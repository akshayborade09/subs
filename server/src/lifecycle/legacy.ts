import type { AccountCondition } from './types.js';

/**
 * The A–AM catalogue from src/lifecycleStateMachine.ts, kept alive as a
 * presentation and telemetry vocabulary rather than a state machine. Support can
 * ask "what state is this user in" and get the same letter the designers used.
 */
export type LegacyLifecycleId =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'
  | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U'
  | 'V' | 'W' | 'X' | 'Y' | 'Z' | 'AA' | 'AB' | 'AC' | 'AD' | 'AE'
  | 'AF' | 'AG' | 'AH' | 'AI' | 'AJ' | 'AK' | 'AL' | 'AM';

const LEGACY_BY_CONDITION: Record<AccountCondition, LegacyLifecycleId | null> = {
  SIGNED_OUT: 'A',
  AUTH_INCOMPLETE: 'B',
  ONBOARDING_INCOMPLETE: 'C',
  TRIAL_PAYMENT_PENDING: 'D',
  TRIAL_PAYMENT_FAILED: 'E',
  TRIAL_SCHEDULED: 'F',
  TRIAL_ACTIVE_NO_SUBSCRIPTION: 'G',
  TRIAL_ACTIVE_SUBSCRIPTION_PURCHASED: 'H',
  TRIAL_COMPLETED_NO_SUBSCRIPTION: 'I',
  SUBSCRIPTION_SCHEDULED: 'J',
  SUBSCRIPTION_ACTIVE: 'K',
  SUBSCRIPTION_NO_MEAL_TODAY: 'L',
  SUBSCRIPTION_PAUSED: 'M',
  SUBSCRIPTION_ENDING: 'N',
  SUBSCRIPTION_EXPIRED: 'O',
  RENEWAL_FAILED: 'P',
  DELIVERY_DELAYED: 'Q',
  DELIVERY_FAILED: 'R',
  SUBSCRIPTION_PAYMENT_PENDING: 'Y',
  SUBSCRIPTION_PAYMENT_FAILED: 'AA',
  // No letter exists for a blocked account — the specs never defined one.
  ACCOUNT_BLOCKED: null,
};

export function toLegacyLifecycleId(condition: AccountCondition): LegacyLifecycleId | null {
  return LEGACY_BY_CONDITION[condition];
}

/**
 * Letters the server never derives, with the reason. Kept as data so the dev
 * state-forcing endpoint can explain itself instead of 404-ing silently.
 */
export const CLIENT_OWNED_STATES: Record<string, string> = {
  S: 'Offline is a transport condition; the server cannot know it is unreachable.',
  T: 'Animation frame: the client plays pending → success when polling flips.',
  U: 'Animation frame: the success screen before routing Home.',
  V: 'Checkout review — a property of an open CheckoutSession, not of the user.',
  W: 'Coupon entry — a checkout sub-screen.',
  X: 'Coupon applied — a checkout sub-screen.',
  Z: 'Animation frame: subscription payment success.',
  AB: 'Profile hub — frontend navigation.',
  AC: 'Edit profile — frontend navigation.',
  AD: 'Saved addresses — frontend navigation.',
  AE: 'Transactions — frontend navigation.',
  AF: 'Account settings — frontend navigation.',
  AG: 'Notifications — frontend navigation.',
  AH: 'App permissions — frontend navigation.',
  AI: 'Refer and earn — frontend navigation.',
  AJ: 'Healthy Streak progress — frontend navigation.',
  AK: 'Monthly leaderboard — frontend navigation.',
  AL: 'Free meal earned — frontend navigation.',
  AM: 'Redeem free meal — frontend navigation.',
};
