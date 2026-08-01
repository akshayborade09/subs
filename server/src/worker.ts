import { closeDb } from './platform/db/index.js';
import { getBoss, JOB, stopBoss } from './platform/jobs.js';
import { logger } from './platform/logger.js';
import { drainOutbox } from './jobs/drainOutbox.js';
import {
  emitSubscriptionExpired,
  emitTrialCompleted,
  expireRewards,
  materializeMealOrders,
} from './jobs/reconcilers.js';

/**
 * Cron below is UTC (pg-boss does not take a timezone). IST is UTC+5:30, so the
 * plan's IST times convert as:
 *   00:05 IST -> 18:35 UTC (previous day)
 *   00:10 IST -> 18:40 UTC
 *   01:30 IST -> 20:00 UTC
 * Each job is also a reconciler, so a missed run self-heals on the next tick.
 */
const SCHEDULE: Array<{ name: string; cron: string; run: () => Promise<number> }> = [
  { name: JOB.materializeMealOrders, cron: '35 18 * * *', run: materializeMealOrders },
  { name: JOB.emitTrialCompleted, cron: '40 18 * * *', run: emitTrialCompleted },
  { name: JOB.emitSubscriptionExpired, cron: '40 18 * * *', run: emitSubscriptionExpired },
  { name: JOB.expireRewards, cron: '0 20 * * *', run: expireRewards },
];

async function main(): Promise<void> {
  const boss = await getBoss();

  // pg-boss v10 requires a queue to exist before it can be worked or scheduled.
  for (const name of [...SCHEDULE.map((j) => j.name), JOB.drainOutbox]) {
    await boss.createQueue(name);
  }

  for (const job of SCHEDULE) {
    await boss.work(job.name, async () => {
      const count = await job.run();
      logger.info({ job: job.name, count }, 'reconciler finished');
    });
    // singletonKey prevents a re-schedule from stacking duplicate runs.
    await boss.schedule(job.name, job.cron, {}, { singletonKey: job.name });
  }

  await boss.work(JOB.drainOutbox, async () => {
    await drainOutbox();
  });
  await boss.schedule(JOB.drainOutbox, '* * * * *', {}, { singletonKey: JOB.drainOutbox });

  // The outbox needs sub-minute latency; cron only resolves to a minute.
  const ticker = setInterval(() => {
    void drainOutbox().catch((error: unknown) =>
      logger.error({ err: error }, 'outbox drain tick failed'),
    );
  }, 1000);

  logger.info({ jobs: SCHEDULE.map((j) => j.name) }, 'worker started');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'worker shutting down');
    clearInterval(ticker);
    await stopBoss();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'worker failed to start');
  process.exit(1);
});
