# Frontend ↔ Backend wiring matrix

**Date:** 9 August 2026  
**App:** `akshayborade09/subs` (Expo)  
**Backend:** `akshayborade09/subs-backend` (`/v1`, ~71 routes)  
**Gate:** `EXPO_PUBLIC_API_URL` set → `backendEnabled === true`; unset → full local mock.

---

## Verdict

**No — the frontend is not fully wired to the backend.**

With backend mode on, only the **first API slice** is live:

| Slice | Status |
| --- | --- |
| OTP auth (`/auth/otp/*`) | **WIRED** |
| Serviceability check + areas | **WIRED** |
| Coverage notify-me | **WIRED** (requires signed-in token) |
| Onboarding step `deliveryEligibility` | **WIRED** (single step) |
| Everything else (Home router, trial pay, meals, subscriptions, addresses CRUD, profile, loyalty, …) | **MOCK / harness** |

The QA lifecycle selector (`A`–`AP`) is still the app’s state router. Product Home should come from `GET /v1/me/app-state`; that call is **not implemented** in `src/api/client.ts`.

---

## How to read this doc

| Term | Meaning |
| --- | --- |
| **WIRED** | UI calls real `/v1` when `EXPO_PUBLIC_API_URL` is set |
| **PARTIAL** | Some calls hit the API; rest of the flow is local |
| **MOCK** | UI works from in-memory / seeded data only |
| **HARNESS** | Lifecycle selector / preview screens used for QA, not a production router |
| **CLIENT-OWNED** | Backend deliberately does **not** return this letter as `lifecycleState` (app-local UI) |
| **SERVER-OWNED** | Backend can derive / simulate this condition via `GET /me/app-state` |

**Contract rule (from handoff):** a frontend change never invents backend behaviour. Render what the server returns; sync `subs-backend` when product rules change.

---

## 1. Machines in the app

| # | Machine | Source | Backend today |
| --- | --- | --- | --- |
| 1 | Lifecycle harness (`A`–`AP`) | `src/lifecycleStateMachine.ts` + `App.tsx` | **Not wired** — should be replaced by `GET /me/app-state` for product routing |
| 2 | Auth sheet (`phone` → `otp`) | `App.tsx` | **WIRED** (OTP) when backend enabled |
| 3 | Delivery eligibility | `src/deliveryEligibilityState.ts` | **WIRED** (check / areas / coverage) |
| 4 | TrialFlow steps | `src/TrialFlow.tsx` | **PARTIAL** — only `deliveryEligibility` POSTed |
| 5 | Delivery address | `src/deliveryAddressState.ts` + `DeliveryAddressFlow.tsx` | **MOCK** addresses store; serviceability check can still hit API |
| 6 | Meal detail | `src/mealDetailState.ts` + `TrialHome.tsx` | **MOCK** |
| 7 | Commerce / profile routes | `src/CommerceProfileExperience.tsx` | **MOCK** |
| 8 | Subscription sheet | `src/subscriptionSheet.tsx` | **MOCK** |

---

## 2. What is wired today (call sites)

All API surface lives in `src/api/client.ts`.

| Client export | Endpoint | Used by | Notes |
| --- | --- | --- | --- |
| `startOtp` | `POST /v1/auth/otp/start` | `App.tsx` LoginSheet | Dev may return `devCode` |
| `verifyOtp` | `POST /v1/auth/otp/verify` | `App.tsx` OtpForm | Sets **in-memory** `accessToken` only |
| `checkServiceability` | `POST /v1/serviceability/check` | `deliveryServiceability.ts` | Public |
| `fetchServiceableAreas` | `GET /v1/serviceability/areas` | `deliveryServiceability.ts` | Sorry / areas sheet |
| `requestCoverage` | `POST /v1/serviceability/coverage-requests` | `coverageRequestStore.ts` | Needs Bearer |
| `completeOnboardingStep` | `POST /v1/me/onboarding/step` | `TrialFlow.tsx` once | Step name: `deliveryEligibility` only |

