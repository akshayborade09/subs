import { describe, expect, it } from 'vitest';
import { applyRipple, buildHome, buildWeek, pickVariant } from './home.js';
import { resolveCondition } from './rules.js';
import { ALL_CONDITIONS, type HomeVariant } from './types.js';
import { baseSnapshot, order, SCENARIOS, subscription, trial, TODAY } from './scenarios.js';

const ALL_VARIANTS: HomeVariant[] = [
  'trial_payment_pending',
  'trial_scheduled',
  'trial_active',
  'trial_subscription_purchased',
  'trial_completed',
  'subscription_scheduled',
  'subscription_active',
  'subscription_no_meal',
  'subscription_paused',
  'subscription_ending',
  'subscription_expired',
  'subscription_renewal_failed',
  'subscription_delivery_delayed',
  'subscription_delivery_failed',
  'subscription_offline',
];

describe('variant mapping', () => {
  it('produces every Home variant the app renders except the client-owned one', () => {
    const produced = new Set(
      ALL_CONDITIONS.map((condition) => pickVariant(condition)).filter(
        (variant): variant is HomeVariant => variant !== null,
      ),
    );
    const missing = ALL_VARIANTS.filter((variant) => !produced.has(variant));
    // Offline is a transport condition; the server cannot know it is unreachable.
    expect(missing).toEqual(['subscription_offline']);
  });

  it('returns no Home for conditions that route elsewhere', () => {
    for (const condition of [
      'SIGNED_OUT',
      'AUTH_INCOMPLETE',
      'ACCOUNT_BLOCKED',
      'ONBOARDING_INCOMPLETE',
      'TRIAL_PAYMENT_FAILED',
      'SUBSCRIPTION_PAYMENT_PENDING',
      'SUBSCRIPTION_PAYMENT_FAILED',
    ] as const) {
      expect(buildHome(SCENARIOS[condition](), condition), condition).toBeNull();
    }
  });

  it('builds a payload for every condition that has a Home', () => {
    for (const condition of ALL_CONDITIONS) {
      const variant = pickVariant(condition);
      if (!variant) continue;
      const home = buildHome(SCENARIOS[condition](), condition);
      expect(home, condition).not.toBeNull();
      expect(home!.variant).toBe(variant);
      expect(home!.title.length, condition).toBeGreaterThan(0);
      expect(home!.eyebrow.length, condition).toBeGreaterThan(0);
    }
  });
});

describe('week building', () => {
  it('shows the five trial dates on trial Home', () => {
    const s = baseSnapshot({ trial: trial() });
    const week = buildWeek(s, 'trial_active');
    expect(week.map((day) => day.date)).toEqual(s.trial!.serviceDates);
  });

  it('shows a Monday-to-Sunday week on subscriber Home', () => {
    const s = baseSnapshot({ subscription: subscription() });
    const week = buildWeek(s, 'subscription_active');
    expect(week).toHaveLength(7);
    expect(week[0]!.date).toBe('2026-07-20');
    expect(week[0]!.dayLabel).toBe('MON');
    expect(week[6]!.date).toBe('2026-07-26');
    expect(week[6]!.dayLabel).toBe('SUN');
  });

  it('greys days outside the subscription weekday selection', () => {
    const s = baseSnapshot({ subscription: subscription({ selectedWeekdays: [1, 3, 5] }) });
    const week = buildWeek(s, 'subscription_active');
    const enabled = week.filter((day) => !day.isDisabled).map((day) => day.dayLabel);
    expect(enabled).toEqual(['MON', 'WED', 'FRI']);
  });

  it('orders markers positionally: lunch first, dinner second', () => {
    const s = baseSnapshot({
      subscription: subscription(),
      window: [
        order({ serviceDate: TODAY, slot: 'dinner', foodType: 'non_vegetarian' }),
        order({ serviceDate: TODAY, slot: 'lunch', foodType: 'vegetarian' }),
      ],
    });
    const day = buildWeek(s, 'subscription_active').find((d) => d.date === TODAY)!;
    expect(day.markers.map((m) => m.slot)).toEqual(['lunch', 'dinner']);
    expect(day.markers.map((m) => m.foodType)).toEqual(['vegetarian', 'non_vegetarian']);
  });

  it('marks today', () => {
    const s = baseSnapshot({ subscription: subscription() });
    const week = buildWeek(s, 'subscription_active');
    expect(week.filter((day) => day.isToday).map((d) => d.date)).toEqual([TODAY]);
  });
});

