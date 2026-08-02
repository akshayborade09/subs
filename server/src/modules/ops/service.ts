import { db, type Tx } from '../../platform/db/index.js';
import { AppError } from '../../platform/errors.js';
import { emit, type DomainEventName } from '../../platform/outbox.js';
import { todayIn, type PlainDate } from '../../platform/time.js';
import { reversePoints } from '../leaderboard/service.js';
import type { OpsStatus } from '../../platform/db/types.js';

/**
 * Legal transitions for a delivery. Ops can correct a mistake by moving back to
 * an earlier stage, but a delivered meal is terminal — reversing it would silently
 * unwind loyalty progress and leaderboard points that have already been awarded.
 */
const TERMINAL: ReadonlySet<OpsStatus> = new Set(['delivered', 'cancelled', 'skipped']);

const EVENT_FOR: Partial<Record<OpsStatus, DomainEventName>> = {
  delivered: 'meal.delivered',
  delayed: 'meal.delayed',
  delivery_failed: 'meal.failed',
  cancelled: 'meal.cancelled',
};

export type DeliveryUpdate = {
  mealOrderId: string;
  status: OpsStatus;
  note?: string;
  operator: string;
};

export async function updateDeliveryStatus(input: DeliveryUpdate) {
  return db.transaction().execute(async (tx) => {
    const order = await tx
      .selectFrom('meal_orders')
      .selectAll()
      .where('id', '=', input.mealOrderId)
      .forUpdate()
      .executeTakeFirst();
    if (!order) throw new AppError('NOT_FOUND', 'Meal order not found.');

    if (order.ops_status && TERMINAL.has(order.ops_status) && order.ops_status !== input.status) {
      throw new AppError(
        'VALIDATION_FAILED',
        `This meal is already ${order.ops_status} and cannot be changed. Raise a support issue instead.`,
      );
    }
    if (order.ops_status === input.status) {
      return { mealOrderId: order.id, status: input.status, changed: false };
    }

    const now = new Date();
    await tx
      .updateTable('meal_orders')
      .set({ ops_status: input.status, ops_status_at: now, ops_note: input.note ?? null })
      .where('id', '=', order.id)
      .execute();

    await tx
      .insertInto('meal_order_events')
      .values({
        meal_order_id: order.id,
        ops_status: input.status,
        actor: input.operator,
        note: input.note ?? null,
      })
      .execute();

    await tx
      .insertInto('audit_logs')
      .values({
        user_id: order.user_id,
        actor_type: 'ops',
        actor_id: input.operator,
        action: 'delivery.status_changed',
        entity_type: 'meal_order',
        entity_id: order.id,
        before: { opsStatus: order.ops_status },
        after: { opsStatus: input.status },
      })
      .execute();

    const eventName = EVENT_FOR[input.status];
    if (eventName) {
      await emit(tx, {
        eventName,
        aggregateType: 'meal_order',
        aggregateId: order.id,
        userId: order.user_id,
        payload: { serviceDate: order.service_date, slot: order.slot, note: input.note ?? null },
      });
    }

    return { mealOrderId: order.id, status: input.status, changed: true };
  });
}

