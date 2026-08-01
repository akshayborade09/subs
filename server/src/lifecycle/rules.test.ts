import { describe, expect, it } from 'vitest';
import { resolveCondition, RULES } from './rules.js';
import { toLegacyLifecycleId } from './legacy.js';
import { ALL_CONDITIONS, type AccountCondition } from './types.js';
import { baseSnapshot, order, SCENARIOS, subscription, trial, TODAY } from './scenarios.js';
import type { LifecycleSnapshot } from './snapshot.js';

describe('every condition is reachable', () => {
  for (const condition of ALL_CONDITIONS) {
    it(`derives ${condition}`, () => {
      const scenario = SCENARIOS[condition];
      expect(scenario, `no fixture for ${condition}`).toBeDefined();
      expect(resolveCondition(scenario()).condition).toBe(condition);
    });
  }

  it('covers the whole AccountCondition union', () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual([...ALL_CONDITIONS].sort());
  });
});

describe('priority ordering', () => {
  it('signed out beats everything', () => {
    const s = baseSnapshot({ session: null, user: null, trial: trial(), subscription: subscription() });
    expect(resolveCondition(s).condition).toBe('SIGNED_OUT');
  });

  it('unverified phone beats a blocked account', () => {
    const s = baseSnapshot({
      session: { authenticated: true, phoneVerified: false },
      user: { id: 'u', fullName: null, status: 'blocked' },
    });
    expect(resolveCondition(s).condition).toBe('AUTH_INCOMPLETE');
  });

  it('a trial in draft keeps the user in onboarding', () => {
    const s = baseSnapshot({
      onboarding: { status: 'in_progress', lastCompletedStep: 'address', resumeStep: 'confirm' },
      trial: trial({ status: 'draft' }),
    });
    expect(resolveCondition(s).condition).toBe('ONBOARDING_INCOMPLETE');
  });

  it('once payment is in flight, payment recovery outranks onboarding', () => {
    const s = baseSnapshot({
      onboarding: { status: 'in_progress', lastCompletedStep: 'payment', resumeStep: 'payment' },
      trial: trial({ status: 'payment_pending' }),
    });
    expect(resolveCondition(s).condition).toBe('TRIAL_PAYMENT_PENDING');
  });

  it('money-blocking (renewal failure) outranks operational (delivery delay)', () => {
    const s = baseSnapshot({
      subscription: subscription({ renewalFailedAt: '2026-07-22T02:00:00+05:30' }),
      window: [order({ opsStatus: 'delayed', serviceDate: TODAY })],
    });
    expect(resolveCondition(s).condition).toBe('RENEWAL_FAILED');
  });

  it('a failed delivery outranks a delayed one', () => {
    const s = baseSnapshot({
      subscription: subscription(),
      window: [
        order({ opsStatus: 'delayed', serviceDate: TODAY }),
        order({ opsStatus: 'delivery_failed', serviceDate: TODAY, slot: 'dinner' }),
      ],
    });
    expect(resolveCondition(s).condition).toBe('DELIVERY_FAILED');
  });

  it('operational issues outrank an administrative "ending" state', () => {
    const s = baseSnapshot({
      subscription: subscription({ status: 'cancelled_at_period_end' }),
      window: [order({ opsStatus: 'delayed', serviceDate: TODAY })],
    });
    expect(resolveCondition(s).condition).toBe('DELIVERY_DELAYED');
  });

  it('an active trial wins over a purchased future subscription (lifecycle spec §4.6)', () => {
    const s = baseSnapshot({
      trial: trial(),
      subscription: subscription({ startsOn: '2026-07-28', endsOn: '2026-08-25' }),
      pendingCheckout: {
        id: 'co', kind: 'subscription', step: 'payment_pending',
        sourceType: 'subscription', sourceId: 'sub_1',
      },
    });
    expect(resolveCondition(s).condition).toBe('TRIAL_ACTIVE_SUBSCRIPTION_PURCHASED');
  });
});

describe('clock-driven derivations', () => {
  it('the same trial reads scheduled, active then completed as today advances', () => {
    const fixed = trial({
      firstServiceDate: '2026-07-21',
      lastServiceDate: '2026-07-27',
      serviceDates: ['2026-07-21', '2026-07-27'],
    });
    const at = (today: string) =>
      resolveCondition(baseSnapshot({ today, trial: fixed })).condition;

    expect(at('2026-07-20')).toBe('TRIAL_SCHEDULED');
    expect(at('2026-07-21')).toBe('TRIAL_ACTIVE_NO_SUBSCRIPTION');
    expect(at('2026-07-27')).toBe('TRIAL_ACTIVE_NO_SUBSCRIPTION');
    expect(at('2026-07-28')).toBe('TRIAL_COMPLETED_NO_SUBSCRIPTION');
  });

  it('a pause window opens and closes without any stored flag', () => {
    const sub = subscription({ pauseFrom: '2026-07-25', pauseTo: '2026-07-30' });
    const at = (today: string) =>
      resolveCondition(baseSnapshot({ today, subscription: sub, window: [order({ serviceDate: today })] })).condition;

    expect(at('2026-07-24')).toBe('SUBSCRIPTION_ACTIVE');
    expect(at('2026-07-25')).toBe('SUBSCRIPTION_PAUSED');
    expect(at('2026-07-30')).toBe('SUBSCRIPTION_PAUSED');
    expect(at('2026-07-31')).toBe('SUBSCRIPTION_ACTIVE');
  });

  it('a past delayed delivery is history, not an alert', () => {
    const s = baseSnapshot({
      subscription: subscription(),
      window: [
        order({ opsStatus: 'delayed', serviceDate: '2026-07-20' }),
        order({ serviceDate: TODAY }),
      ],
    });
    expect(resolveCondition(s).condition).toBe('SUBSCRIPTION_ACTIVE');
  });

  it('a failed delivery stops demanding attention after the grace window', () => {
    const build = (serviceDate: string) =>
      baseSnapshot({
        subscription: subscription(),
        window: [order({ opsStatus: 'delivery_failed', serviceDate }), order({ serviceDate: TODAY })],
      });
    expect(resolveCondition(build('2026-07-21')).condition).toBe('DELIVERY_FAILED');
    expect(resolveCondition(build('2026-07-10')).condition).toBe('SUBSCRIPTION_ACTIVE');
  });

  it('trial-sourced delivery exceptions are suppressed by policy', () => {
    const s = baseSnapshot({
      trial: trial(),
      window: [order({ opsStatus: 'delivery_failed', serviceDate: TODAY, sourceType: 'trial' })],
    });
    expect(resolveCondition(s).condition).toBe('TRIAL_ACTIVE_NO_SUBSCRIPTION');
  });
});

