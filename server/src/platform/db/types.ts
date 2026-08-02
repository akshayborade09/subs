import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/** A calendar date, `YYYY-MM-DD`. Kept as a string end to end — see db/index.ts. */
type PlainDateCol = ColumnType<string, string, string>;
type Instant = ColumnType<Date, Date | string | undefined, Date | string>;
type InstantNull = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;
// `undefined` in the insert position is what makes a column optional on INSERT,
// which these are: every jsonb column below has a DEFAULT.
type Json<T> = ColumnType<T, T | string | undefined, T | string>;

export type Gender = 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say';
export type UserStatus = 'active' | 'blocked' | 'deleted';
export type FoodPreference = 'vegetarian' | 'non_vegetarian' | 'mix';
export type FoodType = 'vegetarian' | 'non_vegetarian';
export type MealPreference = 'lunch' | 'dinner' | 'both';
export type MealSlot = 'lunch' | 'dinner';
export type AddressLabel = 'home' | 'office' | 'other';
export type TrialStatus = 'draft' | 'payment_pending' | 'payment_failed' | 'paid' | 'cancelled';
export type SubscriptionStatus =
  | 'pending_payment'
  | 'paid'
  | 'cancelled_at_period_end'
  | 'terminated';
export type OpsStatus =
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'delayed'
  | 'delivery_failed'
  | 'cancelled'
  | 'skipped';
export type SourceType = 'trial' | 'subscription' | 'reward';
export type CheckoutKind = 'trial' | 'subscription' | 'renewal' | 'resubscription';
export type CheckoutStep =
  | 'review'
  | 'payment_method_required'
  | 'payment_pending'
  | 'payment_success'
  | 'payment_failed'
  | 'expired';
export type PaymentMethod = 'upi' | 'card' | 'net_banking' | 'wallet';
export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded';
export type TransactionType = 'payment' | 'refund' | 'credit' | 'reward';
export type TransactionStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'credited';
export type RewardStatus = 'earned' | 'scheduled' | 'redeemed' | 'expired' | 'revoked';
export type OnboardingStep =
  | 'personal'
  | 'intro'
  | 'food'
  | 'meal'
  | 'mixMeals'
  | 'bread'
  | 'rice'
  | 'locate'
  | 'address'
  | 'confirm'
  | 'summary'
  | 'payment'
  | 'success'
  | 'tracker';

