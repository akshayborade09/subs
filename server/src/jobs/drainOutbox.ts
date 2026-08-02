import { sql } from 'kysely';
import { db } from '../platform/db/index.js';
import { logger } from '../platform/logger.js';
import { awardPoints } from '../modules/leaderboard/service.js';

/**
 * Subscribers are deliberately dumb for now: notifications and analytics are
 * later-phase work. What matters is that the delivery mechanism is correct, so
 * adding a real subscriber later is a one-line change with no reliability risk.
 *
 * Each subscriber is idempotent via the (subscriber, event_id) primary key on
 * outbox_deliveries — that is what makes at-least-once delivery safe.
 */
type Subscriber = {
  name: string;
  handles: (eventName: string) => boolean;
  handle: (event: OutboxRow) => Promise<void>;
};

type OutboxRow = {
  id: number;
  event_name: string;
  aggregate_type: string;
  aggregate_id: string;
  user_id: string | null;
  payload: Record<string, unknown>;
};

const NOTIFIABLE = new Set([
  'trial.payment.succeeded',
  'trial.payment.failed',
  'trial.scheduled',
  'trial.completed',
  'subscription.payment.succeeded',
  'subscription.payment.failed',
  'subscription.renewal.failed',
  'meal.delayed',
  'meal.failed',
  'reward.earned',
  'referral.qualified',
]);

const SUBSCRIBERS: Subscriber[] = [
  {
    /**
     * Leaderboard points. Runs here rather than inline in the payment or ops path
     * so scoring cannot fail a business transaction, and so the (user, event,
     * source) unique index makes a redelivered event a no-op.
     */
    name: 'leaderboard',
    handles: (name) =>
      name === 'meal.delivered' || name === 'referral.qualified' || name === 'reward.earned',
    handle: async (event) => {
      if (!event.user_id) return;
      if (event.event_name === 'meal.delivered') {
        await awardPoints(db, {
          userId: event.user_id,
          eventKind: 'meal_delivered',
          sourceType: 'meal_order',
          sourceId: event.aggregate_id,
        });
        return;
      }
      if (event.event_name === 'referral.qualified') {
        await awardPoints(db, {
          userId: event.user_id,
          eventKind: 'referral_qualified',
          sourceType: 'reward',
          sourceId: event.aggregate_id,
        });
        return;
      }
      // reward.earned from the loyalty reconciler means a month was completed.
      if (event.payload['source'] === 'loyalty') {
        await awardPoints(db, {
          userId: event.user_id,
          eventKind: 'monthly_streak',
          sourceType: 'reward',
          sourceId: event.aggregate_id,
        });
      }
    },
  },
  {
    name: 'notifications',
    handles: (name) => NOTIFIABLE.has(name),
    handle: async (event) => {
      if (!event.user_id) return;
      // Real push/WhatsApp delivery is Phase 3. Recording the notification is
      // enough to prove the outbox path and gives the in-app centre its rows.
      await db
        .insertInto('notifications')
        .values({
          user_id: event.user_id,
          category: categoryFor(event.event_name),
          title: titleFor(event.event_name),
          body: bodyFor(event.event_name),
        })
        .execute();
    },
  },
];

function categoryFor(eventName: string): string {
  if (eventName.includes('payment') || eventName.includes('renewal')) return 'payment_renewal';
  if (eventName.startsWith('meal.')) return 'delivery_issues';
  if (eventName.startsWith('reward') || eventName.startsWith('referral')) return 'rewards_referrals';
  if (eventName.startsWith('subscription')) return 'subscription_updates';
  return 'meal_updates';
}

