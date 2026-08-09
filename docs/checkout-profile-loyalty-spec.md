# Checkout, Coupons, Profile, Settings and Loyalty Specification

Status: Draft for product review  
Product: Healthy Tiffins  
Platforms: iOS, Android and web  
Depends on: `docs/user-lifecycle-state-spec.md`  
Scope: Trial/subscription checkout, coupons, payment recovery, Profile, Settings, saved addresses, transactions, referrals, notifications, app permissions, logout, loyalty programme and leaderboard

## 1. Purpose

This document defines the product behaviour required after onboarding, trial and subscription selection. It is intended to prevent checkout, account management and loyalty from becoming disconnected features.

The product rules are:

- **Checkout answers:** What am I buying, where will it be delivered, what will I pay and what happens next?
- **Profile answers:** Who am I and what account-level information belongs to me?
- **Settings answers:** How should the application behave and communicate with me?
- **Loyalty answers:** What progress have I earned through completed paid meals, and what benefit will I receive?
- **Transactions answer:** What was charged, credited, refunded or rewarded, and why?

## 2. Research basis and design direction

The specification adapts patterns reviewed from:

- [Uber Eats checkout](https://mobbin.com/flows/4997f6c8-d37e-43f0-9d42-5908c636ea90): progressive checkout, prominent delivery context and a persistent final action.
- [Careem food ordering](https://mobbin.com/flows/e9c617d9-65fc-4fe6-8cec-354fe2678673): readable payment breakdown, savings visibility and payment method near the payable action.
- [7-Eleven checkout](https://mobbin.com/flows/a55144aa-ee90-4c04-a931-d4d42322a8ad): compact delivery, contact and cart-summary hierarchy.
- [Fanatics Live settings](https://mobbin.com/flows/3af5a8c1-6cf4-4c0c-9172-29947d0513cb): grouped settings destinations and a quiet logout treatment.
- [Urban Company account](https://mobbin.com/flows/bcc857a9-c457-4731-b523-21e6e170d7d9): service-oriented account shortcuts, address/payment management and referral placement.
- [Crypto.com profile and settings](https://mobbin.com/flows/99b5f1cf-e030-49da-ba80-c4921b30360d): clear separation of profile, security, permissions and account closure.

### 2.1 Reference lock

- Preserve the existing Healthy Tiffins visual system: Inclusive Sans body text with DM Serif Text headings, minimal surfaces, green accent, black/white gradient primary buttons, 16 px content spacing and Phosphor bold icons.
- Reuse existing page headers, cards, fields, selection borders, toasts, payment states and responsive behaviour.
- Checkout is a full page, not a bottom sheet.
- Profile and Settings use grouped rows with restrained icons; avoid a grid of decorative cards.
- Loyalty may use a warmer reward surface, but green remains the action and progress colour.
- Every new surface must ship in light and dark modes together.

## 3. Navigation architecture

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

## 4. Checkout state model

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

## 5. Checkout flow

### 5.1 Step 1: Review order

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

### 5.2 Plan summary

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

### 5.3 Delivery address

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

### 5.4 Coupon entry

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

### 5.5 Coupon calculation order

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

### 5.6 Available coupon cards

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

### 5.7 Payment method

Supported mock methods:

- UPI
- Credit or debit card
- Net banking
- Digital wallet

Show the selected method on the review page. Changing it opens the existing payment-method selection page.

Do not store full card or UPI credentials in local app state. Store only provider references and display-safe labels.

### 5.8 Sticky payment action

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

### 5.9 Processing

After payment begins:

- Lock duplicate submission.
- Show a stable processing state.
- Preserve checkout locally.
- Do not treat an unknown provider response as failure.

### 5.10 Pending payment

Reuse the existing payment-pending system.

- Show the method and total.
- **Go to home** remains available while confirmation runs.
- Home shows a payment-status widget returning to the pending page.
- Refresh on app foreground and through manual status check.
- When confirmed, animate the loader into a size-matched success state.

### 5.11 Success

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

### 5.12 Failure

Show:

- Failure reason, when safe and available
- Amount
- Payment method
- Retry Payment
- Change Payment Method
- Contact Support

A retry creates a new payment attempt while preserving the same checkout selection.

## 6. Profile home

### 6.1 Header

Show:

- Name
- Masked WhatsApp number
- Profile edit icon
- Current lifecycle label: Trial, Active Subscription, Subscription Ending or No Active Plan

### 6.2 Primary destinations

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

### 6.3 Lifecycle-specific profile behaviour

- Trial user: My Plan opens Trial Details.
- Scheduled subscriber: My Plan shows the scheduled subscription.
- Active subscriber: My Plan opens the active plan.
- Expired user: My Plan opens plan history with Renew Subscription.
- User without purchases: Transactions and rewards remain visible with useful empty states.

## 7. Edit profile

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

## 8. Saved addresses

### 8.1 Address list

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

### 8.2 Address rules

- At least one default address exists when any address is saved.
- Deleting the default requires choosing another default.
- An address used by an upcoming meal cannot be silently deleted.
- The delete confirmation lists affected future deliveries.
- Saving runs PIN serviceability validation.
- An unsupported address may be saved for later only if clearly marked **Delivery unavailable**.

### 8.3 Empty state

Title: **No saved addresses**  
Description: **Add an address to make future meal setup faster.**  
Action: **Add address**

## 9. Transactions

### 9.1 Transaction list

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

### 9.2 Transaction detail

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

## 10. Account settings

Sections:

### Personal

- Personal information
- Change WhatsApp number
- Saved addresses

### Security and privacy

- Active sessions, future scope
- Privacy policy
- Data and consent
- Download my data, future scope
- Delete account

### App

- Appearance: System, Light, Dark
- Language: English initially; localisation-ready
- App permissions
- Notification preferences

### Support and legal

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

## 11. Notifications

### 11.1 In-app notification centre

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

### 11.2 Notification preferences

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

## 12. App permissions

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

## 13. Refer and Earn

### 13.1 Referral page

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

### 13.2 Referral states

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

## 14. Loyalty programme

### 14.1 Product promise

Programme name placeholder: **Healthy Streak**

Primary reward:

> Complete one continuous paid subscription month and receive one free day of meals.

“One free day” means the same meal configuration as the user’s active plan on the redeemed date:

- Lunch plan → one free lunch
- Dinner plan → one free dinner
- Both plan → one free lunch and dinner day

### 14.2 Month qualification

A user qualifies when all conditions are true:

1. At least 28 consecutive calendar days of an active paid subscription have elapsed.
2. All required payments for that qualification period succeeded.
3. At least 20 scheduled meal days were delivered or validly fulfilled.
4. The account is not suspended for fraud or abuse.

Operational cancellations, service credits and provider-caused failures do not break progress. User-paused days extend the qualification end date rather than resetting progress.

The UI must state the exact rule being used. Do not use “one month” while calculating an unexplained different threshold.

### 14.3 Progress card

Profile and My Plan may show:

- **18 of 28 days completed**
- Expected qualification date
- Progress bar
- Current streak
- “One free meal day” reward preview
- View details

Do not place loyalty progress above today’s operational meal status on Home.

### 14.4 Reward lifecycle

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

### 14.5 Reward redemption

Rules:

- Redeem on an eligible serviceable future day.
- Use the current default meal preference and address.
- Validate address and capacity before confirmation.
- Reward cannot be converted to cash.
- Reward cannot be transferred.
- Reward cannot overlap another free-meal reward on the same day.
- Recommended expiry: 60 days after issue.
- A redeemed reward appears in Transactions as ₹0 charged with its original value disclosed.

### 14.6 Loyalty interruption

- Subscription paused: freeze progress and extend the expected qualification date.
- Renewal failed: freeze progress during the grace period.
- Subscription cancelled: preserve already earned rewards; incomplete progress expires at the end of plan unless policy explicitly permits carry-over.
- Refund or chargeback: recalculate qualification and explain any revoked reward.

## 15. Leaderboard

### 15.1 Purpose

The leaderboard adds friendly motivation but does not determine the guaranteed one-month reward. The free meal remains rules-based so users are not penalised by other users’ activity.

### 15.2 Ranking period

- Monthly leaderboard
- Resets on the first day of each calendar month in the user’s delivery timezone
- Shows the current month and the previous final result

### 15.3 Points

Recommended initial scoring:

| Event | Points | Rule |
|---|---:|---|
| Paid meal delivered | 10 | Award after Delivered status |
| Complete a full paid week | 25 | Once per qualifying week |
| Submit meal rating | 2 | Maximum once per delivered meal |
| Qualified referral | 50 | Award after referral payment succeeds |
| Complete monthly streak | 100 | Award once when loyalty month qualifies |

Do not award points for opening the app, tapping notifications or other artificial engagement.

### 15.4 Leaderboard UI

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

### 15.5 Leaderboard rewards

Keep the first release simple:

- Guaranteed reward: one free meal day after the qualifying paid month
- Leaderboard: recognition only at launch
- Future top-rank prizes require explicit terms, fulfilment limits and anti-fraud review

This avoids implying that only top-ranked users receive the one-month benefit.

### 15.6 Anti-abuse

- Points are server-authoritative.
- Reversed payments reverse related points.
- Duplicate ratings do not create duplicate points.
- Referral self-invites and repeated devices/payment methods may be reviewed.
- Suspicious accounts show **Rank under review**, not a misleading final rank.

## 16. Logout

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

## 17. Empty, loading and error states

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

## 18. Accessibility and responsive requirements

- Respect system text size without clipping labels or amounts.
- Buttons grow vertically for multi-line labels when required.
- Use status icons and text in addition to colour.
- Minimum touch target: 44 × 44 points.
- Coupons, rewards and transaction status must be screen-reader labelled.
- Honour reduced motion for shimmer, reward celebration, progress and toast animation.
- Hide scrollbars visually while preserving scrolling and accessibility.
- Sticky checkout actions must not cover the final content or system home indicator.

## 19. Analytics events

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

## 20. Required persisted data

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

## 21. Acceptance criteria by module

### Checkout and coupons

- User can review and edit all purchase-critical information.
- Coupon state survives navigation and app interruption.
- Totals update immediately after valid changes.
- Duplicate payment presses cannot create duplicate purchases.
- Pending, success and failure route into the existing lifecycle state machine.

### Profile and Settings

- Every listed destination is reachable from Profile.
- Back navigation restores the exact prior Profile scroll position.
- Profile edits do not replay page animations on return.
- Addresses and notification preferences persist locally in prototype mode.
- Logout clears the session without altering the commercial plan.

### Loyalty and leaderboard

- Progress is calculated from qualifying paid subscription activity.
- A full qualifying month creates exactly one free-meal-day reward.
- Paused or failed states explain whether progress is frozen, extended or revoked.
- Leaderboard ranking does not replace the guaranteed monthly reward.
- The user can opt out of public ranking.

## 22. Suggested implementation phases

### Phase 1: Checkout foundation

- Checkout state and price model
- Review page
- Coupon validation mock
- Payment method selection
- Pending/success/failure lifecycle integration

### Phase 2: Profile core

- Profile landing page
- Edit profile
- Saved addresses
- Transactions and receipt detail
- Settings, permissions and logout

### Phase 3: Engagement

- Notifications centre and preferences
- Refer and Earn
- Referral history

### Phase 4: Loyalty

- Healthy Streak progress
- Reward earning and redemption
- Reward transaction records
- Monthly leaderboard
- Opt-out and anti-abuse states

### Phase 5: Production services

- Backend-authoritative coupons and pricing
- Payment provider integration and webhooks
- Receipt generation
- Referral attribution
- Loyalty and leaderboard service
- Notification delivery and deep links

## 23. Product decisions required before production

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

