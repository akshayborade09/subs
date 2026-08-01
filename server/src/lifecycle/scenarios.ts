import type { LifecycleSnapshot, MealOrderView } from './snapshot.js';
import type { AccountCondition } from './types.js';

export const TODAY = '2026-07-23';
export const NOW = '2026-07-23T09:30:00+05:30';

export function baseSnapshot(overrides: Partial<LifecycleSnapshot> = {}): LifecycleSnapshot {
  return {
    now: NOW,
    today: TODAY,
    session: { authenticated: true, phoneVerified: true },
    user: { id: 'user_1', fullName: 'Akshay Borade', status: 'active' },
    onboarding: { status: 'complete', lastCompletedStep: 'tracker', resumeStep: 'tracker' },
    trial: null,
    subscription: null,
    pendingCheckout: null,
    window: [],
    ...overrides,
  };
}

export function trial(
  overrides: Partial<NonNullable<LifecycleSnapshot['trial']>> = {},
): NonNullable<LifecycleSnapshot['trial']> {
  return {
    id: 'trial_1',
    status: 'paid',
    firstServiceDate: '2026-07-21',
    lastServiceDate: '2026-07-27',
    serviceDates: ['2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-27'],
    scheduleVersion: 0,
    ...overrides,
  };
}

export function subscription(
  overrides: Partial<NonNullable<LifecycleSnapshot['subscription']>> = {},
): NonNullable<LifecycleSnapshot['subscription']> {
  return {
    id: 'sub_1',
    planCode: 'monthly',
    planName: 'Monthly',
    status: 'paid',
    startsOn: '2026-07-01',
    endsOn: '2026-08-20',
    pauseFrom: null,
    pauseTo: null,
    renewalFailedAt: null,
    renewalFailureResolvedAt: null,
    selectedWeekdays: [1, 2, 3, 4, 5],
    mealPreference: 'both',
    foodPreference: 'vegetarian',
    scheduleVersion: 0,
    ...overrides,
  };
}

let orderSeq = 0;
export function order(overrides: Partial<MealOrderView> = {}): MealOrderView {
  orderSeq += 1;
  return {
    id: `meal_${orderSeq}`,
    serviceDate: TODAY,
    slot: 'lunch',
    foodType: 'vegetarian',
    opsStatus: null,
    sourceType: 'subscription',
    rescheduledFrom: null,
    ...overrides,
  };
}

/**
 * One snapshot per AccountCondition. This map is the contract: if a condition
 * cannot be produced from a plausible snapshot, the rule chain has an unreachable
 * branch and the test suite fails.
 */
export const SCENARIOS: Record<AccountCondition, () => LifecycleSnapshot> = {
  SIGNED_OUT: () => baseSnapshot({ session: null, user: null }),

  AUTH_INCOMPLETE: () =>
    baseSnapshot({ session: { authenticated: true, phoneVerified: false } }),

  ACCOUNT_BLOCKED: () =>
    baseSnapshot({ user: { id: 'user_1', fullName: null, status: 'blocked' } }),

  ONBOARDING_INCOMPLETE: () =>
    baseSnapshot({
      onboarding: { status: 'in_progress', lastCompletedStep: 'food', resumeStep: 'meal' },
    }),

  TRIAL_PAYMENT_PENDING: () => baseSnapshot({ trial: trial({ status: 'payment_pending' }) }),
  TRIAL_PAYMENT_FAILED: () => baseSnapshot({ trial: trial({ status: 'payment_failed' }) }),

  SUBSCRIPTION_PAYMENT_PENDING: () =>
    baseSnapshot({
      pendingCheckout: {
        id: 'co_1',
        kind: 'subscription',
        step: 'payment_pending',
        sourceType: 'subscription',
        sourceId: 'sub_1',
      },
    }),

  SUBSCRIPTION_PAYMENT_FAILED: () =>
    baseSnapshot({
      pendingCheckout: {
        id: 'co_1',
        kind: 'subscription',
        step: 'payment_failed',
        sourceType: 'subscription',
        sourceId: 'sub_1',
      },
    }),

  RENEWAL_FAILED: () =>
    baseSnapshot({
      subscription: subscription({ renewalFailedAt: '2026-07-22T02:00:00+05:30' }),
    }),

  DELIVERY_FAILED: () =>
    baseSnapshot({
      subscription: subscription(),
      window: [order({ opsStatus: 'delivery_failed', serviceDate: TODAY })],
    }),

  DELIVERY_DELAYED: () =>
    baseSnapshot({
      subscription: subscription(),
      window: [order({ opsStatus: 'delayed', serviceDate: TODAY })],
    }),

  TRIAL_SCHEDULED: () =>
    baseSnapshot({
      trial: trial({
        firstServiceDate: '2026-07-27',
        lastServiceDate: '2026-07-31',
        serviceDates: ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31'],
      }),
    }),

  TRIAL_ACTIVE_NO_SUBSCRIPTION: () => baseSnapshot({ trial: trial() }),

  TRIAL_ACTIVE_SUBSCRIPTION_PURCHASED: () =>
    baseSnapshot({
      trial: trial(),
      subscription: subscription({ startsOn: '2026-07-28', endsOn: '2026-08-25' }),
    }),

  TRIAL_COMPLETED_NO_SUBSCRIPTION: () =>
    baseSnapshot({
      trial: trial({
        firstServiceDate: '2026-07-13',
        lastServiceDate: '2026-07-17',
        serviceDates: ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17'],
      }),
    }),

  SUBSCRIPTION_SCHEDULED: () =>
    baseSnapshot({ subscription: subscription({ startsOn: '2026-07-27', endsOn: '2026-08-24' }) }),

  SUBSCRIPTION_ACTIVE: () =>
    baseSnapshot({
      subscription: subscription(),
      window: [order({ serviceDate: TODAY, slot: 'lunch' }), order({ serviceDate: TODAY, slot: 'dinner' })],
    }),

  SUBSCRIPTION_NO_MEAL_TODAY: () =>
    baseSnapshot({
      subscription: subscription(),
      window: [order({ serviceDate: '2026-07-24', slot: 'lunch' })],
    }),

  SUBSCRIPTION_PAUSED: () =>
    baseSnapshot({
      subscription: subscription({ pauseFrom: '2026-07-20', pauseTo: '2026-08-01' }),
    }),

  SUBSCRIPTION_ENDING: () =>
    baseSnapshot({
      subscription: subscription({ status: 'cancelled_at_period_end' }),
      window: [order({ serviceDate: TODAY })],
    }),

  SUBSCRIPTION_EXPIRED: () =>
    baseSnapshot({
      subscription: subscription({ startsOn: '2026-05-01', endsOn: '2026-06-30' }),
    }),
};
