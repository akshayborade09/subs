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

## Wired today (this branch)

- `src/api/client.ts` — the API client. Add every new endpoint call here.
- Sign-in: real OTP (`/v1/auth/otp/*`); dev code shows on the verify sheet.
- Delivery eligibility: serviceability check, serviceable-areas sheet and
  notify-me all hit the real endpoints; continuing records the
  `deliveryEligibility` onboarding step (the server enforces the same gate).

## Still mock — next slices in order

1. App state / Home (`GET /v1/me/app-state` — server already renders all 21 states)
2. Trial purchase (draft → dates → address → review → checkout → mock pay)
3. Meal actions (skip / undo-skip / changes / report-issue)
4. Subscription purchase & management (incl. pause/restart)
5. Profile, transactions, loyalty, referrals, leaderboard
