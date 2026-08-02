import { db, type Tx } from '../../platform/db/index.js';
import { AppError } from '../../platform/errors.js';
import { emit } from '../../platform/outbox.js';
import { computePrice, type PriceBreakdown } from '../pricing/engine.js';
import { evaluateCoupon, type CouponContext, type CouponRule } from './eligibility.js';

export type CouponResult = {
  couponStatus: string;
  couponCode: string | null;
  message: string;
  priceBreakdown: PriceBreakdown;
};

async function loadOpenCheckout(tx: Tx, userId: string, checkoutSessionId: string) {
  const checkout = await tx
    .selectFrom('checkout_sessions')
    .selectAll()
    .where('id', '=', checkoutSessionId)
    .where('user_id', '=', userId)
    .forUpdate()
    .executeTakeFirst();
  if (!checkout) throw new AppError('NOT_FOUND', 'Checkout session not found.');
  if (!['review', 'payment_method_required', 'payment_failed'].includes(checkout.step)) {
    throw new AppError(
      'CHECKOUT_INVALID_STATE',
      'This checkout can no longer be changed. Start a new one to use a coupon.',
    );
  }
  return checkout;
}

/**
 * The list price this checkout was built from. Discounts are always recomputed
 * from it rather than from the stored total, so applying and removing a coupon
 * repeatedly can never drift the price downward.
 */
type Basis = { listPricePaise: number; planCode: string | null };

async function basisFor(tx: Tx, checkout: { plan_id: string | null; plan_price_paise: number }): Promise<Basis> {
  if (!checkout.plan_id) return { listPricePaise: checkout.plan_price_paise, planCode: null };
  const plan = await tx
    .selectFrom('subscription_plans')
    .select(['code', 'price_paise', 'discount_paise'])
    .where('id', '=', checkout.plan_id)
    .executeTakeFirst();
  if (!plan) return { listPricePaise: checkout.plan_price_paise, planCode: null };
  return { listPricePaise: plan.price_paise - plan.discount_paise, planCode: plan.code };
}

async function repriceAndSave(
  tx: Tx,
  checkoutId: string,
  basis: Basis,
  trialCreditPaise: number,
  rewardCreditPaise: number,
  couponDiscountPaise: number,
  couponId: string | null,
): Promise<PriceBreakdown> {
  const price = computePrice({
    listPricePaise: basis.listPricePaise,
    couponDiscountPaise,
    trialCreditPaise,
    rewardCreditPaise,
  });

  await tx
    .updateTable('checkout_sessions')
    .set({
      coupon_id: couponId,
      plan_price_paise: price.planPricePaise,
      delivery_charges_paise: price.deliveryChargesPaise,
      taxes_paise: price.taxesPaise,
      discount_paise: price.discountPaise,
      trial_credit_paise: price.trialCreditPaise,
      reward_credit_paise: price.rewardCreditPaise,
      total_payable_paise: price.totalPayablePaise,
    })
    .where('id', '=', checkoutId)
    .execute();

  return price;
}

