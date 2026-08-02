# Healthy Tiffins — Complete Project Record

**Everything in one file: the original product ideation, the architecture we derived from
it, what was built, the decisions taken, the bugs found, and what remains.**

Compiled 2 August 2026. Backend Phases 1–5 complete on branch `backend_init`.

---

## How to read this document

| Part | What it contains | Written by |
|---|---|---|
| **Part I** | What the product is and how it was built | Backend team |
| **Part II** | Architecture and implementation record | Backend team |
| **Part III** | Decisions, defaults and open questions | Backend team |
| **Part IV** | Original ideation specs, reproduced verbatim | Akshay Borhade |

Part IV is the source material. Parts I–III are what we derived from it and built. Where
the two disagree, Part III says so explicitly rather than quietly picking a side.

---

# PART I — THE PRODUCT

## What it is

Healthy Tiffins is a home-style Indian meal subscription service for the Indian market.
Not on-demand food ordering — dependable everyday lunch and dinner on a schedule.

The commercial shape:

1. **Hook** — a paid five-day trial (₹899). The user picks exactly five delivery dates,
   a food preference (vegetarian / non-vegetarian / mix), meal slots (lunch, dinner or
   both), bread and rice preferences, and a delivery address.
2. **Convert** — during and after the trial, Home pushes conversion to a recurring
   subscription: weekly, monthly or quarterly.
3. **Retain** — the "Healthy Streak" loyalty programme (28 active days plus 20 delivered
   meal days earns one free meal day), a recognition-only monthly leaderboard, and
   refer-and-earn.

India-first throughout: WhatsApp-number OTP sign-in, money in paise, UPI and net banking,
PIN-code serviceability, fixed delivery windows of 11:00–13:00 and 18:30–20:30 IST.

## The central design idea

The whole system is organised around one principle:

> **The app renders lifecycle states. It does not decide them.**

Every user is always in exactly one state. The frontend prototype had 39 of them (A–AM)
driven by a manual selector; in production the backend derives the state and the client
renders whatever it is told.

Two surfaces with strictly separated jobs:

- **Home is operational** — what is happening with my food today, do I need to act?
- **My Plan / Profile is administrative** — configuration, billing, history.

---

# PART II — WHAT WAS BUILT

## Stack

| Concern | Choice | Why |
|---|---|---|
| HTTP | Fastify + `fastify-type-provider-zod` | One Zod schema becomes validation, serialization, TS types and OpenAPI |
| Database | PostgreSQL 17 | |
| Query builder | Kysely | The snapshot loader and reconcilers need hand-shaped SQL and `FOR UPDATE SKIP LOCKED` |
| Migrations | node-pg-migrate, plain SQL | Partial indexes and CHECK constraints are first-class |
| Jobs | pg-boss (Postgres, no Redis) | Transactional enqueue: a job row commits with the domain change |
| Time | Luxon, one wrapper module | Only `platform/time.ts` names `Asia/Kolkata` |
| Tests | Vitest | 132 unit, 65 integration |

Modular monolith. Modules communicate through exported service functions and a
transactional outbox — never by importing each other's tables.

## Repository layout

The Expo app was left where it was. Two config lines keep Metro and `tsc` out of the
server directory; no app source was touched.

```
subs/
├── App.tsx, src/, assets/     ← the Expo prototype, unchanged
├── docs/                      ← specs + this document
└── server/
    ├── migrations/            ← 7 SQL migrations, 33 tables
    ├── scripts/               ← regression + walkthrough scripts
    └── src/
        ├── platform/          db, time, config/policy, errors, idempotency, outbox, jobs
        ├── lifecycle/         ★ snapshot, rules, home, copy, scenarios
        ├── modules/           auth, me, trial, subscription, meals, checkout, payments,
        │                      coupons, pricing, loyalty, referral, leaderboard,
        │                      profile, transactions, notification, ops
        ├── jobs/              reconcilers, outbox drain
        ├── test/              integration harness + suites
        └── http/              app, routes, auth plugin
```

## The four architectural decisions that shaped everything

### 1. The 39 states are four axes, not one enum

The A–AM catalogue conflates four unrelated things. Modelling them as one enum is exactly
why the app's original variant mapping was a lossy inline cast.

| Axis | Values | Owner |
|---|---|---|
| **AccountCondition** | 21 conditions (A–R plus Y, AA, and a new blocked state) | Server derives exactly one |
| **PaymentPhase** | T, U, Z | Animation frames the client plays when polling flips pending → success |
| **CheckoutPhase** | V, W, X | A property of an open checkout session, not of the user |
| **Screen** | AB–AM | Pure frontend navigation. A trial user can be on the leaderboard |
| **Transport** | S (offline) | Client only — the server cannot know it is unreachable |

The letters survive as a telemetry vocabulary via `toLegacyLifecycleId()`, so support and
analytics still speak the language the designers used.

### 2. Store what an actor decides; derive what the clock decides

`trials.status` is stored because money and user actions decide it. "Scheduled vs active
vs completed" is derived from dates at read time.

This is not stylistic. A nightly "flip the trial to active" job that runs late produces a
wrong Home screen at 00:01. Deriving means a job can be six hours late — or never run —
and Home is still correct. Jobs emit events and create rows; they never own state a read
can compute.

### 3. The lifecycle resolver is pure

Four queries build a JSON snapshot. Everything after that is a total function over it:

```
GET /v1/me/app-state
    → loadSnapshot()        4 queries, no cross-module joins
    → resolveCondition()    20 priority-ordered rules, .find() ⇒ exactly one
    → buildHome()           variant · week · markers · ripple · notice · plan card
```

All 39 states are unit-testable with no database. Totality is proven by fuzzing 10,000
random snapshots. `firedRule` ships in the response, so "why is this user seeing this
screen" is answered by one string.

### 4. One meal order per (date, slot)

The app collapses a day into a positional `mealMarkers[]` array. That shape provably cannot
carry two distinct meal-detail payloads for one date, so the database normalises and the
projection collapses.

## Database

33 tables across seven migrations. Invariants enforced and checked by the regression suite:

- **Money is always `integer` paise.** Never a float, never a string.
- **Calendar facts are `DATE`; instants are `TIMESTAMPTZ`.** `timestamp without time zone`
  appears nowhere.
- Every materialisation is idempotent by unique index, so reconcilers can re-run freely.

```
IDENTITY              COMMERCE                MONEY                ENGAGEMENT
users                 trials                  checkout_sessions    rewards
otp_challenges        subscriptions           payments             loyalty_periods
sessions              subscription_plans      provider_events      referrals
                      meal_orders  ★          coupons              leaderboard_points
PROFILE               meal_order_events       coupon_redemptions   leaderboard_periods
user_preferences                              transactions         notifications
addresses             CATALOG                                      notification_preferences
serviceable_pincodes  menu_items              PLATFORM             SUPPORT
onboarding_drafts     daily_menus             idempotency_keys     support_issues
                                              outbox_events
                                              outbox_deliveries
                                              audit_logs
```

## What each phase delivered

### Phase 1 — Foundation and the walking skeleton
Schema, the complete lifecycle resolver with all 39 states tested, OTP authentication,
onboarding with exact-step resume, addresses with PIN serviceability, the trial journey,
checkout with a mock payment provider, and `GET /v1/me/app-state` serving real Home data.

### Phase 2 — Jobs, subscriptions, pricing
pg-boss with four daily reconcilers and a one-second outbox drain. Subscription plans,
quote and checkout. Per-meal date, address and preference changes with cutoff enforcement
and optimistic concurrency. A pure pricing engine and coupons.

### Phase 3 — Profile and money history
CI-runnable integration test harness. Profile hub, notification preferences, the in-app
notification centre, the transactions ledger and receipts.

### Phase 4 — Loyalty and engagement
Healthy Streak qualification as a pure function, reward minting and redemption, referrals,
and the monthly leaderboard with server-authoritative points.

### Phase 5 — Operations
Ops delivery status updates (which is what finally makes states Q and R reachable from
real data), production schedule, meal feedback and issue reporting, refunds and credits,
subscription cancel/resubscribe/pause, and a notification channel port.

## The mock payment provider

The mock does **not** shortcut to a final state. It posts real, signed webhooks to the same
endpoint a real provider hits, so demos exercise signature verification, deduplication and
the out-of-order guard rather than bypassing them.

Seven scenarios, three of which exist purely to catch real bugs:

| Scenario | Purpose |
|---|---|
| `success_immediate`, `pending_then_success`, `pending_forever`, `fail_after_2s` | Drive states U/Z, D→T→U, stuck-pending, E/AA |
| `duplicate_webhook` | The same event delivered twice must not double-schedule meals |
| `out_of_order` | A late `pending` must not downgrade a `captured` |
| `webhook_before_response` | A webhook arriving before the payment transaction commits |

These stand as the contract any real provider must satisfy.

---

# PART III — DECISIONS, BUGS AND WHAT REMAINS

## Bugs found during development

Recorded because each says something about where defects actually hide.

| Bug | How it was found |
|---|---|
| **`date[]` arrays came back as JS `Date`s** — a separate Postgres OID does not inherit the `DATE` parser, reintroducing the exact off-by-one the parser existed to prevent | Response schema validation rejected it |
| **Copy could leak `{resumeDate}` to a user** — the fallback for an unresolvable slot was the template itself | A test asserting no field contains `{` |
| **Onboarding outranked payment recovery**, trapping a user with a pending payment back in the setup wizard | Reasoning about the spec's ordering |
| **Nothing capped materialisation** — a "Both" subscriber on a 20-meal plan would have received 40 deliveries | Reading the rolling reconciler against the plan |
| **Concurrency checked after content validation** — a stale client was told "you already have a delivery in that slot", describing a schedule they could not see | Writing the 409 test |
| **Coupon usage limits did nothing** — `consumed_at` was never set, so the usage counter always returned zero and a one-per-user coupon could be redeemed indefinitely | Suspecting the coupon path and grepping for the write that should have existed |
| **Outbox drain compared a Postgres timestamp to the Node process clock** — any skew left a just-emitted event undrained | A leaderboard test asserting an exact point total |
| **Moving a meal did not update the trial's date summary** — Home kept rendering the original dates, and a meal moved past the old end date made the trial read as completed while deliveries were pending | The first integration test run |

Two patterns worth carrying forward:

- **Pure logic correct, wiring absent.** The coupon bug sat behind 17 passing unit tests
  that fed the eligibility function a usage count directly. Unit tests that mock the input
  cannot see a missing producer.
- **Loose assertions hide real bugs.** The outbox clock bug was only visible because a test
  asserted an exact number. "Greater than zero" would have passed on the second drain.

## A mistake worth recording

During Phase 3 the unit-test glob matched `*.integration.test.ts`, so `pnpm test` ran the
integration suite against the default `.env` — **which TRUNCATEd the development database**
and left a transaction wedged, blocking 37 queries behind an exclusive lock.

