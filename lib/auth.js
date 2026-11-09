import crypto from 'node:crypto';
import { sql } from './db.js';

export const USER = 'sajid';
export const SESSION_S = 12 * 3600;

export const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('AUTH_SECRET is not set (use at least 16 random characters).');
  return s;
}
const sign = s => crypto.createHmac('sha256', secret()).update(s).digest('base64url');
export const eq = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
export const hashPw = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? no(e) : ok(k.toString('hex')))));

export async function getAuth() {
  const q = await sql();
  return (await q`SELECT username, salt, hash FROM app_auth WHERE id = 1`)[0] || null;
}
export function mkToken(a) {      // tied to the password hash: changing/resetting the password signs everyone out
  const b = (Date.now() + SESSION_S * 1000).toString(36) + '.' + crypto.randomBytes(8).toString('hex');
  return b + '.' + sign(b + a.hash.slice(0, 16));
}
export function cookie(v, age, req) {
  const secure = process.env.NODE_ENV === 'production' || req.headers.get('x-forwarded-proto') === 'https';
  return `wrl_sid=${v}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
}
export async function isAuthed(req) {
  const t = ((req.headers.get('cookie') || '').match(/(?:^|;\s*)wrl_sid=([^;]+)/) || [])[1];
  const p = String(t || '').split('.');
  if (p.length !== 3) return false;
  const a = await getAuth();
  return !!a && eq(p[2], sign(p[0] + '.' + p[1] + a.hash.slice(0, 16))) && parseInt(p[0], 36) > Date.now();
}

/* 5 wrong tries from one address = 15 minute pause (kept in the database, so it works across servers) */
const ipOf = req => (req.headers.get('x-real-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown').trim();
export async function locked(req) {
  const q = await sql();
  return (await q`SELECT 1 FROM login_attempts WHERE ip = ${ipOf(req)} AND n >= 5 AND locked_until > now()`).length > 0;
}
export async function noteFail(req) {
  const q = await sql();
  await q`INSERT INTO login_attempts (ip, n, locked_until) VALUES (${ipOf(req)}, 1, now() + interval '15 minutes')
          ON CONFLICT (ip) DO UPDATE SET n = CASE WHEN login_attempts.locked_until > now() THEN login_attempts.n + 1 ELSE 1 END, locked_until = now() + interval '15 minutes'`;
}
export async function clearFails(req) {
  const q = await sql();
  await q`DELETE FROM login_attempts WHERE ip = ${ipOf(req)}`;
}