export async function applyCoupon(
  userId: string,
  checkoutSessionId: string,
  code: string,
): Promise<CouponResult> {
  const normalized = code.trim().toUpperCase();

  return db.transaction().execute(async (tx) => {
    const checkout = await loadOpenCheckout(tx, userId, checkoutSessionId);
    const basis = await basisFor(tx, checkout);

    const coupon = await tx
      .selectFrom('coupons')
      .selectAll()
      .where('code', '=', normalized)
      .executeTakeFirst();

    if (!coupon) {
      // Spec §5.4: do not clear the entered code on failure, and leave the
      // existing totals untouched.
      return {
        couponStatus: 'not_found',
        couponCode: normalized,
        message: 'This coupon does not exist.',
        priceBreakdown: currentBreakdown(checkout),
      };
    }

    const [usedByUser, usedTotal, priorPurchase] = await Promise.all([
      countRedemptions(tx, coupon.id, userId),
      countRedemptions(tx, coupon.id, null),
      tx
        .selectFrom('checkout_sessions')
        .select('id')
        .where('user_id', '=', userId)
        .where('step', '=', 'payment_success')
        .where('id', '!=', checkout.id)
        .executeTakeFirst(),
    ]);

    const rule: CouponRule = {
      code: coupon.code,
      kind: coupon.kind,
      valuePaise: coupon.value_paise,
      percentBps: coupon.percent_bps,
      maxDiscountPaise: coupon.max_discount_paise,
      minOrderPaise: coupon.min_order_paise,
      appliesToPlanCodes: coupon.applies_to_plan_codes,
      appliesToKinds: coupon.applies_to_kinds,
      newUsersOnly: coupon.new_users_only,
      stackableWithReward: coupon.stackable_with_reward,
      usageLimitTotal: coupon.usage_limit_total,
      usageLimitPerUser: coupon.usage_limit_per_user,
      startsAt: coupon.starts_at.toISOString(),
      expiresAt: coupon.expires_at?.toISOString() ?? null,
      isActive: coupon.is_active,
    };

    const context: CouponContext = {
      now: new Date().toISOString(),
      orderPaise: basis.listPricePaise,
      planCode: basis.planCode,
      checkoutKind: checkout.kind,
      isNewUser: !priorPurchase,
      timesUsedByUser: usedByUser,
      timesUsedTotal: usedTotal,
      hasRewardApplied: checkout.reward_credit_paise > 0,
    };

    const evaluation = evaluateCoupon(rule, context);
    if (evaluation.status !== 'applied') {
      return {
        couponStatus: evaluation.status,
        couponCode: normalized,
        message: evaluation.message,
        priceBreakdown: currentBreakdown(checkout),
      };
    }

    const price = await repriceAndSave(
      tx,
      checkout.id,
      basis,
      checkout.trial_credit_paise,
      checkout.reward_credit_paise,
      evaluation.discountPaise,
      coupon.id,
    );

    // Idempotent: re-applying the same coupon to the same checkout updates the
    // one row rather than stacking redemptions.
    await tx
      .insertInto('coupon_redemptions')
      .values({
        coupon_id: coupon.id,
        user_id: userId,
        checkout_session_id: checkout.id,
        discount_paise: evaluation.discountPaise,
      })
      .onConflict((oc) =>
        oc
          .columns(['coupon_id', 'checkout_session_id'])
          .doUpdateSet({ discount_paise: evaluation.discountPaise }),
      )
      .execute();

    await emit(tx, {
      eventName: 'coupon.applied',
      aggregateType: 'checkout',
      aggregateId: checkout.id,
      userId,
      payload: { code: coupon.code, discountPaise: evaluation.discountPaise },
    });

    return {
      couponStatus: 'applied',
      couponCode: coupon.code,
      message: evaluation.message,
      priceBreakdown: price,
    };
  });
}

export async function removeCoupon(
  userId: string,
  checkoutSessionId: string,
): Promise<CouponResult> {
  return db.transaction().execute(async (tx) => {
    const checkout = await loadOpenCheckout(tx, userId, checkoutSessionId);
    const basis = await basisFor(tx, checkout);

    if (checkout.coupon_id) {
      await tx
        .deleteFrom('coupon_redemptions')
        .where('checkout_session_id', '=', checkout.id)
        .where('consumed_at', 'is', null)
        .execute();
    }

    const price = await repriceAndSave(
      tx,
      checkout.id,
      basis,
      checkout.trial_credit_paise,
      checkout.reward_credit_paise,
      0,
      null,
    );

    return {
      couponStatus: 'removed',
      couponCode: null,
      message: 'Coupon removed.',
      priceBreakdown: price,
    };
  });
}

function currentBreakdown(checkout: {
  plan_price_paise: number;
  delivery_charges_paise: number;
  taxes_paise: number;
  discount_paise: number;
  trial_credit_paise: number;
  reward_credit_paise: number;
  total_payable_paise: number;
}): PriceBreakdown {
  return {
    planPricePaise: checkout.plan_price_paise,
    deliveryChargesPaise: checkout.delivery_charges_paise,
    taxesPaise: checkout.taxes_paise,
    discountPaise: checkout.discount_paise,
    trialCreditPaise: checkout.trial_credit_paise,
    rewardCreditPaise: checkout.reward_credit_paise,
    totalPayablePaise: checkout.total_payable_paise,
  };
}

async function countRedemptions(tx: Tx, couponId: string, userId: string | null): Promise<number> {
  let query = tx
    .selectFrom('coupon_redemptions')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('coupon_id', '=', couponId)
    .where('consumed_at', 'is not', null);
  if (userId) query = query.where('user_id', '=', userId);
  const row = await query.executeTakeFirstOrThrow();
  return Number(row.count);
}
