import { addDays, dayLabel, mediumDate, shortDate, weekdayOf } from '../platform/time.js';
import { HOME_COPY, interpolate, interpolateRequired, type CopyContext } from './copy.js';
import type { LifecycleSnapshot, MealOrderView } from './snapshot.js';
import type {
  AccountCondition,
  HomeNotice,
  HomePayload,
  HomePlanCard,
  HomeVariant,
  MealDisplayStatus,
  MealMarker,
  WeekDay,
} from './types.js';

/**
 * Exhaustive by type, not by convention: adding an AccountCondition without
 * deciding its Home variant is a compile error.
 *
 * `subscription_offline` is intentionally unreachable here — the server cannot know
 * it is unreachable. The client substitutes that variant itself.
 */
const VARIANT_BY_CONDITION: Record<AccountCondition, HomeVariant | null> = {
  SIGNED_OUT: null,
  AUTH_INCOMPLETE: null,
  ACCOUNT_BLOCKED: null,
  ONBOARDING_INCOMPLETE: null,
  TRIAL_PAYMENT_PENDING: 'trial_payment_pending',
  TRIAL_PAYMENT_FAILED: null,
  SUBSCRIPTION_PAYMENT_PENDING: null,
  SUBSCRIPTION_PAYMENT_FAILED: null,
  RENEWAL_FAILED: 'subscription_renewal_failed',
  DELIVERY_FAILED: 'subscription_delivery_failed',
  DELIVERY_DELAYED: 'subscription_delivery_delayed',
  TRIAL_SCHEDULED: 'trial_scheduled',
  TRIAL_ACTIVE_NO_SUBSCRIPTION: 'trial_active',
  TRIAL_ACTIVE_SUBSCRIPTION_PURCHASED: 'trial_subscription_purchased',
  TRIAL_COMPLETED_NO_SUBSCRIPTION: 'trial_completed',
  SUBSCRIPTION_SCHEDULED: 'subscription_scheduled',
  SUBSCRIPTION_ACTIVE: 'subscription_active',
  SUBSCRIPTION_NO_MEAL_TODAY: 'subscription_no_meal',
  SUBSCRIPTION_PAUSED: 'subscription_paused',
  SUBSCRIPTION_ENDING: 'subscription_ending',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
};

export function pickVariant(condition: AccountCondition): HomeVariant | null {
  return VARIANT_BY_CONDITION[condition];
}

/** Trial Home shows the five trial dates; subscriber Home shows a Mon–Sun week. */
function weekDates(s: LifecycleSnapshot, variant: HomeVariant): string[] {
  const isTrialHome = variant.startsWith('trial_');
  if (isTrialHome && s.trial && s.trial.serviceDates.length > 0) {
    return [...s.trial.serviceDates].sort();
  }
  const monday = addDays(s.today, -(weekdayOf(s.today) - 1));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

function displayStatus(
  order: MealOrderView,
  s: LifecycleSnapshot,
  variant: HomeVariant,
): MealDisplayStatus {
  switch (order.opsStatus) {
    case 'delivered':
      return 'delivered';
    case 'delayed':
      return 'delayed';
    case 'delivery_failed':
      return 'delivery_failed';
    case 'cancelled':
    case 'skipped':
      return 'inactive';
    case 'preparing':
    case 'out_for_delivery':
      return 'upcoming';
    case null:
      break;
  }

  // No operational fact recorded. State-level treatments win first — a paused or
  // ended plan greys its whole schedule rather than showing stale alerts.
  if (variant === 'subscription_paused') return 'paused';
  if (variant === 'subscription_expired') return 'inactive';

  // A past service date with no ops confirmation is a genuine data gap. Never
  // silently assume the meal was delivered.
  if (order.serviceDate < s.today) return 'issue';
  return 'upcoming';
}

const SLOT_ORDER: Record<'lunch' | 'dinner', number> = { lunch: 0, dinner: 1 };

export function buildWeek(s: LifecycleSnapshot, variant: HomeVariant): WeekDay[] {
  const dates = weekDates(s, variant);
  const selectedWeekdays = s.subscription?.selectedWeekdays ?? null;
  const isSubscriptionHome = variant.startsWith('subscription_');

  return dates.map((date) => {
    const orders = s.window
      .filter((order) => order.serviceDate === date)
      .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);

    const isDisabled =
      isSubscriptionHome && selectedWeekdays !== null
        ? !selectedWeekdays.includes(weekdayOf(date))
        : false;

    const markers: MealMarker[] = orders.map((order) => ({
      mealOrderId: order.id,
      slot: order.slot,
      foodType: order.foodType,
      status: isDisabled ? 'inactive' : displayStatus(order, s, variant),
      showRipple: false,
    }));

    return {
      date,
      dayLabel: dayLabel(date),
      shortDate: shortDate(date),
      isToday: date === s.today,
      isSelected: false,
      isDisabled,
      markers,
    };
  });
}

