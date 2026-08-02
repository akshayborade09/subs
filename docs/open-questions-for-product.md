# Healthy Tiffins — Open Product Questions

**For:** Akshay Borhade
**From:** Backend team
**Date:** 2 August 2026
**Status:** Backend Phases 1–5 complete. Razorpay integration held pending commercial terms.

---

## Why this document

The three specs together list 31 open questions. Most have sensible defaults already
implemented, so this is not a list of blockers — it is a list of decisions that are
currently being made *by default* rather than *by you*.

**Every answer below is one line in `server/src/platform/config/policy.ts`.** Changing
any of them is a config edit and a redeploy, not a rewrite. So please do not feel these
need to be perfect — they need to be *decided*.

Sections A and B change what customers are charged or receive, so they should be settled
before launch. Section C is a list of defaults that only need a yes.

---

## A. Money and legal — these block launch

### A1. Does a "Both" subscriber pay more than a lunch-only one?

You confirmed `mealCount` means **20 service days**. That means a Both (lunch + dinner)
subscriber receives **40 meals** for the same ₹4,999 as a lunch-only subscriber receives 20.

Their real price is **₹125 per meal**, but the plan card advertises **₹249.95**.

Two ways out:

- Show a different per-meal figure depending on the selected meal preference, or
- Give Both its own price point

**This is live in the API today**, so it needs an answer before real customers see a plan card.

### A2. Confirm the trial economics

Currently **₹899** for the five-day trial, with **₹100** credited toward the first
subscription. Both were taken from the prototype's checkout screen and have never been
formally confirmed.

### A3. Failed delivery — automatic credit or support review?

Today a failed delivery opens a support issue and an operator decides the credit amount.
If it should be automatic, we need the rule and the value.

### A4. Can coupons stack with loyalty or referral credit?

Defaulted to **no**, with a per-coupon override. This decides what discount combinations
are possible at checkout.

### A5. What happens to earned rewards on account deletion or a chargeback?

Not implemented — a reward currently just survives both. Needs a rule.

### A6. Legal copy for subscription renewal and cancellation

Not written. Needs to come from whoever owns compliance.

### A7. Which payment methods for the first release?

UPI, card, net banking and wallet are all modelled. The answer narrows both the checkout
UI and the Razorpay configuration.

---

## B. Operations — needed before the first real delivery

### B1. Which PIN codes are serviceable at launch?

Seeded with the eight Pune PINs from the prototype:
`411001, 411007, 411014, 411021, 411027, 411038, 411045, 411057`.
We need the real list.

### B2. Confirm the delivery windows

Lunch **11:00–13:00**, dinner **18:30–20:30**, identical every day.

### B3. Confirm the 8:00 PM cutoff

Changes to tomorrow's meal lock at 8:00 PM the previous day, and lunch and dinner share
that one cutoff. Ops may want a later cutoff for dinner — worth checking with the kitchen.

### B4. Who gets ops access, and is a shared key acceptable for now?

The ops tools use a single shared admin key plus a mandatory operator name recorded in the
audit trail. Real per-person staff accounts are a separate piece of work. We need to know
whether that is required before launch or can follow.

---

## C. Quick confirmations — defaults already in place

These only need a yes, or a correction.

| Decision | Current default |
|---|---|
| Loyalty qualification | 28 active days **and** 20 delivered meal days |
| Paused days | Extend the streak rather than reset it |
| "Both" free meal day | Receives both lunch and dinner |
| Reward expiry | 60 days |
| Leaderboard | Recognition only, no prizes |
| Subscriptions | Auto-renew, charged 1 day before period end |
| User-initiated pause | **Enabled** — see note below |
| Date changes per meal | Unlimited |
| Same-day changes | Not allowed |
| Address change cutoff | Same as meal preferences |
| Subscription start date | The day after the trial's final delivery |
| Referral reward | A free meal day, not credit or a coupon |
| Trial length | 5 delivery days |

**Note on pause:** the lifecycle spec lists user-initiated pause as needing product
approval, but the app already renders a "paused" Home screen — so it had to be reachable
for that screen to mean anything. It is enabled, and is one config line to turn off.

---

## D. A contradiction between the specs

The two specs disagree on routing priority:

- `backend-system-handoff.md` §7 ranks **subscription-payment-pending above trial-active**
- `user-lifecycle-state-spec.md` §4 rule 6 says **trial Home wins**, "even if a future
  subscription has already been purchased"

We followed the lifecycle spec, behind a config flag. Worth correcting whichever is wrong
so the next person reading them does not have to guess.

---

## E. Not for Akshay — external dependencies

| Dependency | Status |
|---|---|
| Razorpay credentials | In progress. Scaffold ready; five steps documented in `razorpay.ts` |
| Push / WhatsApp vendor | Undecided. Channel port exists; a real provider is an interface to implement |
| Production secrets | `JWT_SECRET` and `ADMIN_API_KEY` both have development defaults and **must be set** before anything is publicly reachable |

---

## What is already built

Backend Phases 1–5 are complete and on the `backend_init` branch: OTP authentication,
onboarding, the trial journey, subscriptions, per-meal changes with cutoffs, coupons,
profile and transactions, the Healthy Streak loyalty programme, referrals, the monthly
leaderboard, and the ops/delivery surface.

All 39 lifecycle states from the specification are supported. Coverage is 132 unit tests
and 65 integration tests, with a regression suite that runs the whole thing end to end.