**Token persistence:** memory only. Reload clears session. Settings “Log out” does not call `setAccessToken(null)` and does not hit `POST /auth/logout`.

**Not in client (backend already has them):** app-state, onboarding GET, addresses, trial, checkout/pay, subscriptions, meals, loyalty, profile hub, transactions, notifications, refresh token, etc.

---

## 3. Lifecycle states (`A`–`AP`) — wiring status

### 3.1 Server-owned conditions (backend can simulate)

These map to `GET /v1/me/app-state` (and `?simulateState=` in dev). **Frontend still seeds Home from the harness**, so product path is MOCK until app-state is wired.

| ID | Title | App destination | Backend condition | Frontend wiring |
| --- | --- | --- | --- | --- |
| **A** | New user, signed out | `stories` | `SIGNED_OUT` | **MOCK** UI; API would return this with no token |
| **B** | Authentication incomplete | `auth` | `AUTH_INCOMPLETE` | **PARTIAL** — OTP WIRED; resume/session not restored |
| **C** | Onboarding incomplete | `onboarding` | `ONBOARDING_INCOMPLETE` | **PARTIAL** — eligibility WIRED; resume step / other steps not |
| **D** | Trial payment pending | `state_preview` → Home | `TRIAL_PAYMENT_PENDING` | **MOCK** / harness |
| **E** | Trial payment failed | `state_preview` | `TRIAL_PAYMENT_FAILED` | **MOCK** / harness |
| **F** | Trial scheduled | `trial_home` | `TRIAL_SCHEDULED` | **MOCK** Home seed |
| **G** | Trial active, no subscription | `trial_home` | `TRIAL_ACTIVE_NO_SUBSCRIPTION` | **MOCK** |
| **H** | Trial active, subscription purchased | `trial_home` | `TRIAL_ACTIVE_SUBSCRIPTION_PURCHASED` | **MOCK** |
| **I** | Trial completed, no subscription | `trial_home` | `TRIAL_COMPLETED_NO_SUBSCRIPTION` | **MOCK** |
| **J** | Subscription scheduled | `trial_home` | `SUBSCRIPTION_SCHEDULED` | **MOCK** |
| **K** | Subscription active | `trial_home` | `SUBSCRIPTION_ACTIVE` | **MOCK** |
| **L** | No meal today | `trial_home` | `SUBSCRIPTION_NO_MEAL_TODAY` | **MOCK** |
| **M** | Subscription paused | `trial_home` | `SUBSCRIPTION_PAUSED` | **MOCK** |
| **N** | Cancelled, active until end | `trial_home` | `SUBSCRIPTION_ENDING` | **MOCK** |
| **O** | Subscription expired | `trial_home` | `SUBSCRIPTION_EXPIRED` | **MOCK** |
| **P** | Renewal payment failed | `trial_home` | `RENEWAL_FAILED` | **MOCK** |
| **Q** | Delivery delayed | `trial_home` | `DELIVERY_DELAYED` | **MOCK** (ops sets meal status) |
| **R** | Delivery failed / address issue | `trial_home` | `DELIVERY_FAILED` | **MOCK** |
| **Y** | Subscription payment pending | `state_preview` | `SUBSCRIPTION_PAYMENT_PENDING` | **MOCK** / harness |
| **AA** | Subscription payment failed | `state_preview` | `SUBSCRIPTION_PAYMENT_FAILED` | **MOCK** / harness |
| **AP** | Subscription restarted | `trial_home` | `SUBSCRIPTION_RESTARTED` | **MOCK** |

Also server-owned (no letter): `ACCOUNT_BLOCKED` — simulatable by condition name only.

### 3.2 Client-owned letters (backend will not return as `lifecycleState`)

These stay in the app (navigation / animation). Backend may still supply **data** via other endpoints.

