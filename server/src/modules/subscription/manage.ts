import { db } from '../../platform/db/index.js';
import { policy } from '../../platform/config/policy.js';
import { AppError } from '../../platform/errors.js';
import { emit } from '../../platform/outbox.js';
import { addDays, mediumDate, todayIn, type PlainDate } from '../../platform/time.js';

/**
 * Cancels at the end of the paid period rather than immediately. Everything the
 * user already paid for still arrives — which is why the state is called
 * "cancelled, active until end date" and not "cancelled".
 */
export async function cancelSubscription(userId: string, reason?: string) {
  return db.transaction().execute(async (tx) => {
    const subscription = await tx
      .selectFrom('subscriptions')
      .selectAll()
      .where('user_id', '=', userId)
      .where('status', '=', 'paid')
      .forUpdate()
      .executeTakeFirst();
    if (!subscription) throw new AppError('NOT_FOUND', 'No active subscription to cancel.');

    await tx
      .updateTable('subscriptions')
      .set({ status: 'cancelled_at_period_end', cancelled_at: new Date(), auto_renew: false })
      .where('id', '=', subscription.id)
      .execute();

    await tx
      .insertInto('audit_logs')
      .values({
        user_id: userId,
        action: 'subscription.cancelled',
        entity_type: 'subscription',
        entity_id: subscription.id,
        after: { reason: reason ?? null, activeUntil: subscription.ends_on },
      })
      .execute();

    const remaining = await tx
      .selectFrom('meal_orders')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('source_id', '=', subscription.id)
      .where('service_date', '>=', todayIn(new Date()))
      .executeTakeFirstOrThrow();

    return {
      status: 'cancelled_at_period_end' as const,
      activeUntil: subscription.ends_on,
      remainingMeals: Number(remaining.count),
      message: `Your plan stays active until ${mediumDate(subscription.ends_on)}. Meals already paid for will still arrive.`,
    };
  });
}

export async function resubscribe(userId: string) {
  return db.transaction().execute(async (tx) => {
    const subscription = await tx
      .selectFrom('subscriptions')
      .selectAll()
      .where('user_id', '=', userId)
      .where('status', '=', 'cancelled_at_period_end')
      .forUpdate()
      .executeTakeFirst();
    if (!subscription) {
      throw new AppError('NOT_FOUND', 'No cancelled subscription to reactivate.');
    }
    if (subscription.ends_on < todayIn(new Date())) {
      throw new AppError(
        'VALIDATION_FAILED',
        'This plan has already ended. Choose a new subscription instead.',
      );
    }

    await tx
      .updateTable('subscriptions')
      .set({ status: 'paid', cancelled_at: null, auto_renew: true })
      .where('id', '=', subscription.id)
      .execute();

    await tx
      .insertInto('audit_logs')
      .values({
        user_id: userId,
        action: 'subscription.reactivated',
        entity_type: 'subscription',
        entity_id: subscription.id,
      })
      .execute();

    return { status: 'paid' as const, activeUntil: subscription.ends_on };
  });
}

/**
 * Pause is a window, which is why the resolver can derive "paused" without a
 * flag and why a future-dated pause works for free. Paused days do not consume
 * plan meals — the materializer skips them, so the plan simply runs longer.
 */
export async function pauseSubscription(userId: string, from: PlainDate, to: PlainDate | null) {
  if (!policy.subscription.allowUserPause) {
    throw new AppError('VALIDATION_FAILED', 'Pausing is not available on your plan.');
  }
  const today = todayIn(new Date());
  if (from <= today) {
    throw new AppError('VALIDATION_FAILED', 'Choose a pause start from tomorrow onwards.');
  }
  if (to && to < from) {
    throw new AppError('VALIDATION_FAILED', 'The resume date must be after the pause starts.');
  }

  return db.transaction().execute(async (tx) => {
    const subscription = await tx
      .selectFrom('subscriptions')
      .selectAll()
      .where('user_id', '=', userId)
      .where('status', 'in', ['paid', 'cancelled_at_period_end'])
      .forUpdate()
      .executeTakeFirst();
    if (!subscription) throw new AppError('NOT_FOUND', 'No active subscription to pause.');

    await tx
      .updateTable('subscriptions')
      .set({ pause_from: from, pause_to: to, schedule_version: subscription.schedule_version + 1 })
      .where('id', '=', subscription.id)
      .execute();

    // Drop already-materialized meals inside the window. Only untouched ones —
    // anything the kitchen has started is left alone.
    const removed = await tx
      .deleteFrom('meal_orders')
      .where('source_type', '=', 'subscription')
      .where('source_id', '=', subscription.id)
      .where('service_date', '>=', from)
      .where((eb) => (to ? eb('service_date', '<=', to) : eb.val(true)))
      .where('ops_status', 'is', null)
      .returning('id')
      .execute();

    await emit(tx, {
      eventName: 'meal.cancelled',
      aggregateType: 'subscription',
      aggregateId: subscription.id,
      userId,
      payload: { pausedFrom: from, pausedTo: to, mealsRemoved: removed.length },
    });

    return {
      pauseFrom: from,
      pauseTo: to,
      mealsRemoved: removed.length,
      resumesOn: to ? addDays(to, 1) : null,
      message: to
        ? `Deliveries pause from ${mediumDate(from)} and resume on ${mediumDate(addDays(to, 1))}.`
        : `Deliveries pause from ${mediumDate(from)} until you resume them.`,
    };
  });
}

export async function resumeSubscription(userId: string) {
  return db.transaction().execute(async (tx) => {
    const subscription = await tx
      .selectFrom('subscriptions')
      .selectAll()
      .where('user_id', '=', userId)
      .where('pause_from', 'is not', null)
      .forUpdate()
      .executeTakeFirst();
    if (!subscription) throw new AppError('NOT_FOUND', 'Your subscription is not paused.');

    await tx
      .updateTable('subscriptions')
      .set({
        pause_from: null,
        pause_to: null,
        schedule_version: subscription.schedule_version + 1,
      })
      .where('id', '=', subscription.id)
      .execute();

    return { status: 'resumed' as const };
  });
}