No real data was lost; the dev database only held generated test users. The fix is
two-layered: the vitest configs now separate the suites, **and** `resetData()` itself
refuses to run unless the database name contains "test". A config is easy to get wrong
twice; making the destructive statement refuse is the guarantee that actually holds.

## Where the specs contradict each other

`backend-system-handoff.md` §7 ranks subscription-payment-pending **above** trial-active.
`user-lifecycle-state-spec.md` §4 rule 6 says trial Home wins, "even if a future
subscription has already been purchased."

We followed the lifecycle spec, behind `policy.routing.subscriptionPaymentBlocksTrialHome`.
One of the two documents should be corrected.

## Open questions for product

Full detail is in `docs/open-questions-for-product.md`. Summary:

**Blocking — money and legal**

1. Does a "Both" subscriber pay more? They receive 40 meals for the price the card
   advertises as 20 — a real ₹125/meal against an advertised ₹249.95. **Live in the API today.**
2. Confirm ₹899 trial and ₹100 credit toward the first subscription.
3. Failed delivery: automatic credit or support review, and how much?
4. Can coupons stack with loyalty or referral credit?
5. What happens to earned rewards on account deletion or chargeback?
6. Legal copy for renewal and cancellation.
7. Which payment methods in the first release?

**Blocking — operations**

8. The real serviceable PIN code list (currently eight Pune PINs from the prototype).
9. Confirm delivery windows and the 8:00 PM cutoff, and whether dinner needs a later one.
10. Are per-person staff accounts needed before launch, or is a shared ops key acceptable?

**Defaults awaiting a yes:** loyalty at 28 days + 20 meals, paused days extending rather
than resetting, "Both" free meal day getting both slots, 60-day reward expiry, leaderboard
as recognition only, auto-renew charged at T−1, unlimited date changes, no same-day
changes, subscription starting the day after the trial ends, referral paying a free meal day.

## Known gaps

| Gap | Notes |
|---|---|
| **Razorpay** | Scaffold complete and config-switched; every method throws until credentials exist. Five steps documented at the top of `razorpay.ts`. Boot refuses `PAYMENT_PROVIDER=razorpay` without keys, and refuses `mock` in production |
| **Push / WhatsApp** | Channel port exists with a log-backed implementation. A real vendor is an interface to implement |
| **Coupon revalidation** | Spec §5.5 wants a coupon rechecked when the plan or address changes after it is applied. No live path mutates a checkout that way yet |
| **Mock webhook scheduling** | In-process `setTimeout`. Fine for a mock; a real provider owns its own retry |
| **Production secrets** | `JWT_SECRET` and `ADMIN_API_KEY` have development defaults and must be set |

## Running it

```sh
# Postgres 17 must be running
createdb tiffins && createdb tiffins_test

cd server
pnpm install
cp .env.example .env          # then set JWT_SECRET
pnpm migrate && pnpm seed
pnpm dev                      # API on :4000, OpenAPI at /docs
pnpm worker                   # reconcilers + outbox drain

pnpm test                     # 132 unit tests
DATABASE_URL=postgres://tiffins:tiffins@localhost:5432/tiffins_test pnpm test:integration

LIVE=1 ./scripts/regression.sh   # full end-to-end regression, 20 checks
```

Other scripts: `walkthrough.sh` (trial journey), `walkthrough-subscription.sh`,
`verify-payment-edge-cases.sh`, `verify-meal-changes.sh`, and `pnpm jobs:run` which runs
every reconciler twice to demonstrate idempotency.

## Verification status

| Check | Result |
|---|---|
| Unit tests | 132 passing |
| Integration tests | 65 passing |
| Migrations from empty database | Build and reverse cleanly |
| Schema invariants | No naive timestamps; all paise columns integer |
| Lifecycle states | All 20 server-derived states resolve |
| Reconciler idempotency | Second pass creates nothing |
| Regression suite | 20/20, run twice |
| Expo app | Typechecks unchanged |

---

# PART IV — ORIGINAL IDEATION

The three specifications below are reproduced verbatim as Akshay wrote them. They are the
source of truth for intent; where implementation diverged, Part III records why.


---

## Specification 1 — User Lifecycle and Application State

*Source: `docs/user-lifecycle-state-spec.md`*

### User Lifecycle and Application State Specification

Status: Draft for product review  
Product: Food subscription application  
Platforms: iOS, Android and web  
Scope: Entry routing, onboarding, trial, subscription, meal delivery and recovery states

#### 1. Purpose

This document defines every meaningful user lifecycle state and the experience the application should present in that state. It is intended to be reviewed before implementation so navigation, Home variants, trial behaviour and subscription behaviour are not implemented as disconnected screens.

The central product rule is:

- **Home answers:** What is happening with my food today?
- **My Plan answers:** How is my subscription configured and managed over time?

Home is operational and time-sensitive. My Plan is administrative and longitudinal.

#### 2. Primary product surfaces

##### 2.1 Entry flow

The entry flow determines where the user lands after Splash. It includes authentication, onboarding recovery, payment recovery and lifecycle routing.

##### 2.2 Trial Home

Used only while a paid five-day trial is active. It prioritises the next incomplete trial meal, the five-day tracker and trial-to-subscription conversion.

##### 2.3 Subscriber Home

Used after a subscription begins. It prioritises today’s meal, live delivery status, the next seven days and quick actions.

##### 2.4 Conversion Home

Used when the trial is complete and no subscription exists. It summarises the completed trial and provides a focused route to subscription selection.

##### 2.5 My Plan

Available after a subscription has been purchased, including when the subscription is scheduled to begin after an active trial. It contains the full calendar, subscription-wide preferences, billing, remaining meals, nutrition tools and plan management.

##### 2.6 Meal Details

A full page for one meal on one delivery date. Changes made here apply only to that meal unless the user explicitly chooses to change remaining meal dates.

#### 3. Lifecycle state model

The application should derive its destination from independent state domains rather than one large screen-name variable.

##### 3.1 Authentication

```ts
type AuthStatus =
  | 'signed_out'
  | 'otp_required'
  | 'authenticated';
```

##### 3.2 Onboarding

```ts
type OnboardingStatus =
  | 'not_started'
  | 'stories'
  | 'profile'
  | 'trial_preferences'
  | 'delivery_location'
  | 'delivery_address'
  | 'trial_review'
  | 'complete';
```

Store the last completed onboarding step so an interrupted user resumes instead of restarting.

##### 3.3 Trial

```ts
type TrialStatus =
  | 'not_selected'
  | 'payment_pending'
  | 'payment_failed'
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'cancelled';
```

##### 3.4 Subscription

```ts
type SubscriptionStatus =
  | 'none'
  | 'payment_pending'
  | 'payment_failed'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'cancelled_active_until_end'
  | 'expired'
  | 'renewal_failed';
```

##### 3.5 Meal delivery

```ts
type MealStatus =
  | 'scheduled'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'delayed'
  | 'delivery_failed'
  | 'cancelled'
  | 'credit_pending';
```

Trial meals do not support pausing. Subscription meals may support pausing if the commercial policy enables it.

##### 3.6 Payment

```ts
type PaymentStatus =
  | 'not_required'
  | 'initiated'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';
```

#### 4. Entry routing priority

Routing must be evaluated in this order. Higher rules override lower rules.

1. Signed out → Splash, stories or Create Account.
2. OTP required → Verify Number.
3. Onboarding incomplete → Resume the last incomplete onboarding step.
4. Trial payment pending or failed → Trial payment recovery.
5. Subscription payment pending or failed → Subscription payment recovery.
6. Trial active → Trial Home, even if a future subscription has already been purchased.
7. Trial completed and subscription scheduled or active → Subscriber Home.
8. Trial completed and no subscription → Conversion Home.
9. Subscription paused → Paused Home.
10. Subscription expired or ended → Renewal Home.
11. Subscription active → Subscriber Home.

#### 5. State catalogue

##### State A: New user, signed out

**Entry:** Splash → onboarding stories.  
**Primary action:** Get Started.  
**Secondary action:** None.  
**Persistence:** Once stories are completed, do not replay them unless requested from Profile.

Acceptance criteria:

- Get Started opens Create Account.
- Mobile-number input is focused and keyboard-safe.
- Closing and reopening after account creation resumes authentication or onboarding.

##### State B: Returning user, authentication incomplete

**Entry:** Create Account or Verify Number, depending on saved authentication state.  
**Primary action:** Continue with WhatsApp or Verify and Continue.

Acceptance criteria:

- The entered phone number is preserved locally.
- OTP starts focused.
- Changing the number returns to Create Account without replaying stories.

##### State C: Authenticated user, onboarding incomplete

**Entry:** Last incomplete onboarding screen.  
**Home access:** Not available until the minimum trial or subscription setup is complete.

Examples:

- Profile completed, food preference missing → What do you enjoy eating?
- Preferences complete, address missing → Where should we deliver?
- Address complete, payment missing → Trial review/payment.

Acceptance criteria:

- Back navigation follows the onboarding sequence.
- App restart resumes the same logical step.
- Previously entered values remain populated.

##### State D: Trial selected, payment pending

**Entry:** Complete Payment.  
**Primary action:** Check Payment Status or Retry Payment.  
**Secondary action:** Choose Another Payment Method.

Rules:

- Do not create active trial meals until payment succeeds.
- A pending payment must not be presented as failed.
- Refresh payment status when the app becomes active.

##### State E: Trial payment failed

**Entry:** Payment recovery state.  
**Primary action:** Retry Payment.  
**Secondary action:** Change Payment Method.

Show the failed amount, payment method and a plain-language failure explanation when available.

##### State F: Trial scheduled

Used when payment succeeded but the first selected trial date is in the future.

**Home title:** Your trial starts soon.  
**Primary card:** First delivery date, meal preference and address.  
**Primary action:** Review Trial.  
**Subscription action:** Avail Subscription remains available.

##### State G: Trial active, no subscription

**Entry:** Trial Home.  
**Header:** Your five-day trial.  
**Primary content:** Chronologically ordered five-day tracker.  
**Next meal:** First meal whose status is not delivered.  
**Conversion card:** Continue your healthy meal routine.  
**Primary conversion action:** Avail Subscription.

Rules:

- Delivered meals show filled checks.
- The next incomplete meal shows the glowing green ripple.
- Changing a date re-sorts all displayed dates in ascending order.
- The next-delivery highlight follows chronological position, not a fixed meal ID.
- Trial meals cannot be paused.
- Address change requires delivery PIN validation.
- If a PIN is unsupported, preserve the current address and offer date change.
- Meal preferences for tomorrow can be changed until 8:00 PM local time.
- Day-after-tomorrow and later meals remain editable.

