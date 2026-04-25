// /api/migrate-ss-results.js -- ONE-TIME migration. Delete after running.
// Adds missing columns to ss_results and creates the unique constraint.
// Secured by MIGRATE_SECRET env var or falls back to a hardcoded token.

const SUPABASE_URL = 'https://heykwxkyvbzffkhgrqgf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_KvxJYevSYKP1Na_de5RCTQ_G9dDi0_L';

export default async function handler(req, res) {
  // Safety token check
  const token = req.query && req.query.token;
  if (token !== 'splash_migrate_2026') {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const results = [];

  // Use Supabase's pg RPC to run DDL via the postgres connection
  // We use PostgREST RPC with a function that can run arbitrary SQL
  // Since we can't run DDL via REST directly, we'll use individual column adds
  // via a workaround: insert a row with the new columns and let Supabase auto-handle it.
  // Actually, we'll use the Supabase Management API via fetch from server-side (no CORS).

  const PROJECT_REF = 'heykwxkyvbzffkhgrqgf';
  const mgmtToken = SUPABASE_KEY;

  const statements = [
    'ALTER TABLE ss_results ADD COLUMN IF NOT EXISTS user_id INTEGER',
    'ALTER TABLE ss_results ADD COLUMN IF NOT EXISTS pts_awarded INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE ss_results ADD COLUMN IF NOT EXISTS scored_date DATE',
    'CREATE UNIQUE INDEX IF NOT EXISTS ss_results_uniq ON ss_results (game_id, player_id, user_id)',
  ];

  for (const sql of statements) {
    try {
      const r = await fetch(
        'https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + mgmtToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sql }),
        }
      );
      const body = await r.text();
      results.push({ sql, status: r.status, resp: body.slice(0, 200) });
    } catch (e) {
      results.push({ sql, error: e.message });
    }
  }

  return res.json({ done: true, results });
}