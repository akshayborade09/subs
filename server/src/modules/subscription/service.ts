import { db, type Executor, type Tx } from '../../platform/db/index.js';
import { policy } from '../../platform/config/policy.js';
import { AppError } from '../../platform/errors.js';
import { emit } from '../../platform/outbox.js';
import { addDays, weekdayOf, type PlainDate } from '../../platform/time.js';
import { computePrice, type PriceBreakdown } from '../pricing/engine.js';
import type {
  FoodPreference,
  FoodType,
  MealPreference,
  MealSlot,
} from '../../platform/db/types.js';

export async function getCurrentSubscription(userId: string, tx: Executor = db) {
  return tx
    .selectFrom('subscriptions')
    .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
    .selectAll('subscriptions')
    .select([
      'subscription_plans.code as plan_code',
      'subscription_plans.name as plan_name',
      'subscription_plans.meal_count',
      'subscription_plans.price_paise',
    ])
    .where('subscriptions.user_id', '=', userId)
    .where('subscriptions.status', '!=', 'terminated')
    .orderBy('subscriptions.created_at', 'desc')
    .executeTakeFirst();
}

function slotsFor(mealPreference: 'lunch' | 'dinner' | 'both'): MealSlot[] {
  return mealPreference === 'both' ? ['lunch', 'dinner'] : [mealPreference];
}

function isPausedOn(date: PlainDate, from: string | null, to: string | null): boolean {
  if (!from) return false;
  return date >= from && (to === null || date <= to);
}

/**
 * Ensures meal orders exist for the rolling horizon. Idempotent by the
 * (source_type, source_id, service_date, slot) unique index, so the daily
 * reconciler can run as often as it likes and a missed run self-heals.
 *
 * Deliberately a rolling window rather than the full plan: materializing a
 * quarter up front would turn one preference change into a 90-row rewrite.
 * Consequence — "meals remaining" is plan arithmetic, never COUNT(*) here.
 */
export async function materializeSubscriptionOrders(
  tx: Executor,
  subscriptionId: string,
  today: PlainDate,
  horizonDays: number = policy.subscription.materializationHorizonDays,
): Promise<number> {
  const sub = await tx
    .selectFrom('subscriptions')
    .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
    .selectAll('subscriptions')
    .select('subscription_plans.meal_count')
    .where('subscriptions.id', '=', subscriptionId)
    .executeTakeFirst();

  if (!sub) return 0;
  if (sub.status !== 'paid' && sub.status !== 'cancelled_at_period_end') return 0;

  // Never schedule more than was bought. Without this the rolling reconciler
  // happily keeps extending to the end date, so a "both" subscriber on a 20-meal
  // plan would receive 40 deliveries.
  const alreadyScheduled = await tx
    .selectFrom('meal_orders')
    .select('service_date')
    .where('source_type', '=', 'subscription')
    .where('source_id', '=', subscriptionId)
    .execute();

  const scheduledDates = new Set(alreadyScheduled.map((row) => row.service_date));
  const byDays = policy.subscription.mealCountUnit === 'meal_days';
  let budget = byDays
    ? sub.meal_count - scheduledDates.size
    : sub.meal_count - alreadyScheduled.length;
  if (budget <= 0) return 0;

  const from = today > sub.starts_on ? today : sub.starts_on;
  const horizonEnd = addDays(today, horizonDays);
  const to = horizonEnd < sub.ends_on ? horizonEnd : sub.ends_on;
  if (from > to) return 0;

  // A 'mix' subscription has no per-day choices (that is trial-only), so it
  // defaults to vegetarian until the user overrides an individual meal.
  const foodType: FoodType = sub.food_preference === 'non_vegetarian' ? 'non_vegetarian' : 'vegetarian';
  const slots = slotsFor(sub.meal_preference);

  const rows: Array<{
    user_id: string;
    source_type: 'subscription';
    source_id: string;
    service_date: string;
    slot: MealSlot;
    food_type: FoodType;
    bread_preference: string;
    rice_preference: string;
    address_id: string;
  }> = [];

  for (let date = from; date <= to && budget > 0; date = addDays(date, 1)) {
    if (!sub.selected_weekdays.includes(weekdayOf(date))) continue;
    if (isPausedOn(date, sub.pause_from, sub.pause_to)) continue;

    if (byDays && !scheduledDates.has(date)) {
      budget -= 1;
      scheduledDates.add(date);
    }

    for (const slot of slots) {
      if (!byDays) {
        if (budget <= 0) break;
        budget -= 1;
      }
      rows.push({
        user_id: sub.user_id,
        source_type: 'subscription',
        source_id: sub.id,
        service_date: date,
        slot,
        food_type: foodType,
        bread_preference: sub.bread_preference,
        rice_preference: sub.rice_preference,
        address_id: sub.address_id,
      });
    }
  }

  if (rows.length === 0) return 0;

  const inserted = await tx
    .insertInto('meal_orders')
    .values(rows)
    .onConflict((oc) => oc.columns(['source_type', 'source_id', 'service_date', 'slot']).doNothing())
    .returning('id')
    .execute();

  return inserted.length;
}

