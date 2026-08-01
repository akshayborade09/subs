import { db, type Executor } from '../../platform/db/index.js';
import { AppError } from '../../platform/errors.js';

export type ServiceabilityResult = {
  pincode: string;
  serviceable: boolean;
  city: string | null;
  state: string | null;
  message: string;
};

export async function checkServiceability(pincode: string): Promise<ServiceabilityResult> {
  const row = await db
    .selectFrom('serviceable_pincodes')
    .selectAll()
    .where('pincode', '=', pincode)
    .where('is_active', '=', true)
    .executeTakeFirst();

  return row
    ? {
        pincode,
        serviceable: true,
        city: row.city,
        state: row.state,
        message: `We deliver to ${row.city} ${pincode}.`,
      }
    : {
        pincode,
        serviceable: false,
        city: null,
        state: null,
        message: 'We do not deliver to this PIN code yet.',
      };
}

export type AddressInput = {
  label: 'home' | 'office' | 'other';
  buildingType?: string | null;
  flatOrHouse?: string | null;
  buildingOrSociety?: string | null;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  deliveryInstructions?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  makeDefault?: boolean;
};

export async function listAddresses(userId: string) {
  return db
    .selectFrom('addresses')
    .selectAll()
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .orderBy('is_default', 'desc')
    .orderBy('created_at', 'asc')
    .execute();
}

export async function createAddress(userId: string, input: AddressInput) {
  const serviceability = await checkServiceability(input.pincode);

  return db.transaction().execute(async (tx) => {
    const existingCount = await countAddresses(tx, userId);
    // Spec §8.2: at least one default exists whenever any address is saved.
    const shouldDefault = input.makeDefault === true || existingCount === 0;

    if (shouldDefault) await clearDefault(tx, userId);

    return tx
      .insertInto('addresses')
      .values({
        user_id: userId,
        label: input.label,
        building_type: input.buildingType ?? null,
        flat_or_house: input.flatOrHouse ?? null,
        building_or_society: input.buildingOrSociety ?? null,
        line1: input.line1,
        line2: input.line2 ?? null,
        landmark: input.landmark ?? null,
        delivery_instructions: input.deliveryInstructions ?? null,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        latitude: input.latitude?.toString() ?? null,
        longitude: input.longitude?.toString() ?? null,
        is_default: shouldDefault,
        is_serviceable: serviceability.serviceable,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  });
}

export async function setDefaultAddress(userId: string, addressId: string) {
  return db.transaction().execute(async (tx) => {
    const address = await requireAddress(tx, userId, addressId);
    await clearDefault(tx, userId);
    await tx.updateTable('addresses').set({ is_default: true }).where('id', '=', address.id).execute();
    return { ...address, is_default: true };
  });
}

/**
 * Spec §8.2: an address used by an upcoming meal cannot be silently deleted, and
 * the confirmation must list the affected deliveries.
 */
export async function deleteAddress(userId: string, addressId: string, today: string) {
  return db.transaction().execute(async (tx) => {
    const address = await requireAddress(tx, userId, addressId);

    const upcoming = await tx
      .selectFrom('meal_orders')
      .select(['id', 'service_date', 'slot'])
      .where('user_id', '=', userId)
      .where('address_id', '=', addressId)
      .where('service_date', '>=', today)
      .where((eb) => eb.or([eb('ops_status', 'is', null), eb('ops_status', 'in', ['preparing', 'out_for_delivery'])]))
      .orderBy('service_date')
      .execute();

    if (upcoming.length > 0) {
      throw new AppError(
        'VALIDATION_FAILED',
        'This address is used by upcoming deliveries. Change those deliveries first.',
        { affectedDeliveries: upcoming.map((o) => ({ date: o.service_date, slot: o.slot })) },
      );
    }

    if (address.is_default) {
      const replacement = await tx
        .selectFrom('addresses')
        .select('id')
        .where('user_id', '=', userId)
        .where('id', '!=', addressId)
        .where('deleted_at', 'is', null)
        .orderBy('created_at')
        .executeTakeFirst();
      if (!replacement) {
        throw new AppError('VALIDATION_FAILED', 'Add another address before deleting your default.');
      }
      await tx.updateTable('addresses').set({ is_default: false }).where('id', '=', addressId).execute();
      await tx.updateTable('addresses').set({ is_default: true }).where('id', '=', replacement.id).execute();
    }

    await tx
      .updateTable('addresses')
      .set({ deleted_at: new Date(), is_default: false })
      .where('id', '=', addressId)
      .execute();

    return { ok: true as const };
  });
}

async function countAddresses(tx: Executor, userId: string): Promise<number> {
  const row = await tx
    .selectFrom('addresses')
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

async function clearDefault(tx: Executor, userId: string): Promise<void> {
  await tx
    .updateTable('addresses')
    .set({ is_default: false })
    .where('user_id', '=', userId)
    .where('is_default', '=', true)
    .execute();
}

async function requireAddress(tx: Executor, userId: string, addressId: string) {
  const address = await tx
    .selectFrom('addresses')
    .selectAll()
    .where('id', '=', addressId)
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
  if (!address) throw new AppError('NOT_FOUND', 'Address not found.');
  return address;
}