/**
 * At most one ripple per week strip: the first chronological marker that is still
 * actionable. Suppressed entirely for states where nothing is actionable, so a
 * paused or ended plan does not pulse at the user (handoff §11.2).
 */
export function applyRipple(week: WeekDay[], variant: HomeVariant): string | null {
  if (variant === 'subscription_paused' || variant === 'subscription_expired' || variant === 'subscription_offline') {
    return null;
  }
  for (const day of week) {
    if (day.isDisabled) continue;
    for (const marker of day.markers) {
      if (marker.status === 'upcoming' || marker.status === 'delayed') {
        marker.showRipple = true;
        return marker.mealOrderId;
      }
    }
  }
  return null;
}

/** The day the "next meal" card points at: first unfinished, else the last one. */
function selectDay(week: WeekDay[]): WeekDay | null {
  const actionable = week.find(
    (day) =>
      !day.isDisabled &&
      day.markers.some((marker) => marker.status !== 'delivered' && marker.status !== 'inactive'),
  );
  if (actionable) return actionable;
  const withMarkers = [...week].reverse().find((day) => day.markers.length > 0);
  return withMarkers ?? week[week.length - 1] ?? null;
}

function copyContext(s: LifecycleSnapshot): CopyContext {
  const affected = s.window.find(
    (order) => order.opsStatus === 'delayed' || order.opsStatus === 'delivery_failed',
  );
  const context: CopyContext = {};
  if (s.trial?.firstServiceDate) context.trialStartDate = mediumDate(s.trial.firstServiceDate);
  if (s.trial?.lastServiceDate) context.trialEndDate = mediumDate(s.trial.lastServiceDate);
  if (s.subscription) {
    context.subscriptionStartDate = mediumDate(s.subscription.startsOn);
    context.subscriptionEndDate = mediumDate(s.subscription.endsOn);
    context.planName = s.subscription.planName;
    if (s.subscription.pauseTo) context.resumeDate = mediumDate(addDays(s.subscription.pauseTo, 1));
  }
  if (affected) context.affectedDate = mediumDate(affected.serviceDate);
  return context;
}

function pickNotice(variant: HomeVariant, context: CopyContext): HomeNotice | null {
  switch (variant) {
    case 'trial_payment_pending':
      return {
        title: 'Check Payment Status',
        body: 'Return to payment status to see whether your trial payment is confirmed.',
        tone: 'orange',
        action: 'Check Payment Status',
      };
    case 'subscription_delivery_delayed':
      return {
        title: 'Delivery delayed',
        body: interpolateRequired(
          'The {affectedDate} delivery is delayed. The remaining selected delivery days are unchanged.',
          context,
          'A delivery is delayed. The remaining selected delivery days are unchanged.',
        ),
        tone: 'orange',
      };
    case 'subscription_delivery_failed':
      return {
        title: 'Delivery needs attention',
        body: interpolateRequired(
          'Check the {affectedDate} delivery address or contact support to resolve it.',
          context,
          'Check the delivery address or contact support to resolve it.',
        ),
        tone: 'red',
      };
    case 'subscription_ending':
      return {
        title: interpolateRequired(
          'Plan active until {subscriptionEndDate}',
          context,
          'Plan ending soon',
        ),
        body: 'Meals already included in your plan continue as scheduled.',
        tone: 'purple',
        action: 'Re-subscribe to this plan',
      };
    default:
      return null;
  }
}

function pickPlanCard(variant: HomeVariant): HomePlanCard | null {
  switch (variant) {
    case 'subscription_expired':
      return {
        title: 'Restart your healthy meal routine',
        description:
          'Choose a new plan while keeping your saved preferences and nutrition history.',
        buttonLabel: 'Renew Subscription',
      };
    case 'subscription_renewal_failed':
      return {
        title: 'Payment needs attention',
        description: 'Update your payment method to keep future subscription weeks active.',
        buttonLabel: 'Update Payment',
      };
    case 'subscription_paused':
      return {
        title: 'Your plan is paused',
        description:
          'Your preferences and selected weekly schedule are saved until deliveries resume.',
        buttonLabel: 'Manage My Plan',
      };
    default:
      return null;
  }
}

export function buildHome(s: LifecycleSnapshot, condition: AccountCondition): HomePayload | null {
  const variant = pickVariant(condition);
  if (!variant) return null;

  const week = buildWeek(s, variant);
  applyRipple(week, variant);

  const selected = selectDay(week);
  if (selected) selected.isSelected = true;

  const context = copyContext(s);
  const template = HOME_COPY[variant];

  return {
    variant,
    eyebrow: template.eyebrow,
    title: template.title,
    description: interpolateRequired(
      template.description,
      context,
      template.descriptionFallback ?? template.description,
    ),
    caption: interpolate(template.caption, context),
    selectedLabel: template.selectedLabel,
    selectedDate: selected?.date ?? null,
    week,
    notice: pickNotice(variant, context),
    planCard: pickPlanCard(variant),
  };
}
