import { db, type Executor } from '../../platform/db/index.js';
import { policy } from '../../platform/config/policy.js';
import { AppError } from '../../platform/errors.js';
import { assertPlainDate } from '../../platform/time.js';
import type {
  FoodPreference,
  FoodType,
  MealPreference,
  MealSlot,
  OnboardingStep,
} from '../../platform/db/types.js';

export type DailyMealChoice = { lunch: FoodType | null; dinner: FoodType | null };

/** The active trial for a user, or null. Cancelled trials are ignored. */
export async function getTrial(userId: string, tx: Executor = db) {
  return tx
    .selectFrom('trials')
    .selectAll()
    .where('user_id', '=', userId)
    .where('status', '!=', 'cancelled')
    .executeTakeFirst();
}

export async function ensureDraft(userId: string) {
  const existing = await getTrial(userId);
  if (existing) return existing;
  return db
    .insertInto('trials')
    .values({ user_id: userId, status: 'draft', price_paise: policy.trial.pricePaise })
    .returningAll()
    .executeTakeFirstOrThrow();
}

async function requireDraft(userId: string, tx: Executor = db) {
  const trial = await getTrial(userId, tx);
  if (!trial) throw new AppError('NOT_FOUND', 'Start your trial setup first.');
  if (trial.status !== 'draft') {
    throw new AppError(
      'CHECKOUT_INVALID_STATE',
      'This trial has already been submitted for payment and can no longer be edited.',
    );
  }
  return trial;
}

export type TrialPreferencesInput = {
  foodPreference: FoodPreference;
  mealPreference: MealPreference;
  breadPreference: string;
  ricePreference: string;
  dailyMeals?: DailyMealChoice[];
};

