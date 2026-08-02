/**
 * Coupon eligibility, as a pure function so every rejection reason in spec §5.4
 * is unit-testable without a database.
 *
 * The backend owns this decision entirely — the client displays the returned
 * message and total and never decides for itself whether a code applies.
 */
export type CouponStatus =
  | 'applied'
  | 'not_found'
  | 'expired'
  | 'not_started'
  | 'inactive'
  | 'ineligible_plan'
  | 'ineligible_kind'
  | 'below_minimum'
  | 'new_users_only'
  | 'already_used'
  | 'usage_limit_reached'
  | 'conflicts_with_reward';

export type CouponRule = {
  code: string;
  kind: 'flat' | 'percent';
  valuePaise: number | null;
  percentBps: number | null;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  appliesToPlanCodes: string[];
  appliesToKinds: string[];
  newUsersOnly: boolean;
  stackableWithReward: boolean;
  usageLimitTotal: number | null;
  usageLimitPerUser: number;
  startsAt: string;
  expiresAt: string | null;
  isActive: boolean;
};

export type CouponContext = {
  now: string;
  orderPaise: number;
  planCode: string | null;
  checkoutKind: string;
  isNewUser: boolean;
  timesUsedByUser: number;
  timesUsedTotal: number;
  hasRewardApplied: boolean;
};

export type CouponEvaluation = {
  status: CouponStatus;
  discountPaise: number;
  message: string;
};

const MESSAGES: Record<Exclude<CouponStatus, 'applied'>, string> = {
  not_found: 'This coupon does not exist.',
  expired: 'This coupon has expired.',
  not_started: 'This coupon is not active yet.',
  inactive: 'This coupon is no longer available.',
  ineligible_plan: 'This coupon is not valid for this plan.',
  ineligible_kind: 'This coupon cannot be used on this purchase.',
  below_minimum: 'This coupon requires a larger order.',
  new_users_only: 'This coupon is only for new users.',
  already_used: 'This coupon has already been used.',
  usage_limit_reached: 'This coupon has reached its usage limit.',
  conflicts_with_reward: 'This coupon cannot be combined with your reward.',
};

const reject = (status: Exclude<CouponStatus, 'applied'>, message?: string): CouponEvaluation => ({
  status,
  discountPaise: 0,
  message: message ?? MESSAGES[status],
});

export function evaluateCoupon(rule: CouponRule, ctx: CouponContext): CouponEvaluation {
  if (!rule.isActive) return reject('inactive');
  if (ctx.now < rule.startsAt) return reject('not_started');
  if (rule.expiresAt !== null && ctx.now > rule.expiresAt) return reject('expired');

  if (!rule.appliesToKinds.includes(ctx.checkoutKind)) return reject('ineligible_kind');

  // An empty list means "all plans" rather than "no plans".
  if (
    rule.appliesToPlanCodes.length > 0 &&
    (ctx.planCode === null || !rule.appliesToPlanCodes.includes(ctx.planCode))
  ) {
    return reject('ineligible_plan');
  }

  if (ctx.orderPaise < rule.minOrderPaise) {
    return reject(
      'below_minimum',
      `This coupon requires a minimum order of ₹${(rule.minOrderPaise / 100).toLocaleString('en-IN')}.`,
    );
  }

  if (rule.newUsersOnly && !ctx.isNewUser) return reject('new_users_only');
  if (ctx.timesUsedByUser >= rule.usageLimitPerUser) return reject('already_used');
  if (rule.usageLimitTotal !== null && ctx.timesUsedTotal >= rule.usageLimitTotal) {
    return reject('usage_limit_reached');
  }
  if (ctx.hasRewardApplied && !rule.stackableWithReward) return reject('conflicts_with_reward');

  const raw =
    rule.kind === 'flat'
      ? (rule.valuePaise ?? 0)
      : Math.round((ctx.orderPaise * (rule.percentBps ?? 0)) / 10_000);

  // Cap first by the offer's own ceiling, then by what is actually owed — a
  // coupon must never become a refund.
  const capped = rule.maxDiscountPaise !== null ? Math.min(raw, rule.maxDiscountPaise) : raw;
  const discountPaise = Math.max(0, Math.min(capped, ctx.orderPaise));

  return {
    status: 'applied',
    discountPaise,
    message: `Coupon applied. You saved ₹${(discountPaise / 100).toLocaleString('en-IN')}.`,
  };
}
