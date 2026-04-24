// /api/cron-score.js
// Vercel Cron Job — runs daily at 8:00 AM UTC (4:00 AM ET)
// Scores all picks from the previous night's NBA games.
//
// Idempotency: before touching any game, we check for a
//   __SCORED_GAME_{id}__ notification row.  After scoring, we insert one.
// Points:  star = 1 pt  |  role = 2 pt  |  brick = 3 pt
// Scoring: ≥ 1 three-pointer made = hit.

const SUPABASE_URL = 'https://heykwxkyvbzffkhgrqgf.supabase.co';
// Prefer a service-role key (bypasses RLS) if you add it in Vercel dashboard.
// Falls back to the publishable anon key that already has write access to
// ss_users.total_points and ss_notifications.
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_KvxJYevSYKP1Na_de5RCTQ_G9dDi0_L';

// The live site URL — used to call /api/resolve-scores internally.
const SITE_URL =
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://splash-season.vercel.app';

const TIER_PTS = { star: 1, role: 2, brick: 3 };

// ── Entry point ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ?date=YYYY-MM-DD override for manual back-fills / testing
  const dateET = req.query.date || getYesterdayET();
  console.log(`[cron-score] Running for date: ${dateET}`);

  try {
    const result = await runScoring(dateET);
    return res.status(200).json({ ok: true, date: dateET, ...result });
  } catch (err) {
    console.error('[cron-score] Fatal error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ── Core scoring flow ─────────────────────────────────────────────────────────

async function runScoring(dateET) {
  // 1. Find games on this date
  const games = await sbGet(
    `ss_games?game_date=eq.${dateET}&select=id,home_team,away_team`
  );
  if (!games.length) {
    return { message: `No games found for ${dateET}`, gamesScored: 0, picksAwarded: 0 };
  }

  const gameIds = games.map(g => g.id);
  console.log(`[cron-score] Games: ${gameIds.join(', ')}`);

  // 2. Idempotency — skip games already covered by a lock notification
  const lockRows = await sbGet(
    `ss_notifications?message=like.*__SCORED_GAME_*&select=message`
  );
  const scoredSet = new Set(
    lockRows
      .map(n => {
        const m = n.message?.match(/__SCORED_GAME_(\d+)__/);
        return m ? Number(m[1]) : null;
      })
      .filter(Boolean)
  );

  const pendingIds = gameIds.filter(id => !scoredSet.has(id));
  if (!pendingIds.length) {
    return { message: 'All games already scored', gamesScored: 0, picksAwarded: 0 };
  }
  console.log(`[cron-score] Pending games: ${pendingIds.join(', ')}`);

  // 3. Get 3PT results via /api/resolve-scores (handles both hardcoded & live NBA API)
  let resolveData;
  try {
    const r = await fetch(`${SITE_URL}/api/resolve-scores?date=${dateET}`);
    if (!r.ok) throw new Error(`resolve-scores returned HTTP ${r.status}`);
    resolveData = await r.json();
  } catch (e) {
    console.error('[cron-score] resolve-scores call failed:', e.message);
    resolveData = { players: {} };
  }

  const playerResults = resolveData.players || {};
  console.log(
    `[cron-score] resolve-scores (${resolveData.source || 'unknown'}):` +
    ` ${Object.keys(playerResults).length} players`
  );

  // 4. Fetch all picks for pending games, with player tier
  const picks = await sbGet(
    `ss_picks?game_id=in.(${pendingIds.join(',')})` +
    `&select=id,user_id,game_id,player_id,ss_players(name,tier)`
  );
  console.log(`[cron-score] Picks to evaluate: ${picks.length}`);

  // 5. Admin user id for idempotency lock records
  const admins = await sbGet(`ss_users?is_admin=eq.true&select=id&limit=1`);
  const adminId = admins[0]?.id ?? 1;

  // 6. Award points
  let picksAwarded = 0;
  for (const pick of picks) {
    const playerName = pick.ss_players?.name;
    const tier      = pick.ss_players?.tier;
    if (!playerName || !tier || !TIER_PTS[tier]) continue;

    // Try exact match first, then normalised match
    let result = playerResults[playerName];
    if (!result) {
      const normKey = normName(playerName);
      const found = Object.keys(playerResults).find(k => normName(k) === normKey);
      if (found) result = playerResults[found];
    }

    if (!result?.made3) continue; // miss or no data — no points

    const pts = TIER_PTS[tier];

    // Read-then-write so we don't overwrite concurrent updates
    const [user] = await sbGet(`ss_users?id=eq.${pick.user_id}&select=id,total_points`);
    if (!user) continue;

    await sbPatch(`ss_users?id=eq.${pick.user_id}`, {
      total_points: (user.total_points ?? 0) + pts,
    });

    const tierLabel =
      tier === 'star' ? 'Easy Money' : tier === 'role' ? 'MIDS' : 'Brick City';
    const fg3m = result.fg3m ?? '?';
    await sbPost('ss_notifications', [
      {
        user_id: pick.user_id,
        message:
          `🔥 ${playerName} made ${fg3m} three${fg3m !== 1 ? 's' : ''}! ` +
          `+${pts} pt${pts !== 1 ? 's' : ''} awarded. (${tierLabel})`,
        is_read: false,
      },
    ]);

    picksAwarded++;
    console.log(`[cron-score] +${pts}pt → user ${pick.user_id} | ${playerName} (${fg3m} 3s)`);
  }

  // 7. Insert idempotency lock for every game we just processed
  for (const gid of pendingIds) {
    await sbPost('ss_notifications', [
      {
        user_id: adminId,
        message: `__SCORED_GAME_${gid}__ auto-scored ${new Date().toISOString()}`,
        is_read: true,
      },
    ]);
  }

  return { gamesScored: pendingIds.length, picksAwarded };
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────

function sbHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`sbGet ${path} → ${r.status}: ${t}`);
  }
  const d = await r.json();
  return Array.isArray(d) ? d : [];
}

async function sbPatch(path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    console.error(`[cron-score] PATCH ${path} → ${r.status}: ${t}`);
  }
}

async function sbPost(path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    console.error(`[cron-score] POST ${path} → ${r.status}: ${t}`);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Lowercase, strip punctuation, collapse spaces. */
function normName(n) {
  return n.toLowerCase().replace(/[.']/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Yesterday's date in ET as "YYYY-MM-DD".
 * Cron fires at 08:00 UTC = 04:00 ET, so NBA games from the previous
 * calendar day in ET are guaranteed to be final.
 */
function getYesterdayET() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const y  = parts.find(p => p.type === 'year').value;
  const mo = parts.find(p => p.type === 'month').value;
  const da = parts.find(p => p.type === 'day').value;

  const d = new Date(`${y}-${mo}-${da}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
