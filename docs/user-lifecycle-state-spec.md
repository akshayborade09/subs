# User Lifecycle and Application State Specification

Status: Draft for product review  
Product: Food subscription application  
Platforms: iOS, Android and web  
Scope: Entry routing, onboarding, trial, subscription, meal delivery and recovery states

## 1. Purpose

This document defines every meaningful user lifecycle state and the experience the application should present in that state. It is intended to be reviewed before implementation so navigation, Home variants, trial behaviour and subscription behaviour are not implemented as disconnected screens.

The central product rule is:

- **Home answers:** What is happening with my food today?
- **My Plan answers:** How is my subscription configured and managed over time?

Home is operational and time-sensitive. My Plan is administrative and longitudinal.

## 2. Primary product surfaces

### 2.1 Entry flow

The entry flow determines where the user lands after Splash. It includes authentication, onboarding recovery, payment recovery and lifecycle routing.

### 2.2 Trial Home

Used only while a paid five-day trial is active. It prioritises the next incomplete trial meal, the five-day tracker and trial-to-subscription conversion.

### 2.3 Subscriber Home

Used after a subscription begins. It prioritises today’s meal, live delivery status, the next seven days and quick actions.

### 2.4 Conversion Home

Used when the trial is complete and no subscription exists. It summarises the completed trial and provides a focused route to subscription selection.

### 2.5 My Plan

Available after a subscription has been purchased, including when the subscription is scheduled to begin after an active trial. It contains the full calendar, subscription-wide preferences, billing, remaining meals, nutrition tools and plan management.

### 2.6 Meal Details

A full page for one meal on one delivery date. Changes made here apply only to that meal unless the user explicitly chooses to change remaining meal dates.

## 3. Lifecycle state model

The application should derive its destination from independent state domains rather than one large screen-name variable.

### 3.1 Authentication

```ts
type AuthStatus =
  | 'signed_out'
  | 'otp_required'
  | 'authenticated';
```

### 3.2 Onboarding

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

### 3.3 Trial

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

### 3.4 Subscription

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

### 3.5 Meal delivery

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

### 3.6 Payment

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

## 4. Entry routing priority

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

## 5. State catalogue

### State A: New user, signed out

**Entry:** Splash → onboarding stories.  
**Primary action:** Get Started.  
**Secondary action:** None.  
**Persistence:** Once stories are completed, do not replay them unless requested from Profile.

Acceptance criteria:

- Get Started opens Create Account.
- Mobile-number input is focused and keyboard-safe.
- Closing and reopening after account creation resumes authentication or onboarding.

### State B: Returning user, authentication incomplete

**Entry:** Create Account or Verify Number, depending on saved authentication state.  
**Primary action:** Continue with WhatsApp or Verify and Continue.

Acceptance criteria:

- The entered phone number is preserved locally.
- OTP starts focused.
- Changing the number returns to Create Account without replaying stories.

### State C: Authenticated user, onboarding incomplete

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

### State D: Trial selected, payment pending

**Entry:** Complete Payment.  
**Primary action:** Check Payment Status or Retry Payment.  
**Secondary action:** Choose Another Payment Method.

Rules:

- Do not create active trial meals until payment succeeds.
- A pending payment must not be presented as failed.
- Refresh payment status when the app becomes active.

### State E: Trial payment failed

**Entry:** Payment recovery state.  
**Primary action:** Retry Payment.  
**Secondary action:** Change Payment Method.

Show the failed amount, payment method and a plain-language failure explanation when available.

### State F: Trial scheduled

Used when payment succeeded but the first selected trial date is in the future.

**Home title:** Your trial starts soon.  
**Primary card:** First delivery date, meal preference and address.  
**Primary action:** Review Trial.  
**Subscription action:** Avail Subscription remains available.

### State G: Trial active, no subscription

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

### State H: Trial active, subscription purchased

The trial remains the primary operational experience until it ends.

