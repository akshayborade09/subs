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
- **Subscription purchase**: the sheet's pay button runs the real checkout
  (`src/api/subscriptionPurchase.ts`) — server plan catalogue and pricing,
  mock pay, webhook poll; Home refetches app-state when the sheet closes.
- **Session persistence** (web): the token survives reloads via localStorage,
  and the app boots straight to the server's route when signed in.
- **Home for every variant**: when the server payload is present, the week
  strip, header copy, notice and plan card all render from it — trial and
  subscription states alike. The local generators remain the mock/QA path.

- **Meal actions**: skip / undo-skip mirror the optimistic local update to
  the real endpoints (both sides share the same delta model), the per-meal
  food preference PATCHes, and report-issue submits the category. Meals from
  the QA selector carry local ids and never reach the API (UUID guard).

- **Saved addresses sync with the server**: the store hydrates on sign-in and
  after every mutation; creates, deletes and default changes mirror to the
  API (edits become create-plus-delete — the server has no update endpoint).
  Demo seed rows only exist while signed out.
- **Per-meal address change** PATCHes the real endpoint when a server-backed
  address is picked for a server-backed meal.
- **Subscription management**: pause (open-ended, from tomorrow), cancel
  (at period end) and the restart sheet all hit the real endpoints; restart
  refreshes Home from app-state so the AP variant renders.

## Still mock — next slices in order

1. Profile, transactions, loyalty, referrals, leaderboard screens (data is
   inline fixtures in CommerceProfileExperience — needs its own pass)
2. Per-slot configs at subscription checkout (the sheet keeps only formatted
   address strings; it needs to retain server address ids)
3. Native token persistence (web only today — needs expo-secure-store)
