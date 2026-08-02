import { db, type Tx } from '../../platform/db/index.js';
import { policy } from '../../platform/config/policy.js';
import { AppError } from '../../platform/errors.js';
import { emit } from '../../platform/outbox.js';
import {
  addDays,
  dayLabel,
  deliveryWindow,
  longDate,
  todayIn,
  type PlainDate,
} from '../../platform/time.js';
import { derivePermissions, type MealPermissions } from './permissions.js';

export type MealDetail = {
  id: string;
  serviceDate: string;
  dateLabel: string;
  dayLabel: string;
  slot: 'lunch' | 'dinner';
  foodType: string;
  breadPreference: string;
  ricePreference: string;
  status: string;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  address: { id: string; label: string; line1: string; pincode: string };
  rescheduledFrom: string | null;
  scheduleVersion: number;
} & MealPermissions;

async function loadOrder(userId: string, mealOrderId: string, tx: Tx | typeof db = db) {
  const order = await tx
    .selectFrom('meal_orders')
    .innerJoin('addresses', 'addresses.id', 'meal_orders.address_id')
    .selectAll('meal_orders')
    .select([
      'addresses.label as address_label',
      'addresses.line1 as address_line1',
      'addresses.pincode as address_pincode',
    ])
    .where('meal_orders.id', '=', mealOrderId)
    .where('meal_orders.user_id', '=', userId)
    .executeTakeFirst();
  if (!order) throw new AppError('NOT_FOUND', 'Meal not found.');
  return order;
}

/**
 * The schedule owner carries the version, not the individual meal: moving one
 * delivery changes the shape of the whole week, which is what the client is
 * holding stale.
 */
async function scheduleVersionOf(
  tx: Tx,
  sourceType: string,
  sourceId: string,
): Promise<number> {
  const table = sourceType === 'trial' ? 'trials' : 'subscriptions';
  const row = await tx
    .selectFrom(table as 'trials')
    .select('schedule_version')
    .where('id', '=', sourceId)
    .executeTakeFirst();
  return row?.schedule_version ?? 0;
}

/**
 * Guarded bump. Zero rows updated means the client was working from a stale view
 * of the week, so the caller turns that into 409 with a fresh payload.
 */
async function bumpScheduleVersion(
  tx: Tx,
  sourceType: string,
  sourceId: string,
  expected: number | undefined,
): Promise<number> {
  const table = (sourceType === 'trial' ? 'trials' : 'subscriptions') as 'trials';
  let query = tx
    .updateTable(table)
    .set((eb) => ({ schedule_version: eb('schedule_version', '+', 1) }))
    .where('id', '=', sourceId);
  if (expected !== undefined) query = query.where('schedule_version', '=', expected);

  const updated = await query.returning('schedule_version').executeTakeFirst();
  if (!updated) {
    const current = await scheduleVersionOf(tx, sourceType, sourceId);
    throw new AppError(
      'SCHEDULE_CONFLICT',
      'Your meal schedule changed. Refresh and try again.',
      { currentVersion: current },
    );
  }
  return updated.schedule_version;
}

export async function getMealDetail(userId: string, mealOrderId: string): Promise<MealDetail> {
  const order = await loadOrder(userId, mealOrderId);
  const now = new Date();
  const permissions = derivePermissions(
    { serviceDate: order.service_date, slot: order.slot, opsStatus: order.ops_status },
    now,
  );
  const window = deliveryWindow(order.service_date, order.slot);

  return {
    id: order.id,
    serviceDate: order.service_date,
    dateLabel: longDate(order.service_date),
    dayLabel: dayLabel(order.service_date),
    slot: order.slot,
    foodType: order.food_type,
    breadPreference: order.bread_preference,
    ricePreference: order.rice_preference,
    status: order.ops_status ?? (order.service_date < todayIn(now) ? 'issue' : 'upcoming'),
    deliveryWindowStart: window.start.toISOString(),
    deliveryWindowEnd: window.end.toISOString(),
    address: {
      id: order.address_id,
      label: order.address_label,
      line1: order.address_line1,
      pincode: order.address_pincode,
    },
    rescheduledFrom: order.rescheduled_from,
    scheduleVersion: await scheduleVersionOf(db as unknown as Tx, order.source_type, order.source_id),
    ...permissions,
  };
}

