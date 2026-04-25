// /api/fix-rls.js
// One-time RLS setup for the splash-season cron.
// Mode A: GET /api/fix-rls?mgmt_token=SUPABASE_PAT  (get at app.supabase.com/account/tokens)
// Mode B: GET /api/fix-rls?service_key=SERVICE_ROLE_KEY  (saves to Vercel env, cron bypasses RLS)

const SUPABASE_REF = 'heykwxkyvbzffkhgrqgf';
const VERCEL_PROJECT_ID = 'prj_k1gl4THPiNhycfGAxnHRUSsHtYWm';

const SQL = [
  "DO $$v$$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ss_games' AND policyname='anon_update_games') THEN CREATE POLICY anon_update_games ON public.ss_games FOR UPDATE TO anon USING (true) WITH CHECK (true); END IF; END $$v$$",
  "DO $$v$$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ss_players' AND policyname='anon_update_players') THEN CREATE POLICY anon_update_players ON public.ss_players FOR UPDATE TO anon USING (true) WITH CHECK (true); END IF; END $$v$$",
];

export default async function handler(req, res) {
  const { mgmt_token, service_key } = req.query || {};
  if (!mgmt_token && !service_key) {
    return res.status(400).json({ error: 'Provide ?mgmt_token= or ?service_key=', docs: 'See file comments above' });
  }
  const log = [];

  if (service_key) {
    const vt = process.env.VERCEL_ADMIN_TOKEN;
    if (!vt) return res.status(500).json({ error: 'VERCEL_ADMIN_TOKEN env var not set on server' });
    const r = await fetch('https://api.vercel.com/v10/projects/' + VERCEL_PROJECT_ID + '/env', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + vt, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'SUPABASE_SERVICE_KEY', value: service_key, type: 'encrypted', target: ['production'] }),
    });
    const d = await r.json();
    log.push('Vercel env: ' + r.status + (d.error ? ' ' + d.error.message : ' OK, redeploy to activate'));
    return res.json({ success: r.ok, mode: 'service_key', log });
  }

  if (mgmt_token) {
    const results = [];
    for (const query of SQL) {
      const r = await fetch('https://api.supabase.com/v1/projects/' + SUPABASE_REF + '/database/query', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + mgmt_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      results.push({ status: r.status, ok: r.ok });
      log.push('Policy: ' + r.status);
    }
    return res.json({ success: results.every(r => r.ok), mode: 'mgmt_api', results, log });
  }
}