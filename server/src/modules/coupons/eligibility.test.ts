import { describe, expect, it } from 'vitest';
import { evaluateCoupon, type CouponContext, type CouponRule } from './eligibility.js';

const rupees = (v: number): number => v * 100;

const flat = (overrides: Partial<CouponRule> = {}): CouponRule => ({
  code: 'HEALTHY300',
  kind: 'flat',
  valuePaise: rupees(300),
  percentBps: null,
  maxDiscountPaise: null,
  minOrderPaise: rupees(2000),
  appliesToPlanCodes: ['monthly', 'quarterly'],
  appliesToKinds: ['trial', 'subscription', 'renewal', 'resubscription'],
  newUsersOnly: true,
  stackableWithReward: false,
  usageLimitTotal: null,
  usageLimitPerUser: 1,
  startsAt: '2026-01-01T00:00:00.000Z',
  expiresAt: null,
  isActive: true,
  ...overrides,
});

const ctx = (overrides: Partial<CouponContext> = {}): CouponContext => ({
  now: '2026-08-01T00:00:00.000Z',
  orderPaise: rupees(4999),
  planCode: 'monthly',
  checkoutKind: 'subscription',
  isNewUser: true,
  timesUsedByUser: 0,
  timesUsedTotal: 0,
  hasRewardApplied: false,
  ...overrides,
});

describe('applying a coupon', () => {
  it('applies a flat discount', () => {
    const result = evaluateCoupon(flat(), ctx());
    expect(result.status).toBe('applied');
    expect(result.discountPaise).toBe(rupees(300));
    expect(result.message).toBe('Coupon applied. You saved ₹300.');
  });

  it('applies a percentage discount', () => {
    const result = evaluateCoupon(
      flat({ kind: 'percent', valuePaise: null, percentBps: 1000, maxDiscountPaise: null, minOrderPaise: 0 }),
      ctx({ orderPaise: rupees(1000) }),
    );
    expect(result.discountPaise).toBe(rupees(100));
  });

  it('honours a percentage cap', () => {
    const result = evaluateCoupon(
      flat({ kind: 'percent', valuePaise: null, percentBps: 1000, maxDiscountPaise: rupees(150) }),
      ctx({ orderPaise: rupees(5000) }),
    );
    expect(result.discountPaise).toBe(rupees(150));
  });

  it('never discounts more than is owed', () => {
    const result = evaluateCoupon(
      flat({ valuePaise: rupees(9999), minOrderPaise: 0 }),
      ctx({ orderPaise: rupees(500) }),
    );
    expect(result.discountPaise).toBe(rupees(500));
  });

  it('treats an empty plan list as "all plans"', () => {
    const result = evaluateCoupon(flat({ appliesToPlanCodes: [] }), ctx({ planCode: 'weekly' }));
    expect(result.status).toBe('applied');
  });
});

describe('every rejection reason is explicit', () => {
  const cases: Array<[string, CouponRule, CouponContext, string]> = [
    ['inactive', flat({ isActive: false }), ctx(), 'This coupon is no longer available.'],
    [
      'not yet started',
      flat({ startsAt: '2026-12-01T00:00:00.000Z' }),
      ctx(),
      'This coupon is not active yet.',
    ],
    [
      'expired',
      flat({ expiresAt: '2026-07-01T00:00:00.000Z' }),
      ctx(),
      'This coupon has expired.',
    ],
    [
      'wrong plan',
      flat(),
      ctx({ planCode: 'weekly' }),
      'This coupon is not valid for this plan.',
    ],
    [
      'wrong purchase kind',
      flat({ appliesToKinds: ['trial'] }),
      ctx({ checkoutKind: 'subscription' }),
      'This coupon cannot be used on this purchase.',
    ],
    [
      'below minimum',
      flat(),
      ctx({ orderPaise: rupees(500) }),
      'This coupon requires a minimum order of ₹2,000.',
    ],
    [
      'not a new user',
      flat(),
      ctx({ isNewUser: false }),
      'This coupon is only for new users.',
    ],
    [
      'already used',
      flat(),
      ctx({ timesUsedByUser: 1 }),
      'This coupon has already been used.',
    ],
    [
      'global limit reached',
      flat({ usageLimitTotal: 100 }),
      ctx({ timesUsedTotal: 100 }),
      'This coupon has reached its usage limit.',
    ],
    [
      'conflicts with a reward',
      flat(),
      ctx({ hasRewardApplied: true }),
      'This coupon cannot be combined with your reward.',
    ],
  ];

  for (const [name, rule, context, message] of cases) {
    it(`rejects when ${name}`, () => {
      const result = evaluateCoupon(rule, context);
      expect(result.status).not.toBe('applied');
      expect(result.discountPaise).toBe(0);
      expect(result.message).toBe(message);
    });
  }

  it('allows stacking when the offer explicitly permits it', () => {
    const result = evaluateCoupon(
      flat({ stackableWithReward: true }),
      ctx({ hasRewardApplied: true }),
    );
    expect(result.status).toBe('applied');
  });

  it('never returns a discount alongside a rejection', () => {
    for (const [, rule, context] of cases) {
      const result = evaluateCoupon(rule, context);
      if (result.status !== 'applied') expect(result.discountPaise).toBe(0);
    }
  });
});
