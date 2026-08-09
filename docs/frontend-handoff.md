# Frontend handoff — Healthy Tiffins backend

**Date:** 9 August 2026
**Backend:** `akshayborade09/subs-backend`, `main` @ `e9d96cc` (Fastify 5 + Postgres 17, TypeScript ESM)
**App:** `akshayborade09/subs` (Expo). First API slice wired on the `api-wiring` branch.

This is everything a frontend developer needs to build against this backend: the
contract rule, what exists, what is already wired, how to run the demo, and what
to wire next.

---

## 1. The contract rule

**A frontend change never changes the backend by itself.**

- The backend owns the API contract: routes, request/response schemas (zod, in
  `src/modules/*/routes.ts`), business rules, and every business number
  (`src/platform/config/policy.ts`). The app renders what the server returns;
  it does not re-derive policy.
- Every business rule is **enforced server-side**, so no app change — intentional
  or buggy — can bypass one. Example: the delivery-eligibility gate. The app
  shows the sorry screen, but the server independently refuses
  `POST /me/onboarding/step` for an unserviceable pincode. Ship whatever you
  like in the app; users still cannot onboard from an unserviceable area.
- When the app's product behaviour changes (new screens, new rules, changed
  numbers), that is a **deliberate backend sync**, not a side effect: extract
  the rule from the app code, put the number in `policy.ts`, migrate, test,
  and record open questions in `docs/open-questions-for-product.md`. The
  2026-08-09 sync (3-day trial, per-slot plans, skip/restart, eligibility
  gate) followed exactly this path — see the git history from `46dbd1c`.
- Backend responses evolve **additively**. Fields are added, never repurposed;
  fastify's zod serializer strips unknown keys, so the app can rely on
  documented fields staying stable.

## 2. What the backend implements (as of today)

All routes live under `/v1`. Schemas are the source of truth — read the zod
objects in each `src/modules/<module>/routes.ts`. Summary of the surface the
app will consume:

| Area | Endpoints (all `/v1/…`) | Notes |
|---|---|---|
| Auth | `POST /auth/otp/start`, `POST /auth/otp/verify` | Dev provider returns `devCode` in the start response; verify returns `accessToken` (bearer) |
| App state | `GET /me/app-state` | The router: lifecycle condition, legacy letter (A–AP), route, and the full Home payload. Dev-only `?simulateState=G` forces any of the 21 server states |
| Onboarding | `GET /me/onboarding`, `POST /me/onboarding/step` | Steps start at `deliveryEligibility` (server-enforced serviceability gate); payload is free-form JSON that round-trips |
| Serviceability | `POST /serviceability/check`, `GET /serviceability/areas`, `GET /serviceability/pincodes`, `POST /serviceability/coverage-requests` | `areas` is the `{pincode, areaName}` list for the sorry sheet; coverage requests are idempotent per (user, pincode) |
| Addresses | `GET/POST /me/addresses`, plus update/delete/set-default | 6 label kinds + `customLabel`; save gate (flat/house required, line1 ≥ 3 chars); city/state autofill from pincode; deletion refused while a live plan references it |
| Trial | `POST /me/trial/draft`, `PATCH /me/trial/preferences|dates|address`, `GET /me/trial/review`, `POST /me/trial/checkout` | 3 days, any 3 within 7 of the first pick (weekends allowed, must be strictly after today); per-slot `lunchAddressId`/`dinnerAddressId`; review returns the ₹999/−₹100/₹899 breakup with the ₹500+₹499 slot split |
| Checkout & payments | `POST /me/checkout/:id/pay`, `GET /me/checkout/:id/payment-status`, `POST /me/checkout/:id/apply-coupon|remove-coupon` | Mock provider: pay with `{scenario: 'success_immediate'}` etc.; webhook flips state; poll payment-status |
| Subscriptions | `POST /me/subscriptions/checkout`, `GET /me/subscriptions/current`, `POST /me/subscriptions/pause|resume|cancel|resubscribe|restart` | Pricing matches the app to the paisa ('Both' ×2, 5% pre-credit tax); optional per-slot configs at checkout; a bounded pause = state AP (restarted) and credits the plan end date |
| Meals | `GET /me/meals/:id`, `GET …/selectable-dates`, `PATCH …/date|address|preferences`, `POST …/skip|undo-skip|feedback|report-issue` | 20:00 IST previous-day cutoff on all changes; skip extends the plan end by one delivery day, undo is its exact inverse; `expectedScheduleVersion` gives 409 + fresh Home on conflict; report-issue takes the fixed 8 categories |
| Loyalty & rewards | loyalty progress, rewards, eligible dates, redeem (see `src/modules/loyalty/routes.ts`) | Healthy Streak 28/20 rules; redemption is slot-config aware |
| Profile & misc | profile, transactions, notifications (see respective route files) | |
| Ops | `GET /ops/coverage-requests`, support issues, delivery status (see `src/modules/ops/routes.ts`) | Auth: `x-admin-key` + `x-operator` headers |