| ID | Title | App destination | Frontend wiring | Backend data needed |
| --- | --- | --- | --- | --- |
| **S** | Offline | `trial_home` | **MOCK** / client transport | Cached last `home` payload (app concern) |
| **T** | Trial payment pending → success | `state_preview` | **HARNESS** animation | Poll `payment-status` (real flow) |
| **U** | Trial payment success | `state_preview` | **HARNESS** | Checkout / payment-status |
| **V** | Checkout review | `commerce_profile` | **MOCK** | Trial review / subscription quote + checkout |
| **W** | Apply coupon | `commerce_profile` | **MOCK** | `apply-coupon` / `remove-coupon` |
| **X** | Coupon applied | `commerce_profile` | **MOCK** | Same + review totals |
| **Z** | Subscription payment success | `state_preview` | **HARNESS** | payment-status → then Home |
| **AO** | Future meal detail | `trial_home` | **MOCK** sheet over active Home | `GET /me/meals/:id` (+ mutations) |
| **AB** | Profile | `commerce_profile` | **MOCK** | `GET /me/profile-hub`, `/me/profile` |
| **AC** | Edit profile | `commerce_profile` | **MOCK** | `PATCH /me/profile` |
| **AD** | Saved addresses | `commerce_profile` | **MOCK** | `/me/addresses` CRUD |
| **AE** | Transactions | `commerce_profile` | **MOCK** | `/me/transactions` |
| **AF** | Account settings | `commerce_profile` | **MOCK** | logout + prefs; appearance local OK |
| **AG** | Notifications | `commerce_profile` | **MOCK** | notification-preferences + `/me/notifications` |
| **AH** | App permissions | `commerce_profile` | **MOCK** | Mostly OS / local |
| **AI** | Refer and earn | `commerce_profile` | **MOCK** | `/me/referrals` |
| **AJ** | Healthy Streak progress | `commerce_profile` | **MOCK** | `/me/loyalty/progress` |
| **AN** | Streak completed | `commerce_profile` | **MOCK** | loyalty progress + rewards |
| **AK** | Monthly leaderboard | `commerce_profile` | **MOCK** | `/loyalty/leaderboard` |
| **AL** | Free meal earned | `commerce_profile` | **MOCK** | `/me/rewards` |
| **AM** | Redeem free meal | `commerce_profile` | **MOCK** | eligible-dates + redeem |

---

## 4. Product flows — detail

### 4.1 Entry & auth (states A, B)

| Item | Detail |
| --- | --- |
| **Status** | **PARTIAL** |
| **Frontend** | `App.tsx` stories + login/OTP sheets |
| **Wired** | `POST /auth/otp/start`, `POST /auth/otp/verify` |
| **Still mock** | Stories content; mock OTP `123456` when API URL unset |
| **Needed from backend** | Already exists: `POST /auth/refresh`, `POST /auth/logout` |
| **Frontend gap** | Persist refresh/access tokens; restore session on boot; call logout; drive A/B from `GET /me/app-state` |

### 4.2 Delivery eligibility (start of C)

| Item | Detail |
| --- | --- |
| **Status** | **WIRED** (core path) |
| **Frontend** | `deliveryEligibilityScreen.tsx`, `deliveryServiceability.ts`, `coverageRequestStore.ts` |
| **Wired** | check, areas, coverage-requests, `POST /me/onboarding/step` (`deliveryEligibility`) |
| **Needed from backend** | Done for this slice. Optional: `GET /serviceability/pincodes` (centroids/city) if map seeding should be server-owned |
| **Frontend gap** | Surface server `error.message` / `details.rule` (e.g. `pincode_not_serviceable`) consistently |

### 4.3 Trial onboarding wizard (rest of C)

**TrialFlow steps:**  
`deliveryEligibility` → `personal` → `intro` → `food` → (`meal` / `mixMeals`) → `bread` → `rice` → `addressFlow` → `summary` → `payment` → `success` → `tracker`

