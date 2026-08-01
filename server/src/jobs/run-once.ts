/**
 * Runs every reconciler immediately, twice, and prints what each pass changed.
 *
 * Because each job is an idempotent reconciler, the second pass must report zero
 * work. That property is the whole reason a missed cron run is survivable, so it
 * is worth being able to check on demand.
 *
 *   pnpm jobs:run
 */
import { closeDb } from '../platform/db/index.js';
import { drainOutbox } from './drainOutbox.js';
import {
  emitSubscriptionExpired,
  emitTrialCompleted,
  expireRewards,
  materializeMealOrders,
} from './reconcilers.js';

async function main(): Promise<void> {
  for (const pass of [1, 2]) {
    const result = {
      mealOrdersCreated: await materializeMealOrders(),
      trialsCompleted: await emitTrialCompleted(),
      subscriptionsExpired: await emitSubscriptionExpired(),
      rewardsExpired: await expireRewards(),
      outboxDrained: await drainOutbox(),
    };
    console.log(`pass ${pass}:`, JSON.stringify(result));
  }
}

main()
  .then(closeDb)
  .catch(async (error: unknown) => {
    console.error('reconcilers failed:', error);
    await closeDb();
    process.exitCode = 1;
  });
