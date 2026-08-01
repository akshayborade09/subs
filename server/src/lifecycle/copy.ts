import type { HomeVariant } from './types.js';

/**
 * Home copy, lifted verbatim from src/TrialHome.tsx:488 with the hardcoded dates and
 * amounts replaced by interpolation slots. It lives server-side because the specs
 * require backend-supplied wording wherever policy is involved (handoff §3), and
 * because "Trial starts 27 July" cannot be a constant.
 *
 * Unresolved slots are dropped along with their surrounding sentence rather than
 * rendered as "{resumeDate}" — see `interpolate`.
 */
export type CopyTemplate = {
  eyebrow: string;
  title: string;
  description: string;
  /** Slot-free wording used when the description's slots cannot be resolved. */
  descriptionFallback?: string;
  caption: string | null;
  selectedLabel: string;
};

export type CopyContext = {
  trialStartDate?: string;
  trialEndDate?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  resumeDate?: string;
  affectedDate?: string;
  planName?: string;
  trialAmount?: string;
};

export const HOME_COPY: Record<HomeVariant, CopyTemplate> = {
  trial_payment_pending: {
    eyebrow: 'PAYMENT PENDING',
    title: 'Your trial payment is being checked',
    description: 'Your trial dates are saved while the payment confirmation is pending.',
    caption: 'Payment not confirmed',
    selectedLabel: 'FIRST TRIAL MEAL',
  },
  trial_scheduled: {
    eyebrow: 'TRIAL SCHEDULED',
    title: 'Your trial starts soon',
    description:
      'Your five selected trial dates are ready. Tap a meal-status circle to review details.',
    caption: 'Trial starts {trialStartDate}',
    selectedLabel: 'FIRST TRIAL MEAL',
  },
  trial_active: {
    eyebrow: 'ACTIVE TRIAL',
    title: 'Your five-day trial',
    description: 'Tap a meal-status circle to view that meal’s details.',
    caption: null,
    selectedLabel: 'SELECTED MEAL',
  },
  trial_subscription_purchased: {
    eyebrow: 'ACTIVE TRIAL',
    title: 'Your five-day trial',
    description: 'Your subscription is ready and will begin after the final trial meal.',
    caption: 'Subscription starts after trial',
    selectedLabel: 'SELECTED MEAL',
  },
  trial_completed: {
    eyebrow: 'TRIAL COMPLETE',
    title: 'Your five-day trial is complete',
    description: 'Review your delivered meals or continue with a subscription.',
    caption: 'Trial completed',
    selectedLabel: 'LAST TRIAL MEAL',
  },
  subscription_scheduled: {
    eyebrow: 'SUBSCRIPTION SCHEDULED',
    title: 'Your meals start soon',
    description: 'Your selected delivery days are ready for the coming week.',
    caption: 'Starts {subscriptionStartDate}',
    selectedLabel: 'FIRST SELECTED MEAL',
  },
  subscription_active: {
    eyebrow: 'ACTIVE SUBSCRIPTION',
    title: 'Your meals this week',
    description: 'Tap a selected delivery day to view or update that meal.',
    caption: '{planName} subscription',
    selectedLabel: 'NEXT SELECTED MEAL',
  },
  subscription_no_meal: {
    eyebrow: 'ACTIVE SUBSCRIPTION',
    title: 'Your meals this week',
    description:
      'There is no meal selected today. Your next selected delivery remains available below.',
    caption: 'No meal today',
    selectedLabel: 'NEXT SELECTED MEAL',
  },
  subscription_paused: {
    eyebrow: 'SUBSCRIPTION PAUSED',
    title: 'Your meals are paused',
    description: 'The same weekly schedule is preserved and resumes on {resumeDate}.',
    descriptionFallback: 'The same weekly schedule is preserved until deliveries resume.',
    caption: 'Resumes {resumeDate}',
    selectedLabel: 'NEXT MEAL AFTER RESUME',
  },
  subscription_ending: {
    eyebrow: 'SUBSCRIPTION ENDING',
    title: 'Your meals this week',
    description: 'Your paid deliveries remain active until {subscriptionEndDate}.',
    descriptionFallback: 'Your paid deliveries remain active until your plan ends.',
    caption: 'Active until {subscriptionEndDate}',
    selectedLabel: 'NEXT SELECTED MEAL',
  },
  subscription_expired: {
    eyebrow: 'SUBSCRIPTION ENDED',
    title: 'Your saved meal schedule',
    description: 'Your plan has ended. Previous meals and nutrition history remain available.',
    caption: 'Plan ended',
    selectedLabel: 'LAST SCHEDULED MEAL',
  },
  subscription_renewal_failed: {
    eyebrow: 'PAYMENT ACTION NEEDED',
    title: 'Your meals this week',
    description: 'Paid meals remain confirmed. Update payment to keep future weeks active.',
    caption: 'Renewal failed',
    selectedLabel: 'NEXT CONFIRMED MEAL',
  },
  subscription_delivery_delayed: {
    eyebrow: 'DELIVERY UPDATE',
    title: 'Your meals this week',
    description: 'One selected delivery is delayed. Your weekly schedule has not changed.',
    caption: 'Delivery delayed',
    selectedLabel: 'AFFECTED MEAL',
  },
  subscription_delivery_failed: {
    eyebrow: 'DELIVERY ISSUE',
    title: 'Your meals this week',
    description: 'One delivery needs an address or support resolution.',
    caption: 'Action required',
    selectedLabel: 'AFFECTED MEAL',
  },
  subscription_offline: {
    eyebrow: 'OFFLINE',
    title: 'Your saved meals this week',
    description: 'Showing the latest saved schedule. Changes are unavailable until you reconnect.',
    caption: null,
    selectedLabel: 'NEXT SAVED MEAL',
  },
};

const SLOT = /\{(\w+)\}/g;

/**
 * Returns null when the template needs a value the context does not have, so an
 * unresolvable caption is omitted rather than shown as "Resumes {resumeDate}".
 */
export function interpolate(template: string | null, context: CopyContext): string | null {
  if (template === null) return null;
  let missing = false;
  const rendered = template.replace(SLOT, (_match, key: string) => {
    const value = context[key as keyof CopyContext];
    if (value === undefined || value === null || value === '') {
      missing = true;
      return '';
    }
    return value;
  });
  return missing ? null : rendered;
}

/**
 * Same rules, but a missing slot must not blank out a title or description.
 * The fallback is stripped too — a fallback that itself contains a slot would
 * otherwise ship "{resumeDate}" straight to the user.
 */
export function interpolateRequired(template: string, context: CopyContext, fallback: string): string {
  return interpolate(template, context) ?? stripSlots(fallback);
}

function stripSlots(text: string): string {
  return text
    .replace(SLOT, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,])/g, '$1')
    .trim();
}