/** Re-derive inside the transaction: the read-time answer may be minutes stale. */
function assertAllowed(
  order: { service_date: string; slot: 'lunch' | 'dinner'; ops_status: null | string },
  action: 'date' | 'address' | 'preference',
  now: Date,
): void {
  const permissions = derivePermissions(
    {
      serviceDate: order.service_date,
      slot: order.slot,
      opsStatus: order.ops_status as never,
    },
    now,
  );
  const allowed =
    action === 'date'
      ? permissions.canChangeDate
      : action === 'address'
        ? permissions.canChangeAddress
        : permissions.canChangePreference;

  if (!allowed) {
    throw new AppError('CUTOFF_PASSED', permissions.lockedReason ?? 'This meal can no longer be changed.');
  }
}

export type ChangeDateInput = { newDate: PlainDate; expectedScheduleVersion?: number };

export async function changeMealDate(
  userId: string,
  mealOrderId: string,
  input: ChangeDateInput,
): Promise<{ mealOrderId: string; from: string; to: string; scheduleVersion: number }> {
  const now = new Date();
  const today = todayIn(now);

  return db.transaction().execute(async (tx) => {
    const order = await tx
      .selectFrom('meal_orders')
      .selectAll()
      .where('id', '=', mealOrderId)
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
    if (!order) throw new AppError('NOT_FOUND', 'Meal not found.');

    assertAllowed(order, 'date', now);

    // Concurrency is checked before content validation: a client holding a stale
    // week should be told exactly that, rather than a confusing "slot taken" that
    // describes a schedule they cannot see. Safe to bump early — any later failure
    // rolls the whole transaction back.
    const version = await bumpScheduleVersion(
      tx,
      order.source_type,
      order.source_id,
      input.expectedScheduleVersion,
    );

    if (input.newDate <= today) {
      throw new AppError('VALIDATION_FAILED', 'Choose a date from tomorrow onwards.');
    }
    // The replacement date has its own cutoff — moving a meal to tomorrow at
    // 9 PM would land it after the kitchen had already been told.
    assertAllowed({ ...order, service_date: input.newDate }, 'date', now);

    const limit = policy.limits.dateChangesPerOrder;
    if (limit !== null && order.date_change_count >= limit) {
      throw new AppError('VALIDATION_FAILED', `This meal can only be moved ${limit} time(s).`);
    }

    const clash = await tx
      .selectFrom('meal_orders')
      .select('id')
      .where('source_type', '=', order.source_type)
      .where('source_id', '=', order.source_id)
      .where('service_date', '=', input.newDate)
      .where('slot', '=', order.slot)
      .executeTakeFirst();
    if (clash) {
      throw new AppError('VALIDATION_FAILED', 'You already have a delivery in that slot.');
    }

    // The row moves; its identity and status travel with it, so the marker the
    // user was looking at follows the meal rather than the calendar cell.
    await tx
      .updateTable('meal_orders')
      .set({
        service_date: input.newDate,
        rescheduled_from: order.rescheduled_from ?? order.service_date,
        date_change_count: order.date_change_count + 1,
      })
      .where('id', '=', order.id)
      .execute();

    await tx
      .insertInto('audit_logs')
      .values({
        user_id: userId,
        action: 'meal.date_changed',
        entity_type: 'meal_order',
        entity_id: order.id,
        before: { serviceDate: order.service_date },
        after: { serviceDate: input.newDate },
      })
      .execute();

    await emit(tx, {
      eventName: 'meal.date_changed',
      aggregateType: 'meal_order',
      aggregateId: order.id,
      userId,
      payload: { from: order.service_date, to: input.newDate },
    });

    return { mealOrderId: order.id, from: order.service_date, to: input.newDate, scheduleVersion: version };
  });
}

