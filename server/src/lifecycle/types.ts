/**
 * The 39-state catalogue in src/lifecycleStateMachine.ts conflates four unrelated
 * things. Modelling it as one enum is what makes the app's current variant mapping
 * a lossy inline cast (App.tsx:523). The axes are:
 *
 *   AccountCondition  server-derived, exactly one at a time            → this file
 *   PaymentPhase      a property of a Payment, polled by the client    → payments module
 *   CheckoutPhase     a property of an open CheckoutSession            → checkout module
 *   Screen (AB–AM)    pure frontend navigation, no server derivation   → not modelled
 *   Transport (S)     the client is offline; unknowable server-side    → not modelled
 *
 * The letters survive only as a presentation/telemetry vocabulary — see legacy.ts.
 */
export type AccountCondition =
  | 'SIGNED_OUT' //                            A
  | 'AUTH_INCOMPLETE' //                       B
  | 'ACCOUNT_BLOCKED' //                       (absent from the specs; added)
  | 'ONBOARDING_INCOMPLETE' //                 C
  | 'TRIAL_PAYMENT_PENDING' //                 D
  | 'TRIAL_PAYMENT_FAILED' //                  E
  | 'SUBSCRIPTION_PAYMENT_PENDING' //          Y
  | 'SUBSCRIPTION_PAYMENT_FAILED' //           AA
  | 'RENEWAL_FAILED' //                        P
  | 'DELIVERY_FAILED' //                       R
  | 'DELIVERY_DELAYED' //                      Q
  | 'TRIAL_SCHEDULED' //                       F
  | 'TRIAL_ACTIVE_NO_SUBSCRIPTION' //          G
  | 'TRIAL_ACTIVE_SUBSCRIPTION_PURCHASED' //   H
  | 'TRIAL_COMPLETED_NO_SUBSCRIPTION' //       I
  | 'SUBSCRIPTION_SCHEDULED' //                J
  | 'SUBSCRIPTION_ACTIVE' //                   K
  | 'SUBSCRIPTION_NO_MEAL_TODAY' //            L
  | 'SUBSCRIPTION_PAUSED' //                   M
  | 'SUBSCRIPTION_ENDING' //                   N
  | 'SUBSCRIPTION_EXPIRED'; //                 O

export const ALL_CONDITIONS: readonly AccountCondition[] = [
  'SIGNED_OUT',
  'AUTH_INCOMPLETE',
  'ACCOUNT_BLOCKED',
  'ONBOARDING_INCOMPLETE',
  'TRIAL_PAYMENT_PENDING',
  'TRIAL_PAYMENT_FAILED',
  'SUBSCRIPTION_PAYMENT_PENDING',
  'SUBSCRIPTION_PAYMENT_FAILED',
  'RENEWAL_FAILED',
  'DELIVERY_FAILED',
  'DELIVERY_DELAYED',
  'TRIAL_SCHEDULED',
  'TRIAL_ACTIVE_NO_SUBSCRIPTION',
  'TRIAL_ACTIVE_SUBSCRIPTION_PURCHASED',
  'TRIAL_COMPLETED_NO_SUBSCRIPTION',
  'SUBSCRIPTION_SCHEDULED',
  'SUBSCRIPTION_ACTIVE',
  'SUBSCRIPTION_NO_MEAL_TODAY',
  'SUBSCRIPTION_PAUSED',
  'SUBSCRIPTION_ENDING',
  'SUBSCRIPTION_EXPIRED',
] as const;

/** Where the client should route. Mirrors LifecycleDestination in the app. */
export type Route =
  | 'stories'
  | 'auth'
  | 'onboarding'
  | 'home'
  | 'trial_payment_recovery'
  | 'subscription_payment_recovery'
  | 'support';

/**
 * The 15 Home variants the app already renders (HomeLifecycleVariant,
 * src/TrialHome.tsx:42). Conditions that have no Home map to null.
 */
export type HomeVariant =
  | 'trial_payment_pending'
  | 'trial_scheduled'
  | 'trial_active'
  | 'trial_subscription_purchased'
  | 'trial_completed'
  | 'subscription_scheduled'
  | 'subscription_active'
  | 'subscription_no_meal'
  | 'subscription_paused'
  | 'subscription_ending'
  | 'subscription_expired'
  | 'subscription_renewal_failed'
  | 'subscription_delivery_delayed'
  | 'subscription_delivery_failed'
  | 'subscription_offline';

/** MealStatus in src/TrialHome.tsx:32 — what a calendar marker can look like. */
export type MealDisplayStatus =
  | 'delivered'
  | 'upcoming'
  | 'paused'
  | 'inactive'
  | 'issue'
  | 'delayed'
  | 'delivery_failed';

export type NoticeTone = 'orange' | 'red' | 'blue' | 'purple';

export type HomeNotice = {
  title: string;
  body: string;
  tone: NoticeTone;
  action?: string;
};

export type HomePlanCard = {
  title: string;
  description: string;
  buttonLabel: string;
};

export type MealMarker = {
  mealOrderId: string;
  slot: 'lunch' | 'dinner';
  foodType: 'vegetarian' | 'non_vegetarian';
  status: MealDisplayStatus;
  showRipple: boolean;
};

export type WeekDay = {
  date: string;
  dayLabel: string;
  shortDate: string;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  /** Positional: index 0 is lunch, index 1 is dinner — the app reads them that way. */
  markers: MealMarker[];
};

export type HomePayload = {
  variant: HomeVariant;
  eyebrow: string;
  title: string;
  description: string;
  caption: string | null;
  selectedLabel: string;
  selectedDate: string | null;
  week: WeekDay[];
  notice: HomeNotice | null;
  planCard: HomePlanCard | null;
};

export type Resolution = {
  condition: AccountCondition;
  /** Which rule fired. Shipped as a debug field — makes support one string long. */
  firedRule: string;
  route: Route;
  requiresAction: boolean;
};