describe('marker status derivation', () => {
  const at = (variant: HomeVariant, ...orders: ReturnType<typeof order>[]) => {
    const s = baseSnapshot({ subscription: subscription(), window: orders });
    return buildWeek(s, variant).flatMap((day) => day.markers);
  };

  it('maps operational facts straight through', () => {
    const markers = at(
      'subscription_active',
      order({ serviceDate: '2026-07-20', opsStatus: 'delivered' }),
      order({ serviceDate: '2026-07-21', opsStatus: 'delayed' }),
      order({ serviceDate: '2026-07-22', opsStatus: 'delivery_failed' }),
      order({ serviceDate: '2026-07-24', opsStatus: 'cancelled' }),
    );
    expect(markers.map((m) => m.status)).toEqual([
      'delivered',
      'delayed',
      'delivery_failed',
      'inactive',
    ]);
  });

  it('treats in-flight ops states as upcoming', () => {
    const markers = at(
      'subscription_active',
      order({ serviceDate: TODAY, opsStatus: 'preparing' }),
      order({ serviceDate: TODAY, slot: 'dinner', opsStatus: 'out_for_delivery' }),
    );
    expect(markers.map((m) => m.status)).toEqual(['upcoming', 'upcoming']);
  });

  it('never silently assumes a past meal was delivered', () => {
    const markers = at('subscription_active', order({ serviceDate: '2026-07-20', opsStatus: null }));
    expect(markers[0]!.status).toBe('issue');
  });

  it('greys the whole schedule when paused, keeping delivered history', () => {
    const markers = at(
      'subscription_paused',
      order({ serviceDate: '2026-07-20', opsStatus: 'delivered' }),
      order({ serviceDate: '2026-07-24', opsStatus: null }),
    );
    expect(markers.map((m) => m.status)).toEqual(['delivered', 'paused']);
  });

  it('greys the whole schedule when the plan has ended', () => {
    const markers = at(
      'subscription_expired',
      order({ serviceDate: '2026-07-20', opsStatus: 'delivered' }),
      order({ serviceDate: '2026-07-24', opsStatus: null }),
    );
    expect(markers.map((m) => m.status)).toEqual(['delivered', 'inactive']);
  });
});

describe('ripple', () => {
  it('marks exactly one, the first actionable in chronological order', () => {
    const s = baseSnapshot({
      subscription: subscription(),
      window: [
        order({ serviceDate: '2026-07-20', opsStatus: 'delivered' }),
        order({ serviceDate: '2026-07-24', opsStatus: null }),
        order({ serviceDate: '2026-07-25', opsStatus: null }),
      ],
    });
    const week = buildWeek(s, 'subscription_active');
    applyRipple(week, 'subscription_active');
    const rippled = week.flatMap((d) => d.markers).filter((m) => m.showRipple);
    expect(rippled).toHaveLength(1);
    expect(rippled[0]!.mealOrderId).toBe(s.window[1]!.id);
  });

  it('moves to dinner once lunch is delivered on the same day', () => {
    const s = baseSnapshot({
      subscription: subscription(),
      window: [
        order({ serviceDate: TODAY, slot: 'lunch', opsStatus: 'delivered' }),
        order({ serviceDate: TODAY, slot: 'dinner', opsStatus: null }),
      ],
    });
    const week = buildWeek(s, 'subscription_active');
    applyRipple(week, 'subscription_active');
    const rippled = week.flatMap((d) => d.markers).filter((m) => m.showRipple);
    expect(rippled).toHaveLength(1);
    expect(rippled[0]!.slot).toBe('dinner');
  });

  it('can land on a delayed meal, since it is still actionable', () => {
    const s = baseSnapshot({
      subscription: subscription(),
      window: [order({ serviceDate: TODAY, opsStatus: 'delayed' })],
    });
    const week = buildWeek(s, 'subscription_delivery_delayed');
    expect(applyRipple(week, 'subscription_delivery_delayed')).toBe(s.window[0]!.id);
  });

  it('is suppressed entirely when nothing is actionable', () => {
    for (const variant of ['subscription_paused', 'subscription_expired', 'subscription_offline'] as const) {
      const s = baseSnapshot({
        subscription: subscription(),
        window: [order({ serviceDate: '2026-07-24', opsStatus: null })],
      });
      const week = buildWeek(s, variant);
      expect(applyRipple(week, variant), variant).toBeNull();
      expect(week.flatMap((d) => d.markers).some((m) => m.showRipple), variant).toBe(false);
    }
  });

  it('skips greyed-out days', () => {
    const s = baseSnapshot({
      subscription: subscription({ selectedWeekdays: [5] }),
      window: [
        order({ serviceDate: '2026-07-21', opsStatus: null }),
        order({ serviceDate: '2026-07-24', opsStatus: null }),
      ],
    });
    const week = buildWeek(s, 'subscription_active');
    expect(applyRipple(week, 'subscription_active')).toBe(s.window[1]!.id);
  });
});