| Step | Persisted to API today? | Backend to use |
| --- | --- | --- |
| `deliveryEligibility` | **Yes** | `POST /me/onboarding/step` |
| `personal` | No | `POST /me/onboarding/step` + later `PATCH /me/profile` |
| `intro` | No | onboarding step (optional) |
| `food` / `meal` / `mixMeals` / `bread` / `rice` | No | onboarding step **and/or** `PATCH /me/trial/preferences` |
| Trial dates (calendar) | No | `PATCH /me/trial/dates` (strictly after today) |
| `addressFlow` | No | `POST /me/addresses` then `PATCH /me/trial/address` |
| `summary` / review | No | `GET /me/trial/review` |
| `payment` | No | `POST /me/trial/checkout` → `POST …/pay` → poll `payment-status` |
| `success` / `tracker` | No | Navigate from payment-status + `GET /me/app-state` |

| Item | Detail |
| --- | --- |
| **Status** | **PARTIAL** |
| **Also unused** | `GET /me/onboarding` (resume), `POST /me/trial/draft` |
| **Needed from backend** | **Already implemented** for trial + onboarding |
| **Frontend gap** | Persist every step; create trial draft early; bind addresses to slot IDs; replace local payment UI with checkout + poll; handle 422 `details.rule` |

### 4.4 App state / Home router (F–R, AP, and payment homes)

| Item | Detail |
| --- | --- |
| **Status** | **MOCK** |
| **Frontend** | `lifecycleStateMachine.ts`, `LifecycleStateSelector`, `TrialHome` seeded by `lifecycleVariant` |
| **Needed from backend** | **Already implemented:** `GET /me/app-state` (+ `?simulateState=` for QA) |
| **Frontend gap** | Replace selector-as-router with app-state; render `home` payload (week strip, markers, notices, plan card); keep selector only as **dev harness** calling `simulateState` |

### 4.5 Trial purchase & payment (D, E, T, U → F)

| Item | Detail |
| --- | --- |
| **Status** | **MOCK** |
| **Frontend** | `TrialFlow` payment/success; harness previews for D/E/T/U |
| **Needed from backend** | **Already implemented:** draft → preferences → dates → address → review → checkout → pay → payment-status; mock `scenario` in dev |
| **Frontend gap** | `idempotency-key` on money POSTs; poll status; map pending/fail/success to D/E/U then F via app-state; do not treat T/U as server lifecycle |

### 4.6 Addresses (onboarding + AD + meal redirect)

| Item | Detail |
| --- | --- |
| **Status** | **MOCK** |
| **Frontend** | `savedAddressesStore.tsx` (in-memory + demo seed), `DeliveryAddressFlow.tsx` |
| **Needed from backend** | **Mostly implemented:** `GET/POST /me/addresses`, set-default, `DELETE` |
| **Backend gap** | **No `PATCH` / update-address route** (handoff table overstates “update”). Edit-in-place today must be delete+create or backend must add update |
| **Frontend gap** | Replace store with API; map label kinds + `customLabel`; respect delete refusal when plan references address |

### 4.7 Subscription purchase (V–X → Y/Z/AA → J/K/H)

| Item | Detail |
| --- | --- |
| **Status** | **MOCK** |
| **Frontend** | `subscriptionSheet.tsx`, `CommerceProfileExperience` checkout/coupon, harness Y/Z/AA |
| **Needed from backend** | **Already implemented:** `GET /subscription-plans`, `POST /me/subscriptions/quote`, `POST /me/subscriptions/checkout`, pay/poll, apply/remove coupon |
| **Frontend gap** | Quote-driven prices (no hardcode); coupons via API; idempotent checkout; activate from payment-status + app-state (not local `onActivated`) |

### 4.8 Subscription management (M, N, O, AP, pause/resume/cancel)

| Item | Detail |
| --- | --- |
| **Status** | **MOCK** |
| **Frontend** | `TrialHome`, `planRestartDateSheet.tsx`, commerce toasts |
| **Needed from backend** | **Already implemented:** `GET /me/subscriptions/current`, pause, resume, cancel, resubscribe, restart |
| **Frontend gap** | Call mutations; refresh Home from app-state; show server copy on 422 |

