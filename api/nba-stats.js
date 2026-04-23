export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);

  try {
    const nbaUrl = 'https://stats.nba.com/stats/leaguedashplayerstats' +
      '?Season=2024-25&SeasonType=Playoffs&PerMode=PerGame&LeagueID=00';

    const resp = await fetch(nbaUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Origin': 'https://www.nba.com',
        'Referer': 'https://www.nba.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
        'Connection': 'keep-alive',
      }
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const body = await resp.text();
      return new Response(JSON.stringify({
        error: 'NBA API ' + resp.status,
        detail: body.substring(0, 300)
      }), { status: 502, headers: corsHeaders });
    }

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' }
    });

  } catch (err) {
    clearTimeout(timer);
    return new Response(JSON.stringify({
      error: err.name === 'AbortError' ? 'NBA API timeout after 22s' : err.message
    }), { status: 500, headers: corsHeaders });
  }
}