##### State H: Trial active, subscription purchased

The trial remains the primary operational experience until it ends.

**Entry:** Trial Home.  
**Conversion card replacement:** Your subscription is ready.  
**Card content:** Plan, start date, meal selection and address.  
**Primary action:** Explore My Plan.

Rules:

- Do not prematurely replace trial dates with subscription dates.
- My Plan shows the scheduled subscription and permits eligible future configuration.
- The subscription begins after the final trial delivery unless the product explicitly supports overlap.

##### State I: Trial completed, no subscription

**Entry:** Conversion Home.  
**Title:** Your five-day trial is complete.  
**Primary action:** Choose Subscription.  
**Secondary action:** Review Trial Meals.

Recommended summary:

- Meals delivered
- Trial dates
- Food and meal preference
- Compact nutrition totals
- Saved address
- Benefits unlocked by subscription

Do not show an empty or frozen active-trial tracker.

##### State J: Subscription scheduled

Used when a subscription is paid but begins later.

**Entry:** Pre-subscription Home or Trial Home if the trial is still active.  
**Primary card:** Subscription starts on [date].  
**Primary action:** Explore My Plan.

My Plan permits editing subscription-wide defaults until the relevant cutoff.

##### State K: Subscription active

**Entry:** Subscriber Home.  
**Home purpose:** Today’s food and immediate delivery actions.

Home order:

1. Greeting and profile action
2. Today’s meal or next scheduled meal
3. Live delivery status
4. Available quick actions
5. Seven-day delivery tracker
6. Weekly nutrition summary
7. Personalised nutrition recommendation
8. Compact plan snapshot with Explore My Plan
9. Feedback and support

The trial conversion card is removed.

##### State L: No meal scheduled today

**Entry:** Subscriber Home.  
**Primary message:** No meal scheduled today.  
**Primary card:** Next scheduled delivery.  
**Secondary content:** Seven-day tracker and weekly nutrition.

Do not show an empty Today’s Meal card.

##### State M: Subscription paused

**Entry:** Paused Home.  
**Primary message:** Your subscription is paused.  
**Primary action:** Resume Subscription.  
**Details:** Resume date, affected meals and billing implications.

Past deliveries and nutrition history remain available.

##### State N: Subscription cancelled but active until end date

**Entry:** Subscriber Home.  
**Plan snapshot:** Active until [date].  
**Primary plan action:** Reactivate Subscription.

Paid upcoming meals remain visible and manageable according to normal cutoffs.

##### State O: Subscription expired or completed

**Entry:** Renewal Home.  
**Primary action:** Renew Subscription.  
**Secondary action:** View Previous Plan.

Keep nutrition history, payment history and past meals accessible.

##### State P: Renewal failed

**Entry:** Subscriber Home with high-priority payment banner.  
**Primary action:** Update Payment Method.  
**Secondary action:** Retry Payment.

Rules:

- Existing paid meals remain visible.
- Unpaid future meals are marked clearly and are not presented as confirmed.
- Do not delete preferences or delivery history.

##### State Q: Delivery delayed

**Home treatment:** Elevate the affected meal above normal content.  
**Status:** Delayed.  
**Actions:** Track Update, Contact Support.

Do not use a success colour for delayed delivery.

##### State R: Delivery failed or address issue

**Home treatment:** High-priority issue card.  
**Actions:** Fix Address, Contact Support, View Credit Status.

The original address remains visible for verification. Any credit or refund state must be explicit.

##### State S: Offline

Show the most recently cached Home state with an offline message.

Rules:

- Read-only information remains available.
- Changes are either disabled or visibly queued.
- Never imply a queued address/date change was accepted by the server.

#### 6. Subscriber Home specification

##### 6.1 Today or next meal card

Required fields:

- Delivery date
- Lunch, dinner or both
- Food type
- Menu summary
- Delivery window
- Delivery address label
- Current delivery status
- Modification cutoff

Allowed actions are conditional. Hide unavailable actions instead of showing a wall of disabled controls.

##### 6.2 Delivery status progression

```text
Scheduled → Preparing → Out for delivery → Delivered
```

Exceptional paths:

```text
Scheduled → Delayed
Out for delivery → Delivery failed
Delivery failed → Credit pending → Credited
```

##### 6.3 Seven-day tracker

- Chronological order is mandatory.
- Delivered meals use a filled check.
- Next incomplete meal uses a green bordered circle and subtle expanding ripple.
- Future meals use neutral circles.
- Changed meals may show a small rescheduled indicator.
- Tapping any delivery opens that meal’s full-page Meal Details.

##### 6.4 Plan snapshot

Keep this compact:

- Plan name
- Meals remaining
- Active-through date
- Explore My Plan

Do not put full billing or preference management on Home.

#### 7. My Plan specification

##### 7.1 Header summary

- Plan name
- Active, scheduled, paused or ending status
- Start and end dates
- Meals used and remaining
- Next payment or renewal date, if applicable

##### 7.2 Upcoming deliveries

Use a full calendar or grouped chronological list. Each delivery opens Meal Details.

##### 7.3 Subscription-wide preferences

- Food preference
- Lunch, dinner or both
- Bread preference
- Rice preference
- Primary address

Changes apply only to eligible future meals after confirmation. The confirmation must state the first affected delivery date.

##### 7.4 Nutrition tools

- Nutrient Calculator
- My Diet Plan
- Nutrition History
- Weekly Insights

##### 7.5 Billing and plan management

- Current plan
- Payment method
- Payment history
- Change plan
- Pause subscription, if supported
- Cancel subscription
- Contact support

Destructive actions must use a confirmation step and explain already-paid deliveries.

#### 8. Meal Details specification

Meal Details is a full page, not a bottom sheet.

##### 8.1 Delivered meal

- Delivery date and meal
- Delivered status
- Address
- Menu
- Nutrition summary
- Selected preferences
- Rating and feedback
- Report issue

##### 8.2 Upcoming trial meal

- Delivery date and meal
- Upcoming status
- Address
- Selected preferences
- Change delivery address
- Change delivery date
- Report issue

Trial meals cannot be paused.

##### 8.3 Upcoming subscription meal

May additionally support pause when enabled by product policy.

##### 8.4 Meal-specific preference editing

- Clearly state: Only for [date].
- Saving changes updates only that meal.
- Tomorrow’s meal locks after 8:00 PM local time.
- Subscription-wide preference changes live in My Plan or Profile, never in this flow.

##### 8.5 Date change

- State the original date in the description.
- Display selectable future dates beginning tomorrow.
- Previously vacated future dates become selectable again.
- After choosing a date, show original date → new date.
- Primary action: Only This Meal.
- Secondary action: Change This and Remaining Meals.
- Re-sort deliveries chronologically after saving.

##### 8.6 Address change

- PIN field autofocuses.
- Validate a six-digit PIN before showing Save Address.
- Unsupported PIN leaves the current address unchanged.
- Unsupported PIN offers Change Delivery Date.

#### 9. Notification and feedback patterns

##### 9.1 Toast

- Appears near the bottom safe area.
- Fully rounded pill shape.
- Slides upward with a short spring motion.
- Automatically dismisses.
- Used for successful local actions and non-blocking feedback.

##### 9.2 Inline error

Use for form validation and failed PIN/payment states. Keep it close to the relevant control.

##### 9.3 Blocking confirmation

Use for payment, cancellation, remaining-meal date changes and other multi-item consequences.

#### 10. Required persisted data

```ts
type AppLifecycleState = {
  authStatus: AuthStatus;
  onboardingStatus: OnboardingStatus;
  lastCompletedOnboardingStep?: string;
  trialStatus: TrialStatus;
  trialPaymentStatus: PaymentStatus;
  trialStartDate?: string;
  trialEndDate?: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPaymentStatus: PaymentStatus;
  subscriptionPlanId?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionMealsRemaining?: number;
  subscriptionAutoRenew?: boolean;
  nextMealId?: string;
  lastSuccessfulSyncAt?: string;
};
```

Each meal should store an actual ISO delivery date. Display strings such as `Monday, 27 July` must be derived rather than used as the source of truth.

#### 11. Cross-cutting rules

##### 11.1 Dates

- Store ISO dates with timezone context.
- Sort using date values, never labels or IDs.
- Derive the next delivery from the first incomplete chronological meal.

##### 11.2 Cutoffs

- Cutoffs use the delivery location’s timezone.
- Show the cutoff before it passes.
- Explain why editing is unavailable after it passes.

##### 11.3 Light and dark modes

Every new state must define both modes at implementation time. Dark mode is not a later styling pass.

##### 11.4 Accessibility

- Support system text scaling within the established safe limit.
- Never clip button labels.
- Use text and icon/status shape together; colour alone is insufficient.
- Honour reduced-motion preference for shimmer, ripple and toast motion.

##### 11.5 Empty and loading states

Every data-driven section must define loading, empty, populated and error states.

#### 12. Suggested implementation phases

##### Phase 1: Lifecycle foundation

- Central state types
- Entry router
- Persistence and onboarding resume
- Trial/subscription status derivation
- ISO meal dates

##### Phase 2: Complete trial states

- Trial scheduled
- Trial active
- Trial completed conversion Home
- Trial payment recovery

##### Phase 3: Subscriber core

- Subscriber Home
- My Plan
- Subscription scheduled
- Subscription active
- Meal-specific and subscription-wide editing separation

##### Phase 4: Recovery and retention

- Renewal warning
- Renewal failure
- Pause/cancel/reactivate
- Delivery failures and credits
- Offline cache behaviour

##### Phase 5: Nutrition tools

- Nutrient Calculator
- Diet Plan
- Nutrition History
- Weekly Insights

#### 13. Decisions requiring product approval

Before implementation, confirm:

1. Does a paid subscription always begin after an active trial ends?
2. Can subscription meals be paused, and what is the cutoff?
3. Are subscriptions fixed-duration or auto-renewing?
4. Can users change meal count after purchase?
5. Does changing subscription-wide preferences affect all future meals or only meals after a preparation cutoff?
6. Are weekends treated differently from weekdays?
7. What happens financially when a delivery PIN is unsupported after payment?
8. Is a failed delivery credited automatically or reviewed by support?
9. How early should renewal prompts appear?
10. What information remains accessible after cancellation or expiry?

#### 14. Review checklist

- [ ] Entry destination is defined for every lifecycle state.
- [ ] Trial Home and Subscriber Home are distinct.
- [ ] Home and My Plan have non-overlapping primary purposes.
- [ ] Subscription purchased during trial is defined.
- [ ] Payment pending and failure states are defined.
- [ ] Trial completion without subscription is defined.
- [ ] Scheduled, active, paused, cancelled and expired subscription states are defined.
- [ ] Meal cutoffs and PIN validation are defined.
- [ ] Date changes preserve chronological order.
- [ ] Per-meal and subscription-wide preference changes are separated.
- [ ] Delivery exceptions and credits are defined.
- [ ] Offline behaviour is defined.
- [ ] Light, dark and accessibility requirements are included.