/* ------------------------------------------------------------------ *
 * Properties. These are the real payoff of keeping the resolver pure.
 * ------------------------------------------------------------------ */

function randomSnapshot(rand: () => number): LifecycleSnapshot {
  const pick = <T>(values: readonly T[]): T => values[Math.floor(rand() * values.length)]!;
  const maybe = <T>(value: T): T | null => (rand() < 0.4 ? null : value);
  const date = () => {
    const day = 1 + Math.floor(rand() * 28);
    const month = rand() < 0.5 ? '07' : '08';
    return `2026-${month}-${String(day).padStart(2, '0')}`;
  };

  const dates = [date(), date(), date()].sort();

  return {
    now: NOW_ISO,
    today: date(),
    session: maybe({ authenticated: rand() < 0.85, phoneVerified: rand() < 0.8 }),
    user: maybe({
      id: 'u',
      fullName: null,
      status: pick(['active', 'active', 'active', 'blocked', 'deleted'] as const),
    }),
    onboarding: maybe({
      status: pick(['in_progress', 'complete', 'abandoned'] as const),
      lastCompletedStep: null,
      resumeStep: 'personal',
    }),
    trial: maybe(
      trial({
        status: pick(['draft', 'payment_pending', 'payment_failed', 'paid', 'cancelled'] as const),
        firstServiceDate: dates[0]!,
        lastServiceDate: dates[2]!,
        serviceDates: dates,
      }),
    ),
    subscription: maybe(
      subscription({
        status: pick(['pending_payment', 'paid', 'cancelled_at_period_end', 'terminated'] as const),
        startsOn: dates[0]!,
        endsOn: dates[2]!,
        pauseFrom: rand() < 0.3 ? dates[0]! : null,
        pauseTo: rand() < 0.5 ? dates[2]! : null,
        renewalFailedAt: rand() < 0.2 ? '2026-07-22T02:00:00+05:30' : null,
      }),
    ),
    pendingCheckout: maybe({
      id: 'co',
      kind: pick(['trial', 'subscription', 'renewal', 'resubscription'] as const),
      step: pick(['review', 'payment_pending', 'payment_failed', 'payment_success'] as const),
      sourceType: 'subscription' as const,
      sourceId: 'sub_1',
    }),
    window: Array.from({ length: Math.floor(rand() * 4) }, () =>
      order({
        serviceDate: date(),
        slot: pick(['lunch', 'dinner'] as const),
        opsStatus: pick([null, 'delivered', 'delayed', 'delivery_failed', 'cancelled'] as const),
        sourceType: pick(['trial', 'subscription'] as const),
      }),
    ),
  };
}

const NOW_ISO = '2026-07-23T09:30:00+05:30';

/** Deterministic PRNG so a failure is reproducible from the seed alone. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('properties', () => {
  it('is total: some rule always fires, over 10k random snapshots', () => {
    const rand = mulberry32(20260723);
    const valid = new Set<string>(ALL_CONDITIONS);
    for (let i = 0; i < 10_000; i += 1) {
      const snapshot = randomSnapshot(rand);
      const resolution = resolveCondition(snapshot);
      expect(valid.has(resolution.condition), `unknown condition at iteration ${i}`).toBe(true);
      expect(resolution.firedRule).toBeTruthy();
    }
  });

  it('is deterministic: the same snapshot always resolves the same way', () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 500; i += 1) {
      const snapshot = randomSnapshot(rand);
      const first = resolveCondition(snapshot);
      const second = resolveCondition(structuredClone(snapshot));
      expect(second).toEqual(first);
    }
  });

  it('has no duplicate rule ids', () => {
    const ids = RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ends with a rule that matches everything', () => {
    const last = RULES[RULES.length - 1]!;
    expect(last.when(baseSnapshot())).toBe(true);
  });

  it('maps every derived condition to a legacy letter except the one the specs omit', () => {
    const unmapped = ALL_CONDITIONS.filter((c: AccountCondition) => toLegacyLifecycleId(c) === null);
    expect(unmapped).toEqual(['ACCOUNT_BLOCKED']);
  });
});