export async function changeMealAddress(
  userId: string,
  mealOrderId: string,
  addressId: string,
  expectedScheduleVersion?: number,
) {
  const now = new Date();
  return db.transaction().execute(async (tx) => {
    const order = await tx
      .selectFrom('meal_orders')
      .selectAll()
      .where('id', '=', mealOrderId)
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
    if (!order) throw new AppError('NOT_FOUND', 'Meal not found.');

    assertAllowed(order, 'address', now);

    const address = await tx
      .selectFrom('addresses')
      .selectAll()
      .where('id', '=', addressId)
      .where('user_id', '=', userId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!address) throw new AppError('NOT_FOUND', 'Address not found.');
    if (!address.is_serviceable) {
      // Spec §8.6: an unsupported PIN leaves the current address untouched and
      // offers a date change instead.
      throw new AppError(
        'PINCODE_NOT_SERVICEABLE',
        `We do not deliver to ${address.pincode}. Your current address is unchanged — you can change the delivery date instead.`,
      );
    }

    const version = await bumpScheduleVersion(
      tx,
      order.source_type,
      order.source_id,
      expectedScheduleVersion,
    );

    await tx
      .updateTable('meal_orders')
      .set({ address_id: addressId })
      .where('id', '=', order.id)
      .execute();

    await emit(tx, {
      eventName: 'meal.address_changed',
      aggregateType: 'meal_order',
      aggregateId: order.id,
      userId,
      payload: { from: order.address_id, to: addressId },
    });

    return { mealOrderId: order.id, addressId, scheduleVersion: version };
  });
}

export type ChangePreferenceInput = {
  foodType?: 'vegetarian' | 'non_vegetarian';
  breadPreference?: string;
  ricePreference?: string;
  expectedScheduleVersion?: number;
};

export async function changeMealPreferences(
  userId: string,
  mealOrderId: string,
  input: ChangePreferenceInput,
) {
  const now = new Date();
  return db.transaction().execute(async (tx) => {
    const order = await tx
      .selectFrom('meal_orders')
      .selectAll()
      .where('id', '=', mealOrderId)
      .where('user_id', '=', userId)
      .forUpdate()
      .executeTakeFirst();
    if (!order) throw new AppError('NOT_FOUND', 'Meal not found.');

    assertAllowed(order, 'preference', now);

    const version = await bumpScheduleVersion(
      tx,
      order.source_type,
      order.source_id,
      input.expectedScheduleVersion,
    );

    await tx
      .updateTable('meal_orders')
      .set({
        ...(input.foodType ? { food_type: input.foodType } : {}),
        ...(input.breadPreference ? { bread_preference: input.breadPreference } : {}),
        ...(input.ricePreference ? { rice_preference: input.ricePreference } : {}),
      })
      .where('id', '=', order.id)
      .execute();

    await emit(tx, {
      eventName: 'meal.preference_changed',
      aggregateType: 'meal_order',
      aggregateId: order.id,
      userId,
      payload: { ...input },
    });

    return { mealOrderId: order.id, scheduleVersion: version };
  });
}

/**
 * Dates the user could move this meal to. Spec §8.5 is explicit that previously
 * vacated dates become selectable again, so this is "every eligible future date
 * without a delivery in this slot", not just dates after the current one.
 */
export async function selectableDates(
  userId: string,
  mealOrderId: string,
  windowDays = 21,
): Promise<string[]> {
  const order = await loadOrder(userId, mealOrderId);
  const now = new Date();
  const today = todayIn(now);

  const taken = await db
    .selectFrom('meal_orders')
    .select('service_date')
    .where('source_type', '=', order.source_type)
    .where('source_id', '=', order.source_id)
    .where('slot', '=', order.slot)
    .where('id', '!=', order.id)
    .execute();
  const occupied = new Set(taken.map((row) => row.service_date));

  const dates: string[] = [];
  for (let i = 1; i <= windowDays; i += 1) {
    const date = addDays(today, i);
    if (occupied.has(date)) continue;
    const permissions = derivePermissions({ serviceDate: date, slot: order.slot, opsStatus: null }, now);
    if (permissions.canChangeDate) dates.push(date);
  }
  return dates;
}