### 4.9 Meal actions (AO + detail on F–K)

| Item | Detail |
| --- | --- |
| **Status** | **MOCK** |
| **Frontend** | `mealDetailState.ts`, `TrialHome.tsx` local `setMeals` / toasts |
| **Needed from backend** | **Already implemented:** meal detail, selectable-dates, PATCH date/address/preferences, skip, undo-skip, feedback, report-issue |
| **Frontend gap** | Drive `canSkip` / `canUndoSkip` from API; send `expectedScheduleVersion`; on **409** replace Home with returned payload; report-issue categories from server contract |

### 4.10 Recovery & delivery (P, Q, R, S)

| Item | Detail |
| --- | --- |
| **Status** | **MOCK** Home variants |
| **Needed from backend** | App-state already encodes P/Q/R. Ops meal status (`PATCH /ops/meals/:id/status`) drives Q/R — **ops tool**, not customer app |
| **Frontend gap** | Render notices from `home`; payment recovery CTAs for P; offline S is client-only |

### 4.11 Profile, settings, transactions (AB–AH)

| Item | Detail |
| --- | --- |
| **Status** | **MOCK** |
| **Needed from backend** | **Already implemented:** profile, profile-hub, notification prefs, notifications, transactions |
| **Frontend gap** | Wire screens; keep OS permissions (AH) local |

### 4.12 Loyalty, referrals, leaderboard (AI–AN)

| Item | Detail |
| --- | --- |
| **Status** | **MOCK** |
| **Needed from backend** | **Already implemented:** loyalty progress, rewards, eligible-dates, redeem, referrals, apply referral, leaderboard |
| **Frontend gap** | Replace hardcoded progress/ranks; redeem flow end-to-end |

---

## 5. Backend inventory vs frontend consumption

| Backend area | Routes exist? | Consumed by app? |
| --- | --- | --- |
| Auth OTP | Yes | **Yes** |
| Auth refresh / logout | Yes | **No** |
| App state | Yes | **No** |
| Onboarding GET/POST | Yes | **POST only, one step** |
| Serviceability | Yes | **Yes** (check, areas, coverage) |
| Serviceability pincodes | Yes | **No** |
| Addresses | Yes (no PATCH update) | **No** |
| Trial draft → checkout | Yes | **No** |
| Checkout pay / status / coupons | Yes | **No** |
| Subscription plans / quote / lifecycle | Yes | **No** |
| Meals | Yes | **No** |
| Loyalty / referrals / leaderboard | Yes | **No** |
| Profile hub / notifications / transactions | Yes | **No** |
| Ops | Yes | N/A (admin) |
| Webhooks | Yes | N/A (provider → server) |

**Rough coverage:** ~6 of ~71 `/v1` routes are used by the app today.

---

## 6. What is needed from backend for missing flows

### Already available — frontend work only

Almost all missing product flows already have routes. Priority wiring order (matches handoff §3):

1. **`GET /me/app-state`** — product router + Home payload (unlocks F–R, AP, and real A/B/C resume).
2. **Trial purchase pipeline** — draft → preferences → dates → addresses → review → checkout → pay → poll.
3. **Meal actions** — detail flags + skip/undo/changes/report + 409 handling.
4. **Subscription purchase & management** — plans, quote, checkout, pause/restart/cancel.
5. **Profile / transactions / loyalty / referrals / leaderboard.**
6. **Addresses CRUD** + bind to trial/subscription slots.
7. **Session durability** — refresh + logout + secure storage.

### Real backend gaps / product syncs (not just “wire the UI”)

