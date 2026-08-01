import type {
  CheckoutKind,
  CheckoutStep,
  FoodPreference,
  FoodType,
  MealPreference,
  MealSlot,
  OnboardingStep,
  OpsStatus,
  SourceType,
  SubscriptionStatus,
  TrialStatus,
} from '../platform/db/types.js';

/**
 * Everything the resolver is allowed to see. Deliberately JSON-only — no Date
 * objects, no database handles — so every one of the 39 states is a literal fixture
 * and the whole resolver is testable without Postgres.
 */
export type LifecycleSnapshot = {
  /** ISO 8601 instant. */
  now: string;
  /** `YYYY-MM-DD` in the delivery timezone. */
  today: string;

  session: { authenticated: boolean; phoneVerified: boolean } | null;
  user: { id: string; fullName: string | null; status: 'active' | 'blocked' | 'deleted' } | null;

  onboarding: {
    status: 'in_progress' | 'complete' | 'abandoned';
    lastCompletedStep: OnboardingStep | null;
    resumeStep: OnboardingStep;
  } | null;

  trial: {
    id: string;
    status: TrialStatus;
    firstServiceDate: string | null;
    lastServiceDate: string | null;
    serviceDates: string[];
    scheduleVersion: number;
  } | null;

  subscription: {
    id: string;
    planCode: 'weekly' | 'monthly' | 'quarterly';
    planName: string;
    status: SubscriptionStatus;
    startsOn: string;
    endsOn: string;
    pauseFrom: string | null;
    pauseTo: string | null;
    renewalFailedAt: string | null;
    renewalFailureResolvedAt: string | null;
    selectedWeekdays: number[];
    mealPreference: MealPreference;
    foodPreference: FoodPreference;
    scheduleVersion: number;
  } | null;

  /** An unfinished checkout, if one exists. Drives conditions Y and AA. */
  pendingCheckout: {
    id: string;
    kind: CheckoutKind;
    step: CheckoutStep;
    sourceType: 'trial' | 'subscription';
    sourceId: string;
  } | null;

  /** Meal orders in a window around today, ascending by (date, slot). */
  window: MealOrderView[];
};

export type MealOrderView = {
  id: string;
  serviceDate: string;
  slot: MealSlot;
  foodType: FoodType;
  opsStatus: OpsStatus | null;
  sourceType: SourceType;
  rescheduledFrom: string | null;
};

/* ------------------------------------------------------------------ *
 * Derivations. The clock decides these, so they are computed, never stored.
 * ------------------------------------------------------------------ */

export type TrialPhase =
  | 'none'
  | 'draft'
  | 'payment_pending'
  | 'payment_failed'
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'cancelled';

export function trialPhase(s: LifecycleSnapshot): TrialPhase {
  const trial = s.trial;
  if (!trial) return 'none';
  if (trial.status === 'cancelled') return 'cancelled';
  if (trial.status === 'draft') return 'draft';
  if (trial.status === 'payment_pending') return 'payment_pending';
  if (trial.status === 'payment_failed') return 'payment_failed';

  // status === 'paid': the calendar decides the rest.
  const { firstServiceDate: first, lastServiceDate: last } = trial;
  if (!first || !last) return 'scheduled';
  if (s.today < first) return 'scheduled';
  if (s.today > last) return 'completed';
  return 'active';
}

export type SubscriptionPhase =
  | 'none'
  | 'pending_payment'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'ending'
  | 'expired';

/**
 * Ordered deliberately: expiry beats pause beats scheduling beats cancellation.
 * Making this one function the single source of truth keeps the rule chain from
 * encoding a second, subtly different ordering.
 */
export function subscriptionPhase(s: LifecycleSnapshot): SubscriptionPhase {
  const sub = s.subscription;
  if (!sub) return 'none';
  if (sub.status === 'pending_payment') return 'pending_payment';
  if (sub.status === 'terminated') return 'expired';
  if (s.today > sub.endsOn) return 'expired';
  if (s.today < sub.startsOn) return 'scheduled';
  if (isPaused(sub.pauseFrom, sub.pauseTo, s.today)) return 'paused';
  if (sub.status === 'cancelled_at_period_end') return 'ending';
  return 'active';
}

function isPaused(from: string | null, to: string | null, today: string): boolean {
  if (!from) return false;
  return today >= from && (to === null || today <= to);
}

/** Money has been taken for a subscription, whatever its calendar phase. */
export function hasPaidSubscription(s: LifecycleSnapshot): boolean {
  const status = s.subscription?.status;
  return status === 'paid' || status === 'cancelled_at_period_end';
}

export function hasUnresolvedRenewalFailure(s: LifecycleSnapshot): boolean {
  const sub = s.subscription;
  return !!sub && sub.renewalFailedAt !== null && sub.renewalFailureResolvedAt === null;
}

export function ordersOn(s: LifecycleSnapshot, date: string): MealOrderView[] {
  return s.window.filter((order) => order.serviceDate === date);
}

/** A day counts as "has a meal" unless every order on it was cancelled or skipped. */
export function hasLiveMealOn(s: LifecycleSnapshot, date: string): boolean {
  return ordersOn(s, date).some(
    (order) => order.opsStatus !== 'cancelled' && order.opsStatus !== 'skipped',
  );
}
