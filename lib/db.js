// Neon Postgres connection + one-time table creation (runs automatically on first request).
let q, ready;

async function init(sql) {
  await sql`CREATE TABLE IF NOT EXISTS app_state (id int PRIMARY KEY, data jsonb NOT NULL, version int NOT NULL DEFAULT 0)`;
  await sql`INSERT INTO app_state (id, data) VALUES (1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING`;
  await sql`CREATE TABLE IF NOT EXISTS app_auth (id int PRIMARY KEY, username text NOT NULL, salt text NOT NULL, hash text NOT NULL, created timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS login_attempts (ip text PRIMARY KEY, n int NOT NULL, locked_until timestamptz NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS app_backups (day date PRIMARY KEY, data jsonb NOT NULL)`;
}

export async function sql() {
  if (globalThis.__WRL_SQL) return globalThis.__WRL_SQL;            // used only by the offline test harness
  if (!q) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
    const { neon } = await import('@neondatabase/serverless');
    q = neon(process.env.DATABASE_URL);
  }
  if (!ready) ready = init(q).catch(e => { ready = null; throw e; });
  await ready;
  return q;
}
