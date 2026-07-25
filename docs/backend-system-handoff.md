# Healthy Tiffins Backend System Handoff

This document explains the product concept, core flows, state logic, backend domains, APIs, business rules, and implementation expectations for the Healthy Tiffins app.

It is written for the backend team so they can start building the server-side system that powers the current React Native / Expo frontend.

---

## 1. Product concept

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

## 2. Product principles

### 2.1 Home is operational

The Home screen should answer:

- What is happening with my meals this week?
- What is happening today?
- Do I need to take action?
- Is my trial or subscription active, pending, failed, ending, or completed?

Home should not feel like an admin dashboard. It should be time-sensitive and food-first.

### 2.2 Profile / My Plan is administrative

Profile and plan pages should answer:

- What plan am I on?
- What are my saved addresses?
- What transactions happened?
- What notifications and app permissions are enabled?
- What loyalty reward did I earn?

### 2.3 Backend owns truth; frontend renders states

The frontend currently has a state selector for demo/testing. In production, lifecycle state should come from backend-derived state, not user-selected UI state.

The backend should provide a compact `appState` response that tells the client:

- where to route the user
- what Home variant to render
- what action widgets to show
- what calendar dates and meal markers to show
- what payment / checkout state exists

---

## 3. Platforms and client assumptions

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

## 4. End-to-end user journey

### 4.1 First launch

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

### 4.2 Trial to subscription

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

### 4.3 Active subscription

The active subscription uses the same Home structure as trial:

- top weekly calendar
- meal status markers
- operational widget
- nutrition tools card
- next selected meal
- profile access

Unselected subscription days are shown as disabled / grey dates.

---

## 5. Phone authentication logic

### 5.1 Indian mobile number validation

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

### 5.2 OTP rules

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

## 6. Lifecycle states

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

## 7. Routing priority

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

## 8. Core backend domains

### 8.1 User

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

### 8.2 Address

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

### 8.3 Preferences

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

### 8.4 Trial

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

### 8.5 Meal order

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

### 8.6 Subscription plan

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

### 8.7 Subscription

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

### 8.8 Checkout session

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

### 8.9 Payment

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

### 8.10 Loyalty and rewards

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

## 9. Trial business logic

### 9.1 Trial date selection

User must select exactly five delivery dates.

Rules:

- Dates should be stored in ascending order.
- User can select continuous dates.
- Saturday/Sunday may be skipped.
- Selection should allow enough surrounding dates so user can choose five valid delivery days.
- Weekend separate-address flow is future scope and currently disabled.
- Trial currently uses one delivery address.

### 9.2 Trial meal changes

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

### 9.3 Meal preference cutoff

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

### 9.4 Date change policy

Date changes should only apply to future meal orders.

Backend should allow changing a future meal back into an earlier available date if that earlier date is still in the future and serviceable.

The available date window should not only move forward from the current selected date. It should include valid future dates that can replace the meal.

---

## 10. Subscription business logic

### 10.1 Plans

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

### 10.2 Meal selection

Meal preference:

- lunch
- dinner
- both

Fixed delivery windows:

- Lunch: 11:00 AM to 1:00 PM
- Dinner: 6:30 PM to 8:30 PM

No selectable delivery time slots are needed in MVP.

### 10.3 Active subscription Home

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

### 10.4 Subscription ending

If subscription is cancelled but active until end date:

- show “subscription ending”
- show widget: “Plan active until {date}”
- CTA: “Re-subscribe to this plan”
- CTA should use a darker shade of the widget background, not a primary black gradient button.

### 10.5 Subscription ended

If subscription ended:

- do not show pause icon in meal markers
- today’s date can still be highlighted
- meal markers should be grey
- show subscribe/re-subscribe action

---

## 11. Delivery and meal marker logic

### 11.1 Marker colors

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

### 11.2 Ripple logic

Ripple should only appear for the upcoming/current actionable delivery.

Do not show ripple for:

- past delivered meals
- past cancelled meals
- past failed meals
- previous delayed meals
- inactive/unselected dates

If lunch is delivered and dinner is upcoming, show active ripple only on dinner marker.

### 11.3 Delayed delivery

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

### 11.4 Failed delivery

Failed delivery or address issue:

- show pastel red widget
- show action required copy
- for already delivered previous orders, do not allow preference/date/address edits

---

## 12. Payment logic

### 12.1 Trial payment pending

Trial payment pending page:

- shows confirming payment state
- bottom CTA: “Go to home”
- no “Choose another payment method” CTA while confirming

Home should show a widget:

