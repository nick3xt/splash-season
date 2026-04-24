// /api/resolve-scores.js — Vercel serverless function
// Returns NBA per-game 3-pointer results for a given date.
// Called by the frontend autoResolveCompletedGames() to score picks.
//
// GET /api/resolve-scores?date=YYYY-MM-DD
// Response: { players: { "Player Name": { made3: bool, fg3m: number } }, source, date }

// Hardcoded results for known past dates — guarantees retroactive scoring works
// even if the NBA API is unavailable or returns no data.
const KNOWN_RESULTS = {
  '2026-04-23': {
    'Scottie Barnes':  { made3: true,  fg3m: 2 },
    'James Harden':    { made3: true,  fg3m: 1 },
    'OG Anunoby':      { made3: true,  fg3m: 2 },
    'Naz Reid':        { made3: true,  fg3m: 1 },
    'Jamal Murray':    { made3: false, fg3m: 0 },
    'Jalen Johnson':   { made3: true,  fg3m: 1 },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date parameter required in YYYY-MM-DD format' });
  }

  // Return hardcoded results instantly when available (retroactive fix)
  if (KNOWN_RESULTS[date]) {
    return res.json({ players: KNOWN_RESULTS[date], source: 'known', date });
  }

  // Convert YYYY-MM-DD to MM/DD/YYYY for NBA API
  const [y, m, d] = date.split('-');
  const nbaDate = m + '/' + d + '/' + y;

  try {
    const url =
      'https://stats.nba.com/stats/playergamelogs' +
      '?Season=2025-26&SeasonType=Playoffs' +
      '&DateFrom=' + encodeURIComponent(nbaDate) +
      '&DateTo='   + encodeURIComponent(nbaDate) +
      '&LeagueID=00';

    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer':            'https://www.nba.com/',
        'Origin':             'https://www.nba.com',
        'Accept':             'application/json, text/plain, */*',
        'Accept-Language':    'en-US,en;q=0.9',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token':  'true',
      },
    });

    if (!resp.ok) throw new Error('NBA API returned HTTP ' + resp.status);

    const json = await resp.json();
    const rs = json.resultSets && json.resultSets[0];
    if (!rs || !rs.headers || !rs.rowSet) throw new Error('Unexpected NBA API response shape');

    const nameIdx = rs.headers.indexOf('PLAYER_NAME');
    const fg3mIdx = rs.headers.indexOf('FG3M');
    if (nameIdx < 0 || fg3mIdx < 0) throw new Error('Missing columns in NBA response');

    const players = {};
    for (const row of rs.rowSet) {
      const fg3m = row[fg3mIdx] || 0;
      players[row[nameIdx]] = { made3: fg3m > 0, fg3m };
    }

    return res.json({ players, source: 'nba-api', date, count: Object.keys(players).length });

  } catch (e) {
    console.error('[resolve-scores] NBA API error:', e.message);
    return res.status(500).json({ error: e.message, date });
  }
}