export async function listPlans() {
  return db
    .selectFrom('subscription_plans')
    .selectAll()
    .where('is_active', '=', true)
    .orderBy('sort_order')
    .execute();
}

/**
 * A paid trial earns a credit against the first subscription — the "−₹100" the
 * app's summary shows. Consumed once: a second subscription does not get it again.
 */
async function trialCreditFor(tx: Executor, userId: string): Promise<number> {
  const trial = await tx
    .selectFrom('trials')
    .select('id')
    .where('user_id', '=', userId)
    .where('status', '=', 'paid')
    .executeTakeFirst();
  if (!trial) return 0;

  const alreadyUsed = await tx
    .selectFrom('checkout_sessions')
    .select('id')
    .where('user_id', '=', userId)
    .where('kind', '!=', 'trial')
    .where('step', '=', 'payment_success')
    .where('trial_credit_paise', '>', 0)
    .executeTakeFirst();

  return alreadyUsed ? 0 : policy.trial.creditTowardSubscriptionPaise;
}

/**
 * The subscription begins the day after the trial's final delivery, so the two
 * never overlap (lifecycle spec §H). With no active trial it starts tomorrow.
 */
async function defaultStartDate(tx: Executor, userId: string, today: PlainDate): Promise<PlainDate> {
  const trial = await tx
    .selectFrom('trials')
    .select('last_service_date')
    .where('user_id', '=', userId)
    .where('status', '=', 'paid')
    .executeTakeFirst();

  const tomorrow = addDays(today, 1);
  if (!trial?.last_service_date) return tomorrow;
  const afterTrial = addDays(trial.last_service_date, 1);
  return afterTrial > tomorrow ? afterTrial : tomorrow;
}

export type SubscriptionQuote = {
  planCode: string;
  planName: string;
  /** Service days included — the unit mealCount is measured in. */
  mealDays: number;
  /** Actual deliveries: doubled for a "both" subscriber. */
  mealsIncluded: number;
  durationDays: number;
  startsOn: string;
  endsOn: string;
  /**
   * Derived from mealsIncluded, not from the plan's static column. Product
   * confirmed mealCount means service days, so a "both" subscriber receives two
   * deliveries per day and their true per-meal price is half the plan's headline
   * figure. Quoting the static column would overstate it.
   */
  effectivePricePerMealPaise: number;
  priceBreakdown: PriceBreakdown;
};

export async function quoteSubscription(
  userId: string,
  planCode: 'weekly' | 'monthly' | 'quarterly',
  today: PlainDate,
  tx: Executor = db,
  mealPreference: MealPreference = 'lunch',
): Promise<SubscriptionQuote> {
  const plan = await tx
    .selectFrom('subscription_plans')
    .selectAll()
    .where('code', '=', planCode)
    .where('is_active', '=', true)
    .executeTakeFirst();
  if (!plan) throw new AppError('NOT_FOUND', 'That plan is not available.');

  const startsOn = await defaultStartDate(tx, userId, today);
  const priceBreakdown = computePrice({
    listPricePaise: plan.price_paise,
    planDiscountPaise: plan.discount_paise,
    trialCreditPaise: await trialCreditFor(tx, userId),
  });

  const mealsIncluded = plan.meal_count * (mealPreference === 'both' ? 2 : 1);

  return {
    planCode: plan.code,
    planName: plan.name,
    mealDays: plan.meal_count,
    mealsIncluded,
    durationDays: plan.duration_days,
    startsOn,
    endsOn: addDays(startsOn, plan.duration_days - 1),
    effectivePricePerMealPaise: Math.round(priceBreakdown.totalPayablePaise / mealsIncluded),
    priceBreakdown,
  };
}