export interface UsersTable {
  id: Generated<string>;
  phone_country_code: Generated<string>;
  phone_number: string;
  phone_verified_at: InstantNull;
  full_name: string | null;
  date_of_birth: ColumnType<string | null, string | null | undefined, string | null>;
  gender: Gender | null;
  status: Generated<UserStatus>;
  referral_code: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface OtpChallengesTable {
  id: Generated<string>;
  phone_country_code: Generated<string>;
  phone_number: string;
  code_hash: string;
  expires_at: Instant;
  attempts: Generated<number>;
  max_attempts: Generated<number>;
  consumed_at: InstantNull;
  device_id: string | null;
  created_at: Generated<Date>;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  refresh_token_hash: string;
  device_id: string | null;
  user_agent: string | null;
  expires_at: Instant;
  revoked_at: InstantNull;
  last_used_at: Generated<Date>;
  created_at: Generated<Date>;
}

export interface ServiceablePincodesTable {
  pincode: string;
  city: string;
  state: string;
  zone: string | null;
  is_active: Generated<boolean>;
}

export interface AddressesTable {
  id: Generated<string>;
  user_id: string;
  label: Generated<AddressLabel>;
  building_type: string | null;
  flat_or_house: string | null;
  building_or_society: string | null;
  line1: string;
  line2: string | null;
  landmark: string | null;
  delivery_instructions: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude: string | null;
  longitude: string | null;
  is_default: Generated<boolean>;
  is_serviceable: Generated<boolean>;
  deleted_at: InstantNull;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface UserPreferencesTable {
  user_id: string;
  food_preference: FoodPreference;
  meal_preference: MealPreference;
  bread_preference: string;
  rice_preference: string;
  updated_at: Generated<Date>;
}

export interface OnboardingDraftsTable {
  user_id: string;
  status: Generated<'in_progress' | 'complete' | 'abandoned'>;
  last_completed_step: OnboardingStep | null;
  resume_step: Generated<OnboardingStep>;
  payload: Json<Record<string, unknown>>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SubscriptionPlansTable {
  id: Generated<string>;
  code: 'weekly' | 'monthly' | 'quarterly';
  name: string;
  duration_days: number;
  meal_count: number;
  price_paise: number;
  discount_paise: Generated<number>;
  effective_price_per_meal_paise: number;
  badge: 'recommended' | 'best_value' | null;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
}

export interface MenuItemsTable {
  id: Generated<string>;
  name: string;
  serving: string;
  food_type: FoodType;
  category: string | null;
  calories_kcal: Generated<number>;
  protein_g: Generated<string>;
  carbs_g: Generated<string>;
  fat_g: Generated<string>;
  fibre_g: Generated<string>;
  sodium_mg: Generated<number>;
  is_active: Generated<boolean>;
}

export interface DailyMenusTable {
  id: Generated<string>;
  service_date: PlainDateCol;
  slot: MealSlot;
  food_type: FoodType;
  item_ids: Generated<string[]>;
}

export interface TrialsTable {
  id: Generated<string>;
  user_id: string;
  status: Generated<TrialStatus>;
  service_dates: Generated<string[]>;
  first_service_date: ColumnType<string | null, string | null | undefined, string | null>;
  last_service_date: ColumnType<string | null, string | null | undefined, string | null>;
  address_id: string | null;
  food_preference: FoodPreference | null;
  meal_preference: MealPreference | null;
  bread_preference: string | null;
  rice_preference: string | null;
  daily_meals: Json<unknown[]>;
  price_paise: Generated<number>;
  paid_at: InstantNull;
  cancelled_at: InstantNull;
  schedule_version: Generated<number>;
  completed_event_at: InstantNull;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface SubscriptionsTable {
  id: Generated<string>;
  user_id: string;
  plan_id: string;
  status: Generated<SubscriptionStatus>;
  meal_preference: MealPreference;
  food_preference: FoodPreference;
  bread_preference: string;
  rice_preference: string;
  selected_weekdays: Generated<number[]>;
  address_id: string;
  starts_on: PlainDateCol;
  ends_on: PlainDateCol;
  pause_from: ColumnType<string | null, string | null | undefined, string | null>;
  pause_to: ColumnType<string | null, string | null | undefined, string | null>;
  cancelled_at: InstantNull;
  renewal_failed_at: InstantNull;
  renewal_failure_resolved_at: InstantNull;
  auto_renew: Generated<boolean>;
  paid_at: InstantNull;
  schedule_version: Generated<number>;
  expired_event_at: InstantNull;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface MealOrdersTable {
  id: Generated<string>;
  user_id: string;
  source_type: SourceType;
  source_id: string;
  service_date: PlainDateCol;
  slot: MealSlot;
  food_type: FoodType;
  bread_preference: string;
  rice_preference: string;
  address_id: string;
  ops_status: OpsStatus | null;
  ops_status_at: InstantNull;
  ops_note: string | null;
  rescheduled_from: ColumnType<string | null, string | null | undefined, string | null>;
  date_change_count: Generated<number>;
  rating: number | null;
  feedback_tags: string[] | null;
  feedback_note: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface MealOrderEventsTable {
  id: Generated<number>;
  meal_order_id: string;
  ops_status: string;
  occurred_at: Generated<Date>;
  actor: Generated<string>;
  note: string | null;
}

export interface CouponsTable {
  id: Generated<string>;
  code: string;
  title: string;
  description: string;
  kind: 'flat' | 'percent';
  value_paise: number | null;
  percent_bps: number | null;
  max_discount_paise: number | null;
  min_order_paise: Generated<number>;
  applies_to_plan_codes: Generated<string[]>;
  applies_to_kinds: Generated<string[]>;
  new_users_only: Generated<boolean>;
  stackable_with_reward: Generated<boolean>;
  usage_limit_total: number | null;
  usage_limit_per_user: Generated<number>;
  starts_at: Generated<Date>;
  expires_at: InstantNull;
  is_active: Generated<boolean>;
  created_at: Generated<Date>;
}

export interface CheckoutSessionsTable {
  id: Generated<string>;
  user_id: string;
  kind: CheckoutKind;
  step: Generated<CheckoutStep>;
  source_type: 'trial' | 'subscription';
  source_id: string;
  plan_id: string | null;
  coupon_id: string | null;
  reward_id: string | null;
  payment_method: PaymentMethod | null;
  plan_price_paise: Generated<number>;
  delivery_charges_paise: Generated<number>;
  taxes_paise: Generated<number>;
  discount_paise: Generated<number>;
  trial_credit_paise: Generated<number>;
  reward_credit_paise: Generated<number>;
  total_payable_paise: Generated<number>;
  mock_scenario: string | null;
  expires_at: InstantNull;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface CouponRedemptionsTable {
  id: Generated<string>;
  coupon_id: string;
  user_id: string;
  checkout_session_id: string;
  discount_paise: number;
  consumed_at: InstantNull;
  created_at: Generated<Date>;
}

export interface PaymentsTable {
  id: Generated<string>;
  user_id: string;
  checkout_session_id: string;
  provider: 'mock' | 'razorpay' | 'stripe' | 'cashfree';
  provider_order_id: string | null;
  provider_payment_id: string | null;
  amount_paise: number;
  currency: Generated<string>;
  status: Generated<PaymentStatus>;
  status_rank: Generated<number>;
  failure_code: string | null;
  failure_reason: string | null;
  last_event_at: InstantNull;
  idempotency_key: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ProviderEventsTable {
  provider: string;
  provider_event_id: string;
  raw: Json<Record<string, unknown>>;
  received_at: Generated<Date>;
  processed_at: InstantNull;
  superseded: Generated<boolean>;
  error: string | null;
}

export interface TransactionsTable {
  id: Generated<string>;
  user_id: string;
  type: TransactionType;
  title: string;
  subtitle: string | null;
  amount_paise: number | null;
  display_amount: string | null;
  status: TransactionStatus;
  payment_id: string | null;
  reference: string | null;
  occurred_at: Generated<Date>;
  meta: Json<Record<string, unknown>>;
}

export interface RewardsTable {
  id: Generated<string>;
  user_id: string;
  type: Generated<'free_meal_day' | 'credit'>;
  source: 'loyalty' | 'referral' | 'service_recovery';
  status: Generated<RewardStatus>;
  value_paise: number | null;
  earned_at: Generated<Date>;
  expires_on: PlainDateCol;
  redeemed_at: InstantNull;
  redeemed_service_date: ColumnType<string | null, string | null | undefined, string | null>;
  redeemed_meal_order_ids: Generated<string[]>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface LoyaltyPeriodsTable {
  id: Generated<string>;
  user_id: string;
  subscription_id: string | null;
  period_start: PlainDateCol;
  expected_qualification_date: PlainDateCol;
  active_days: Generated<number>;
  required_active_days: Generated<number>;
  fulfilled_meal_days: Generated<number>;
  required_fulfilled_meal_days: Generated<number>;
  status: Generated<'in_progress' | 'qualified' | 'frozen' | 'expired'>;
  reward_id: string | null;
  qualified_at: InstantNull;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ReferralsTable {
  id: Generated<string>;
  referrer_user_id: string;
  referred_user_id: string | null;
  code: string;
  status: Generated<
    'invited' | 'signed_up' | 'payment_pending' | 'qualified' | 'rewarded' | 'rejected' | 'expired'
  >;
  reward_id: string | null;
  qualified_at: InstantNull;
  rewarded_at: InstantNull;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface LeaderboardPeriodsTable {
  period: PlainDateCol;
  closed_at: InstantNull;
  snapshot: Json<unknown> | null;
}

export interface LeaderboardPointsTable {
  id: Generated<number>;
  user_id: string;
  period: PlainDateCol;
  event_kind:
    | 'meal_delivered'
    | 'full_paid_week'
    | 'meal_rated'
    | 'referral_qualified'
    | 'monthly_streak';
  points: number;
  source_type: string;
  source_id: string;
  reversed_at: InstantNull;
  created_at: Generated<Date>;
}

export interface NotificationPreferencesTable {
  user_id: string;
  delivery: Generated<boolean>;
  payment: Generated<boolean>;
  reminders: Generated<boolean>;
  nutrition: Generated<boolean>;
  rewards: Generated<boolean>;
  offers: Generated<boolean>;
  channels: Json<Record<string, boolean>>;
  leaderboard_opt_in: Generated<boolean>;
  appearance: Generated<'system' | 'light' | 'dark'>;
  updated_at: Generated<Date>;
}

export interface NotificationsTable {
  id: Generated<string>;
  user_id: string;
  category: string;
  title: string;
  body: string;
  deep_link: string | null;
  read_at: InstantNull;
  created_at: Generated<Date>;
}

export interface SupportIssuesTable {
  id: Generated<string>;
  user_id: string;
  meal_order_id: string | null;
  category: string;
  description: string | null;
  status: Generated<'open' | 'investigating' | 'resolved' | 'rejected'>;
  resolution: string | null;
  credit_paise: number | null;
  resolved_at: InstantNull;
  resolved_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface IdempotencyKeysTable {
  user_id: string;
  key: string;
  endpoint: string;
  request_hash: string;
  state: Generated<'in_progress' | 'completed'>;
  response_status: number | null;
  response_body: Json<unknown> | null;
  locked_at: Generated<Date>;
  completed_at: InstantNull;
}

export interface OutboxEventsTable {
  id: Generated<number>;
  event_name: string;
  aggregate_type: string;
  aggregate_id: string;
  user_id: string | null;
  payload: Json<Record<string, unknown>>;
  occurred_at: Generated<Date>;
  available_at: Generated<Date>;
  attempts: Generated<number>;
  last_error: string | null;
  published_at: InstantNull;
}

export interface OutboxDeliveriesTable {
  subscriber: string;
  event_id: number;
  delivered_at: Generated<Date>;
}

export interface AuditLogsTable {
  id: Generated<number>;
  user_id: string | null;
  actor_type: Generated<'user' | 'system' | 'ops' | 'provider'>;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Json<unknown> | null;
  after: Json<unknown> | null;
  created_at: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  otp_challenges: OtpChallengesTable;
  sessions: SessionsTable;
  serviceable_pincodes: ServiceablePincodesTable;
  addresses: AddressesTable;
  user_preferences: UserPreferencesTable;
  onboarding_drafts: OnboardingDraftsTable;
  subscription_plans: SubscriptionPlansTable;
  menu_items: MenuItemsTable;
  daily_menus: DailyMenusTable;
  trials: TrialsTable;
  subscriptions: SubscriptionsTable;
  meal_orders: MealOrdersTable;
  meal_order_events: MealOrderEventsTable;
  coupons: CouponsTable;
  checkout_sessions: CheckoutSessionsTable;
  coupon_redemptions: CouponRedemptionsTable;
  payments: PaymentsTable;
  provider_events: ProviderEventsTable;
  transactions: TransactionsTable;
  rewards: RewardsTable;
  loyalty_periods: LoyaltyPeriodsTable;
  referrals: ReferralsTable;
  leaderboard_periods: LeaderboardPeriodsTable;
  leaderboard_points: LeaderboardPointsTable;
  notification_preferences: NotificationPreferencesTable;
  notifications: NotificationsTable;
  support_issues: SupportIssuesTable;
  idempotency_keys: IdempotencyKeysTable;
  outbox_events: OutboxEventsTable;
  outbox_deliveries: OutboxDeliveriesTable;
  audit_logs: AuditLogsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
export type Trial = Selectable<TrialsTable>;
export type Subscription = Selectable<SubscriptionsTable>;
export type MealOrder = Selectable<MealOrdersTable>;
export type CheckoutSession = Selectable<CheckoutSessionsTable>;
export type Payment = Selectable<PaymentsTable>;
export type Address = Selectable<AddressesTable>;
export type SubscriptionPlan = Selectable<SubscriptionPlansTable>;
