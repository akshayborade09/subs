import { db } from '../../platform/db/index.js';
import { AppError } from '../../platform/errors.js';
import { awardPoints } from '../leaderboard/service.js';

/**
 * Feedback is only meaningful on a meal that actually arrived, and may only score
 * once. The points ledger's unique index on (user, event, source) is the real
 * guard — resubmitting a rating updates the text but cannot pay again.
 */
export async function submitFeedback(
  userId: string,
  mealOrderId: string,
  input: { rating: number; tags?: string[]; note?: string },
) {
  return db.transaction().execute(async (tx) => {
    const order = await tx
      .selectFrom('meal_orders')
      .selectAll()
      .where('id', '=', mealOrderId)
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
    if (!order) throw new AppError('NOT_FOUND', 'Meal not found.');
    if (order.ops_status !== 'delivered') {
      throw new AppError('VALIDATION_FAILED', 'You can rate a meal once it has been delivered.');
    }

    await tx
      .updateTable('meal_orders')
      .set({
        rating: input.rating,
        feedback_tags: input.tags ?? null,
        feedback_note: input.note ?? null,
      })
      .where('id', '=', order.id)
      .execute();

    const scored = await awardPoints(tx, {
      userId,
      eventKind: 'meal_rated',
      sourceType: 'meal_order',
      sourceId: order.id,
    });

    return { mealOrderId: order.id, rating: input.rating, pointsAwarded: scored };
  });
}

export async function reportIssue(
  userId: string,
  mealOrderId: string,
  input: { category: string; description?: string },
) {
  const order = await db
    .selectFrom('meal_orders')
    .select('id')
    .where('id', '=', mealOrderId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!order) throw new AppError('NOT_FOUND', 'Meal not found.');

  const issue = await db
    .insertInto('support_issues')
    .values({
      user_id: userId,
      meal_order_id: order.id,
      category: input.category,
      description: input.description ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    issueId: issue.id,
    status: issue.status,
    // Spec §R: any credit or refund state must be explicit rather than implied.
    message: 'Support has your report. Any credit will be confirmed here once reviewed.',
  };
}