export async function updatePreferences(userId: string, input: TrialPreferencesInput) {
  const trial = await requireDraft(userId);

  // "Mix of both" is the only mode where per-day choices are meaningful, and every
  // selected slot must be filled before checkout (mirrors the mixMeals wizard step).
  if (input.foodPreference === 'mix') {
    const choices = input.dailyMeals ?? [];
    if (choices.length !== policy.trial.requiredDays) {
      throw new AppError(
        'VALIDATION_FAILED',
        `Choose vegetarian or non-vegetarian for each of your ${policy.trial.requiredDays} trial days.`,
      );
    }
    const needsLunch = input.mealPreference !== 'dinner';
    const needsDinner = input.mealPreference !== 'lunch';
    const incomplete = choices.some(
      (day) => (needsLunch && !day.lunch) || (needsDinner && !day.dinner),
    );
    if (incomplete) {
      throw new AppError('VALIDATION_FAILED', 'Every selected meal needs a food type.');
    }
  }

  return db
    .updateTable('trials')
    .set({
      food_preference: input.foodPreference,
      meal_preference: input.mealPreference,
      bread_preference: input.breadPreference,
      rice_preference: input.ricePreference,
      daily_meals: input.foodPreference === 'mix' ? (input.dailyMeals ?? []) : [],
    })
    .where('id', '=', trial.id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateDates(userId: string, dates: string[], today: string) {
  const trial = await requireDraft(userId);

  const unique = [...new Set(dates.map(assertPlainDate))].sort();
  if (unique.length !== policy.trial.requiredDays) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Choose exactly ${policy.trial.requiredDays} delivery dates.`,
    );
  }
  if (unique[0]! <= today) {
    throw new AppError('VALIDATION_FAILED', 'Trial deliveries must start from tomorrow onwards.');
  }

  return db
    .updateTable('trials')
    .set({
      service_dates: unique,
      first_service_date: unique[0]!,
      last_service_date: unique[unique.length - 1]!,
    })
    .where('id', '=', trial.id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateAddress(userId: string, addressId: string) {
  const trial = await requireDraft(userId);

  const address = await db
    .selectFrom('addresses')
    .selectAll()
    .where('id', '=', addressId)
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!address) throw new AppError('NOT_FOUND', 'Address not found.');
  if (!address.is_serviceable) {
    throw new AppError(
      'PINCODE_NOT_SERVICEABLE',
      `We do not deliver to ${address.pincode} yet. Choose another address.`,
    );
  }

  return db
    .updateTable('trials')
    .set({ address_id: addressId })
    .where('id', '=', trial.id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export type TrialReview = {
  trialId: string;
  status: string;
  serviceDates: string[];
  mealPreference: MealPreference | null;
  foodPreference: FoodPreference | null;
  breadPreference: string | null;
  ricePreference: string | null;
  address: { id: string; line1: string; pincode: string; label: string } | null;
  pricePaise: number;
  totalPayablePaise: number;
  ready: boolean;
  missing: string[];
};

export async function reviewTrial(userId: string): Promise<TrialReview> {
  const trial = await getTrial(userId);
  if (!trial) throw new AppError('NOT_FOUND', 'Start your trial setup first.');

  const address = trial.address_id
    ? await db
        .selectFrom('addresses')
        .select(['id', 'line1', 'pincode', 'label'])
        .where('id', '=', trial.address_id)
        .executeTakeFirst()
    : undefined;

  const missing: string[] = [];
  if (!trial.food_preference) missing.push('foodPreference');
  if (!trial.meal_preference) missing.push('mealPreference');
  if (!trial.bread_preference) missing.push('breadPreference');
  if (!trial.rice_preference) missing.push('ricePreference');
  if (trial.service_dates.length !== policy.trial.requiredDays) missing.push('serviceDates');
  if (!address) missing.push('address');

  return {
    trialId: trial.id,
    status: trial.status,
    serviceDates: trial.service_dates,
    mealPreference: trial.meal_preference,
    foodPreference: trial.food_preference,
    breadPreference: trial.bread_preference,
    ricePreference: trial.rice_preference,
    address: address ?? null,
    pricePaise: trial.price_paise,
    totalPayablePaise: trial.price_paise,
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Expands the trial's preferences into concrete meal orders. Called inside the
 * payment-success transaction, so ON CONFLICT DO NOTHING makes a webhook retry a
 * no-op rather than a duplicate schedule.
 */
export async function materializeTrialOrders(tx: Executor, trialId: string): Promise<number> {
  const trial = await tx
    .selectFrom('trials')
    .selectAll()
    .where('id', '=', trialId)
    .executeTakeFirstOrThrow();

  if (!trial.address_id || !trial.meal_preference || !trial.food_preference) {
    throw new AppError('CHECKOUT_INVALID_STATE', 'Trial is missing setup required to schedule meals.');
  }

  const slots: MealSlot[] =
    trial.meal_preference === 'both' ? ['lunch', 'dinner'] : [trial.meal_preference];
  const dailyMeals = trial.daily_meals as DailyMealChoice[];

  const rows = trial.service_dates.flatMap((date, dayIndex) =>
    slots.map((slot) => ({
      user_id: trial.user_id,
      source_type: 'trial' as const,
      source_id: trial.id,
      service_date: date,
      slot,
      food_type: resolveFoodType(trial.food_preference!, dailyMeals[dayIndex], slot),
      bread_preference: trial.bread_preference ?? 'any',
      rice_preference: trial.rice_preference ?? 'any',
      address_id: trial.address_id!,
    })),
  );

  if (rows.length === 0) return 0;

  const inserted = await tx
    .insertInto('meal_orders')
    .values(rows)
    .onConflict((oc) =>
      oc.columns(['source_type', 'source_id', 'service_date', 'slot']).doNothing(),
    )
    .returning('id')
    .execute();

  return inserted.length;
}

function resolveFoodType(
  preference: FoodPreference,
  day: DailyMealChoice | undefined,
  slot: MealSlot,
): FoodType {
  if (preference !== 'mix') return preference;
  return day?.[slot] ?? 'vegetarian';
}
