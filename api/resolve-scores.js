// /api/resolve-scores.js — Vercel serverless function
// Fully automatic ESPN-based 3PT scoring. No hardcoded data.
//
// GET /api/resolve-scores?date=YYYY-MM-DD
//   date defaults to yesterday PT (UTC-7) if omitted.
//
// Response:
//   {
//     players: { "Player Name": { fg3m: N, team: "ABC" } },
//     date: "YYYY-MM-DD",
//     source: "espn",
//     gamesFound: N,
//     gamesCompleted: N
//   }
//
// players includes every player who attempted >=1 three on that date.
// fg3m is 0 if they attempted but missed all.

export default async function handler(req, res) {
  try {
    // 1. Resolve target date -- default to yesterday in PT (UTC-7)
    let dateStr = (req.query && req.query.date) ? req.query.date : null;
    if (!dateStr) {
      const nowPT = new Date(Date.now() - 7 * 60 * 60 * 1000);
      nowPT.setDate(nowPT.getDate() - 1);
      dateStr = nowPT.toISOString().slice(0, 10); // YYYY-MM-DD
    }

    // Validate format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD', got: dateStr });
    }

    // 2. Convert to ESPN format: YYYYMMDD
    const espnDate = dateStr.replace(/-/g, '');

    // 3. Fetch ESPN scoreboard -- try playoffs (seasontype=3) then regular season (seasontype=2)
    let events = [];
    let seasonTypeUsed = null;
    for (const seasontype of [3, 2]) {
      const sbUrl =
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard` +
        `?dates=${espnDate}&seasontype=${seasontype}`;
      const sbRes = await fetch(sbUrl);
      if (!sbRes.ok) continue;
      const sbData = await sbRes.json();
      const found = sbData.events || [];
      if (found.length > 0) {
        events = found;
        seasonTypeUsed = seasontype;
        break;
      }
    }

    const players = {};
    let gamesCompleted = 0;
    const errors = [];

    // 4. For each completed game, fetch box score summary
    for (const event of events) {
      const completed = event.status?.type?.completed === true;
      if (!completed) continue;
      gamesCompleted++;

      const gameId = event.id;
      try {
        const sumUrl =
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
        const sumRes = await fetch(sumUrl);
        if (!sumRes.ok) {
          errors.push(`summary ${gameId}: HTTP ${sumRes.status}`);
          continue;
        }
        const sumData = await sumRes.json();

        // 5. Parse box score -- ESPN structure:
        //    boxscore.players[i].team.abbreviation
        //    boxscore.players[i].statistics[0].labels  -> ["MIN","PTS","FG","3PT",...]
        //    boxscore.players[i].statistics[0].athletes[j].athlete.displayName
        //    boxscore.players[i].statistics[0].athletes[j].stats[labelIndex]  -> "2-7"
        const boxTeams = sumData.boxscore?.players || [];
        for (const teamGroup of boxTeams) {
          const teamAbbrev = teamGroup.team?.abbreviation || '';
          const stats = teamGroup.statistics?.[0];
          if (!stats) continue;

          const labels = stats.labels || [];
          const idx3PT = labels.indexOf('3PT');
          if (idx3PT === -1) continue;

          for (const athlete of stats.athletes || []) {
            const name = athlete.athlete?.displayName || '';
            if (!name) continue;

            const statStr = athlete.stats?.[idx3PT] || '';
            if (!statStr || !statStr.includes('-')) continue;

            const parts = statStr.split('-');
            const made = parseInt(parts[0], 10) || 0;
            const attempted = parseInt(parts[1], 10) || 0;

            // Include any player who attempted at least one 3-pointer
            if (attempted > 0) {
              players[name] = { fg3m: made, team: teamAbbrev };
            }
          }
        }
      } catch (e) {
        errors.push(`summary ${gameId}: ${e.message}`);
      }
    }

    return res.json({
      players,
      date: dateStr,
      source: 'espn',
      seasonTypeUsed,
      gamesFound: events.length,
      gamesCompleted,
      playerCount: Object.keys(players).length,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err) {
    console.error('[resolve-scores] fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