**Entry:** Trial Home.  
**Conversion card replacement:** Your subscription is ready.  
**Card content:** Plan, start date, meal selection and address.  
**Primary action:** Explore My Plan.

Rules:

- Do not prematurely replace trial dates with subscription dates.
- My Plan shows the scheduled subscription and permits eligible future configuration.
- The subscription begins after the final trial delivery unless the product explicitly supports overlap.

### State I: Trial completed, no subscription

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

### State J: Subscription scheduled

Used when a subscription is paid but begins later.

**Entry:** Pre-subscription Home or Trial Home if the trial is still active.  
**Primary card:** Subscription starts on [date].  
**Primary action:** Explore My Plan.

My Plan permits editing subscription-wide defaults until the relevant cutoff.

### State K: Subscription active

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

### State L: No meal scheduled today

**Entry:** Subscriber Home.  
**Primary message:** No meal scheduled today.  
**Primary card:** Next scheduled delivery.  
**Secondary content:** Seven-day tracker and weekly nutrition.

Do not show an empty Today’s Meal card.

### State M: Subscription paused

**Entry:** Paused Home.  
**Primary message:** Your subscription is paused.  
**Primary action:** Resume Subscription.  
**Details:** Resume date, affected meals and billing implications.

Past deliveries and nutrition history remain available.

### State N: Subscription cancelled but active until end date

**Entry:** Subscriber Home.  
**Plan snapshot:** Active until [date].  
**Primary plan action:** Reactivate Subscription.

Paid upcoming meals remain visible and manageable according to normal cutoffs.

### State O: Subscription expired or completed

**Entry:** Renewal Home.  
**Primary action:** Renew Subscription.  
**Secondary action:** View Previous Plan.

Keep nutrition history, payment history and past meals accessible.

### State P: Renewal failed

**Entry:** Subscriber Home with high-priority payment banner.  
**Primary action:** Update Payment Method.  
**Secondary action:** Retry Payment.

Rules:

- Existing paid meals remain visible.
- Unpaid future meals are marked clearly and are not presented as confirmed.
- Do not delete preferences or delivery history.

### State Q: Delivery delayed

**Home treatment:** Elevate the affected meal above normal content.  
**Status:** Delayed.  
**Actions:** Track Update, Contact Support.

Do not use a success colour for delayed delivery.

### State R: Delivery failed or address issue

**Home treatment:** High-priority issue card.  
**Actions:** Fix Address, Contact Support, View Credit Status.

The original address remains visible for verification. Any credit or refund state must be explicit.

### State S: Offline

Show the most recently cached Home state with an offline message.

Rules:

- Read-only information remains available.
- Changes are either disabled or visibly queued.
- Never imply a queued address/date change was accepted by the server.

## 6. Subscriber Home specification

### 6.1 Today or next meal card

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

### 6.2 Delivery status progression

```text
Scheduled → Preparing → Out for delivery → Delivered
```

Exceptional paths:

```text
Scheduled → Delayed
Out for delivery → Delivery failed
Delivery failed → Credit pending → Credited
```

### 6.3 Seven-day tracker

- Chronological order is mandatory.
- Delivered meals use a filled check.
- Next incomplete meal uses a green bordered circle and subtle expanding ripple.
- Future meals use neutral circles.
- Changed meals may show a small rescheduled indicator.
- Tapping any delivery opens that meal’s full-page Meal Details.

### 6.4 Plan snapshot

Keep this compact:

- Plan name
- Meals remaining
- Active-through date
- Explore My Plan

Do not put full billing or preference management on Home.

## 7. My Plan specification

### 7.1 Header summary

- Plan name
- Active, scheduled, paused or ending status
- Start and end dates
- Meals used and remaining
- Next payment or renewal date, if applicable

### 7.2 Upcoming deliveries

Use a full calendar or grouped chronological list. Each delivery opens Meal Details.

### 7.3 Subscription-wide preferences

- Food preference
- Lunch, dinner or both
- Bread preference
- Rice preference
- Primary address

