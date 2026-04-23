module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const url = 'https://stats.nba.com/stats/leaguedashplayerstats' +
      '?Season=2024-25&SeasonType=Playoffs&PerMode=PerGame&LeagueID=00';

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.nba.com/',
        'Origin': 'https://www.nba.com'
      }
    });

    if (!response.ok) throw new Error('NBA API ' + response.status);
    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
