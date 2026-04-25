// /api/cron-score.js -- Vercel Cron Job
// Fires daily at 09:00 UTC (2:00 AM PT).
// Fully idempotent, no locks, no hardcoded data.
// REQUIRED ALTER TABLE before first run:
// ALTER TABLE ss_results ADD COLUMN IF NOT EXISTS user_id INTEGER;
// ALTER TABLE ss_results ADD COLUMN IF NOT EXISTS pts_awarded INTEGER NOT NULL DEFAULT 0;
// ALTER TABLE ss_results ADD COLUMN IF NOT EXISTS scored_date DATE;
// CREATE UNIQUE INDEX IF NOT EXISTS ss_results_uniq ON ss_results (game_id, player_id, user_id);
const SUPABASE_URL = 'https://heykwxkyvbzffkhgrqgf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_KvxJYevSYKP1Na_de5RCTQ_G9dDi0_L';
function getSiteUrl() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) { return 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL; }
  if (process.env.VERCEL_URL) { return 'https://' + process.env.VERCEL_URL; }
  return 'https://splash-season.vercel.app';
}
function tierPts(tier) {
  const t = String(tier || '').toLowerCase().trim();
  if (t === 'star' || t === '1') return 1;
  if (t === 'role' || t === '2') return 2;
  if (t === 'brick' || t === '3') return 3;
  return 0;
}
// Alias map: normalized ss_players name -> normalized ESPN name
const NAME_ALIASES = {
  'brice scheierman': 'baylor scheierman',
};
function normName(s) {
  const n = String(s || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return NAME_ALIASES[n] || n;
}
function sbHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}
async function sbGet(path) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: sbHeaders() });
  if (!r.ok) { const body = await r.text(); throw new Error('sbGet /' + path + ' => ' + r.status + ': ' + body); }
  return r.json();
}
async function sbUpsert(table, rows, conflictCols) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?on_conflict=' + conflictCols, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) { const body = await r.text(); throw new Error('sbUpsert ' + table + ' => ' + r.status + ': ' + body); }
  return r.json();
}
async function sbPatch(table, filter, body) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const text = await r.text(); throw new Error('sbPatch ' + table + '?' + filter + ' => ' + r.status + ': ' + text); }
}
export default async function handler(req, res) {
  const log = [];
  try {
    const nowPT = new Date(Date.now() - 7 * 60 * 60 * 1000);
    nowPT.setDate(nowPT.getDate() - 1);
    const targetDate = nowPT.toISOString().slice(0, 10);
    const scoringDate = (req.query && req.query.date) ? req.query.date : targetDate;
    log.push('Scoring date: ' + scoringDate);
    const SITE_URL = getSiteUrl();
    const resolveUrl = SITE_URL + '/api/resolve-scores?date=' + scoringDate;
    log.push('Fetching ESPN data: ' + resolveUrl);
    const resolveRes = await fetch(resolveUrl);
    if (!resolveRes.ok) throw new Error('resolve-scores HTTP ' + resolveRes.status);
    const resolveData = await resolveRes.json();
    const espnPlayers = resolveData.players || {};
    const gamesCompleted = resolveData.gamesCompleted || 0;
    log.push('ESPN: ' + resolveData.gamesFound + ' games, ' + gamesCompleted + ' completed, ' + resolveData.playerCount + ' players with 3PT attempts');
    if (gamesCompleted === 0) {
      return res.json({ success: true, message: 'No completed ESPN games for ' + scoringDate, scoringDate, scored: 0, log });
    }
    const espnByNorm = {};
    for (const [name, data] of Object.entries(espnPlayers)) {
      espnByNorm[normName(name)] = { ...data, originalName: name };
    }
    const games = await sbGet('ss_games?select=id,game_date,home_team,away_team,status&game_date=eq.' + scoringDate);
    log.push('ss_games: ' + games.length + ' games');
    if (games.length === 0) {
      return res.json({ success: true, message: 'No ss_games for ' + scoringDate, scoringDate, scored: 0, log });
    }
    const gameIds = games.map(g => g.id);
    const picksRaw = await sbGet('ss_picks?select=id,game_id,player_id,user_id,team_side&game_id=in.(' + gameIds.join(',') + ')');
    log.push('ss_picks: ' + picksRaw.length + ' picks');
    if (picksRaw.length === 0) {
      return res.json({ success: true, message: 'No picks for ' + scoringDate, scoringDate, scored: 0, log });
    }
    const playerIds = [...new Set(picksRaw.map(p => p.player_id))];
    const playersData = await sbGet('ss_players?select=id,name,tier&id=in.(' + playerIds.join(',') + ')');
    const playerMap = {};
    for (const p of playersData) playerMap[p.id] = p;
    const upsertRows = [];
    const affectedUsers = new Set();
    const matchLog = [];
    for (const pick of picksRaw) {
      const player = playerMap[pick.player_id];
      if (!player) { matchLog.push('WARN: player_id ' + pick.player_id + ' not in ss_players'); continue; }
      const norm = normName(player.name);
      const espnMatch = espnByNorm[norm];
      const made_three = !!(espnMatch && espnMatch.fg3m > 0);
      const pts_awarded = made_three ? tierPts(player.tier) : 0;
      matchLog.push(player.name + ' (' + player.tier + ') norm=' + norm + ' => ' + (espnMatch ? 'matched:' + espnMatch.originalName + ' fg3m=' + espnMatch.fg3m + ' pts=' + pts_awarded : 'NO MATCH'));
      upsertRows.push({ game_id: pick.game_id, player_id: pick.player_id, user_id: pick.user_id, made_three, pts_awarded, scored_date: scoringDate });
      affectedUsers.add(pick.user_id);
    }
    log.push('Scored ' + upsertRows.length + ' picks, ' + upsertRows.filter(r => r.made_three).length + ' made threes');
    if (upsertRows.length > 0) {
      await sbUpsert('ss_results', upsertRows, 'game_id,player_id,user_id');
      log.push('Upserted ' + upsertRows.length + ' rows into ss_results');
    }
    await sbPatch('ss_games', 'game_date=eq.' + scoringDate, { status: 'final', is_locked: true });
    log.push('Marked ' + games.length + ' ss_games as final');
    const pointsUpdated = [];
    for (const userId of affectedUsers) {
      const rows = await sbGet('ss_results?select=pts_awarded&user_id=eq.' + userId + '&made_three=eq.true');
      const totalPoints = rows.reduce((sum, r) => sum + (r.pts_awarded || 0), 0);
      await sbPatch('ss_users', 'id=eq.' + userId, { total_points: totalPoints });
      pointsUpdated.push({ userId, totalPoints });
    }
    log.push('Updated total_points for ' + pointsUpdated.length + ' users');
    return res.json({ success: true, scoringDate, gamesCompleted, picksScored: upsertRows.length, madeThree: upsertRows.filter(r => r.made_three).length, usersUpdated: pointsUpdated, matchLog, log });
  } catch (err) {
    console.error('[cron-score] error:', err.message);
    return res.status(500).json({ error: err.message, log });
  }
}