# Well Reach Logistics — Next.js + Neon

Invoices · Quotations · Delivery Notes · Jobs · Accounting.
Login: username **sajid** — you create the password at first logon.

## Deploy (Vercel + Neon)
1. **Neon** (neon.com): create a project, copy the connection string → this is `DATABASE_URL`. Tables are created automatically on the first request.
2. **Secrets**: run `openssl rand -base64 32` twice → `AUTH_SECRET` and `CRON_SECRET`. Choose any text for `SETUP_CODE`.
3. Put this folder in a Git repository (GitHub), then in **Vercel → Add New → Project → import it**. Under *Environment Variables* add `DATABASE_URL`, `AUTH_SECRET`, `SETUP_CODE`, `CRON_SECRET` (see `.env.example`). Deploy.
4. **Domain**: Vercel project → Settings → Domains → add `app.wellreachlogistics.com` (or the bare domain) and create the DNS record Vercel shows you at your registrar. HTTPS is automatic.

## First logon
Open the site → **First logon** screen → username `sajid`, your `SETUP_CODE`, and the password you choose (8+ characters). After that the screen never appears again (the code is then useless; you may delete it from the environment).

## Forgot the password
In the Neon SQL editor run: `DELETE FROM app_auth;` — everyone is signed out and the first-logon screen returns (needs `SETUP_CODE`). Data is untouched.

## Backups
A daily job (`vercel.json`) saves a dated copy of all data in table `app_backups` (30 days). To restore a day:
`UPDATE app_state SET data = (SELECT data FROM app_backups WHERE day = '2026-11-01'), version = version + 1 WHERE id = 1;`
These copies live in the same database, so also keep your own export (Neon dashboard / `pg_dump`) now and then.

## Run on your computer
`npm install`, copy `.env.example` to `.env.local` and fill it in, then `npm run dev` → http://localhost:3000

## How it is organised
- `html/index.html` the app screens (your original UI, unchanged apart from "Sheet" → "Cloud" wording and Sign out) · `html/login.html` login / first logon. `npm run build` bundles both into `lib/pages.js`.
- `public/core.js` all business logic ported from Code.gs (runs on the server; the browser also keeps a copy for offline fallback).
- `app/route.js` serves the app or the login page · `app/api/[fn]` data API · `app/auth/[action]` login · `app/api/cron/backup` backup job.
- `lib/store.js` keeps all company data as one versioned JSON document in Neon; a save only succeeds if nobody else saved in between, otherwise it is repeated on fresh data.
- Security: scrypt password hash · HttpOnly 12 h session cookie · 5 wrong tries = 15 min pause per address · every data endpoint refuses without a session.

## Notes
- Neon's free database pauses when idle, so the first click after a quiet spell can take a few seconds.
- Check Vercel's current terms for commercial use of its free plan before going live.
- Keep dependencies updated (`npm audit`, `npm update`).