- title: “Check payment status”
- tapping it returns to trial payment pending page
- button style should be a darker shade of widget background, not primary gradient

### 12.2 Pending to success

When payment status changes from pending to success:

- pending loader around card icon completes
- loader becomes a green completed ring
- icon background becomes green
- icon changes to check
- success screen appears
- user then goes to Home

Visual sizes should stay consistent during this transition.

### 12.3 Payment failed

Payment failed state:

- use red pastel icon background
- icon container size should match success icon container
- offer retry/payment method change where appropriate

### 12.4 Payment webhooks

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

## 13. Checkout and coupon logic

### 13.1 Checkout review

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

### 13.2 Coupon application

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

## 14. Profile, settings, and loyalty

### 14.1 Profile

Profile sections:

- My plan
- Loyalty & rewards
- Saved addresses
- Transactions
- Refer & earn
- Notifications
- Settings

### 14.2 Personal information

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

### 14.3 Saved addresses

Features:

- list addresses
- add address
- edit address
- set as default
- delete non-default address
- serviceability check by pincode

### 14.4 Transactions

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

### 14.5 Refer and earn

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

### 14.6 Loyalty program

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

## 15. Notifications

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

## 16. Suggested API surface

### 16.1 App state

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

### 16.2 Auth

```http
POST /v1/auth/otp/start
POST /v1/auth/otp/verify
POST /v1/auth/logout
```

### 16.3 Profile

```http
GET /v1/me/profile
PATCH /v1/me/profile
GET /v1/me/preferences
PATCH /v1/me/preferences
```

### 16.4 Addresses

```http
GET /v1/me/addresses
POST /v1/me/addresses
PATCH /v1/me/addresses/:addressId
DELETE /v1/me/addresses/:addressId
POST /v1/serviceability/check
POST /v1/geocode/search
POST /v1/geocode/reverse
```

### 16.5 Trial

```http
POST /v1/me/trial/draft
PATCH /v1/me/trial/:trialId/preferences
PATCH /v1/me/trial/:trialId/dates
PATCH /v1/me/trial/:trialId/address
GET /v1/me/trial/:trialId/review
POST /v1/me/trial/:trialId/checkout
GET /v1/me/trial/:trialId/payment-status
```

### 16.6 Meal orders

```http
GET /v1/me/meals/:mealOrderId
PATCH /v1/me/meals/:mealOrderId/date
PATCH /v1/me/meals/:mealOrderId/address
PATCH /v1/me/meals/:mealOrderId/preferences
POST /v1/me/meals/:mealOrderId/feedback
POST /v1/me/meals/:mealOrderId/report-issue
```

### 16.7 Subscription

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

### 16.8 Checkout and payments

```http
GET /v1/me/checkout/:checkoutSessionId
POST /v1/me/checkout/:checkoutSessionId/apply-coupon
POST /v1/me/checkout/:checkoutSessionId/remove-coupon
PATCH /v1/me/checkout/:checkoutSessionId/payment-method
POST /v1/me/checkout/:checkoutSessionId/pay
GET /v1/me/checkout/:checkoutSessionId/payment-status
POST /v1/webhooks/payments/:provider
```

### 16.9 Loyalty, referrals, transactions

```http
GET /v1/me/transactions
GET /v1/me/referrals
POST /v1/me/referrals/share-event
GET /v1/me/loyalty/progress
GET /v1/loyalty/leaderboard?month=2026-07
GET /v1/me/rewards
POST /v1/me/rewards/:rewardId/redeem
```

### 16.10 Notifications and settings

```http
GET /v1/me/notification-preferences
PATCH /v1/me/notification-preferences
GET /v1/me/settings
PATCH /v1/me/settings
```

---

## 17. Backend events

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

## 18. Admin and operations requirements

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

## 19. Security and reliability

### 19.1 Authentication

- Use short-lived access token + refresh token or secure session.
- Bind sessions to device where possible.
- Rate-limit OTP actions.
- Never expose raw OTP.
- Never log sensitive tokens.

### 19.2 Idempotency

Required for:

- checkout creation
- payment initiation
- payment webhooks
- coupon application
- date changes
- address changes
- reward redemption

Use `Idempotency-Key` header for mutating operations.

### 19.3 Concurrency

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

### 19.4 Audit logs

Audit these actions:

- payment status changes
- meal date changes
- address changes
- preference changes
- subscription cancellation/resubscription
- reward redemption
- support issue creation/resolution

---

## 20. MVP backend build order

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

## 21. Future scope

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

## 22. Open questions for product/backend alignment

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

## 23. Definition of backend done

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

