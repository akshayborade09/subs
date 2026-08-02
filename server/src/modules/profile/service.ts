import { db } from '../../platform/db/index.js';
import { AppError } from '../../platform/errors.js';
import { todayIn } from '../../platform/time.js';
import { buildHome } from '../../lifecycle/home.js';
import { loadSnapshot } from '../../lifecycle/load.js';
import { resolveCondition } from '../../lifecycle/rules.js';
import type { AccountCondition } from '../../lifecycle/types.js';
import type { AuthContext } from '../../http/auth-plugin.js';

/**
 * The label in the profile header (spec §6.1). Derived from the same resolver the
 * Home screen uses, so the two can never disagree about what plan someone is on.
 */
const PLAN_LABEL: Record<AccountCondition, string> = {
  SIGNED_OUT: 'No Active Plan',
  AUTH_INCOMPLETE: 'No Active Plan',
  ACCOUNT_BLOCKED: 'No Active Plan',
  ONBOARDING_INCOMPLETE: 'No Active Plan',
  TRIAL_PAYMENT_PENDING: 'Trial',
  TRIAL_PAYMENT_FAILED: 'Trial',
  SUBSCRIPTION_PAYMENT_PENDING: 'No Active Plan',
  SUBSCRIPTION_PAYMENT_FAILED: 'No Active Plan',
  RENEWAL_FAILED: 'Active Subscription',
  DELIVERY_FAILED: 'Active Subscription',
  DELIVERY_DELAYED: 'Active Subscription',
  TRIAL_SCHEDULED: 'Trial',
  TRIAL_ACTIVE_NO_SUBSCRIPTION: 'Trial',
  TRIAL_ACTIVE_SUBSCRIPTION_PURCHASED: 'Trial',
  TRIAL_COMPLETED_NO_SUBSCRIPTION: 'No Active Plan',
  SUBSCRIPTION_SCHEDULED: 'Active Subscription',
  SUBSCRIPTION_ACTIVE: 'Active Subscription',
  SUBSCRIPTION_NO_MEAL_TODAY: 'Active Subscription',
  SUBSCRIPTION_PAUSED: 'Active Subscription',
  SUBSCRIPTION_ENDING: 'Subscription Ending',
  SUBSCRIPTION_EXPIRED: 'No Active Plan',
};

/** Where "My Plan" should go, which depends on what the user actually has (§6.3). */
function planDestination(condition: AccountCondition): string {
  if (condition.startsWith('TRIAL_')) return 'trial_details';
  if (condition === 'SUBSCRIPTION_EXPIRED') return 'plan_history';
  if (condition.startsWith('SUBSCRIPTION_') || condition === 'RENEWAL_FAILED') return 'my_plan';
  return 'choose_subscription';
}

export async function getProfileHub(auth: AuthContext) {
  const snapshot = await loadSnapshot(auth);
  const resolution = resolveCondition(snapshot);

  const [user, unread, addressCount, rewardCount] = await Promise.all([
    db
      .selectFrom('users')
      .select(['id', 'full_name', 'phone_country_code', 'phone_number', 'referral_code'])
      .where('id', '=', auth.userId)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('notifications')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('user_id', '=', auth.userId)
      .where('read_at', 'is', null)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('addresses')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('user_id', '=', auth.userId)
      .where('deleted_at', 'is', null)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('rewards')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('user_id', '=', auth.userId)
      .where('status', '=', 'earned')
      .executeTakeFirstOrThrow(),
  ]);

  return {
    name: user.full_name,
    phoneNumberMasked: `${user.phone_country_code} ${'•'.repeat(6)}${user.phone_number.slice(-4)}`,
    lifecycleLabel: PLAN_LABEL[resolution.condition],
    planDestination: planDestination(resolution.condition),
    referralCode: user.referral_code,
    unreadNotifications: Number(unread.count),
    savedAddresses: Number(addressCount.count),
    availableRewards: Number(rewardCount.count),
  };
}

export async function getNotificationPreferences(userId: string) {
  const row = await db
    .selectFrom('notification_preferences')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return (
    row ??
    db
      .insertInto('notification_preferences')
      .values({ user_id: userId })
      .returningAll()
      .executeTakeFirstOrThrow()
  );
}

export type PreferencePatch = {
  reminders?: boolean;
  nutrition?: boolean;
  rewards?: boolean;
  offers?: boolean;
  delivery?: boolean;
  payment?: boolean;
  leaderboardOptIn?: boolean;
  appearance?: 'system' | 'light' | 'dark';
};

/**
 * Delivery and payment are operational channels. Spec §11.2 forbids switching
 * them off while there are deliveries that depend on them, so the attempt is
 * rejected with an explanation rather than silently ignored.
 */
export async function updateNotificationPreferences(userId: string, patch: PreferencePatch) {
  if (patch.delivery === false || patch.payment === false) {
    const today = todayIn(new Date());
    const upcoming = await db
      .selectFrom('meal_orders')
      .select('id')
      .where('user_id', '=', userId)
      .where('service_date', '>=', today)
      .where((eb) =>
        eb.or([eb('ops_status', 'is', null), eb('ops_status', 'in', ['preparing', 'out_for_delivery'])]),
      )
      .executeTakeFirst();

    if (upcoming) {
      throw new AppError(
        'VALIDATION_FAILED',
        'Delivery and payment alerts stay on while you have upcoming meals.',
        { channel: patch.delivery === false ? 'delivery' : 'payment' },
      );
    }
  }

  await getNotificationPreferences(userId);
  return db
    .updateTable('notification_preferences')
    .set({
      ...(patch.reminders !== undefined ? { reminders: patch.reminders } : {}),
      ...(patch.nutrition !== undefined ? { nutrition: patch.nutrition } : {}),
      ...(patch.rewards !== undefined ? { rewards: patch.rewards } : {}),
      ...(patch.offers !== undefined ? { offers: patch.offers } : {}),
      ...(patch.delivery !== undefined ? { delivery: patch.delivery } : {}),
      ...(patch.payment !== undefined ? { payment: patch.payment } : {}),
      ...(patch.leaderboardOptIn !== undefined ? { leaderboard_opt_in: patch.leaderboardOptIn } : {}),
      ...(patch.appearance !== undefined ? { appearance: patch.appearance } : {}),
    })
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function listNotifications(userId: string, limit = 50) {
  return db
    .selectFrom('notifications')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .execute();
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
  let query = db
    .updateTable('notifications')
    .set({ read_at: new Date() })
    .where('user_id', '=', userId)
    .where('read_at', 'is', null);
  if (ids && ids.length > 0) query = query.where('id', 'in', ids);

  const updated = await query.returning('id').execute();
  return updated.length;
}

/** Used by the profile header to show a plan snapshot without a second call. */
export async function getHomeSnapshotLabel(auth: AuthContext): Promise<string | null> {
  const snapshot = await loadSnapshot(auth);
  const resolution = resolveCondition(snapshot);
  return buildHome(snapshot, resolution.condition)?.caption ?? null;
}
