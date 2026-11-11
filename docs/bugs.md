# Planted bugs

Bucla Verde ships six bugs on purpose. Each one is off by default and is switched on for a single browser session
with `?bugs=<id>[,<id>...]` (the SPA then calls `POST /__demo/bugs`, which sets a signed `qz_bugs` session cookie).
`?bugs=all` turns every bug on and `?bugs=off` clears the cookie. With `BUGS_ENABLED=false` the Worker ignores all of it.
The login cool-down stays on in every mode.

Find every bug path with `grep -rn "BUG:" server web`. Server-side bug code lives in `server/bugs/paths.ts`.

| Id | Strip label | Behaviour with the bug | Clean behaviour | File | Episode | Caught by |
|---|---|---|---|---|---|---|
| `slow-login` | login lent | Login waits an extra 3 s before answering (success and failure), a planted delay standing in for a slow query | Login answers well under 1 s | `server/routes/auth.ts:POST /auth/login` (delay in `server/bugs/paths.ts:slowLoginDelay`) | 020 „Același site, două viteze” | `perf/login-budget` |
| `login-enumeration` | mesaje de login prea clare | 401 „Nu există niciun cont cu acest email” for an unknown email, 401 „Parola este greșită” for a wrong password | Always „Email sau parolă greșite” | `server/routes/auth.ts:POST /auth/login` (messages in `server/bugs/paths.ts:enumerationError`) | 023 „Mesajul de eroare care îi ajută pe hackeri” | `security/login-generic-error` |
| `booking-past-closing` | programare după închidere | The slot list and the booking check test only the start time, so Vopsit complet (120 min) can start at 18:00 and end after 19:00 | The service must end by closing (19:00) | `server/routes/slots.ts:GET /slots`, `server/routes/bookings.ts:POST /bookings` (`checkEnd: false` in `server/domain/slots.ts:fitsInDay`) | 017 „Bugul pe care un test simplu nu-l vede” | `e2e/booking-fits-before-closing` |
| `a11y-gap` | accesibilitate stricată | Time slots become clickable `<div>`s with no keyboard access, form inputs lose their labels, the focus outline is removed | Real buttons, labels, visible focus | `web/` (client only; the SPA reads `GET /__demo/bugs`) | 022 (keyboard-only b-roll); a later accessibility coding episode | `a11y/axe-booking`, `a11y/keyboard-only-booking` |
| `leaky-errors` | erori cu detalii interne | A malformed `start` in a booking request skips validation, reaches a D1 query and returns 500 `{ error, stack, sql }` with a stack trace and the SQL text | 400 `VALIDATION` in the standard error shape, no internals | `server/routes/bookings.ts:POST /bookings` (`server/bugs/paths.ts:leakyStartLookup`) | The brief's „error-message checks”; candidate for a new security episode | `security/no-internal-details` |
| `idor-booking` | acces la programările altora | `GET /api/bookings/:id` returns any client's booking (cancel and pay stay owner-only) | 404, not 403, for a booking that isn't yours, so ids can't be probed | `server/routes/bookings.ts:GET /bookings/:id` (`server/bugs/paths.ts:getBookingAnyOwner`) | 034 „Un AI construiește, altul îi caută bugurile”, with `?bugs=all` | `security/booking-access-control` |

Every bugs-on video says the bug was planted on purpose.
