export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    // ESPN public stats API — no IP restrictions, server-to-server works fine
    // season=2025 = 2024-25 NBA season (ESPN uses end year), seasontype=3 = Playoffs
    const espnUrl =
      'https://site.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/leaders' +
      '?region=us&lang=en&contentorigin=espn&isqualified=true&limit=200&season=2025&seasontype=3';

    const resp = await fetch(espnUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!resp.ok) throw new Error('ESPN returned ' + resp.status);

    const data = await resp.json();
    const categories = data.categories || [];

    // Collect all category names for debug
    const catNames = categories.map(c => c.name);

    // Build per-player lookup from 3PT categories
    const lookup = {}; // name -> {fg3m, fg3a, fg3pct}

    const fill = (cat, field) => {
      if (!cat) return;
      for (const leader of (cat.leaders || [])) {
        const name = leader.athlete?.displayName;
        if (!name) continue;
        if (!lookup[name]) lookup[name] = { fg3m: 0, fg3a: 0, fg3pct: 0 };
        let val = parseFloat(leader.displayValue) || 0;
        // ESPN pct is 0-100 range; convert to 0-1 for NBA API compatibility
        if (field === 'fg3pct' && val > 1) val = val / 100;
        lookup[name][field] = val;
      }
    };

    // Try known ESPN category name variants for 3PM, 3PA, 3P%
    const findCat = (...names) => categories.find(c => names.includes(c.name));
    fill(findCat('threePointFieldGoalsMade','threePointersMade'), 'fg3m');
    fill(findCat('threePointFieldGoalAttempts','threePointFieldGoalsAttempted','threePointersAttempted'), 'fg3a');
    fill(findCat('threePointFieldGoalPct','threePointFieldGoalsPct','threePointersPct','threePointPct'), 'fg3pct');

    // Build NBA Stats API format
    const headers_list = ['PLAYER_NAME', 'FG3M', 'FG3A', 'FG3_PCT'];
    const rowSet = Object.entries(lookup)
      .filter(([, d]) => d.fg3a >= 0.5)
      .map(([name, d]) => [name, d.fg3m, d.fg3a, d.fg3pct]);

    return new Response(JSON.stringify({
      resultSets: [{ name: 'LeagueDashPlayerStats', headers: headers_list, rowSet }],
      _debug: { source: 'espn', catNames, rowCount: rowSet.length }
    }), {
      headers: { ...corsHeaders, 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders
    });
  }
}
