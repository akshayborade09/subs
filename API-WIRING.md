# API wiring (frontend ↔ subs-backend)

The full handoff lives in the backend repo: **`subs-backend/docs/frontend-handoff.md`**
(endpoints, error envelope, demo steps, next slices). This file is the app-side
short version.

## The rule

**A frontend change never changes the backend by itself.** The backend owns the
API contract and enforces every business rule server-side — the app renders what
the server returns. New product behaviour in the app becomes backend behaviour
only through a deliberate sync in the `subs-backend` repo (rule extracted,
number placed in `policy.ts`, migrated, tested). Never assume a screen change
"just works" against the API; check the handoff doc or ask for a sync.

## Backend mode

Everything is gated on `EXPO_PUBLIC_API_URL`:

```bash
# mock mode (default) — no env var, the app runs exactly as before
pnpm start

# backend mode — real API (server from subs-backend running on :4000)
EXPO_PUBLIC_API_URL=http://127.0.0.1:4000 pnpm web        # browser (most reliable)
EXPO_PUBLIC_API_URL=http://192.168.1.5:4000 pnpm start    # phone on open Wi-Fi
```

## Wired today

- `src/api/client.ts` — the API client. Add every new endpoint call here.
- Sign-in: real OTP (`/v1/auth/otp/*`); dev code shows on the verify sheet.
- Delivery eligibility: serviceability check, serviceable-areas sheet and
  notify-me all hit the real endpoints; continuing records the
  `deliveryEligibility` onboarding step (the server enforces the same gate).
- **App-state routing**: after sign-in (and after a purchase) the app calls
  `GET /v1/me/app-state`; the server's `route` decides onboarding vs home and
  its `legacyStateId` picks the Home variant.
- **Trial purchase**: the payment step runs the real sequence
  (`src/api/trialPurchase.ts`): draft → preferences → dates → address created
  server-side → checkout → mock pay → webhook poll. Errors surface on the
  payment screen; retries are safe (idempotency keys, upserting draft).
- **Trial Home week strip**: for trial variants, `TrialHome` renders the
  server's Home payload (real meal orders) instead of the demo seed.

## Still mock — next slices in order

1. Subscription-variant Home (server payload exists; `TrialHome` still uses its
   local scaffolding for subscription states)
2. Meal actions (skip / undo-skip / changes / report-issue)
3. Subscription purchase & management (incl. pause/restart)
4. Profile, transactions, loyalty, referrals, leaderboard
5. Token persistence (in-memory only — an app restart signs you out)
