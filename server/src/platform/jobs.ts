import PgBoss from 'pg-boss';
import { env } from './config/env.js';
import { logger } from './logger.js';

/**
 * pg-boss over Redis/BullMQ for one decisive reason: transactional enqueue. A job
 * row is written by the same Postgres transaction as the domain change, so
 * "activate the subscription AND schedule its renewal check" is atomic. With an
 * external broker you would have to build an outbox to get that guarantee.
 */
let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: 'pgboss',
    retryLimit: 5,
    retryBackoff: true,
  });
  boss.on('error', (error) => logger.error({ err: error }, 'pg-boss error'));
  await boss.start();
  return boss;
}

export async function stopBoss(): Promise<void> {
  if (!boss) return;
  await boss.stop({ graceful: true });
  boss = null;
}

/** Cron expressions are UTC; these are the IST times from the plan converted. */
export const JOB = {
  materializeMealOrders: 'materialize-meal-orders',
  emitTrialCompleted: 'emit-trial-completed',
  emitSubscriptionExpired: 'emit-subscription-expired',
  evaluateLoyalty: 'evaluate-loyalty',
  expireRewards: 'expire-rewards',
  drainOutbox: 'drain-outbox',
} as const;

export type JobName = (typeof JOB)[keyof typeof JOB];
