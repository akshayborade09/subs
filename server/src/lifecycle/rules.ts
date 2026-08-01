import { policy } from '../platform/config/policy.js';
import {
  hasLiveMealOn,
  hasPaidSubscription,
  hasUnresolvedRenewalFailure,
  subscriptionPhase,
  trialPhase,
  type LifecycleSnapshot,
} from './snapshot.js';
import type { AccountCondition, Resolution, Route } from './types.js';

type Rule = {
  id: string;
  when: (s: LifecycleSnapshot) => boolean;
  then: AccountCondition | ((s: LifecycleSnapshot) => AccountCondition);
};

const isSubscriptionKind = (kind: string): boolean => kind !== 'trial';

/** An open delivery exception must be recent enough to still demand attention. */
function hasOpenDeliveryFailure(s: LifecycleSnapshot): boolean {
  const cutoff = addDaysLexical(s.today, -policy.routing.deliveryFailureGraceDays);
  return s.window.some(
    (order) =>
      order.opsStatus === 'delivery_failed' &&
      order.serviceDate >= cutoff &&
      isExceptionEligible(order.sourceType),
  );
}

/**
 * The specs are explicit that "delayed" is an *upcoming* condition — a past
 * delivery that ran late is history, not an alert (handoff §11.3).
 */
function hasOpenDeliveryDelay(s: LifecycleSnapshot): boolean {
  return s.window.some(
    (order) =>
      order.opsStatus === 'delayed' &&
      order.serviceDate >= s.today &&
      isExceptionEligible(order.sourceType),
  );
}

function isExceptionEligible(sourceType: string): boolean {
  return policy.routing.deliveryExceptionsDuringTrial ? true : sourceType !== 'trial';
}

