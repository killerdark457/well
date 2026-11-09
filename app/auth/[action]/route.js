// status / me (GET)  ·  setup / login / logout (POST)
import crypto from 'node:crypto';
import { sql } from '../../../lib/db.js';
import { USER, SESSION_S, json, eq, hashPw, getAuth, mkToken, cookie, isAuthed, locked, noteFail, clearFails } from '../../../lib/auth.js';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { action } = await params;
  try {
    if (action === 'status') return json({ user: USER, setup: !(await getAuth()) });
    if (action === 'me') return (await isAuthed(req)) ? json({ user: USER }) : json({ error: 'Not signed in' }, 401);
    return json({ error: 'Not found' }, 404);
  } catch (e) { return json({ error: e.message }, 500); }
}

export async function POST(req, { params }) {
  const { action } = await params;
  if (!/json/.test(req.headers.get('content-type') || '')) return json({ error: 'JSON required' }, 415);
  if (action === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0, req) });
  if (action !== 'setup' && action !== 'login') return json({ error: 'Not found' }, 404);
  try {
    let b = {}; try { b = await req.json(); } catch (e) { b = {}; }
    if (await locked(req)) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
    const bad = async m => { await noteFail(req); return json({ error: m }, 401); };
    const pw = String(b.password || ''), a = await getAuth();

    if (action === 'setup') {
      if (a) return json({ error: 'Password already created. Please sign in.' }, 409);
      const code = process.env.SETUP_CODE;
      if (!code) return json({ error: 'First logon is switched off: set SETUP_CODE in the server environment.' }, 503);
      if (!eq(String(b.code || '').trim().toUpperCase(), code.trim().toUpperCase())) return bad('Setup code is not correct.');
      if (pw.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      const salt = crypto.randomBytes(16).toString('hex'), hash = await hashPw(pw, salt), q = await sql();
      const ins = await q`INSERT INTO app_auth (id, username, salt, hash) VALUES (1, ${USER}, ${salt}, ${hash}) ON CONFLICT (id) DO NOTHING RETURNING id`;
      if (!ins.length) return json({ error: 'Password already created. Please sign in.' }, 409);
      await clearFails(req);
      return json({ ok: true }, 200, { 'Set-Cookie': cookie(mkToken({ hash }), SESSION_S, req) });
    }

    if (!a) return json({ error: 'First logon has not been done yet.' }, 409);
    const good = await hashPw(pw, a.salt);            // always computed: same timing whether or not the username is right
    if (!eq(String(b.username || '').trim().toLowerCase(), USER) || !eq(good, a.hash)) return bad('Wrong username or password.');
    await clearFails(req);
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(mkToken(a), SESSION_S, req) });
  } catch (e) { return json({ error: e.message }, 500); }
}
