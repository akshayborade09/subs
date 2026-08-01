import { db } from '../platform/db/index.js';
import { addDays, todayIn } from '../platform/time.js';
import type { LifecycleSnapshot, MealOrderView } from './snapshot.js';
import type { AuthContext } from '../http/auth-plugin.js';

/** How much of the calendar the Home screen can possibly need. */
const WINDOW_BEFORE_DAYS = 7;
const WINDOW_AFTER_DAYS = 14;

/**
 * Four queries, no cross-module joins. Everything after this point is a pure
 * function over JSON — which is why all 39 states are unit-testable without a
 * database.
 */
export async function loadSnapshot(
  auth: AuthContext | undefined,
  now: Date = new Date(),
): Promise<LifecycleSnapshot> {
  const today = todayIn(now);
  const base: LifecycleSnapshot = {
    now: now.toISOString(),
    today,
    session: null,
    user: null,
    onboarding: null,
    trial: null,
    subscription: null,
    pendingCheckout: null,
    window: [],
  };

  if (!auth) return base;

  const [user, onboarding, trial, subscriptionRow, pendingCheckout, orders] = await Promise.all([
    db.selectFrom('users').select(['id', 'full_name', 'status']).where('id', '=', auth.userId).executeTakeFirst(),

    db
      .selectFrom('onboarding_drafts')
      .select(['status', 'last_completed_step', 'resume_step'])
      .where('user_id', '=', auth.userId)
      .executeTakeFirst(),

    db
      .selectFrom('trials')
      .select([
        'id',
        'status',
        'first_service_date',
        'last_service_date',
        'service_dates',
        'schedule_version',
      ])
      .where('user_id', '=', auth.userId)
      .where('status', '!=', 'cancelled')
      .executeTakeFirst(),

    db
      .selectFrom('subscriptions')
      .innerJoin('subscription_plans', 'subscription_plans.id', 'subscriptions.plan_id')
      .select([
        'subscriptions.id',
        'subscriptions.status',
        'subscriptions.starts_on',
        'subscriptions.ends_on',
        'subscriptions.pause_from',
        'subscriptions.pause_to',
        'subscriptions.renewal_failed_at',
        'subscriptions.renewal_failure_resolved_at',
        'subscriptions.selected_weekdays',
        'subscriptions.meal_preference',
        'subscriptions.food_preference',
        'subscriptions.schedule_version',
        'subscription_plans.code as plan_code',
        'subscription_plans.name as plan_name',
      ])
      .where('subscriptions.user_id', '=', auth.userId)
      .where('subscriptions.status', '!=', 'terminated')
      .orderBy('subscriptions.created_at', 'desc')
      .executeTakeFirst(),

    db
      .selectFrom('checkout_sessions')
      .select(['id', 'kind', 'step', 'source_type', 'source_id'])
      .where('user_id', '=', auth.userId)
      .where('step', 'in', ['review', 'payment_method_required', 'payment_pending', 'payment_failed'])
      .orderBy('created_at', 'desc')
      .executeTakeFirst(),

    db
      .selectFrom('meal_orders')
      .select(['id', 'service_date', 'slot', 'food_type', 'ops_status', 'source_type', 'rescheduled_from'])
      .where('user_id', '=', auth.userId)
      .where('service_date', '>=', addDays(today, -WINDOW_BEFORE_DAYS))
      .where('service_date', '<=', addDays(today, WINDOW_AFTER_DAYS))
      .orderBy('service_date')
      .orderBy('slot')
      .execute(),
  ]);

  const window: MealOrderView[] = orders.map((order) => ({
    id: order.id,
    serviceDate: order.service_date,
    slot: order.slot,
    foodType: order.food_type,
    opsStatus: order.ops_status,
    sourceType: order.source_type,
    rescheduledFrom: order.rescheduled_from,
  }));

  return {
    ...base,
    session: { authenticated: true, phoneVerified: auth.phoneVerified },
    user: user ? { id: user.id, fullName: user.full_name, status: user.status } : null,
    onboarding: onboarding
      ? {
          status: onboarding.status,
          lastCompletedStep: onboarding.last_completed_step,
          resumeStep: onboarding.resume_step,
        }
      : null,
    trial: trial
      ? {
          id: trial.id,
          status: trial.status,
          firstServiceDate: trial.first_service_date,
          lastServiceDate: trial.last_service_date,
          serviceDates: trial.service_dates,
          scheduleVersion: trial.schedule_version,
        }
      : null,
    subscription: subscriptionRow
      ? {
          id: subscriptionRow.id,
          planCode: subscriptionRow.plan_code,
          planName: subscriptionRow.plan_name,
          status: subscriptionRow.status,
          startsOn: subscriptionRow.starts_on,
          endsOn: subscriptionRow.ends_on,
          pauseFrom: subscriptionRow.pause_from,
          pauseTo: subscriptionRow.pause_to,
          renewalFailedAt: subscriptionRow.renewal_failed_at?.toISOString() ?? null,
          renewalFailureResolvedAt:
            subscriptionRow.renewal_failure_resolved_at?.toISOString() ?? null,
          selectedWeekdays: subscriptionRow.selected_weekdays,
          mealPreference: subscriptionRow.meal_preference,
          foodPreference: subscriptionRow.food_preference,
          scheduleVersion: subscriptionRow.schedule_version,
        }
      : null,
    pendingCheckout: pendingCheckout
      ? {
          id: pendingCheckout.id,
          kind: pendingCheckout.kind,
          step: pendingCheckout.step,
          sourceType: pendingCheckout.source_type,
          sourceId: pendingCheckout.source_id,
        }
      : null,
    window,
  };
}