Changes apply only to eligible future meals after confirmation. The confirmation must state the first affected delivery date.

### 7.4 Nutrition tools

- Nutrient Calculator
- My Diet Plan
- Nutrition History
- Weekly Insights

### 7.5 Billing and plan management

- Current plan
- Payment method
- Payment history
- Change plan
- Pause subscription, if supported
- Cancel subscription
- Contact support

Destructive actions must use a confirmation step and explain already-paid deliveries.

## 8. Meal Details specification

Meal Details is a full page, not a bottom sheet.

### 8.1 Delivered meal

- Delivery date and meal
- Delivered status
- Address
- Menu
- Nutrition summary
- Selected preferences
- Rating and feedback
- Report issue

### 8.2 Upcoming trial meal

- Delivery date and meal
- Upcoming status
- Address
- Selected preferences
- Change delivery address
- Change delivery date
- Report issue

Trial meals cannot be paused.

### 8.3 Upcoming subscription meal

May additionally support pause when enabled by product policy.

### 8.4 Meal-specific preference editing

- Clearly state: Only for [date].
- Saving changes updates only that meal.
- Tomorrow’s meal locks after 8:00 PM local time.
- Subscription-wide preference changes live in My Plan or Profile, never in this flow.

### 8.5 Date change

- State the original date in the description.
- Display selectable future dates beginning tomorrow.
- Previously vacated future dates become selectable again.
- After choosing a date, show original date → new date.
- Primary action: Only This Meal.
- Secondary action: Change This and Remaining Meals.
- Re-sort deliveries chronologically after saving.

### 8.6 Address change

- PIN field autofocuses.
- Validate a six-digit PIN before showing Save Address.
- Unsupported PIN leaves the current address unchanged.
- Unsupported PIN offers Change Delivery Date.

## 9. Notification and feedback patterns

### 9.1 Toast

- Appears near the bottom safe area.
- Fully rounded pill shape.
- Slides upward with a short spring motion.
- Automatically dismisses.
- Used for successful local actions and non-blocking feedback.

### 9.2 Inline error

Use for form validation and failed PIN/payment states. Keep it close to the relevant control.

### 9.3 Blocking confirmation

Use for payment, cancellation, remaining-meal date changes and other multi-item consequences.

## 10. Required persisted data

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

## 11. Cross-cutting rules

### 11.1 Dates

- Store ISO dates with timezone context.
- Sort using date values, never labels or IDs.
- Derive the next delivery from the first incomplete chronological meal.

### 11.2 Cutoffs

- Cutoffs use the delivery location’s timezone.
- Show the cutoff before it passes.
- Explain why editing is unavailable after it passes.

### 11.3 Light and dark modes

Every new state must define both modes at implementation time. Dark mode is not a later styling pass.

### 11.4 Accessibility

- Support system text scaling within the established safe limit.
- Never clip button labels.
- Use text and icon/status shape together; colour alone is insufficient.
- Honour reduced-motion preference for shimmer, ripple and toast motion.

### 11.5 Empty and loading states

Every data-driven section must define loading, empty, populated and error states.

## 12. Suggested implementation phases

### Phase 1: Lifecycle foundation

- Central state types
- Entry router
- Persistence and onboarding resume
- Trial/subscription status derivation
- ISO meal dates

### Phase 2: Complete trial states

- Trial scheduled
- Trial active
- Trial completed conversion Home
- Trial payment recovery

### Phase 3: Subscriber core

- Subscriber Home
- My Plan
- Subscription scheduled
- Subscription active
- Meal-specific and subscription-wide editing separation

### Phase 4: Recovery and retention

- Renewal warning
- Renewal failure
- Pause/cancel/reactivate
- Delivery failures and credits
- Offline cache behaviour

### Phase 5: Nutrition tools

- Nutrient Calculator
- Diet Plan
- Nutrition History
- Weekly Insights

## 13. Decisions requiring product approval

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

## 14. Review checklist

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