/** The kitchen's view: what has to be cooked and where it is going. */
export async function productionSchedule(serviceDate: PlainDate) {
  const rows = await db
    .selectFrom('meal_orders')
    .innerJoin('addresses', 'addresses.id', 'meal_orders.address_id')
    .select([
      'meal_orders.slot',
      'meal_orders.food_type',
      'meal_orders.bread_preference',
      'meal_orders.rice_preference',
      'addresses.pincode',
    ])
    .where('meal_orders.service_date', '=', serviceDate)
    .where((eb) =>
      eb.or([eb('meal_orders.ops_status', 'is', null), eb('meal_orders.ops_status', 'in', ['preparing'])]),
    )
    .execute();

  type Line = {
    slot: string;
    foodType: string;
    breadPreference: string;
    ricePreference: string;
    count: number;
  };
  // Keyed by the combination the kitchen actually cooks as one batch. The line is
  // stored alongside its key so nothing has to be parsed back out of a string.
  const counts = new Map<string, Line>();
  const byPincode = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.slot}|${row.food_type}|${row.bread_preference}|${row.rice_preference}`;
    const line = counts.get(key);
    if (line) {
      line.count += 1;
    } else {
      counts.set(key, {
        slot: row.slot,
        foodType: row.food_type,
        breadPreference: row.bread_preference,
        ricePreference: row.rice_preference,
        count: 1,
      });
    }
    byPincode.set(row.pincode, (byPincode.get(row.pincode) ?? 0) + 1);
  }

  return {
    serviceDate,
    totalMeals: rows.length,
    breakdown: [...counts.values()],
    byPincode: [...byPincode.entries()]
      .map(([pincode, count]) => ({ pincode, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** Deliveries needing attention today: nothing recorded, or an open exception. */
export async function deliveryBoard(serviceDate: PlainDate = todayIn(new Date())) {
  const rows = await db
    .selectFrom('meal_orders')
    .innerJoin('users', 'users.id', 'meal_orders.user_id')
    .innerJoin('addresses', 'addresses.id', 'meal_orders.address_id')
    .select([
      'meal_orders.id',
      'meal_orders.slot',
      'meal_orders.ops_status',
      'meal_orders.food_type',
      'users.full_name',
      'addresses.line1',
      'addresses.pincode',
    ])
    .where('meal_orders.service_date', '=', serviceDate)
    .orderBy('meal_orders.slot')
    .execute();

  return {
    serviceDate,
    deliveries: rows.map((row) => ({
      mealOrderId: row.id,
      slot: row.slot,
      status: row.ops_status ?? 'scheduled',
      foodType: row.food_type,
      customer: row.full_name ?? 'Customer',
      address: `${row.line1}, ${row.pincode}`,
    })),
  };
}

export type RefundInput = {
  userId: string;
  paymentId?: string;
  amountPaise: number;
  reason: string;
  operator: string;
  /** Reverses leaderboard points earned from the thing being refunded. */
  reversePointsFor?: { sourceType: string; sourceId: string };
};

/**
 * Records a refund or service credit. Spec §15.6 requires reversed money to
 * reverse the points it earned, otherwise the leaderboard rewards chargebacks.
 */
export async function recordRefund(input: RefundInput) {
  return db.transaction().execute(async (tx) => {
    if (input.amountPaise <= 0) {
      throw new AppError('VALIDATION_FAILED', 'Refund amount must be positive.');
    }

    const transaction = await tx
      .insertInto('transactions')
      .values({
        user_id: input.userId,
        type: input.paymentId ? 'refund' : 'credit',
        title: input.paymentId ? 'Refund' : 'Service credit',
        subtitle: input.reason,
        amount_paise: input.amountPaise,
        status: input.paymentId ? 'refunded' : 'credited',
        payment_id: input.paymentId ?? null,
        meta: { reason: input.reason, operator: input.operator },
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (input.paymentId) {
      await tx
        .updateTable('payments')
        .set({ status: 'refunded', status_rank: 4 })
        .where('id', '=', input.paymentId)
        .execute();
    }

    let pointsReversed = 0;
    if (input.reversePointsFor) {
      pointsReversed = await reversePoints(
        tx,
        input.reversePointsFor.sourceType,
        input.reversePointsFor.sourceId,
      );
    }

    await tx
      .insertInto('audit_logs')
      .values({
        user_id: input.userId,
        actor_type: 'ops',
        actor_id: input.operator,
        action: input.paymentId ? 'payment.refunded' : 'credit.issued',
        entity_type: 'transaction',
        entity_id: transaction.id,
        after: { amountPaise: input.amountPaise, reason: input.reason },
      })
      .execute();

    return { transactionId: transaction.id, amountPaise: input.amountPaise, pointsReversed };
  });
}

export async function resolveSupportIssue(
  issueId: string,
  input: { status: 'resolved' | 'rejected'; resolution: string; creditPaise?: number; operator: string },
) {
  return db.transaction().execute(async (tx) => {
    const issue = await tx
      .selectFrom('support_issues')
      .selectAll()
      .where('id', '=', issueId)
      .forUpdate()
      .executeTakeFirst();
    if (!issue) throw new AppError('NOT_FOUND', 'Support issue not found.');
    if (issue.status === 'resolved' || issue.status === 'rejected') {
      throw new AppError('VALIDATION_FAILED', `This issue is already ${issue.status}.`);
    }

    await tx
      .updateTable('support_issues')
      .set({
        status: input.status,
        resolution: input.resolution,
        credit_paise: input.creditPaise ?? null,
        resolved_at: new Date(),
        resolved_by: input.operator,
      })
      .where('id', '=', issueId)
      .execute();

    if (input.status === 'resolved' && input.creditPaise && input.creditPaise > 0) {
      await issueCreditWithin(tx, issue.user_id, input.creditPaise, input.resolution, input.operator);
    }

    return { issueId, status: input.status, creditPaise: input.creditPaise ?? 0 };
  });
}

async function issueCreditWithin(
  tx: Tx,
  userId: string,
  amountPaise: number,
  reason: string,
  operator: string,
): Promise<void> {
  await tx
    .insertInto('transactions')
    .values({
      user_id: userId,
      type: 'credit',
      title: 'Service credit',
      subtitle: reason,
      amount_paise: amountPaise,
      status: 'credited',
      meta: { operator },
    })
    .execute();
}
