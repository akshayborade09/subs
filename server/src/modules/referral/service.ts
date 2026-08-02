import { db, type Tx } from '../../platform/db/index.js';
import { policy } from '../../platform/config/policy.js';
import { AppError } from '../../platform/errors.js';
import { emit } from '../../platform/outbox.js';
import { addDays, todayIn } from '../../platform/time.js';

/** "A•••••" — spec §13.2 allows only privacy-safe friend details. */
function maskName(name: string | null): string {
  if (!name) return 'A friend';
  const first = name.trim()[0] ?? 'A';
  return `${first.toUpperCase()}${'•'.repeat(5)}`;
}

export async function getReferralOverview(userId: string) {
  const user = await db
    .selectFrom('users')
    .select('referral_code')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();

  const history = await db
    .selectFrom('referrals')
    .leftJoin('users', 'users.id', 'referrals.referred_user_id')
    .select([
      'referrals.id',
      'referrals.status',
      'referrals.created_at',
      'referrals.qualified_at',
      'users.full_name',
    ])
    .where('referrals.referrer_user_id', '=', userId)
    .orderBy('referrals.created_at', 'desc')
    .execute();

  return {
    code: user.referral_code,
    shareMessage:
      `Try Healthy Tiffins with my code ${user.referral_code} — home-style meals delivered daily.`,
    howItWorks: [
      'Share your code with a friend.',
      'They sign up and complete their first payment.',
      'Your reward unlocks — a free meal day.',
    ],
    referrals: history.map((row) => ({
      id: row.id,
      friend: maskName(row.full_name),
      status: row.status,
      // Only qualification is meaningful to the referrer; signup alone earns nothing.
      qualifiedAt: row.qualified_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    })),
    qualifiedCount: history.filter((row) => row.status === 'qualified' || row.status === 'rewarded')
      .length,
  };
}

/**
 * Links a new signup to whoever referred them. Attribution only — no reward is
 * issued here, because spec §13.1 is explicit that account creation alone must
 * never pay out.
 */
export async function attributeReferral(
  tx: Tx,
  referredUserId: string,
  code: string,
): Promise<'attributed' | 'self_referral' | 'unknown_code' | 'already_attributed'> {
  const referrer = await tx
    .selectFrom('users')
    .select('id')
    .where('referral_code', '=', code.trim().toUpperCase())
    .executeTakeFirst();

  if (!referrer) return 'unknown_code';
  if (referrer.id === referredUserId) return 'self_referral';

  const inserted = await tx
    .insertInto('referrals')
    .values({
      referrer_user_id: referrer.id,
      referred_user_id: referredUserId,
      code: code.trim().toUpperCase(),
      status: 'signed_up',
    })
    .onConflict((oc) => oc.doNothing())
    .returning('id')
    .executeTakeFirst();

  return inserted ? 'attributed' : 'already_attributed';
}

/**
 * Called when a referred user's first payment captures. Moves the referral to
 * qualified and issues the referrer's reward, once.
 */
export async function qualifyReferral(tx: Tx, referredUserId: string): Promise<boolean> {
  const referral = await tx
    .selectFrom('referrals')
    .selectAll()
    .where('referred_user_id', '=', referredUserId)
    .where('status', 'in', ['signed_up', 'payment_pending'])
    .forUpdate()
    .executeTakeFirst();

  if (!referral) return false;

  const today = todayIn(new Date());
  const reward = await tx
    .insertInto('rewards')
    .values({
      user_id: referral.referrer_user_id,
      type: 'free_meal_day',
      source: 'referral',
      status: 'earned',
      expires_on: addDays(today, policy.loyalty.rewardExpiryDays),
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await tx
    .updateTable('referrals')
    .set({
      status: 'rewarded',
      qualified_at: new Date(),
      rewarded_at: new Date(),
      reward_id: reward.id,
    })
    .where('id', '=', referral.id)
    .execute();

  await emit(tx, {
    eventName: 'referral.qualified',
    aggregateType: 'reward',
    aggregateId: reward.id,
    userId: referral.referrer_user_id,
    payload: { referralId: referral.id, referredUserId },
  });

  return true;
}

export async function applyReferralCode(userId: string, code: string) {
  return db.transaction().execute(async (tx) => {
    const alreadyPaid = await tx
      .selectFrom('checkout_sessions')
      .select('id')
      .where('user_id', '=', userId)
      .where('step', '=', 'payment_success')
      .executeTakeFirst();
    if (alreadyPaid) {
      throw new AppError('VALIDATION_FAILED', 'A referral code can only be added before your first payment.');
    }

    const outcome = await attributeReferral(tx, userId, code);
    if (outcome === 'self_referral') {
      throw new AppError('VALIDATION_FAILED', 'You cannot use your own referral code.');
    }
    if (outcome === 'unknown_code') {
      throw new AppError('VALIDATION_FAILED', 'That referral code does not exist.');
    }
    if (outcome === 'already_attributed') {
      throw new AppError('VALIDATION_FAILED', 'A referral code has already been applied.');
    }

    return { status: 'attributed' as const };
  });
}
