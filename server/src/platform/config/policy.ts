/**
 * Every product decision the specs left open. Values live here rather than in the
 * database so product can change them without a migration, and so the lifecycle
 * resolver stays a pure function of (snapshot, policy).
 *
 * Sources: docs/backend-system-handoff.md §22, docs/user-lifecycle-state-spec.md §13,
 * docs/checkout-profile-loyalty-spec.md §23 — all currently undecided.
 */
export type Policy = typeof policy;

export const policy = {
  deliveryTimezone: 'Asia/Kolkata',

  routing: {
    /**
     * Handoff §7 ranks subscription-payment-pending above trial-active; lifecycle
     * spec §4 rule 6 says trial Home wins "even if a future subscription has
     * already been purchased". We follow the lifecycle spec.
     */
    subscriptionPaymentBlocksTrialHome: false,
    /** Q/R are written against subscriber Home; the app has no trial delay variant. */
    deliveryExceptionsDuringTrial: false,
    /** How long a failed delivery keeps demanding attention on Home. */
    deliveryFailureGraceDays: 2,
  },

  cutoffs: {
    /** Preferences for a service date lock at this IST hour the previous day. */
    preferenceHourIst: 20,
    /** Lunch and dinner share one cutoff until ops says otherwise. */
    perSlot: false,
    /** Address changes follow the same cutoff as preferences. */
    addressFollowsPreference: true,
    /** Same-day changes of any kind are refused. */
    allowSameDayChanges: false,
  },

  deliveryWindows: {
    lunch: { start: '11:00', end: '13:00' },
    dinner: { start: '18:30', end: '20:30' },
  },

  trial: {
    requiredDays: 5,
    /** ₹899, from the app's checkout summary (src/TrialFlow.tsx:506). */
    pricePaise: 89_900,
    /** Credited against the first subscription (the app shows "−₹100"). */
    creditTowardSubscriptionPaise: 10_000,
    /** All five meal orders are created inside the payment-success transaction. */
    materializeOnPayment: true,
  },

  subscription: {
    /** Rolling window; a full quarter would make one preference change a 90-row rewrite. */
    materializationHorizonDays: 21,
    autoRenew: true,
    /** Renewal is charged this many days before the period ends. */
    renewChargeLeadDays: 1,
  },

  limits: {
    /** null = unlimited date changes per meal order. */
    dateChangesPerOrder: null as number | null,
  },

  loyalty: {
    qualifyingActiveDays: 28,
    requiredFulfilledMealDays: 20,
    rewardExpiryDays: 60,
  },

  otp: {
    length: 6,
    expirySeconds: 300,
    maxAttempts: 5,
    resendCooldownSeconds: 30,
    maxRequestsPerPhonePerHour: 5,
  },

  currency: 'INR' as const,
} as const;