export type SubscriptionCheckoutInput = {
  planCode: 'weekly' | 'monthly' | 'quarterly';
  mealPreference: MealPreference;
  foodPreference: FoodPreference;
  breadPreference: string;
  ricePreference: string;
  selectedWeekdays?: number[];
  addressId?: string;
};

export async function createSubscriptionCheckout(
  tx: Tx,
  userId: string,
  input: SubscriptionCheckoutInput,
  today: PlainDate,
) {
  const existing = await getCurrentSubscription(userId, tx);
  if (existing && (existing.status === 'paid' || existing.status === 'cancelled_at_period_end')) {
    throw new AppError('CHECKOUT_INVALID_STATE', 'You already have an active subscription.');
  }

  const addressId =
    input.addressId ??
    (
      await tx
        .selectFrom('addresses')
        .select('id')
        .where('user_id', '=', userId)
        .where('is_default', '=', true)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
    )?.id;
  if (!addressId) throw new AppError('VALIDATION_FAILED', 'Add a delivery address first.');

  const address = await tx
    .selectFrom('addresses')
    .selectAll()
    .where('id', '=', addressId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!address) throw new AppError('NOT_FOUND', 'Address not found.');
  if (!address.is_serviceable) {
    throw new AppError('PINCODE_NOT_SERVICEABLE', `We do not deliver to ${address.pincode} yet.`);
  }

  const quote = await quoteSubscription(userId, input.planCode, today, tx, input.mealPreference);
  const plan = await tx
    .selectFrom('subscription_plans')
    .select(['id', 'price_paise', 'discount_paise'])
    .where('code', '=', input.planCode)
    .executeTakeFirstOrThrow();

  // Reuse a pending subscription rather than stacking rows on every retry.
  const subscription = existing?.status === 'pending_payment'
    ? await tx
        .updateTable('subscriptions')
        .set({
          plan_id: plan.id,
          meal_preference: input.mealPreference,
          food_preference: input.foodPreference,
          bread_preference: input.breadPreference,
          rice_preference: input.ricePreference,
          selected_weekdays: input.selectedWeekdays ?? [1, 2, 3, 4, 5],
          address_id: addressId,
          starts_on: quote.startsOn,
          ends_on: quote.endsOn,
        })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow()
    : await tx
        .insertInto('subscriptions')
        .values({
          user_id: userId,
          plan_id: plan.id,
          status: 'pending_payment',
          meal_preference: input.mealPreference,
          food_preference: input.foodPreference,
          bread_preference: input.breadPreference,
          rice_preference: input.ricePreference,
          selected_weekdays: input.selectedWeekdays ?? [1, 2, 3, 4, 5],
          address_id: addressId,
          starts_on: quote.startsOn,
          ends_on: quote.endsOn,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

  const price = quote.priceBreakdown;
  const checkout = await tx
    .insertInto('checkout_sessions')
    .values({
      user_id: userId,
      kind: 'subscription',
      step: 'review',
      source_type: 'subscription',
      source_id: subscription.id,
      plan_id: plan.id,
      plan_price_paise: price.planPricePaise,
      delivery_charges_paise: price.deliveryChargesPaise,
      taxes_paise: price.taxesPaise,
      discount_paise: price.discountPaise,
      trial_credit_paise: price.trialCreditPaise,
      reward_credit_paise: price.rewardCreditPaise,
      total_payable_paise: price.totalPayablePaise,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await emit(tx, {
    eventName: 'subscription.checkout.created',
    aggregateType: 'checkout',
    aggregateId: checkout.id,
    userId,
    payload: { subscriptionId: subscription.id, planCode: input.planCode },
  });

  return { subscription, checkout, quote };
}