describe('copy interpolation', () => {
  it('fills dates into captions', () => {
    const s = SCENARIOS.TRIAL_SCHEDULED();
    const home = buildHome(s, 'TRIAL_SCHEDULED')!;
    expect(home.caption).toBe('Trial starts 27 July');
  });

  it('names the plan on an active subscription', () => {
    const home = buildHome(SCENARIOS.SUBSCRIPTION_ACTIVE(), 'SUBSCRIPTION_ACTIVE')!;
    expect(home.caption).toBe('Monthly subscription');
  });

  it('reports the resume date as the day after the pause ends', () => {
    const home = buildHome(SCENARIOS.SUBSCRIPTION_PAUSED(), 'SUBSCRIPTION_PAUSED')!;
    expect(home.caption).toBe('Resumes 2 August');
    expect(home.description).toContain('resumes on 2 August');
  });

  it('omits a caption rather than leaking an unresolved placeholder', () => {
    const s = baseSnapshot({
      subscription: subscription({ pauseFrom: '2026-07-20', pauseTo: null }),
    });
    const home = buildHome(s, 'SUBSCRIPTION_PAUSED')!;
    expect(home.caption).toBeNull();
    expect(home.description).not.toContain('{');
  });

  it('never emits an unresolved slot in any field', () => {
    for (const condition of ALL_CONDITIONS) {
      const home = buildHome(SCENARIOS[condition](), condition);
      if (!home) continue;
      const text = [home.eyebrow, home.title, home.description, home.caption ?? '', home.notice?.title ?? '', home.notice?.body ?? ''].join(' ');
      expect(text, condition).not.toMatch(/\{[a-zA-Z]+\}/);
    }
  });
});

describe('notices and plan cards', () => {
  it('names the affected date on a delayed delivery', () => {
    const home = buildHome(SCENARIOS.DELIVERY_DELAYED(), 'DELIVERY_DELAYED')!;
    expect(home.notice).toMatchObject({ tone: 'orange', title: 'Delivery delayed' });
    expect(home.notice!.body).toContain('23 July');
  });

  it('uses a red notice for a failed delivery', () => {
    const home = buildHome(SCENARIOS.DELIVERY_FAILED(), 'DELIVERY_FAILED')!;
    expect(home.notice!.tone).toBe('red');
  });

  it('offers re-subscribe while a cancelled plan is still running', () => {
    const home = buildHome(SCENARIOS.SUBSCRIPTION_ENDING(), 'SUBSCRIPTION_ENDING')!;
    expect(home.notice).toMatchObject({ tone: 'purple', action: 'Re-subscribe to this plan' });
    expect(home.notice!.title).toBe('Plan active until 20 August');
  });

  it('shows a plan card only for the three recovery states', () => {
    const withCard = ALL_CONDITIONS.filter(
      (condition) => buildHome(SCENARIOS[condition](), condition)?.planCard != null,
    );
    expect(withCard.sort()).toEqual(
      ['RENEWAL_FAILED', 'SUBSCRIPTION_EXPIRED', 'SUBSCRIPTION_PAUSED'].sort(),
    );
  });
});

describe('end-to-end resolution', () => {
  it('resolves and renders each scenario without throwing', () => {
    for (const condition of ALL_CONDITIONS) {
      const snapshot = SCENARIOS[condition]();
      const resolution = resolveCondition(snapshot);
      expect(resolution.condition).toBe(condition);
      expect(() => buildHome(snapshot, resolution.condition)).not.toThrow();
    }
  });

  it('selects exactly one day whenever a Home is rendered', () => {
    for (const condition of ALL_CONDITIONS) {
      const home = buildHome(SCENARIOS[condition](), condition);
      if (!home || home.week.length === 0) continue;
      expect(home.week.filter((day) => day.isSelected), condition).toHaveLength(1);
    }
  });
});