| Gap | Why it matters | Ask of backend / product |
| --- | --- | --- |
| **No address UPDATE (`PATCH`)** | Profile “edit address” and meal address edits that mutate fields in place have no matching route | Add `PATCH /me/addresses/:id` **or** document delete+recreate as the contract |
| **Trial date stricter than app** | Server: dates must be **strictly after today**; app calendar can allow today | Align calendar UX with server rule (documented in handoff §5 / open questions §F7) |
| **Open product questions** | Tax base, Mumbai-vs-Pune pincodes, weekend kitchen, unlimited skips, pause crediting | Resolve in `subs-backend/docs/open-questions-for-product.md` → `policy.ts` before treating numbers as final |
| **Client-owned letters** | T/U/Z/V–X/S/AO/AB–AN are not server lifecycle | Do not expect `simulateState=T` etc.; use payment-status + navigation |
| **Idempotency** | Money POSTs need `idempotency-key` | Client must send (≥ 8 chars); already enforced server-side |
| **Ops-driven Q/R** | Delayed/failed delivery is set via ops APIs | Customer app only **displays** app-state; need ops tooling or seed scripts for demos |

### Nice-to-have (backend exists, unused)

- `GET /serviceability/pincodes` — server centroids / city-state for map seed (today app uses local `PINCODE_CENTROIDS` in `locationGeocoding.ts`).
- `GET /me/onboarding` — resume mid-wizard for state C without local step guesswork.

---

## 7. Recommended wiring plan (frontend)

| Slice | Deliverable | Unlocks states / flows | Backend dependency |
| --- | --- | --- | --- |
| **0 — Done** | OTP + eligibility + coverage + eligibility step | B (auth), start of C | Live |
| **1** | `GET /me/app-state` + render `home` | Real A–R, Y, AA, AP routing; retire harness as sole router | Live |
| **2** | Onboarding step persistence + trial draft/prefs/dates/address/review | Full C → summary | Live |
| **3** | Trial checkout + pay + poll | D, E, T/U animations, F | Live |
| **4** | Addresses API | AD + trial slot addresses | Live; clarify UPDATE |
| **5** | Meal detail + mutations | AO + actions on F–K | Live |
| **6** | Subscription quote/checkout/pay + pause/restart/cancel | V–X, Y/Z/AA, H/J/K/M/N/O/AP | Live |
| **7** | Profile / txns / loyalty / referrals | AB–AN | Live |
| **8** | Token refresh + logout + secure storage | Durable B/A | Live |

Keep mock fallbacks behind `backendEnabled` until each slice is stable.

---

## 8. Quick demo checklist (current wired slice only)

1. Backend: `pnpm dev` on `:4000` (migrate + seed as needed).
2. App: `EXPO_PUBLIC_API_URL` pointing at API (browser: `http://127.0.0.1:4000`).
3. Sign in with any 10-digit phone → use on-screen **Dev code**.
4. Delivery availability: `560001` → sorry + areas + Notify me; `400101` → Yay → meal → continue.
5. Confirm DB writes: `users`, `onboarding_drafts`, `coverage_requests`.
6. Expect: later TrialFlow steps, Home, pay, meals, profile still **local**.

---

## 9. Source references

| Doc / file | Role |
| --- | --- |
| `docs/frontend-handoff.md` | Backend contract + recommended next slices |
| `API-WIRING.md` | App-side short gate + wired list |
| `src/api/client.ts` | Only HTTP client |
| `src/lifecycleStateMachine.ts` | Letters A–AP definitions |
| `src/TrialFlow.tsx` | Onboarding step machine |
| `qa/STATE_MACHINE_COVERAGE.md` | QA coverage of machines (not API wiring) |
| `subs-backend` `src/modules/*/routes.ts` | Zod schemas = API truth |
| `subs-backend` `src/lifecycle/*` | Server vs client-owned states |

---

## 10. One-line summary

**Wired:** auth OTP + delivery eligibility/serviceability/coverage (+ one onboarding step).  
**Not wired:** app-state Home router, rest of onboarding, trial/subscription commerce, meals, addresses CRUD, profile, loyalty — and for almost all of those the **backend already exists**; the work is frontend integration (plus address UPDATE clarity and a few product policy syncs).
