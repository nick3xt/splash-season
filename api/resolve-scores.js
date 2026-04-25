// /api/resolve-scores.js — Vercel serverless function
// Returns NBA per-game 3-pointer results for a given date.
// Called by cron-score.js to score picks.
//
// GET /api/resolve-scores?date=YYYY-MM-DD
// Response: { players: { "Player Name": { made3: bool, fg3m: number } }, source, date }
//
// Primary data source: ESPN public API (reliable from serverless)
// Fallback: KNOWN_RESULTS hardcoded below (covers all played 2026 playoff dates)

const KNOWN_RESULTS = {
  '2026-04-18': {
    'RJ Barrett': {made3:true,fg3m:3},'Scottie Barnes': {made3:true,fg3m:3},'Jamal Shead': {made3:true,fg3m:5},
    'Sandro Mamukelashvili': {made3:true,fg3m:1},"Ja'Kobe Walter": {made3:true,fg3m:1},'Dean Wade': {made3:true,fg3m:1},
    'Evan Mobley': {made3:true,fg3m:1},'James Harden': {made3:true,fg3m:4},'Donovan Mitchell': {made3:true,fg3m:4},
    'Max Strus': {made3:true,fg3m:4},'Sam Merrill': {made3:true,fg3m:1},'Keon Ellis': {made3:true,fg3m:1},
    'Donte DiVincenzo': {made3:true,fg3m:4},'Anthony Edwards': {made3:true,fg3m:2},'Naz Reid': {made3:true,fg3m:1},
    'Mike Conley': {made3:true,fg3m:1},'Ayo Dosunmu': {made3:true,fg3m:3},'Aaron Gordon': {made3:true,fg3m:1},
    'Cameron Johnson': {made3:true,fg3m:2},'Nikola Jokic': {made3:true,fg3m:2},'Christian Braun': {made3:true,fg3m:2},
    'Spencer Jones': {made3:true,fg3m:1},'Tim Hardaway Jr.': {made3:true,fg3m:1},'Bruce Brown': {made3:true,fg3m:1},
    'Onyeka Okongwu': {made3:true,fg3m:4},'Jalen Johnson': {made3:true,fg3m:3},'CJ McCollum': {made3:true,fg3m:4},
    'Nickeil Alexander-Walker': {made3:true,fg3m:3},'OG Anunoby': {made3:true,fg3m:2},'Karl-Anthony Towns': {made3:true,fg3m:3},
    'Mikal Bridges': {made3:true,fg3m:1},'Jalen Brunson': {made3:true,fg3m:3},'Landry Shamet': {made3:true,fg3m:1},
    'Miles McBride': {made3:true,fg3m:2},'Jabari Smith Jr.': {made3:true,fg3m:3},'Josh Okogie': {made3:true,fg3m:1},
    'Reed Sheppard': {made3:true,fg3m:5},'Tari Eason': {made3:true,fg3m:2},'LeBron James': {made3:true,fg3m:1},
    'Rui Hachimura': {made3:true,fg3m:2},'Marcus Smart': {made3:true,fg3m:1},'Luke Kennard': {made3:true,fg3m:5},
    'Jarred Vanderbilt': {made3:true,fg3m:1},
  },
  '2026-04-19': {
    'Paul George': {made3:true,fg3m:1},'Tyrese Maxey': {made3:true,fg3m:1},'Justin Edwards': {made3:true,fg3m:1},
    'Quentin Grimes': {made3:true,fg3m:1},'Jayson Tatum': {made3:true,fg3m:1},'Sam Hauser': {made3:true,fg3m:4},
    'Derrick White': {made3:true,fg3m:2},'Jaylen Brown': {made3:true,fg3m:2},'Nikola Vucevic': {made3:true,fg3m:1},
    'Luka Garza': {made3:true,fg3m:1},'Payton Pritchard': {made3:true,fg3m:2},'Ron Harper Jr.': {made3:true,fg3m:1},
    'Brice Scheierman': {made3:true,fg3m:1},'Jordan Walsh': {made3:true,fg3m:1},'Dillon Brooks': {made3:true,fg3m:3},
    'Devin Booker': {made3:true,fg3m:2},'Jalen Green': {made3:true,fg3m:2},"Royce O'Neale": {made3:true,fg3m:1},
    'Rasheer Fleming': {made3:true,fg3m:3},'Collin Gillespie': {made3:true,fg3m:2},'Chet Holmgren': {made3:true,fg3m:2},
    'Luguentz Dort': {made3:true,fg3m:2},'Jalen Williams': {made3:true,fg3m:2},'Jaylin Williams': {made3:true,fg3m:1},
    'Isaiah Joe': {made3:true,fg3m:3},'Jared McCain': {made3:true,fg3m:1},'Ajay Mitchell': {made3:true,fg3m:3},
    'Paolo Banchero': {made3:true,fg3m:2},'Franz Wagner': {made3:true,fg3m:1},'Wendell Carter Jr.': {made3:true,fg3m:1},
    'Desmond Bane': {made3:true,fg3m:1},'Jalen Suggs': {made3:true,fg3m:3},'Tristan da Silva': {made3:true,fg3m:1},
    'Anthony Black': {made3:true,fg3m:1},'Tobias Harris': {made3:true,fg3m:1},'Duncan Robinson': {made3:true,fg3m:3},
    'Cade Cunningham': {made3:true,fg3m:3},'Caris LeVert': {made3:true,fg3m:1},'Kevin Huerter': {made3:true,fg3m:1},
    'Daniss Jenkins': {made3:true,fg3m:1},'Toumani Camara': {made3:true,fg3m:2},'Deni Avdija': {made3:true,fg3m:2},
    'Jrue Holiday': {made3:true,fg3m:1},'Scoot Henderson': {made3:true,fg3m:2},'Jerami Grant': {made3:true,fg3m:1},
    'Robert Williams III': {made3:true,fg3m:1},'Matisse Thybulle': {made3:true,fg3m:1},'Julian Champagnie': {made3:true,fg3m:2},
    'Victor Wembanyama': {made3:true,fg3m:5},"De'Aaron Fox": {made3:true,fg3m:2},'Devin Vassell': {made3:true,fg3m:4},
    'Stephon Castle': {made3:true,fg3m:1},'Keldon Johnson': {made3:true,fg3m:1},
  },
  '2026-04-20': {
    'Brandon Ingram': {made3:true,fg3m:1},'Scottie Barnes': {made3:true,fg3m:1},'Jamal Shead': {made3:true,fg3m:1},
    'Sandro Mamukelashvili': {made3:true,fg3m:1},"Ja'Kobe Walter": {made3:true,fg3m:3},'Dean Wade': {made3:true,fg3m:1},
    'Evan Mobley': {made3:true,fg3m:1},'James Harden': {made3:true,fg3m:3},'Donovan Mitchell': {made3:true,fg3m:4},
    'Max Strus': {made3:true,fg3m:2},'Sam Merrill': {made3:true,fg3m:1},'Jaylon Tyson': {made3:true,fg3m:1},
    'Onyeka Okongwu': {made3:true,fg3m:2},'CJ McCollum': {made3:true,fg3m:3},'Nickeil Alexander-Walker': {made3:true,fg3m:2},
    'Jonathan Kuminga': {made3:true,fg3m:1},'Gabe Vincent': {made3:true,fg3m:1},'OG Anunoby': {made3:true,fg3m:2},
    'Karl-Anthony Towns': {made3:true,fg3m:2},'Josh Hart': {made3:true,fg3m:1},'Mikal Bridges': {made3:true,fg3m:2},
    'Jalen Brunson': {made3:true,fg3m:4},'Julius Randle': {made3:true,fg3m:2},'Donte DiVincenzo': {made3:true,fg3m:4},
    'Anthony Edwards': {made3:true,fg3m:3},'Naz Reid': {made3:true,fg3m:1},'Ayo Dosunmu': {made3:true,fg3m:1},
    'Bones Hyland': {made3:true,fg3m:3},'Aaron Gordon': {made3:true,fg3m:1},'Cameron Johnson': {made3:true,fg3m:1},
    'Nikola Jokic': {made3:true,fg3m:1},'Jamal Murray': {made3:true,fg3m:6},'Christian Braun': {made3:true,fg3m:1},
    'Tim Hardaway Jr.': {made3:true,fg3m:3},'Bruce Brown': {made3:true,fg3m:2},
  },
  '2026-04-21': {
    'Paul George': {made3:true,fg3m:2},'Kelly Oubre Jr.': {made3:true,fg3m:2},'Tyrese Maxey': {made3:true,fg3m:5},
    'VJ Edgecombe': {made3:true,fg3m:6},'Justin Edwards': {made3:true,fg3m:1},'Andre Drummond': {made3:true,fg3m:1},
    'Quentin Grimes': {made3:true,fg3m:2},'Jayson Tatum': {made3:true,fg3m:2},'Sam Hauser': {made3:true,fg3m:2},
    'Derrick White': {made3:true,fg3m:2},'Jaylen Brown': {made3:true,fg3m:5},'Nikola Vucevic': {made3:true,fg3m:1},
    'Brice Scheierman': {made3:true,fg3m:1},'Toumani Camara': {made3:true,fg3m:2},'Deni Avdija': {made3:true,fg3m:1},
    'Donovan Clingan': {made3:true,fg3m:1},'Jrue Holiday': {made3:true,fg3m:2},'Scoot Henderson': {made3:true,fg3m:5},
    'Robert Williams III': {made3:true,fg3m:1},'Shaedon Sharpe': {made3:true,fg3m:1},'Julian Champagnie': {made3:true,fg3m:2},
    "De'Aaron Fox": {made3:true,fg3m:1},'Stephon Castle': {made3:true,fg3m:2},'Keldon Johnson': {made3:true,fg3m:1},
    'Carter Bryant': {made3:true,fg3m:1},'Kevin Durant': {made3:true,fg3m:1},'Jabari Smith Jr.': {made3:true,fg3m:3},
    'Josh Okogie': {made3:true,fg3m:1},'Tari Eason': {made3:true,fg3m:2},'LeBron James': {made3:true,fg3m:2},
    'Rui Hachimura': {made3:true,fg3m:3},'Marcus Smart': {made3:true,fg3m:5},'Luke Kennard': {made3:true,fg3m:3},
  },
  '2026-04-22': {
    'Desmond Bane': {made3:true,fg3m:2},'Jalen Suggs': {made3:true,fg3m:3},'Tristan da Silva': {made3:true,fg3m:1},
    'Jase Richardson': {made3:true,fg3m:2},'Duncan Robinson': {made3:true,fg3m:3},'Cade Cunningham': {made3:true,fg3m:1},
    'Isaiah Stewart': {made3:true,fg3m:1},'Kevin Huerter': {made3:true,fg3m:1},'Dillon Brooks': {made3:true,fg3m:5},
    'Collin Gillespie': {made3:true,fg3m:1},'Jalen Green': {made3:true,fg3m:1},"Royce O'Neale": {made3:true,fg3m:4},
    'Chet Holmgren': {made3:true,fg3m:3},'Shai Gilgeous-Alexander': {made3:true,fg3m:2},'Luguentz Dort': {made3:true,fg3m:3},
    'Jalen Williams': {made3:true,fg3m:2},'Alex Caruso': {made3:true,fg3m:1},'Isaiah Joe': {made3:true,fg3m:2},
    'Ajay Mitchell': {made3:true,fg3m:1},
  },
  '2026-04-23': {
    'OG Anunoby': {made3:true,fg3m:4},'Karl-Anthony Towns': {made3:true,fg3m:1},'Miles McBride': {made3:true,fg3m:5},
    'Onyeka Okongwu': {made3:true,fg3m:1},'Jalen Johnson': {made3:true,fg3m:2},'CJ McCollum': {made3:true,fg3m:2},
    'Nickeil Alexander-Walker': {made3:true,fg3m:3},'Dyson Daniels': {made3:true,fg3m:1},'Jonathan Kuminga': {made3:true,fg3m:2},
    'Mouhamed Gueye': {made3:true,fg3m:1},'Gabe Vincent': {made3:true,fg3m:1},'Dean Wade': {made3:true,fg3m:1},
    'James Harden': {made3:true,fg3m:3},'Donovan Mitchell': {made3:true,fg3m:1},'Dennis Schroder': {made3:true,fg3m:1},
    'Max Strus': {made3:true,fg3m:4},'Sam Merrill': {made3:true,fg3m:1},'Jaylon Tyson': {made3:true,fg3m:3},
    'Brandon Ingram': {made3:true,fg3m:1},'RJ Barrett': {made3:true,fg3m:6},'Scottie Barnes': {made3:true,fg3m:3},
    'Jamison Battle': {made3:true,fg3m:4},'Spencer Jones': {made3:true,fg3m:2},'Nikola Jokic': {made3:true,fg3m:2},
    'Zeke Nnaji': {made3:true,fg3m:1},'Tim Hardaway Jr.': {made3:true,fg3m:2},'Julian Strawther': {made3:true,fg3m:1},
    'Jaden McDaniels': {made3:true,fg3m:1},'Donte DiVincenzo': {made3:true,fg3m:3},'Anthony Edwards': {made3:true,fg3m:2},
    'Naz Reid': {made3:true,fg3m:1},'Bones Hyland': {made3:true,fg3m:2},
  },
  '2026-04-24': {
    'Jayson Tatum': {made3:true,fg3m:5},'Sam Hauser': {made3:true,fg3m:2},'Derrick White': {made3:true,fg3m:1},
    'Jaylen Brown': {made3:true,fg3m:1},'Nikola Vucevic': {made3:true,fg3m:3},'Luka Garza': {made3:true,fg3m:1},
    'Payton Pritchard': {made3:true,fg3m:5},'Brice Scheierman': {made3:true,fg3m:2},'Paul George': {made3:true,fg3m:4},
    'Kelly Oubre Jr.': {made3:true,fg3m:1},'Tyrese Maxey': {made3:true,fg3m:5},'Andre Drummond': {made3:true,fg3m:2},
    'LeBron James': {made3:true,fg3m:4},'Rui Hachimura': {made3:true,fg3m:4},'Marcus Smart': {made3:true,fg3m:2},
    'Luke Kennard': {made3:true,fg3m:1},'Bronny James': {made3:true,fg3m:1},'Jabari Smith Jr.': {made3:true,fg3m:6},
    'Alperen Sengun': {made3:true,fg3m:1},'Reed Sheppard': {made3:true,fg3m:4},'Julian Champagnie': {made3:true,fg3m:2},
    'Luke Kornet': {made3:true,fg3m:1},"De'Aaron Fox": {made3:true,fg3m:1},'Devin Vassell': {made3:true,fg3m:3},
    'Stephon Castle': {made3:true,fg3m:3},'Keldon Johnson': {made3:true,fg3m:1},'Carter Bryant': {made3:true,fg3m:1},
    'Dylan Harper': {made3:true,fg3m:4},'Deni Avdija': {made3:true,fg3m:1},'Donovan Clingan': {made3:true,fg3m:1},
    'Jrue Holiday': {made3:true,fg3m:5},'Scoot Henderson': {made3:true,fg3m:5},'Jerami Grant': {made3:true,fg3m:2},
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

  // Return hardcoded results instantly when available
  if (KNOWN_RESULTS[date]) {
    return res.json({ players: KNOWN_RESULTS[date], source: 'known', date });
  }

  // Convert YYYY-MM-DD to YYYYMMDD for ESPN API
  const espnDate = date.replace(/-/g, '');

  try {
    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 8000);
    const boardRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${espnDate}&seasontype=3`,
      { signal: ctrl1.signal }
    );
    clearTimeout(t1);
    if (!boardRes.ok) throw new Error('ESPN scoreboard returned HTTP ' + boardRes.status);
    const boardJson = await boardRes.json();
    const events = boardJson.events || [];
    if (!events.length) return res.json({ players: {}, source: 'espn-no-games', date, count: 0 });

    const players = {};
    await Promise.all(events.map(async event => {
      try {
        const ctrl2 = new AbortController();
        const t2 = setTimeout(() => ctrl2.abort(), 8000);
        const summaryRes = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${event.id}`,
          { signal: ctrl2.signal }
        );
        clearTimeout(t2);
        if (!summaryRes.ok) return;
        const summaryJson = await summaryRes.json();
        summaryJson.boxscore?.players?.forEach(team => {
          team.statistics?.forEach(statBlock => {
            const labels = statBlock.labels || [];
            const idx3pt = labels.indexOf('3PT');
            if (idx3pt < 0) return;
            statBlock.athletes?.forEach(athlete => {
              const name = athlete.athlete?.displayName;
              const stats = athlete.stats || [];
              const fg3m = parseInt((stats[idx3pt] || '0-0').split('-')[0]) || 0;
              if (name) players[name] = { made3: fg3m > 0, fg3m };
            });
          });
        });
      } catch (e) { console.warn('[resolve-scores] event', event.id, e.message); }
    }));

    return res.json({ players, source: 'espn-api', date, count: Object.keys(players).length });
  } catch (e) {
    console.error('[resolve-scores] ESPN API error:', e.message);
    return res.status(500).json({ error: e.message, date });
  }
}