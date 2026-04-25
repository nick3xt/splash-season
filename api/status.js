// /api/status.js -- Ops status endpoint
// Returns latest cron run info + game counts + standings
const SUPABASE_URL = 'https://heykwxkyvbzffkhgrqgf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_KvxJYevSYKP1Na_de5RCTQ_G9dDi0_L';

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
  if (!r.ok) { const b = await r.text(); throw new Error(path + ' => ' + r.status + ': ' + b); }
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    // Latest cron log row
    const logs = await sbGet('ss_cron_log?select=*&order=created_at.desc&limit=1');
    const latest = logs[0] || null;

    // Games summary
    const today = new Date().toISOString().slice(0, 10);
    const games = await sbGet('ss_games?select=id,game_date,status');
    const gamesInDB = games.length;
    const upcomingGames = games.filter(g => g.game_date >= today && g.status !== 'final').length;

    // User standings
    const users = await sbGet('ss_users?select=username,nickname,total_points&is_admin=eq.false&order=total_points.desc');

    return res.json({
      lastCronRun: latest ? latest.created_at : null,
      lastCronDate: latest ? latest.run_date : null,
      picksScored: latest ? (latest.scored_count || 0) : 0,
      madeThree: latest ? (latest.made_three_count || 0) : 0,
      espnMismatches: latest ? JSON.parse(latest.mismatches || '[]') : [],
      usersUpdated: latest ? JSON.parse(latest.users_updated || '[]') : [],
      gamesInDB,
      upcomingGames,
      standings: users || []
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