**Error envelope** (everywhere): `{ "error": { "code", "message", "details" } }`.
Validation problems are **422** with `code: VALIDATION_FAILED` and often a stable
`details.rule` slug (e.g. `pincode_not_serviceable`, `span_exceeded`). Schedule
conflicts are **409** with a fresh Home payload. User-facing copy in `message`
is server-owned and matches the app's strings verbatim — render it directly.

**Mutations that charge money** take an `idempotency-key` header (any unique
string) — retries replay the original response instead of double-charging.

## 3. What is already wired in the app (`subs` branch `api-wiring`)

Everything is gated on `EXPO_PUBLIC_API_URL`: **unset → the app runs on its
local mocks exactly as before**. Set → the following are real:

- `src/api/client.ts` — the API client (base URL, bearer token, error type).
  Extend this file for every future wiring slice.
- **Sign-in**: OTP start/verify against the server; the dev code is displayed
  on the verify sheet ("Dev code: …"); the token is held in memory.
- **Delivery eligibility**: `checkPincodeServiceability` and
  `getServiceableAreas` in `src/deliveryServiceability.ts` hit the real
  endpoints (their old mock annotations named exactly these routes). Notify-me
  posts a real coverage request. Continuing records the
  `deliveryEligibility` onboarding step server-side.

**Still mock** (next slices, in recommended order):
1. **App state / Home** — replace the local lifecycle selector with
   `GET /me/app-state`; the server already renders all 21 states and the full
   Home payload (week strip, markers, notices, plan card).
2. **Trial purchase** — draft → preferences → dates → per-slot address →
   review → checkout → mock pay → poll payment-status.
3. **Meal actions** — detail flags (`canSkip`/`canUndoSkip`), skip/undo,
   address/preference changes, report-issue.
4. **Subscription purchase & management** — plans, quote, slot configs,
   pause/restart.
5. Profile, transactions, loyalty, referrals, leaderboard.

## 4. Running the full demo

Backend (terminal 1):
```bash
cd ~/Desktop/subs-backend
docker compose up -d          # or use the Homebrew Postgres already on :5432 (.env points there)
pnpm migrate && pnpm seed
pnpm dev                      # API on :4000
```

App — **browser mode is the reliable path on a managed Mac** (terminal 2):
```bash
cd ~/Desktop/subs && git checkout api-wiring
EXPO_PUBLIC_API_URL=http://127.0.0.1:4000 pnpm web
```

Demo script: sign in with any 10-digit number (dev code shows on screen) →
Delivery availability: `560001` → sorry + the server's area list + Notify me;
`400101` → "Yay!" → pick a meal → continue. Watch requests land in terminal 1.

Verify the writes:
```bash
/opt/homebrew/opt/postgresql@17/bin/psql 'postgres://tiffins:tiffins@localhost:5432/tiffins'
-- then:
SELECT phone_number, created_at FROM users ORDER BY created_at DESC LIMIT 5;
SELECT u.phone_number, o.last_completed_step, o.payload FROM onboarding_drafts o JOIN users u ON u.id = o.user_id ORDER BY o.updated_at DESC;
SELECT pincode, count(*) FROM coverage_requests GROUP BY pincode;
```

### Phone demo — pitfalls found on 9 Aug (managed corporate Mac)

- **MDM firewall blocks all incoming connections** and cannot be changed → the
  phone can never reach the Mac over Wi-Fi (Metro or API). Symptoms: "Failed
  to download remote update" / "network connection was lost".
- **`adb reverse` is broken on the test device** (Lava LXX504, MediaTek ROM):
  it accepts connections but forwards nothing → USB is also out for that phone.
- **cloudflared is blocked** by corporate egress (port 7844 + api.cloudflare.com).
- **localtunnel works**: `npx localtunnel --port 4000` → set
  `EXPO_PUBLIC_API_URL=https://<name>.loca.lt` and run `pnpm start --tunnel`.
  URL changes on every restart.
- Watch for **stale processes squatting on ports 4000/8081** (week-old
  pre-split servers were found doing exactly this):
  `lsof -tiTCP:4000 -sTCP:LISTEN | xargs kill`.
- The proper fix for phone demos: deploy the backend to a public host and point
  `EXPO_PUBLIC_API_URL` at it. Until then, browser mode.

## 5. Quality gates & references

- `pnpm test` (213 unit), `DATABASE_URL=…/tiffins_test pnpm test:integration`
  (153), `./scripts/regression.sh` (14 checks; `LIVE=1` adds live-API
  walkthroughs incl. all 21 simulated states). All green at handoff.
- `docs/open-questions-for-product.md` §F — product decisions inherited from
  the app that still need sign-off (tax base, Mumbai-vs-Pune pincodes,
  weekend kitchen service, unlimited skips, pause crediting…). Each maps to a
  `policy.ts` line.
- Two deliberate server-stricter divergences: trial dates must be **strictly
  after today** (the app calendar permits today), and everything else follows
  the app. Both flagged in §F7.