---

## Specification 2 — Checkout, Coupons, Profile, Settings and Loyalty

*Source: `docs/checkout-profile-loyalty-spec.md`*

### Checkout, Coupons, Profile, Settings and Loyalty Specification

Status: Draft for product review  
Product: Healthy Tiffins  
Platforms: iOS, Android and web  
Depends on: `docs/user-lifecycle-state-spec.md`  
Scope: Trial/subscription checkout, coupons, payment recovery, Profile, Settings, saved addresses, transactions, referrals, notifications, app permissions, logout, loyalty programme and leaderboard

#### 1. Purpose

This document defines the product behaviour required after onboarding, trial and subscription selection. It is intended to prevent checkout, account management and loyalty from becoming disconnected features.

The product rules are:

- **Checkout answers:** What am I buying, where will it be delivered, what will I pay and what happens next?
- **Profile answers:** Who am I and what account-level information belongs to me?
- **Settings answers:** How should the application behave and communicate with me?
- **Loyalty answers:** What progress have I earned through completed paid meals, and what benefit will I receive?
- **Transactions answer:** What was charged, credited, refunded or rewarded, and why?

#### 2. Research basis and design direction

The specification adapts patterns reviewed from:

- [Uber Eats checkout](https://mobbin.com/flows/4997f6c8-d37e-43f0-9d42-5908c636ea90): progressive checkout, prominent delivery context and a persistent final action.
- [Careem food ordering](https://mobbin.com/flows/e9c617d9-65fc-4fe6-8cec-354fe2678673): readable payment breakdown, savings visibility and payment method near the payable action.
- [7-Eleven checkout](https://mobbin.com/flows/a55144aa-ee90-4c04-a931-d4d42322a8ad): compact delivery, contact and cart-summary hierarchy.
- [Fanatics Live settings](https://mobbin.com/flows/3af5a8c1-6cf4-4c0c-9172-29947d0513cb): grouped settings destinations and a quiet logout treatment.
- [Urban Company account](https://mobbin.com/flows/bcc857a9-c457-4731-b523-21e6e170d7d9): service-oriented account shortcuts, address/payment management and referral placement.
- [Crypto.com profile and settings](https://mobbin.com/flows/99b5f1cf-e030-49da-ba80-c4921b30360d): clear separation of profile, security, permissions and account closure.

##### 2.1 Reference lock

- Preserve the existing Healthy Tiffins visual system: Geist Sans, minimal surfaces, green accent, black/white gradient primary buttons, 16 px content spacing and Phosphor bold icons.
- Reuse existing page headers, cards, fields, selection borders, toasts, payment states and responsive behaviour.
- Checkout is a full page, not a bottom sheet.
- Profile and Settings use grouped rows with restrained icons; avoid a grid of decorative cards.
- Loyalty may use a warmer reward surface, but green remains the action and progress colour.
- Every new surface must ship in light and dark modes together.

#### 3. Navigation architecture

Profile is opened from the profile icon on Home. It is the root for account, service history and settings.

```text
Profile
├── My plan
├── Loyalty & rewards
│   ├── Monthly progress
│   ├── Leaderboard
│   └── Reward history
├── Saved addresses
├── Transactions
├── Refer & earn
├── Notifications
├── Settings
│   ├── Account settings
│   ├── App permissions
│   ├── Appearance
│   ├── Language
│   ├── Privacy and data
│   └── Help and legal
└── Log out
```

Checkout can be entered from:

- Start Trial / Proceed to Payment
- Choose Subscription / Continue to Payment
- Re-subscribe
- Renew Subscription
- Retry Payment
- Update Payment Method

#### 4. Checkout state model

```ts
type CheckoutKind =
  | 'trial'
  | 'subscription'
  | 'renewal'
  | 'resubscription';

type CheckoutStep =
  | 'review'
  | 'coupon'
  | 'payment_method'
  | 'processing'
  | 'pending'
  | 'success'
  | 'failed';

type CouponStatus =
  | 'idle'
  | 'validating'
  | 'applied'
  | 'invalid'
  | 'expired'
  | 'ineligible'
  | 'usage_limit_reached'
  | 'removed';

type CheckoutState = {
  checkoutId: string;
  kind: CheckoutKind;
  step: CheckoutStep;
  planId?: string;
  trialId?: string;
  selectedMealPreference: 'lunch' | 'dinner' | 'both';
  deliveryAddressId: string;
  deliveryDates: string[];
  couponCode?: string;
  couponStatus: CouponStatus;
  paymentMethodId?: string;
  price: PriceBreakdown;
  idempotencyKey: string;
};

type PriceBreakdown = {
  basePrice: number;
  deliveryFee: number;
  taxes: number;
  discount: number;
  loyaltyCredit: number;
  trialCredit: number;
  totalPayable: number;
  currency: 'INR';
};
```

All amounts are stored in paise. UI formats them as rupees.

#### 5. Checkout flow

##### 5.1 Step 1: Review order

Page title:

- Trial: **Review your trial**
- Subscription: **Review your subscription**
- Renewal: **Review your renewal**

Required sections, in order:

1. Plan or trial summary
2. Meal selection
3. Delivery dates or subscription start date
4. Primary delivery address
5. Food, bread and rice preferences
6. Coupon and rewards
7. Price breakdown
8. Payment method
9. Terms and cancellation note
10. Sticky payment action

The user can edit preferences or address without losing checkout state. Returning from an edit restores the same scroll position and applied coupon.

##### 5.2 Plan summary

Trial summary shows:

- Five selected delivery dates
- Lunch, dinner or both
- Food preference
- Trial price

Subscription summary shows:

- Weekly, Monthly or Quarterly
- Duration
- Number of meals
- Lunch, dinner or both
- Subscription start date
- Renewal behaviour

Do not repeat marketing benefits at this stage. Checkout is for verification and payment confidence.

##### 5.3 Delivery address

Show:

- Address label
- Complete delivery address
- PIN code
- Edit action

Rules:

- Address must pass serviceability validation before payment.
- If serviceability changes while checkout is open, block payment and explain the issue.
- Editing address reruns price and delivery-fee calculation.
- Never silently replace the selected address.

##### 5.4 Coupon entry

The default checkout row reads **Apply coupon**. Tapping it opens a coupon page or modal with:

- Coupon-code field
- Apply action
- Available coupons
- Eligibility copy
- Clear savings value

Applied state shows:

- Coupon code
- Savings
- Short benefit statement
- Remove action

Coupon validation errors:

- This coupon does not exist.
- This coupon has expired.
- This coupon is not valid for this plan.
- This coupon requires a minimum order of ₹X.
- This coupon is only for new users.
- This coupon has already been used.
- This coupon cannot be combined with your reward.

Do not clear the entered code after a validation failure.

##### 5.5 Coupon calculation order

The backend should own calculation. The mock/client order is:

```text
Base plan price
− eligible plan discount
− coupon discount
− trial credit
− loyalty credit
+ delivery charge
+ tax on the legally applicable base
= total payable
```

Rules:

- Total payable cannot be negative.
- Only one promotional coupon may be active.
- Loyalty rewards and coupons may stack only when the offer explicitly permits it.
- A coupon is revalidated when plan, meal selection, dates, address or payment attempt changes.
- If a coupon becomes invalid, explain why and update the total before allowing payment.

##### 5.6 Available coupon cards

Each coupon card contains:

- Benefit headline, for example **Save ₹150**
- Coupon code
- Minimum purchase, plan and user eligibility
- Expiry date
- Apply action
- Terms disclosure

Recommended initial coupon types:

1. Flat amount off
2. Percentage off with a maximum cap
3. New subscriber offer
4. Referral reward
5. Win-back offer for an expired subscriber
6. Operations-issued service recovery credit

##### 5.7 Payment method

Supported mock methods:

- UPI
- Credit or debit card
- Net banking
- Digital wallet

Show the selected method on the review page. Changing it opens the existing payment-method selection page.

Do not store full card or UPI credentials in local app state. Store only provider references and display-safe labels.

##### 5.8 Sticky payment action

The button includes intent and amount:

```text
Start trial                    Pay ₹899
Subscribe                    Pay ₹2,499
Renew plan                   Pay ₹2,499
```

Requirements:

- Full width within 16 px page margins
- Keyboard-safe
- Never clip with system text scaling
- Disabled only with an adjacent explanation
- One press creates one payment attempt using an idempotency key

##### 5.9 Processing

After payment begins:

- Lock duplicate submission.
- Show a stable processing state.
- Preserve checkout locally.
- Do not treat an unknown provider response as failure.

##### 5.10 Pending payment

Reuse the existing payment-pending system.

- Show the method and total.
- **Go to home** remains available while confirmation runs.
- Home shows a payment-status widget returning to the pending page.
- Refresh on app foreground and through manual status check.
- When confirmed, animate the loader into a size-matched success state.

##### 5.11 Success

Trial success shows:

- Trial active confirmation
- Five selected dates
- Meal preference
- Address
- Amount paid
- Transaction reference
- Go to Home

Subscription success shows:

- Subscription active or scheduled
- Plan and duration
- Start date
- Meal preference
- Address
- Next meal
- Amount paid
- Transaction reference
- Explore My Plan

##### 5.12 Failure

Show:

- Failure reason, when safe and available
- Amount
- Payment method
- Retry Payment
- Change Payment Method
- Contact Support

A retry creates a new payment attempt while preserving the same checkout selection.

#### 6. Profile home

##### 6.1 Header

Show:

- Name
- Masked WhatsApp number
- Profile edit icon
- Current lifecycle label: Trial, Active Subscription, Subscription Ending or No Active Plan

##### 6.2 Primary destinations

Order:

1. My Plan
2. Loyalty & Rewards
3. Saved Addresses
4. Transactions
5. Refer & Earn
6. Notifications
7. Settings
8. Help & Support

Use grouped rows with a left icon, title, optional status/value and right chevron. Avoid large empty cards.

##### 6.3 Lifecycle-specific profile behaviour

- Trial user: My Plan opens Trial Details.
- Scheduled subscriber: My Plan shows the scheduled subscription.
- Active subscriber: My Plan opens the active plan.
- Expired user: My Plan opens plan history with Renew Subscription.
- User without purchases: Transactions and rewards remain visible with useful empty states.

#### 7. Edit profile

Fields:

- Full name
- Date of birth
- Gender
- WhatsApp number, read-only with Change Number flow

Rules:

- Reuse onboarding field tokens.
- Enter advances to the next editable field.
- Only the required content moves when the keyboard opens.
- Changing the WhatsApp number requires OTP verification.
- Save returns to the existing Profile instance without replaying entrance animation.

#### 8. Saved addresses

##### 8.1 Address list

Each address shows:

- Home, Office or Other label
- Full address
- PIN code
- Default badge, when applicable
- Edit and overflow actions

Actions:

- Add address
- Edit address
- Set as default
- Delete address

##### 8.2 Address rules

- At least one default address exists when any address is saved.
- Deleting the default requires choosing another default.
- An address used by an upcoming meal cannot be silently deleted.
- The delete confirmation lists affected future deliveries.
- Saving runs PIN serviceability validation.
- An unsupported address may be saved for later only if clearly marked **Delivery unavailable**.

##### 8.3 Empty state

Title: **No saved addresses**  
Description: **Add an address to make future meal setup faster.**  
Action: **Add address**

#### 9. Transactions

##### 9.1 Transaction list

Group by month. Each row shows:

- Trial, subscription, renewal, refund, credit or reward label
- Date and time
- Amount
- Status
- Payment method or **Reward credit**

Filters:

- All
- Payments
- Refunds and credits
- Rewards

##### 9.2 Transaction detail

Show:

- Transaction reference
- Order/plan reference
- Status timeline
- Plan or trial purchased
- Price breakdown
- Coupon and discount
- Payment method
- Billing date
- Refund/credit details, if any
- Download receipt
- Contact Support

Status values:

```ts
type TransactionStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'credited';
```

#### 10. Account settings

Sections:

##### Personal

- Personal information
- Change WhatsApp number
- Saved addresses

##### Security and privacy

- Active sessions, future scope
- Privacy policy
- Data and consent
- Download my data, future scope
- Delete account

##### App

- Appearance: System, Light, Dark
- Language: English initially; localisation-ready
- App permissions
- Notification preferences

##### Support and legal

- Help Centre
- Contact Support
- Terms of Service
- Cancellation and refund policy
- App version

Account deletion is destructive and requires:

1. Explanation of active trial/subscription consequences
2. OTP confirmation
3. Explicit Delete Account action
4. Final completion state

#### 11. Notifications

##### 11.1 In-app notification centre

Categories:

- Meal updates
- Delivery issues
- Payment and renewal
- Subscription updates
- Rewards and referrals
- Product announcements

Each notification stores:

- Title
- Description
- Timestamp
- Read/unread state
- Category
- Destination/deep link

Actions:

- Mark as read
- Mark all as read
- Open destination

##### 11.2 Notification preferences

Channels:

- Push notification
- WhatsApp
- SMS, future scope
- Email, future scope

Controls:

- Delivery and meal status: required operational channel; cannot be fully disabled when active deliveries exist
- Payment and account security: required operational channel
- Meal reminders
- Nutrition insights
- Rewards and leaderboard
- Offers and promotions

Promotional consent must be separate from operational messages.

#### 12. App permissions

Permission rows:

- Location
- Notifications
- Camera, only if later required for support/upload
- Photos, only if later required for support/upload

Each row shows:

- Current status: Allowed, Limited, Denied or Not Requested
- Why the permission is useful
- Manage action

Rules:

- Do not request permissions merely by opening the settings page.
- If denied, Manage opens operating-system settings.
- Location must explain that manual address search remains available.
- Notification denial must not block checkout or meal access.

#### 13. Refer and Earn

##### 13.1 Referral page

Show:

- Personal referral code
- Share link
- Copy code
- How it works
- Eligibility and reward
- Referral history

Recommended initial rule:

1. Friend signs up with the code.
2. Friend completes their first paid trial or subscription payment.
3. Referrer reward changes from Pending to Earned.
4. Reward is issued as account credit with an expiry date.

Do not issue a reward for account creation alone.

##### 13.2 Referral states

```ts
type ReferralStatus =
  | 'invited'
  | 'signed_up'
  | 'payment_pending'
  | 'qualified'
  | 'rewarded'
  | 'rejected';
```

Show only privacy-safe friend details, for example `A••••• joined`.

#### 14. Loyalty programme

##### 14.1 Product promise

Programme name placeholder: **Healthy Streak**

Primary reward:

> Complete one continuous paid subscription month and receive one free day of meals.

“One free day” means the same meal configuration as the user’s active plan on the redeemed date:

- Lunch plan → one free lunch
- Dinner plan → one free dinner
- Both plan → one free lunch and dinner day

##### 14.2 Month qualification

A user qualifies when all conditions are true:

1. At least 28 consecutive calendar days of an active paid subscription have elapsed.
2. All required payments for that qualification period succeeded.
3. At least 20 scheduled meal days were delivered or validly fulfilled.
4. The account is not suspended for fraud or abuse.

Operational cancellations, service credits and provider-caused failures do not break progress. User-paused days extend the qualification end date rather than resetting progress.

The UI must state the exact rule being used. Do not use “one month” while calculating an unexplained different threshold.

##### 14.3 Progress card

Profile and My Plan may show:

- **18 of 28 days completed**
- Expected qualification date
- Progress bar
- Current streak
- “One free meal day” reward preview
- View details

Do not place loyalty progress above today’s operational meal status on Home.

##### 14.4 Reward lifecycle

```ts
type LoyaltyRewardStatus =
  | 'locked'
  | 'in_progress'
  | 'earned'
  | 'available'
  | 'scheduled'
  | 'redeemed'
  | 'expired'
  | 'revoked';
```

When earned:

- Create a reward record.
- Notify the user.
- Show **Choose your free meal day**.
- Allow selection from eligible future dates.

##### 14.5 Reward redemption

Rules:

- Redeem on an eligible serviceable future day.
- Use the current default meal preference and address.
- Validate address and capacity before confirmation.
- Reward cannot be converted to cash.
- Reward cannot be transferred.
- Reward cannot overlap another free-meal reward on the same day.
- Recommended expiry: 60 days after issue.
- A redeemed reward appears in Transactions as ₹0 charged with its original value disclosed.

##### 14.6 Loyalty interruption

- Subscription paused: freeze progress and extend the expected qualification date.
- Renewal failed: freeze progress during the grace period.
- Subscription cancelled: preserve already earned rewards; incomplete progress expires at the end of plan unless policy explicitly permits carry-over.
- Refund or chargeback: recalculate qualification and explain any revoked reward.

#### 15. Leaderboard

##### 15.1 Purpose

The leaderboard adds friendly motivation but does not determine the guaranteed one-month reward. The free meal remains rules-based so users are not penalised by other users’ activity.

##### 15.2 Ranking period

- Monthly leaderboard
- Resets on the first day of each calendar month in the user’s delivery timezone
- Shows the current month and the previous final result

##### 15.3 Points

Recommended initial scoring:

| Event | Points | Rule |
|---|---:|---|
| Paid meal delivered | 10 | Award after Delivered status |
| Complete a full paid week | 25 | Once per qualifying week |
| Submit meal rating | 2 | Maximum once per delivered meal |
| Qualified referral | 50 | Award after referral payment succeeds |
| Complete monthly streak | 100 | Award once when loyalty month qualifies |

Do not award points for opening the app, tapping notifications or other artificial engagement.

##### 15.4 Leaderboard UI

Header:

- Current month
- User rank
- User points
- Days until reset

List:

- Top three highlighted without excessive podium decoration
- Rank
- Privacy-safe display name
- Points
- Current user pinned when outside visible top ranks

Use initials and partial names by default. Users can opt out of public ranking while still earning their guaranteed reward.

##### 15.5 Leaderboard rewards

Keep the first release simple:

- Guaranteed reward: one free meal day after the qualifying paid month
- Leaderboard: recognition only at launch
- Future top-rank prizes require explicit terms, fulfilment limits and anti-fraud review

This avoids implying that only top-ranked users receive the one-month benefit.

##### 15.6 Anti-abuse

- Points are server-authoritative.
- Reversed payments reverse related points.
- Duplicate ratings do not create duplicate points.
- Referral self-invites and repeated devices/payment methods may be reviewed.
- Suspicious accounts show **Rank under review**, not a misleading final rank.

#### 16. Logout

Logout is placed at the bottom of Settings as a quiet destructive row, not a primary button.

Confirmation:

Title: **Log out of Healthy Tiffins?**  
Description: **Your saved account data will remain available when you sign in again.**

Actions:

- Log out
- Stay signed in

On logout:

- Clear authentication tokens and sensitive local data.
- Preserve non-sensitive theme preference.
- Do not cancel an active trial or subscription.
- Return to the signed-out entry flow.

#### 17. Empty, loading and error states

Every profile destination must define:

- Loading skeleton
- Empty state
- Populated state
- Offline state
- Recoverable error with Retry

Examples:

- Transactions empty: **No transactions yet. Your trial and subscription payments will appear here.**
- Referrals empty: **Your invites will appear here after friends use your code.**
- Rewards empty: **Complete your first paid subscription month to earn a free meal day.**
- Leaderboard unavailable: show cached rank with last-updated time or a retry state.

#### 18. Accessibility and responsive requirements

- Respect system text size without clipping labels or amounts.
- Buttons grow vertically for multi-line labels when required.
- Use status icons and text in addition to colour.
- Minimum touch target: 44 × 44 points.
- Coupons, rewards and transaction status must be screen-reader labelled.
- Honour reduced motion for shimmer, reward celebration, progress and toast animation.
- Hide scrollbars visually while preserving scrolling and accessibility.
- Sticky checkout actions must not cover the final content or system home indicator.

#### 19. Analytics events

Minimum event catalogue:

```text
checkout_opened
checkout_address_edited
coupon_entry_opened
coupon_applied
coupon_failed
coupon_removed
payment_method_selected
payment_started
payment_pending
payment_succeeded
payment_failed
profile_opened
profile_destination_opened
address_added
address_updated
address_deleted
transaction_opened
referral_shared
referral_qualified
loyalty_progress_viewed
loyalty_reward_earned
loyalty_reward_scheduled
loyalty_reward_redeemed
leaderboard_viewed
leaderboard_opt_out
notification_preference_changed
permission_manage_opened
logout_confirmed
```

Do not include raw phone numbers, full addresses, coupon secrets or payment credentials in analytics.

#### 20. Required persisted data

```ts
type ProfileState = {
  userId: string;
  fullName: string;
  phoneMasked: string;
  dateOfBirth?: string;
  gender?: string;
  defaultAddressId?: string;
  notificationPreferences: NotificationPreferences;
  appearance: 'system' | 'light' | 'dark';
  leaderboardOptIn: boolean;
};

type LoyaltyProgress = {
  qualificationStartDate: string;
  expectedQualificationDate: string;
  activeDays: number;
  requiredDays: number;
  fulfilledMealDays: number;
  requiredFulfilledMealDays: number;
  status: 'in_progress' | 'qualified' | 'frozen' | 'expired';
};

type LeaderboardEntry = {
  period: string;
  rank: number;
  points: number;
  displayName: string;
  isCurrentUser: boolean;
};
```

Payment, coupon eligibility, loyalty qualification, referral qualification and leaderboard points must eventually be server-authoritative. Local mock state is acceptable during prototype implementation.

#### 21. Acceptance criteria by module

##### Checkout and coupons

- User can review and edit all purchase-critical information.
- Coupon state survives navigation and app interruption.
- Totals update immediately after valid changes.
- Duplicate payment presses cannot create duplicate purchases.
- Pending, success and failure route into the existing lifecycle state machine.

##### Profile and Settings

- Every listed destination is reachable from Profile.
- Back navigation restores the exact prior Profile scroll position.
- Profile edits do not replay page animations on return.
- Addresses and notification preferences persist locally in prototype mode.
- Logout clears the session without altering the commercial plan.

##### Loyalty and leaderboard

- Progress is calculated from qualifying paid subscription activity.
- A full qualifying month creates exactly one free-meal-day reward.
- Paused or failed states explain whether progress is frozen, extended or revoked.
- Leaderboard ranking does not replace the guaranteed monthly reward.
- The user can opt out of public ranking.

#### 22. Suggested implementation phases

##### Phase 1: Checkout foundation

- Checkout state and price model
- Review page
- Coupon validation mock
- Payment method selection
- Pending/success/failure lifecycle integration

##### Phase 2: Profile core

- Profile landing page
- Edit profile
- Saved addresses
- Transactions and receipt detail
- Settings, permissions and logout

##### Phase 3: Engagement

- Notifications centre and preferences
- Refer and Earn
- Referral history

##### Phase 4: Loyalty

- Healthy Streak progress
- Reward earning and redemption
- Reward transaction records
- Monthly leaderboard
- Opt-out and anti-abuse states

##### Phase 5: Production services

- Backend-authoritative coupons and pricing
- Payment provider integration and webhooks
- Receipt generation
- Referral attribution
- Loyalty and leaderboard service
- Notification delivery and deep links

#### 23. Product decisions required before production

1. Is the loyalty qualification exactly 28 active days, one billing cycle or a calendar month?
2. What minimum delivered-meal count qualifies for the reward?
3. Do user-paused days extend the period or disqualify the month?
4. Can coupons stack with loyalty or referral credit?
5. What is the expiry period for a free meal day and referral credit?
6. Does “Both” receive lunch and dinner as the single free day? This specification recommends yes.
7. Does leaderboard ranking have prizes at launch? This specification recommends recognition only.
8. Which payment methods are included in the first production release?
9. Which notifications are mandatory operational messages under the product’s legal policy?
10. What happens to earned rewards after account deletion or a payment chargeback?


---

## Specification 3 — Backend System Handoff

*Source: `docs/backend-system-handoff.md`*

### Healthy Tiffins Backend System Handoff

This document explains the product concept, core flows, state logic, backend domains, APIs, business rules, and implementation expectations for the Healthy Tiffins app.

It is written for the backend team so they can start building the server-side system that powers the current React Native / Expo frontend.

---

#### 1. Product concept

Healthy Tiffins is a home-style Indian meal subscription app.

The product starts with a simple five-day paid trial and then converts users into recurring meal subscriptions. The core promise is:

- fresh everyday meals
- simple WhatsApp-first sign-in
- configurable vegetarian / non-vegetarian preferences
- lunch, dinner, or both
- delivery address management
- trial-to-subscription conversion
- nutrition tools unlocked after subscription
- loyalty rewards after a completed paid month

The current frontend uses local mock state for most flows. The backend must become the source of truth for user state, trial status, subscription status, payments, meal schedules, rewards, and operational delivery updates.

---

#### 2. Product principles

##### 2.1 Home is operational

The Home screen should answer:

- What is happening with my meals this week?
- What is happening today?
- Do I need to take action?
- Is my trial or subscription active, pending, failed, ending, or completed?

Home should not feel like an admin dashboard. It should be time-sensitive and food-first.

##### 2.2 Profile / My Plan is administrative

Profile and plan pages should answer:

- What plan am I on?
- What are my saved addresses?
- What transactions happened?
- What notifications and app permissions are enabled?
- What loyalty reward did I earn?

##### 2.3 Backend owns truth; frontend renders states

The frontend currently has a state selector for demo/testing. In production, lifecycle state should come from backend-derived state, not user-selected UI state.

The backend should provide a compact `appState` response that tells the client:

- where to route the user
- what Home variant to render
- what action widgets to show
- what calendar dates and meal markers to show
- what payment / checkout state exists

---

#### 3. Platforms and client assumptions

The app targets:

- iOS
- Android
- Web

Frontend stack:

- Expo React Native
- Uniwind / Tailwind-style classes
- React Native Reanimated
- local mock state currently

Backend should expose platform-neutral APIs.

Important client expectations:

- All monetary values should be returned in paise from the backend.
- All dates should use ISO `YYYY-MM-DD`.
- All timestamps should use ISO 8601.
- Backend should include display-friendly strings where policy-sensitive wording matters.
- Client should not calculate subscription totals independently.

---

#### 4. End-to-end user journey

##### 4.1 First launch

1. Splash screen
2. Onboarding stories
3. Get Started
4. Create account with WhatsApp number
5. OTP verification
6. Tell us about you
   - full name
   - date of birth
   - gender
7. Trial intro screen
8. Choose food preference
   - vegetarian
   - non-vegetarian
   - mix of both
9. Choose five delivery days
10. Choose meal preference
    - lunch
    - dinner
    - both
11. If food preference is “mix of both”, configure veg/non-veg per selected meal/date
12. Choose bread preference
13. Choose rice preference
14. Select delivery location
15. Add address details
16. Confirm delivery address
17. Trial at a glance
18. Checkout
19. Payment processing / pending / success / failed
20. Trial scheduled or active Home

##### 4.2 Trial to subscription

During trial, the Home screen contains a subscription conversion card.

User taps:

- Avail Subscription

Then the subscription purchase flow opens as a page:

1. Choose subscription
2. Select meal preference
3. Select plan
   - weekly
   - monthly
   - quarterly
4. Review subscription
5. Apply coupon / rewards
6. Select payment method
7. Pay
8. Subscription payment processing / pending / success / failed
9. Subscription scheduled or active

##### 4.3 Active subscription

The active subscription uses the same Home structure as trial:

- top weekly calendar
- meal status markers
- operational widget
- nutrition tools card
- next selected meal
- profile access

Unselected subscription days are shown as disabled / grey dates.

---

#### 5. Phone authentication logic

##### 5.1 Indian mobile number validation

Client and backend should apply the same rules:

- remove `+91`
- remove spaces
- remove hyphens
- keep digits only
- final number must be exactly 10 digits
- first digit must be `6`, `7`, `8`, or `9`

Example:

```text
+91 86553 09919 -> 8655309919
```

##### 5.2 OTP rules

Backend should support:

- OTP challenge creation
- OTP verification
- resend timer
- attempt limit
- rate limiting per phone number
- device/session binding
- expiry

Recommended rules:

- OTP length: 6 digits
- OTP expiry: 5 minutes
- max attempts: 5
- resend cooldown: 30 seconds
- max OTP requests per phone: configurable per hour/day

OTP values must never be logged.

---

#### 6. Lifecycle states

The app currently models these states in the frontend. Backend should produce equivalent lifecycle states.

| ID | State | Meaning |
|---|---|---|
| A | New user, signed out | No authenticated session |
| B | Authentication incomplete | OTP challenge started but not verified |
| C | Onboarding incomplete | User verified but profile/trial setup incomplete |
| D | Trial payment pending | Payment initiated, final status unknown |
| T | Trial payment pending + success | Pending screen is resolving into success |
| U | Trial payment success | Payment confirmed, ready to enter Home |
| E | Trial payment failed | Trial payment failed |
| F | Trial scheduled | Trial paid but first meal not active yet |
| G | Trial active, no subscription | Trial active, subscription not purchased |
| H | Trial active, subscription purchased | Trial active and future subscription purchased |
| I | Trial completed, no subscription | Trial ended; user should subscribe |
| J | Subscription scheduled | Subscription purchased, start date in future |
| K | Subscription active | Paid subscription active |
| L | No meal today | Active subscription but no selected meal today |
| M | Subscription paused | Subscription paused |
| N | Cancelled active until end date | Cancelled but paid period still active |
| O | Subscription expired | Paid access ended |
| P | Renewal payment failed | Renewal failed; action needed |
| Q | Delivery delayed | Upcoming delivery delayed |
| R | Delivery failed or address issue | Delivery needs attention |
| S | Offline | Client is offline and showing last saved schedule |
| V | Checkout review | User is reviewing subscription purchase |
| W | Apply coupon | Coupon entry flow |
| X | Coupon applied | Coupon applied successfully |
| Y | Subscription payment pending | Subscription payment awaiting final status |
| Z | Subscription payment success | Subscription payment successful |
| AA | Subscription payment failed | Subscription payment failed |
| AB | Profile | Profile hub |
| AC | Edit profile | Personal information |
| AD | Saved addresses | Address management |
| AE | Transactions | Payment/reward ledger |
| AF | Account settings | Settings hub |
| AG | Notifications | Notification preferences |
| AH | App permissions | Device permissions |
| AI | Refer and earn | Referral program |
| AJ | Healthy Streak progress | Loyalty progress |
| AK | Monthly leaderboard | Loyalty leaderboard |
| AL | Free meal earned | Reward earned state |
| AM | Redeem free meal | Free meal redemption flow |

---

#### 7. Routing priority

Backend should return a single recommended route. Suggested priority:

1. Signed out
2. OTP incomplete
3. Profile/onboarding incomplete
4. Trial payment pending
5. Trial payment failed
6. Subscription payment pending
7. Subscription payment failed
8. Delivery issue that blocks today’s/future meal
9. Trial active/scheduled/completed
10. Subscription scheduled/active/paused/expired
11. Normal Home

Example:

```json
{
  "route": "home",
  "lifecycleState": "TRIAL_ACTIVE_NO_SUBSCRIPTION",
  "requiresAction": false
}
```

---

#### 8. Core backend domains

##### 8.1 User

Represents the account.

Key fields:

```ts
User {
  id: string
  phoneCountryCode: "+91"
  phoneNumber: string
  phoneVerifiedAt: string | null
  fullName: string | null
  dateOfBirth: string | null
  gender: "woman" | "man" | "non_binary" | "prefer_not_to_say" | null
  status: "active" | "blocked" | "deleted"
  createdAt: string
  updatedAt: string
}
```

##### 8.2 Address

Stores delivery locations.

Key fields:

```ts
Address {
  id: string
  userId: string
  label: "home" | "office" | "other"
  line1: string
  line2?: string
  buildingOrSociety?: string
  flatOrHouse?: string
  landmark?: string
  deliveryInstructions?: string
  city: string
  state: string
  pincode: string
  latitude?: number
  longitude?: number
  isDefault: boolean
  isServiceable: boolean
  createdAt: string
  updatedAt: string
}
```

##### 8.3 Preferences

Global meal preferences.

```ts
UserPreferences {
  userId: string
  foodPreference: "vegetarian" | "non_vegetarian" | "mix"
  mealPreference: "lunch" | "dinner" | "both"
  breadPreference: "chapati" | "bhakri" | "paratha" | "any"
  ricePreference: "plain_rice" | "jeera_rice" | "brown_rice" | "any"
  updatedAt: string
}
```

##### 8.4 Trial

Represents the five-day trial.

```ts
Trial {
  id: string
  userId: string
  status:
    | "draft"
    | "payment_pending"
    | "payment_failed"
    | "scheduled"
    | "active"
    | "completed"
    | "cancelled"
  selectedDates: string[]
  addressId: string
  foodPreference: "vegetarian" | "non_vegetarian" | "mix"
  mealPreference: "lunch" | "dinner" | "both"
  breadPreference: string
  ricePreference: string
  startsAt: string | null
  endsAt: string | null
  paymentId?: string
  createdAt: string
  updatedAt: string
}
```

##### 8.5 Meal order

Each lunch/dinner delivery should be a separate meal order. This is important because one date can have lunch and dinner with different statuses.

```ts
MealOrder {
  id: string
  userId: string
  sourceType: "trial" | "subscription" | "reward"
  sourceId: string
  serviceDate: string
  mealSlot: "lunch" | "dinner"
  foodType: "vegetarian" | "non_vegetarian"
  breadPreference: string
  ricePreference: string
  addressId: string
  status:
    | "scheduled"
    | "upcoming"
    | "preparing"
    | "out_for_delivery"
    | "delivered"
    | "delayed"
    | "failed"
    | "cancelled"
    | "skipped"
  canChangeDate: boolean
  canChangeAddress: boolean
  canChangePreference: boolean
  lockedReason?: string
  deliveryWindowStart: string
  deliveryWindowEnd: string
  createdAt: string
  updatedAt: string
}
```

##### 8.6 Subscription plan

```ts
SubscriptionPlan {
  id: string
  code: "weekly" | "monthly" | "quarterly"
  name: "Weekly" | "Monthly" | "Quarterly"
  durationDays: number
  mealCount: number
  pricePaise: number
  effectivePricePerMealPaise: number
  discountPaise: number
  badge?: "recommended" | "best_value"
  isActive: boolean
}
```

##### 8.7 Subscription

```ts
Subscription {
  id: string
  userId: string
  planId: string
  status:
    | "scheduled"
    | "active"
    | "paused"
    | "cancelled_active_until_end"
    | "expired"
    | "renewal_failed"
  mealPreference: "lunch" | "dinner" | "both"
  selectedWeekdays: number[]
  foodPreference: "vegetarian" | "non_vegetarian" | "mix"
  breadPreference: string
  ricePreference: string
  addressId: string
  startsAt: string
  endsAt: string
  cancelledAt?: string
  createdAt: string
  updatedAt: string
}
```

##### 8.8 Checkout session

```ts
CheckoutSession {
  id: string
  userId: string
  kind: "trial" | "subscription" | "renewal" | "resubscription"
  status:
    | "review"
    | "payment_method_required"
    | "payment_pending"
    | "payment_success"
    | "payment_failed"
    | "expired"
  sourceId: string
  couponId?: string
  rewardId?: string
  paymentMethod: "upi" | "card" | "net_banking" | "wallet" | null
  priceBreakdown: PriceBreakdown
  createdAt: string
  updatedAt: string
}

PriceBreakdown {
  planPricePaise: number
  deliveryChargesPaise: number
  taxesPaise: number
  discountPaise: number
  trialCreditPaise: number
  rewardCreditPaise: number
  totalPayablePaise: number
}
```

##### 8.9 Payment

```ts
Payment {
  id: string
  userId: string
  checkoutSessionId: string
  provider: "razorpay" | "stripe" | "cashfree" | "mock"
  providerPaymentId?: string
  providerOrderId?: string
  amountPaise: number
  currency: "INR"
  status:
    | "created"
    | "pending"
    | "authorized"
    | "captured"
    | "failed"
    | "refunded"
  failureReason?: string
  idempotencyKey: string
  createdAt: string
  updatedAt: string
}
```

##### 8.10 Loyalty and rewards

```ts
LoyaltyProgress {
  userId: string
  month: string
  activeDaysCompleted: number
  requiredActiveDays: number
  fulfilledMealDays: number
  requiredFulfilledMealDays: number
  rewardStatus: "not_earned" | "earned" | "redeemed" | "expired"
  expectedRewardDate?: string
}

Reward {
  id: string
  userId: string
  type: "free_meal_day"
  status: "earned" | "redeemed" | "expired"
  earnedAt: string
  expiresAt: string
  redeemedAt?: string
  redeemedMealOrderIds?: string[]
}
```

---

#### 9. Trial business logic

##### 9.1 Trial date selection

User must select exactly five delivery dates.

Rules:

- Dates should be stored in ascending order.
- User can select continuous dates.
- Saturday/Sunday may be skipped.
- Selection should allow enough surrounding dates so user can choose five valid delivery days.
- Weekend separate-address flow is future scope and currently disabled.
- Trial currently uses one delivery address.

##### 9.2 Trial meal changes

During trial:

- User cannot pause meals.
- User can change future delivery dates.
- User can change future delivery address if pincode is serviceable.
- User can change per-meal preferences only when policy allows.

Important:

When a delivery date changes, the meal order moves to the new date, but the meal status must remain attached to the meal order.

Example:

- Original dates: 21, 22, 23, 24, 25 July
- User changes 23 July to 27 July
- Home should show dates sorted: 21, 22, 24, 25, 27
- The status marker for the moved meal should move with the meal order.

##### 9.3 Meal preference cutoff

Meal preference change policy:

- User can change future meal preferences.
- For next-day meal preferences, changes are allowed only until 8:00 PM the previous day.
- After 8:00 PM, the next day’s meal preference is locked.
- Day-after-tomorrow and later dates can still be changed.

Backend should return:

```json
{
  "canChangePreference": false,
  "lockedReason": "Meal preferences for tomorrow are locked after 8:00 PM."
}
```

##### 9.4 Date change policy

Date changes should only apply to future meal orders.

Backend should allow changing a future meal back into an earlier available date if that earlier date is still in the future and serviceable.

The available date window should not only move forward from the current selected date. It should include valid future dates that can replace the meal.

---

#### 10. Subscription business logic

##### 10.1 Plans

Subscription plans:

- Weekly
- Monthly
- Quarterly

Plan data should remain backend-owned.

Home should not expose prices directly in the subscription conversion card.

Prices appear in:

- choose subscription page
- review subscription page
- checkout/payment pages

##### 10.2 Meal selection

Meal preference:

- lunch
- dinner
- both

Fixed delivery windows:

- Lunch: 11:00 AM to 1:00 PM
- Dinner: 6:30 PM to 8:30 PM

No selectable delivery time slots are needed in MVP.

##### 10.3 Active subscription Home

Subscription Home should reuse the trial Home structure:

- status label
- title
- description
- week calendar
- meal markers
- action widget
- nutrition tools card
- next selected meal

For unselected subscription days:

- show dates in grey
- show inactive markers
- do not make them primary actions

##### 10.4 Subscription ending

If subscription is cancelled but active until end date:

- show “subscription ending”
- show widget: “Plan active until {date}”
- CTA: “Re-subscribe to this plan”
- CTA should use a darker shade of the widget background, not a primary black gradient button.

##### 10.5 Subscription ended

If subscription ended:

- do not show pause icon in meal markers
- today’s date can still be highlighted
- meal markers should be grey
- show subscribe/re-subscribe action

---

#### 11. Delivery and meal marker logic

##### 11.1 Marker colors

Food type:

- vegetarian = green
- non-vegetarian = red

Status:

- delivered = filled circle with white check
- upcoming/current = hollow circle
- delayed = orange/pastel orange treatment
- failed/needs attention = red/pastel red treatment
- cancelled past meal = cancel icon
- skipped/unselected = grey

##### 11.2 Ripple logic

Ripple should only appear for the upcoming/current actionable delivery.

Do not show ripple for:

- past delivered meals
- past cancelled meals
- past failed meals
- previous delayed meals
- inactive/unselected dates

If lunch is delivered and dinner is upcoming, show active ripple only on dinner marker.

##### 11.3 Delayed delivery

Delayed delivery is an upcoming delivery condition.

Do not show past delivered orders as delayed.

If a delivery is delayed:

- show pastel orange widget
- show orange marker only on affected upcoming meal
- copy should mention the affected date/slot

Example:

```text
Delivery delayed
The dinner delivery for 24 July is delayed. Your remaining selected delivery days are unchanged.
```

##### 11.4 Failed delivery

Failed delivery or address issue:

- show pastel red widget
- show action required copy
- for already delivered previous orders, do not allow preference/date/address edits

---

#### 12. Payment logic

##### 12.1 Trial payment pending

Trial payment pending page:

- shows confirming payment state
- bottom CTA: “Go to home”
- no “Choose another payment method” CTA while confirming

Home should show a widget:

- title: “Check payment status”
- tapping it returns to trial payment pending page
- button style should be a darker shade of widget background, not primary gradient

##### 12.2 Pending to success

When payment status changes from pending to success:

- pending loader around card icon completes
- loader becomes a green completed ring
- icon background becomes green
- icon changes to check
- success screen appears
- user then goes to Home

Visual sizes should stay consistent during this transition.

##### 12.3 Payment failed

Payment failed state:

- use red pastel icon background
- icon container size should match success icon container
- offer retry/payment method change where appropriate

##### 12.4 Payment webhooks

Payment provider webhooks must be idempotent.

Recommended webhook event handling:

```json
{
  "event": "payment.captured",
  "providerPaymentId": "pay_xxx",
  "providerOrderId": "order_xxx",
  "checkoutSessionId": "checkout_123",
  "amountPaise": 89900,
  "currency": "INR",
  "status": "captured",
  "occurredAt": "2026-07-22T10:42:00+05:30"
}
```

Webhook effects:

- update `Payment`
- update `CheckoutSession`
- create/update `Trial` or `Subscription`
- create meal orders
- emit notification/toast event if needed

---

#### 13. Checkout and coupon logic

##### 13.1 Checkout review

Review subscription page should include:

- plan widget
- current preferences
- delivery address
- coupon/reward widget
- price breakdown
- payment method
- terms
- sticky payment action

Backend should provide this as a single checkout summary payload.

##### 13.2 Coupon application

Coupon rules:

- backend validates eligibility
- backend calculates discount
- frontend only displays returned totals
- coupon application must be idempotent
- expired / invalid / already-used responses should be explicit

Coupon response example:

```json
{
  "couponStatus": "applied",
  "couponCode": "AKSHAY250",
  "message": "Coupon applied successfully.",
  "priceBreakdown": {
    "planPricePaise": 279900,
    "deliveryChargesPaise": 0,
    "taxesPaise": 0,
    "discountPaise": 25000,
    "trialCreditPaise": 0,
    "rewardCreditPaise": 0,
    "totalPayablePaise": 254900
  }
}
```

---

#### 14. Profile, settings, and loyalty

##### 14.1 Profile

Profile sections:

- My plan
- Loyalty & rewards
- Saved addresses
- Transactions
- Refer & earn
- Notifications
- Settings

##### 14.2 Personal information

Fields:

- full name
- date of birth
- gender
- verified WhatsApp number

WhatsApp number should be read-only.

Backend should return:

```json
{
  "phoneNumberMasked": "+91 •••••9919",
  "phoneVerified": true
}
```

##### 14.3 Saved addresses

Features:

- list addresses
- add address
- edit address
- set as default
- delete non-default address
- serviceability check by pincode

##### 14.4 Transactions

Transaction list should include:

- monthly subscription payments
- trial payments
- rewards
- credits
- refunds

```ts
Transaction {
  id: string
  userId: string
  type: "payment" | "refund" | "credit" | "reward"
  title: string
  subtitle: string
  amountPaise?: number
  displayAmount?: string
  status: "succeeded" | "failed" | "pending" | "credited"
  occurredAt: string
}
```

##### 14.5 Refer and earn

Referral flow:

1. Friend signs up with user’s code
2. Friend completes first payment
3. User account credits are unlocked

```ts
Referral {
  id: string
  referrerUserId: string
  referredUserId?: string
  code: string
  status: "signed_up" | "qualified" | "rewarded" | "expired"
  createdAt: string
  qualifiedAt?: string
}
```

##### 14.6 Loyalty program

User earns one free meal day after completing one continuous paid subscription month.

MVP rule:

- complete one paid month
- backend marks reward as earned
- user can redeem one free meal day within 60 days

Leaderboard:

- monthly points
- user rank
- top public entries
- user’s own row

Remove opt-out from MVP unless legal/product later requires it.

---

#### 15. Notifications

Notification preference categories:

- delivery and meal status
- payment and account security
- meal reminders
- nutrition insights
- rewards and leaderboard
- offers and promotions

Operational messages should remain enabled when legally required.

Backend should store preferences but push notification permission itself is device/client-level.

---

#### 16. Suggested API surface

##### 16.1 App state

```http
GET /v1/me/app-state
```

Returns the state needed to route and render Home.

Example:

```json
{
  "user": {
    "id": "user_123",
    "fullName": "Akshay Borade"
  },
  "lifecycleState": "SUBSCRIPTION_ACTIVE",
  "route": "home",
  "home": {
    "statusLabel": "active subscription",
    "title": "Your meals this week",
    "description": "Your selected deliveries remain available below.",
    "selectedDate": "2026-07-23",
    "week": [
      {
        "date": "2026-07-21",
        "day": "MON",
        "isToday": false,
        "isSelected": true,
        "isDisabled": false,
        "markers": [
          {
            "mealOrderId": "meal_1",
            "slot": "lunch",
            "foodType": "vegetarian",
            "status": "delivered",
            "showRipple": false
          },
          {
            "mealOrderId": "meal_2",
            "slot": "dinner",
            "foodType": "non_vegetarian",
            "status": "delivered",
            "showRipple": false
          }
        ]
      }
    ],
    "widget": {
      "type": "nutrition_tools_ready",
      "tone": "default",
      "title": "Your nutrition tools are ready",
      "description": "Explore your subscribed meals and personalised nutrition tools.",
      "cta": "Explore My Plan"
    }
  }
}
```

##### 16.2 Auth

```http
POST /v1/auth/otp/start
POST /v1/auth/otp/verify
POST /v1/auth/logout
```

##### 16.3 Profile

```http
GET /v1/me/profile
PATCH /v1/me/profile
GET /v1/me/preferences
PATCH /v1/me/preferences
```

##### 16.4 Addresses

```http
GET /v1/me/addresses
POST /v1/me/addresses
PATCH /v1/me/addresses/:addressId
DELETE /v1/me/addresses/:addressId
POST /v1/serviceability/check
POST /v1/geocode/search
POST /v1/geocode/reverse
```

##### 16.5 Trial

```http
POST /v1/me/trial/draft
PATCH /v1/me/trial/:trialId/preferences
PATCH /v1/me/trial/:trialId/dates
PATCH /v1/me/trial/:trialId/address
GET /v1/me/trial/:trialId/review
POST /v1/me/trial/:trialId/checkout
GET /v1/me/trial/:trialId/payment-status
```

##### 16.6 Meal orders

```http
GET /v1/me/meals/:mealOrderId
PATCH /v1/me/meals/:mealOrderId/date
PATCH /v1/me/meals/:mealOrderId/address
PATCH /v1/me/meals/:mealOrderId/preferences
POST /v1/me/meals/:mealOrderId/feedback
POST /v1/me/meals/:mealOrderId/report-issue
```

##### 16.7 Subscription

```http
GET /v1/subscription-plans
POST /v1/me/subscriptions/quote
POST /v1/me/subscriptions/checkout
GET /v1/me/subscriptions/current
PATCH /v1/me/subscriptions/:subscriptionId/preferences
PATCH /v1/me/subscriptions/:subscriptionId/address
POST /v1/me/subscriptions/:subscriptionId/cancel
POST /v1/me/subscriptions/:subscriptionId/resubscribe
```

##### 16.8 Checkout and payments

```http
GET /v1/me/checkout/:checkoutSessionId
POST /v1/me/checkout/:checkoutSessionId/apply-coupon
POST /v1/me/checkout/:checkoutSessionId/remove-coupon
PATCH /v1/me/checkout/:checkoutSessionId/payment-method
POST /v1/me/checkout/:checkoutSessionId/pay
GET /v1/me/checkout/:checkoutSessionId/payment-status
POST /v1/webhooks/payments/:provider
```

##### 16.9 Loyalty, referrals, transactions

```http
GET /v1/me/transactions
GET /v1/me/referrals
POST /v1/me/referrals/share-event
GET /v1/me/loyalty/progress
GET /v1/loyalty/leaderboard?month=2026-07
GET /v1/me/rewards
POST /v1/me/rewards/:rewardId/redeem
```

##### 16.10 Notifications and settings

```http
GET /v1/me/notification-preferences
PATCH /v1/me/notification-preferences
GET /v1/me/settings
PATCH /v1/me/settings
```

---

#### 17. Backend events

Recommended internal events:

- `otp.requested`
- `otp.verified`
- `profile.completed`
- `trial.created`
- `trial.payment.pending`
- `trial.payment.succeeded`
- `trial.payment.failed`
- `trial.scheduled`
- `trial.completed`
- `subscription.checkout.created`
- `subscription.payment.succeeded`
- `subscription.payment.failed`
- `subscription.activated`
- `subscription.renewal.failed`
- `meal.scheduled`
- `meal.delivered`
- `meal.delayed`
- `meal.failed`
- `meal.cancelled`
- `meal.date_changed`
- `meal.address_changed`
- `meal.preference_changed`
- `coupon.applied`
- `reward.earned`
- `reward.redeemed`
- `referral.qualified`

Events should be stored or emitted in a way that supports audit and notifications.

---

#### 18. Admin and operations requirements

Backend/admin should eventually support:

- serviceable pincodes
- delivery zones
- kitchen menus
- meal nutrition values
- daily production schedule
- delivery status updates
- delayed/failed delivery marking
- customer support issue resolution
- payment reconciliation
- refunds/credits
- coupon management
- subscription plan management
- leaderboard/monthly reward configuration

---

#### 19. Security and reliability

##### 19.1 Authentication

- Use short-lived access token + refresh token or secure session.
- Bind sessions to device where possible.
- Rate-limit OTP actions.
- Never expose raw OTP.
- Never log sensitive tokens.

##### 19.2 Idempotency

Required for:

- checkout creation
- payment initiation
- payment webhooks
- coupon application
- date changes
- address changes
- reward redemption

Use `Idempotency-Key` header for mutating operations.

##### 19.3 Concurrency

Meal schedules should use a version field.

Example:

```json
{
  "scheduleVersion": 4
}
```

If client tries to update an old schedule version, return conflict:

```http
409 Conflict
```

##### 19.4 Audit logs

Audit these actions:

- payment status changes
- meal date changes
- address changes
- preference changes
- subscription cancellation/resubscription
- reward redemption
- support issue creation/resolution

---

#### 20. MVP backend build order

Recommended implementation order:

1. User + OTP auth
2. Profile and preferences
3. Address and serviceability
4. Trial draft and trial scheduling
5. Checkout session and mock payment status
6. Trial Home app-state payload
7. Meal order detail and future date/address/preference changes
8. Subscription plans and subscription checkout
9. Subscription Home app-state payload
10. Coupon and price breakdown
11. Transactions
12. Profile/settings pages
13. Loyalty progress and reward redemption
14. Referral program
15. Payment provider integration
16. Delivery operations/admin events

---

#### 21. Future scope

These are intentionally not required for first backend MVP:

- separate weekend delivery address
- full nutrition calculator personalization
- generated diet plans based on goals
- dynamic delivery slots
- subscription pausing by user
- complex refund/credit policies
- live delivery tracking
- real map pin movement/reverse geocoding beyond basic address selection
- admin dashboard UI

---

#### 22. Open questions for product/backend alignment

Before production launch, decide:

1. Which payment provider will be used?
2. What is the exact trial price?
3. Are trial meals refundable if delivery fails?
4. Which pincodes are serviceable at launch?
5. Can users change address for same-day meals?
6. What is the operational cutoff for address changes?
7. Does lunch and dinner have separate cutoff times?
8. How many times can a user change a delivery date?
9. Can users redeem a free meal day during an active subscription only?
10. Should referrals unlock credit, free meals, or coupon discounts?
11. What legal copy is required for subscription renewal/cancellation?

---

#### 23. Definition of backend done

Backend MVP is ready when:

- user can sign in with OTP
- user profile and preferences persist
- user can create a five-day trial
- trial checkout/payment state persists
- trial Home is driven by backend state
- meal details are driven by backend meal orders
- future meal date/address/preference changes follow policy
- subscription plans and checkout are backend-driven
- subscription active Home is backend-driven
- coupon/price breakdown is backend-authoritative
- profile/settings/transactions/loyalty/referrals are persisted
- payment webhooks are idempotent
- app-state API can route all major lifecycle states
