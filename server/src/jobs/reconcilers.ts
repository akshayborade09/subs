import { db } from '../platform/db/index.js';
import { logger } from '../platform/logger.js';
import { emit, emitMany } from '../platform/outbox.js';
import { todayIn } from '../platform/time.js';
import { materializeSubscriptionOrders } from '../modules/subscription/service.js';

/**
 * Every job here is a RECONCILER, not a scheduled state transition: it asks the
 * database what is out of sync and fixes it. That is why none of them own
 * lifecycle state — trial "active" and subscription "expired" are derived from
 * dates at read time, so a job that runs six hours late (or not at all) can
 * never produce a wrong Home screen. These jobs only create rows and emit events.
 */

export async function materializeMealOrders(now = new Date()): Promise<number> {
  const today = todayIn(now);
  const subscriptions = await db
    .selectFrom('subscriptions')
    .select('id')
    .where('status', 'in', ['paid', 'cancelled_at_period_end'])
    .where('ends_on', '>=', today)
    .execute();

  let created = 0;
  for (const sub of subscriptions) {
    created += await db.transaction().execute(async (tx) => {
      const count = await materializeSubscriptionOrders(tx, sub.id, today);
      if (count > 0) {
        await emit(tx, {
          eventName: 'meal.scheduled',
          aggregateType: 'subscription',
          aggregateId: sub.id,
          payload: { created: count, horizonFrom: today },
        });
      }
      return count;
    });
  }

  if (created > 0) logger.info({ created, subscriptions: subscriptions.length }, 'meal orders materialized');
  return created;
}

/** Stamps completion once, so the event fires exactly once per trial. */
export async function emitTrialCompleted(now = new Date()): Promise<number> {
  const today = todayIn(now);
  const due = await db
    .selectFrom('trials')
    .select(['id', 'user_id'])
    .where('status', '=', 'paid')
    .where('completed_event_at', 'is', null)
    .where('last_service_date', '<', today)
    .execute();

  if (due.length === 0) return 0;

  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable('trials')
      .set({ completed_event_at: now })
      .where(
        'id',
        'in',
        due.map((t) => t.id),
      )
      .execute();
    await emitMany(
      tx,
      due.map((trial) => ({
        eventName: 'trial.completed' as const,
        aggregateType: 'trial' as const,
        aggregateId: trial.id,
        userId: trial.user_id,
        payload: {},
      })),
    );
  });

  logger.info({ count: due.length }, 'trial.completed emitted');
  return due.length;
}

export async function emitSubscriptionExpired(now = new Date()): Promise<number> {
  const today = todayIn(now);
  const due = await db
    .selectFrom('subscriptions')
    .select(['id', 'user_id'])
    .where('status', 'in', ['paid', 'cancelled_at_period_end'])
    .where('expired_event_at', 'is', null)
    .where('ends_on', '<', today)
    .execute();

  if (due.length === 0) return 0;

  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable('subscriptions')
      .set({ expired_event_at: now })
      .where(
        'id',
        'in',
        due.map((s) => s.id),
      )
      .execute();
    await emitMany(
      tx,
      due.map((sub) => ({
        eventName: 'subscription.activated' as const,
        aggregateType: 'subscription' as const,
        aggregateId: sub.id,
        userId: sub.user_id,
        payload: { expired: true },
      })),
    );
  });

  logger.info({ count: due.length }, 'subscription expiry emitted');
  return due.length;
}

export async function expireRewards(now = new Date()): Promise<number> {
  const today = todayIn(now);
  const expired = await db
    .updateTable('rewards')
    .set({ status: 'expired' })
    .where('status', '=', 'earned')
    .where('expires_on', '<', today)
    .returning('id')
    .execute();

  if (expired.length > 0) logger.info({ count: expired.length }, 'rewards expired');
  return expired.length;
}
