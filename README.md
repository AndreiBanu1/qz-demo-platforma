# Bucla Verde

[![planted bugs caught](https://img.shields.io/endpoint?url=https://andreibanu1.github.io/qz-demo-platforma/bugs-caught.json)](https://andreibanu1.github.io/qz-demo-platforma/)

Bucla Verde is a **fictional** hair and beauty salon with online booking. It is a demo built by
[Quality Zone](https://qualityzone.netlify.app) as a target for testing on the Quality Zone TikTok channel:
failed logins, error messages, accessibility, booking rules and planted bugs. No real business uses this site,
every account on it is a demo account, and every page says „Site demonstrativ realizat de Quality Zone”.

- **Live demo:** https://bucla-verde-demo.andreibanu97.workers.dev (reset every night at 01:00 UTC)
- **Test report:** https://andreibanu1.github.io/qz-demo-platforma/ (published by CI)
- **Planted bugs:** [docs/bugs.md](docs/bugs.md)

The demo accounts and their passwords are printed on the site's login page.

## What it does

Clients browse six services and three stylists, pick a free slot, hold it for 10 minutes and pay a deposit
(30% of the price, at least 20 lei) with a simulated card form or Stripe Checkout in test mode. The salon admin
sees every booking for a day and can block time. The salon is open Monday to Saturday, 09:00–19:00
(Europe/Bucharest), and a service must end by closing.

Stack: a Hono API and a React + Tailwind single-page app on Cloudflare Workers, with D1 (SQLite) for data and a
cron trigger for the nightly reset. Tests: Vitest (unit and Workers pool), Playwright (desktop, iPhone 15 and the
bug-catcher), axe-core for accessibility.

## Run it locally

Needs Node 26 (see `.nvmrc`).

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run db:reset
npm run build
npm run dev
```

The app runs at http://127.0.0.1:8787. The values in `.dev.vars.example` are public, local-only test values; the
deployed Worker uses its own secrets.

Tests:

```bash
npm run test:unit
npm run test:worker
npm run test:e2e
```

`npm run test:e2e` starts its own Worker on 127.0.0.1:8787 with a fixed clock and resets the database first.

To count the planted bugs the suite catches:

```bash
mkdir -p report && npx playwright test --project=bug-catcher --reporter=json > report/bug-catcher.json; node scripts/bug-summary.ts
```

It writes `report/bugs-caught.json` and exits with an error unless all six are caught.

Load test with [k6](https://k6.io), against the local copy only (the script refuses any other host). Start
`npm run start:test` in one terminal, then:

```bash
k6 run -e TARGET=http://127.0.0.1:8787 tests/load/booking-day.js
```

It resets the local database, runs 20 users booking and paying for 60 s plus 20 users racing for one slot, and
fails unless exactly one racer wins, under 1% of requests fail, slot lists stay under 800 ms at p95 and no stylist
ends up double-booked.

CI (`.github/workflows/ci.yml`) runs all of the above except k6 on every push and pull request, publishes the
report to GitHub Pages and, on `main`, deploys to Cloudflare and runs the smoke test. A weekly workflow runs a 20 s
k6 pass against a local copy inside the runner.

Smoke test of the deployed copy (four low-volume checks):

```bash
npm run test:smoke
```

## Planted bugs

Six bugs ship on purpose, each off by default. `?bugs=<id>` turns one on for your browser session only, and a red
strip names every active bug. `?bugs=off` turns them off. The full list, with the file each one lives in and the
test that catches it, is in [docs/bugs.md](docs/bugs.md): `slow-login`, `login-enumeration`,
`booking-past-closing`, `a11y-gap`, `leaky-errors`, `idor-booking`.

## Safety

- **One allowlist.** `config/hosts.json` lists the only hosts the tests may target: `127.0.0.1`, `localhost` and
  the public demo host. Any other target stops the run with an error.
- **Heavy tests stay local.** Brute-force, cool-down, timing and load tests refuse every host except `127.0.0.1`
  and `localhost`. Against the public host Playwright runs only `tests/smoke`.
- **No bypassing.** Nothing here solves or gets around a CAPTCHA, bot check or rate limit, on this site or any
  other, Cloudflare's own protection included.
- **Payments are test-only.** Automated runs use the simulated provider. A Stripe key containing `_live_` stops
  the Worker.
- **Only our own sites.** Security and load tests in Quality Zone videos run against our own demos, never against
  someone else's site.

## Known trade-offs

**Password hashing is lighter than best practice.** Passwords are hashed with PBKDF2-SHA256 through WebCrypto at
20,000 iterations. OWASP recommends 600,000 for PBKDF2-SHA256. Cloudflare's free plan gives each request 10 ms of
CPU, and 600,000 iterations would take far longer than that. The Workers runtime also caps PBKDF2 at 100,000
iterations.

The count was measured on the deployed Worker on 2026-11-12 (`wrangler tail`, CPU time per request):

| Request | CPU time, warm | CPU time, cold start |
|---|---|---|
| `POST /api/auth/login` at 20,000 iterations | 6–8 ms | 12 ms |
| `GET /api/slots` (no hashing) | 2–5 ms | 10 ms |

Hashing adds about 3 ms. Doubling the count would put warm logins at or past the 10 ms limit, so it stays at
20,000 (`PBKDF2_ITERATIONS` in `wrangler.toml`). Cold starts cost about as much on requests that hash nothing, so
lowering the count would not remove them. If logins start failing with Cloudflare's CPU-limit error, lower it to
10,000 and regenerate the seed hashes with `scripts/hash-password.ts`.

This is acceptable here because every account is either a public demo account whose password is printed on the
login page, or a sign-up with a reserved `.test` or `example.com` address. There is nothing real to protect. Each
stored hash records its own iteration count, so the count can be raised later without breaking existing accounts.
A real booking site should use the full OWASP figure, or a slower hash on a server with more CPU per request.

**Other limits the free plan sets:**

- The login cool-down (5 failures per email or 30 per IP in 15 minutes) is enforced by the app, not by Cloudflare.
- No load tests run against the public copy. They run against the local copy only.
- Requests over the daily limit fail until midnight UTC (see below), so a busy day can take the demo down.

## Hosting limits

Read on Cloudflare's own pages on 2026-11-12, Workers free plan:

| Limit | Value |
|---|---|
| Worker requests | 100,000 a day per account, reset at 00:00 UTC. Over the limit, requests get error 1027. Static files don't count |
| CPU time | 10 ms per HTTP request |
| Memory | 128 MB per isolate |
| Subrequests | 50 per request |
| Cron triggers | 5 per account |
| D1 | 10 databases, 500 MB each, 5 GB in all |
| D1 reads and writes | 5 million rows read and 100,000 rows written a day, reset at 00:00 UTC. Over the limit, queries fail |
| D1 queries | 50 per Worker invocation. A `batch()` counts as one, so the nightly reset fits |

These match the figures the design used. The 100,000 daily requests are shared by every demo on the same
Cloudflare account.

Cloudflare's scanning and penetration testing policy allows customers to scan and test their own assets with
throttled scans, without prior notice. It requires notice for DoS-style tests and says nothing specific about load
tests. Since load tests here run only on the local copy, nothing changes.

## Pe scurt (în română)

Bucla Verde este un salon **fictiv**, creat de Quality Zone ca țintă pentru teste demonstrative pe canalul de
TikTok. Nu există o firmă reală cu acest site. Toate conturile sunt conturi demo, iar datele se resetează în
fiecare noapte. Site-ul are șase buguri puse intenționat, care se pornesc doar pentru sesiunea ta, cu
`?bugs=<id>`. Testele grele (forță brută, încărcare) rulează doar pe copia locală, niciodată pe site-ul public.