/** Lexical date maths, safe because both operands are `YYYY-MM-DD`. */
function addDaysLexical(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Priority-ordered. Higher rules override lower ones — money-blocking beats
 * operational beats administrative (lifecycle spec §4).
 *
 * The final rule is total, so `.find()` can never return undefined. That is
 * asserted by a fuzz test rather than trusted.
 */
export const RULES: readonly Rule[] = [
  { id: 'no_session', when: (s) => !s.session?.authenticated || !s.user, then: 'SIGNED_OUT' },
  { id: 'phone_unverified', when: (s) => !s.session?.phoneVerified, then: 'AUTH_INCOMPLETE' },
  { id: 'account_blocked', when: (s) => s.user?.status !== 'active', then: 'ACCOUNT_BLOCKED' },

  /**
   * Lifecycle spec §4 ranks onboarding above payment recovery, which only makes
   * sense while the trial is still a draft. Once payment has been initiated the
   * user is past the wizard, so the payment rules below must win.
   */
  {
    id: 'onboarding_incomplete',
    when: (s) => {
      if (s.onboarding?.status === 'complete') return false;
      if (hasPaidSubscription(s)) return false;
      const phase = trialPhase(s);
      return phase === 'none' || phase === 'draft' || phase === 'cancelled';
    },
    then: 'ONBOARDING_INCOMPLETE',
  },

  { id: 'trial_payment_pending', when: (s) => trialPhase(s) === 'payment_pending', then: 'TRIAL_PAYMENT_PENDING' },
  { id: 'trial_payment_failed', when: (s) => trialPhase(s) === 'payment_failed', then: 'TRIAL_PAYMENT_FAILED' },

  /**
   * Handoff §7 ranks this above trial-active; lifecycle spec §4 rule 6 says trial
   * Home wins even when a subscription has been purchased. We follow the lifecycle
   * spec, so this rule stands down while a trial is running and the pending payment
   * is surfaced as a Home notice instead.
   */
  {
    id: 'subscription_payment_recovery',
    when: (s) => {
      const checkout = s.pendingCheckout;
      if (!checkout || !isSubscriptionKind(checkout.kind)) return false;
      if (checkout.step !== 'payment_pending' && checkout.step !== 'payment_failed') return false;
      if (!policy.routing.subscriptionPaymentBlocksTrialHome && trialPhase(s) === 'active') return false;
      return true;
    },
    then: (s) =>
      s.pendingCheckout?.step === 'payment_failed'
        ? 'SUBSCRIPTION_PAYMENT_FAILED'
        : 'SUBSCRIPTION_PAYMENT_PENDING',
  },

  { id: 'renewal_failed', when: hasUnresolvedRenewalFailure, then: 'RENEWAL_FAILED' },
  { id: 'delivery_failed_open', when: hasOpenDeliveryFailure, then: 'DELIVERY_FAILED' },
  { id: 'delivery_delayed_open', when: hasOpenDeliveryDelay, then: 'DELIVERY_DELAYED' },

  {
    id: 'trial_active',
    when: (s) => trialPhase(s) === 'active',
    then: (s) =>
      hasPaidSubscription(s)
        ? 'TRIAL_ACTIVE_SUBSCRIPTION_PURCHASED'
        : 'TRIAL_ACTIVE_NO_SUBSCRIPTION',
  },
  { id: 'trial_scheduled', when: (s) => trialPhase(s) === 'scheduled', then: 'TRIAL_SCHEDULED' },

  { id: 'subscription_paused', when: (s) => subscriptionPhase(s) === 'paused', then: 'SUBSCRIPTION_PAUSED' },
  { id: 'subscription_scheduled', when: (s) => subscriptionPhase(s) === 'scheduled', then: 'SUBSCRIPTION_SCHEDULED' },
  { id: 'subscription_ending', when: (s) => subscriptionPhase(s) === 'ending', then: 'SUBSCRIPTION_ENDING' },
  {
    id: 'subscription_no_meal_today',
    when: (s) => subscriptionPhase(s) === 'active' && !hasLiveMealOn(s, s.today),
    then: 'SUBSCRIPTION_NO_MEAL_TODAY',
  },
  { id: 'subscription_active', when: (s) => subscriptionPhase(s) === 'active', then: 'SUBSCRIPTION_ACTIVE' },
  { id: 'subscription_expired', when: (s) => subscriptionPhase(s) === 'expired', then: 'SUBSCRIPTION_EXPIRED' },

  { id: 'trial_completed', when: (s) => trialPhase(s) === 'completed', then: 'TRIAL_COMPLETED_NO_SUBSCRIPTION' },

  // Total by construction: a signed-in, verified, onboarded user with no commerce
  // of any kind still has somewhere to go.
  { id: 'fallback_onboarding', when: () => true, then: 'ONBOARDING_INCOMPLETE' },
];

const ROUTES: Record<AccountCondition, Route> = {
  SIGNED_OUT: 'stories',
  AUTH_INCOMPLETE: 'auth',
  ACCOUNT_BLOCKED: 'support',
  ONBOARDING_INCOMPLETE: 'onboarding',
  TRIAL_PAYMENT_PENDING: 'trial_payment_recovery',
  TRIAL_PAYMENT_FAILED: 'trial_payment_recovery',
  SUBSCRIPTION_PAYMENT_PENDING: 'subscription_payment_recovery',
  SUBSCRIPTION_PAYMENT_FAILED: 'subscription_payment_recovery',
  RENEWAL_FAILED: 'home',
  DELIVERY_FAILED: 'home',
  DELIVERY_DELAYED: 'home',
  TRIAL_SCHEDULED: 'home',
  TRIAL_ACTIVE_NO_SUBSCRIPTION: 'home',
  TRIAL_ACTIVE_SUBSCRIPTION_PURCHASED: 'home',
  TRIAL_COMPLETED_NO_SUBSCRIPTION: 'home',
  SUBSCRIPTION_SCHEDULED: 'home',
  SUBSCRIPTION_ACTIVE: 'home',
  SUBSCRIPTION_NO_MEAL_TODAY: 'home',
  SUBSCRIPTION_PAUSED: 'home',
  SUBSCRIPTION_ENDING: 'home',
  SUBSCRIPTION_EXPIRED: 'home',
};

const REQUIRES_ACTION: ReadonlySet<AccountCondition> = new Set<AccountCondition>([
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
  'TRIAL_COMPLETED_NO_SUBSCRIPTION',
  'SUBSCRIPTION_EXPIRED',
]);

export function resolveCondition(s: LifecycleSnapshot): Resolution {
  const rule = RULES.find((candidate) => candidate.when(s));
  if (!rule) {
    // Unreachable: the last rule matches everything. Guard rather than assert.
    throw new Error('Lifecycle rule chain is not total');
  }
  const condition = typeof rule.then === 'function' ? rule.then(s) : rule.then;
  return {
    condition,
    firedRule: rule.id,
    route: ROUTES[condition],
    requiresAction: REQUIRES_ACTION.has(condition),
  };
}
