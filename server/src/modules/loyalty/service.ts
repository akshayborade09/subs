import { db, type Executor, type Tx } from '../../platform/db/index.js';
import { policy } from '../../platform/config/policy.js';
import { AppError } from '../../platform/errors.js';
import { emit } from '../../platform/outbox.js';
import { addDays, todayIn, weekdayOf, type PlainDate } from '../../platform/time.js';
import { evaluateQualification, type QualificationResult } from './qualification.js';
import type { MealSlot } from '../../platform/db/types.js';

/** Every calendar date the subscription was paused, expanded from its window. */
function pausedDates(from: string | null, to: string | null, until: PlainDate): string[] {
  if (!from) return [];
  const end = to && to < until ? to : until;
  const dates: string[] = [];
  for (let date = from; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export async function getProgress(
  userId: string,
  today = todayIn(new Date()),
  tx: Executor = db,
): Promise<(QualificationResult & { periodStart: string; rewardId: string | null }) | null> {
  const subscription = await tx
    .selectFrom('subscriptions')
    .selectAll()
    .where('user_id', '=', userId)
    .where('status', 'in', ['paid', 'cancelled_at_period_end'])
    .orderBy('created_at', 'desc')
    .executeTakeFirst();

  if (!subscription) return null;

  const [delivered, user, period] = await Promise.all([
    tx
      .selectFrom('meal_orders')
      .select('service_date')
      .distinct()
      .where('user_id', '=', userId)
      .where('ops_status', '=', 'delivered')
      .where('service_date', '>=', subscription.starts_on)
      .execute(),
    tx.selectFrom('users').select('status').where('id', '=', userId).executeTakeFirstOrThrow(),
    tx
      .selectFrom('loyalty_periods')
      .select(['reward_id'])
      .where('user_id', '=', userId)
      .where('period_start', '=', subscription.starts_on)
      .executeTakeFirst(),
  ]);

  const result = evaluateQualification({
    periodStart: subscription.starts_on,
    today,
    pausedDates: pausedDates(subscription.pause_from, subscription.pause_to, today),
    fulfilledDates: delivered.map((row) => row.service_date),
    paymentsHealthy:
      subscription.renewal_failed_at === null || subscription.renewal_failure_resolved_at !== null,
    accountActive: user.status === 'active',
  });

  return { ...result, periodStart: subscription.starts_on, rewardId: period?.reward_id ?? null };
}

/**
 * Reconciler. Mints at most one reward per qualifying period — the unique index
 * on (user_id, period_start) where reward_id is not null is the real guarantee,
 * so a concurrent run cannot double-issue.
 */
export async function evaluateLoyalty(now = new Date()): Promise<number> {
  const today = todayIn(now);
  const subscribers = await db
    .selectFrom('subscriptions')
    .select(['user_id', 'starts_on'])
    .where('status', 'in', ['paid', 'cancelled_at_period_end'])
    .execute();

  let minted = 0;
  for (const subscriber of subscribers) {
    minted += await db.transaction().execute(async (tx) => {
      const progress = await getProgress(subscriber.user_id, today, tx);
      if (!progress) return 0;

      const existing = await tx
        .insertInto('loyalty_periods')
        .values({
          user_id: subscriber.user_id,
          period_start: progress.periodStart,
          expected_qualification_date: progress.expectedQualificationDate,
          active_days: progress.activeDays,
          required_active_days: progress.requiredActiveDays,
          fulfilled_meal_days: progress.fulfilledMealDays,
          required_fulfilled_meal_days: progress.requiredFulfilledMealDays,
          status: progress.status,
        })
        .onConflict((oc) =>
          oc.columns(['user_id', 'period_start']).doUpdateSet({
            expected_qualification_date: progress.expectedQualificationDate,
            active_days: progress.activeDays,
            fulfilled_meal_days: progress.fulfilledMealDays,
            status: progress.status,
          }),
        )
        .returningAll()
        .executeTakeFirstOrThrow();

      if (progress.status !== 'qualified' || existing.reward_id) return 0;

      const reward = await tx
        .insertInto('rewards')
        .values({
          user_id: subscriber.user_id,
          type: 'free_meal_day',
          source: 'loyalty',
          status: 'earned',
          expires_on: addDays(today, policy.loyalty.rewardExpiryDays),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await tx
        .updateTable('loyalty_periods')
        .set({ reward_id: reward.id, qualified_at: now, status: 'qualified' })
        .where('id', '=', existing.id)
        .execute();

      await emit(tx, {
        eventName: 'reward.earned',
        aggregateType: 'reward',
        aggregateId: reward.id,
        userId: subscriber.user_id,
        payload: { source: 'loyalty', expiresOn: reward.expires_on },
      });

      return 1;
    });
  }
  return minted;
}

export async function listRewards(userId: string) {
  return db
    .selectFrom('rewards')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('earned_at', 'desc')
    .execute();
}

/** Future dates the reward could be taken on, respecting the plan's weekdays. */
export async function eligibleRedemptionDates(userId: string, windowDays = 30): Promise<string[]> {
  const today = todayIn(new Date());
  const subscription = await db
    .selectFrom('subscriptions')
    .select(['selected_weekdays', 'ends_on'])
    .where('user_id', '=', userId)
    .where('status', 'in', ['paid', 'cancelled_at_period_end'])
    .orderBy('created_at', 'desc')
    .executeTakeFirst();

  const taken = await db
    .selectFrom('meal_orders')
    .select('service_date')
    .distinct()
    .where('user_id', '=', userId)
    .where('source_type', '=', 'reward')
    .execute();
  const used = new Set(taken.map((row) => row.service_date));

  const weekdays = subscription?.selected_weekdays ?? [1, 2, 3, 4, 5];
  const dates: string[] = [];
  for (let i = 1; i <= windowDays; i += 1) {
    const date = addDays(today, i);
    if (!weekdays.includes(weekdayOf(date))) continue;
    // Spec §14.5: a reward cannot overlap another free-meal day.
    if (used.has(date)) continue;
    dates.push(date);
  }
  return dates;
}

/**
 * Redeems a free meal day: creates reward-sourced meal orders using the user's
 * current plan configuration, and records a ₹0 transaction disclosing the value
 * it replaced (spec §14.5).
 */
export async function redeemReward(userId: string, rewardId: string, serviceDate: PlainDate) {
  const today = todayIn(new Date());

  return db.transaction().execute(async (tx) => {
    const reward = await tx
      .selectFrom('rewards')
      .selectAll()
      .where('id', '=', rewardId)
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();

    if (!reward) throw new AppError('NOT_FOUND', 'Reward not found.');
    if (reward.status === 'redeemed') {
      throw new AppError('VALIDATION_FAILED', 'This reward has already been used.');
    }
    if (reward.status !== 'earned') {
      throw new AppError('VALIDATION_FAILED', `This reward is ${reward.status}.`);
    }
    if (reward.expires_on < today) {
      throw new AppError('VALIDATION_FAILED', 'This reward has expired.');
    }
    if (serviceDate <= today) {
      throw new AppError('VALIDATION_FAILED', 'Choose a date from tomorrow onwards.');
    }

    const subscription = await tx
      .selectFrom('subscriptions')
      .selectAll()
      .where('user_id', '=', userId)
      .where('status', 'in', ['paid', 'cancelled_at_period_end'])
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
    if (!subscription) {
      throw new AppError('VALIDATION_FAILED', 'A free meal day needs an active plan to sit inside.');
    }

    const address = await tx
      .selectFrom('addresses')
      .selectAll()
      .where('id', '=', subscription.address_id)
      .executeTakeFirstOrThrow();
    if (!address.is_serviceable) {
      throw new AppError('PINCODE_NOT_SERVICEABLE', 'Your delivery address is not serviceable.');
    }

    // "One free day" means the same configuration as the active plan: a Both
    // subscriber gets lunch and dinner (spec §14.1).
    const slots: MealSlot[] =
      subscription.meal_preference === 'both' ? ['lunch', 'dinner'] : [subscription.meal_preference];

    const created = await tx
      .insertInto('meal_orders')
      .values(
        slots.map((slot) => ({
          user_id: userId,
          source_type: 'reward' as const,
          source_id: reward.id,
          service_date: serviceDate,
          slot,
          food_type:
            subscription.food_preference === 'non_vegetarian'
              ? ('non_vegetarian' as const)
              : ('vegetarian' as const),
          bread_preference: subscription.bread_preference,
          rice_preference: subscription.rice_preference,
          address_id: subscription.address_id,
        })),
      )
      .onConflict((oc) =>
        oc.columns(['source_type', 'source_id', 'service_date', 'slot']).doNothing(),
      )
      .returning('id')
      .execute();

    if (created.length === 0) {
      throw new AppError('VALIDATION_FAILED', 'You already have a free meal on that date.');
    }

    await tx
      .updateTable('rewards')
      .set({
        status: 'redeemed',
        redeemed_at: new Date(),
        redeemed_service_date: serviceDate,
        redeemed_meal_order_ids: created.map((row) => row.id),
      })
      .where('id', '=', reward.id)
      .execute();

    await tx
      .insertInto('transactions')
      .values({
        user_id: userId,
        type: 'reward',
        title: 'Healthy Streak reward',
        subtitle: `Free meal day on ${serviceDate}`,
        amount_paise: null,
        display_amount: 'Free meal day',
        status: 'credited',
        meta: { rewardId: reward.id, mealsCreated: created.length },
      })
      .execute();

    await emit(tx, {
      eventName: 'reward.redeemed',
      aggregateType: 'reward',
      aggregateId: reward.id,
      userId,
      payload: { serviceDate, mealsCreated: created.length },
    });

    return { rewardId: reward.id, serviceDate, mealsCreated: created.length };
  });
}

/** Shared with the reconciler module so the job list stays in one place. */
export type LoyaltyTx = Tx;