const TITLES: Record<string, string> = {
  'trial.payment.succeeded': 'Your trial is confirmed',
  'trial.payment.failed': 'Trial payment did not go through',
  'trial.scheduled': 'Your trial meals are scheduled',
  'trial.completed': 'Your five-day trial is complete',
  'subscription.payment.succeeded': 'Your subscription is confirmed',
  'subscription.payment.failed': 'Subscription payment did not go through',
  'subscription.renewal.failed': 'Action needed on your payment',
  'meal.delayed': 'A delivery is running late',
  'meal.failed': 'A delivery needs your attention',
  'reward.earned': 'You earned a free meal day',
  'referral.qualified': 'Your referral qualified',
};

const BODIES: Record<string, string> = {
  'trial.payment.succeeded': 'Your five-day trial is paid for and scheduled.',
  'trial.payment.failed': 'Your trial dates are saved. Retry payment to confirm them.',
  'trial.scheduled': 'Tap to review your upcoming meals.',
  'trial.completed': 'Choose a subscription to keep your meals coming.',
  'subscription.payment.succeeded': 'Explore your plan and upcoming deliveries.',
  'subscription.payment.failed': 'Your selection is saved. Retry payment to continue.',
  'subscription.renewal.failed': 'Update your payment method to keep future weeks active.',
  'meal.delayed': 'Your remaining delivery days are unchanged.',
  'meal.failed': 'Check the delivery address or contact support.',
  'reward.earned': 'Choose the day you would like your free meal.',
  'referral.qualified': 'Your reward is on its way.',
};

const titleFor = (name: string): string => TITLES[name] ?? 'Update on your meals';
const bodyFor = (name: string): string => BODIES[name] ?? 'Open the app for details.';

const MAX_ATTEMPTS = 10;

/**
 * FOR UPDATE SKIP LOCKED lets several workers drain concurrently without
 * double-processing. Concurrency 1 gives global ordering for now; scaling means
 * hashing aggregate_id across N workers, since only per-aggregate order matters.
 */
export async function drainOutbox(batchSize = 100): Promise<number> {
  return db.transaction().execute(async (tx) => {
    const events = await tx
      .selectFrom('outbox_events')
      .select(['id', 'event_name', 'aggregate_type', 'aggregate_id', 'user_id', 'payload'])
      .where('published_at', 'is', null)
      // Compare against the database clock, not the Node process clock. available_at
      // is set by Postgres `now()`, so testing it against a client-side `new Date()`
      // lets a just-emitted event fall outside the window on any skew and sit
      // undrained until the next tick.
      .where('available_at', '<=', sql<Date>`now()`)
      .orderBy('id')
      .limit(batchSize)
      .forUpdate()
      .skipLocked()
      .execute();

    if (events.length === 0) return 0;

    for (const event of events as OutboxRow[]) {
      let failed = false;
      for (const subscriber of SUBSCRIBERS) {
        if (!subscriber.handles(event.event_name)) continue;

        const claimed = await tx
          .insertInto('outbox_deliveries')
          .values({ subscriber: subscriber.name, event_id: event.id })
          .onConflict((oc) => oc.columns(['subscriber', 'event_id']).doNothing())
          .returning('event_id')
          .executeTakeFirst();
        if (!claimed) continue; // already delivered

        try {
          await subscriber.handle(event);
        } catch (error) {
          failed = true;
          logger.error(
            { err: error, eventId: event.id, subscriber: subscriber.name },
            'outbox subscriber failed',
          );
        }
      }

      if (failed) {
        await tx
          .updateTable('outbox_events')
          .set({
            attempts: sql`attempts + 1`,
            available_at: sql`now() + (interval '10 seconds' * power(2, least(attempts, 6)))`,
            last_error: 'subscriber failed',
          })
          .where('id', '=', event.id)
          .execute();
        await tx
          .updateTable('outbox_events')
          .set({ published_at: new Date(), last_error: 'parked after max attempts' })
          .where('id', '=', event.id)
          .where('attempts', '>=', MAX_ATTEMPTS)
          .execute();
      } else {
        await tx
          .updateTable('outbox_events')
          .set({ published_at: new Date() })
          .where('id', '=', event.id)
          .execute();
      }
    }

    return events.length;
  });
}
