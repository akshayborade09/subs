import { useCallback, useReducer } from 'react';
import {
  formatCutoffTime,
  isBeforeMealModificationCutoff,
  isBeforeModificationCutoffForDeliveryDay,
  mealModificationCutoff,
} from './mealConfig';

export type MealPreferenceValue = 'Vegetarian' | 'Non-vegetarian' | 'Mix of both';

export type MealSlot = 'lunch' | 'dinner';

export type MealAddressOverride = {
  text: string;
  pincode?: string;
  label?: string;
  savedAddressId?: string;
};

export type MealDetailActionId =
  | 'changeAddress'
  | 'changeMealPreference'
  | 'skipMeal'
  | 'reportIssue';

export type MealDetailPhase =
  | 'viewing'
  | 'editingAddress'
  | 'checkingPincode'
  | 'addressAvailable'
  | 'addressUnavailable'
  | 'editingMealPreference'
  | 'confirmingSkip'
  | 'skippingMeal'
  | 'skipped'
  | 'undoingSkip'
  | 'reportingIssue';

export type MealDetailEvent =
  | { type: 'CHANGE_ADDRESS' }
  | { type: 'ADDRESS_UPDATED' }
  | { type: 'CHECK_PINCODE' }
  | { type: 'PINCODE_AVAILABLE' }
  | { type: 'PINCODE_UNAVAILABLE' }
  | { type: 'CHANGE_MEAL_PREFERENCE' }
  | { type: 'MEAL_PREFERENCE_UPDATED' }
  | { type: 'SKIP_MEAL' }
  | { type: 'CONFIRM_SKIP' }
  | { type: 'MEAL_SKIPPED' }
  | { type: 'UNDO_SKIP' }
  | { type: 'MEAL_SKIP_UNDONE' }
  | { type: 'REPORT_ISSUE' }
  | { type: 'CLOSE_FLOW' }
  | { type: 'CUTOFF_REACHED' };

export type SkipMetadata = {
  originalDeliveryDate: string;
  previousStatus: string;
  previousSubscriptionEndDate: string;
  extendedSubscriptionEndDate: string;
  date: string;
  dayLabel: string;
  shortDate: string;
  skippedSlot: MealSlot;
  previousMarkerStatus: string;
  mealPreferenceOverride?: MealPreferenceValue;
  deliveryAddressOverride?: MealAddressOverride;
};

export type MealMarkerState = {
  foodPreference: string;
  status: string;
  slot?: MealSlot;
  skipMetadata?: SkipMetadata;
};

type MealDetailState = {
  phase: MealDetailPhase;
};

export type MealDetailGuardMeal = {
  status: string;
  date: string;
  isSkipped?: boolean;
  skipMetadata?: SkipMetadata;
  mealMarkers?: MealMarkerState[];
  deliveryAddressOverride?: MealAddressOverride;
  mealPreferenceOverride?: string;
  address: string;
  foodPreference: string;
};

export type MealDetailGuardContext = {
  meal: MealDetailGuardMeal;
  isSubscriptionMeal: boolean;
  isTrialMeal: boolean;
  mealSlot?: MealSlot;
  planBoth?: boolean;
  now?: Date;
  cutoff?: string;
};

export function mealSlotIndex(slot: MealSlot): number {
  return slot === 'lunch' ? 0 : 1;
}

export function markerIndexFromMarkers(markers: MealMarkerState[] | undefined, slot: MealSlot): number {
  if (markers?.length) {
    const found = markers.findIndex((marker) => marker.slot === slot);
    if (found >= 0) return found;
    if (markers.length === 1) return 0;
  }
  return mealSlotIndex(slot);
}

export function markerIndexForSlot(meal: MealDetailGuardMeal, slot: MealSlot): number {
  return markerIndexFromMarkers(meal.mealMarkers, slot);
}

export function slotLabel(slot: MealSlot): 'Lunch' | 'Dinner' {
  return slot === 'lunch' ? 'Lunch' : 'Dinner';
}

export function isSlotSkipped(meal: MealDetailGuardMeal, slot?: MealSlot): boolean {
  if (slot && meal.mealMarkers?.length) {
    return meal.mealMarkers[markerIndexForSlot(meal, slot)]?.status === 'skipped';
  }
  return isSkippedMeal(meal);
}

export function isFullySkipped(meal: MealDetailGuardMeal): boolean {
  if (meal.mealMarkers?.length) {
    return meal.mealMarkers.every((marker) => marker.status === 'skipped');
  }
  return isSkippedMeal(meal);
}

export function skipMetadataForSlot(meal: MealDetailGuardMeal, slot: MealSlot): SkipMetadata | undefined {
  return meal.mealMarkers?.[markerIndexForSlot(meal, slot)]?.skipMetadata;
}

const initialMealDetailState: MealDetailState = { phase: 'viewing' };

function mealDetailReducer(state: MealDetailState, event: MealDetailEvent): MealDetailState {
  switch (event.type) {
    case 'CHANGE_ADDRESS':
      return { phase: 'editingAddress' };
    case 'CHECK_PINCODE':
      return { phase: 'checkingPincode' };
    case 'PINCODE_AVAILABLE':
      return { phase: 'addressAvailable' };
    case 'PINCODE_UNAVAILABLE':
      return { phase: 'addressUnavailable' };
    case 'ADDRESS_UPDATED':
      return { phase: 'viewing' };
    case 'CHANGE_MEAL_PREFERENCE':
      return { phase: 'editingMealPreference' };
    case 'MEAL_PREFERENCE_UPDATED':
      return { phase: 'viewing' };
    case 'SKIP_MEAL':
      return { phase: 'confirmingSkip' };
    case 'CONFIRM_SKIP':
      return { phase: 'skippingMeal' };
    case 'MEAL_SKIPPED':
      return { phase: 'skipped' };
    case 'UNDO_SKIP':
      return { phase: 'undoingSkip' };
    case 'MEAL_SKIP_UNDONE':
      return { phase: 'viewing' };
    case 'REPORT_ISSUE':
      return { phase: 'reportingIssue' };
    case 'CLOSE_FLOW':
      return state.phase === 'skipped' || state.phase === 'undoingSkip' ? state : { phase: 'viewing' };
    case 'CUTOFF_REACHED':
      return state;
    default:
      return state;
  }
}

export function useMealDetailMachine() {
  const [state, dispatch] = useReducer(mealDetailReducer, initialMealDetailState);

  const send = useCallback((event: MealDetailEvent) => {
    dispatch(event);
  }, []);

  const closeFlow = useCallback(() => {
    dispatch({ type: 'CLOSE_FLOW' });
  }, []);

  return { phase: state.phase, send, closeFlow };
}

export function parseMealDate(mealDate: string, referenceYear = new Date().getFullYear()): Date {
  const parsed = new Date(`${mealDate} ${referenceYear}`);
  if (Number.isNaN(parsed.getTime())) return new Date(`${mealDate} 2026`);
  return parsed;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isFutureMeal(meal: MealDetailGuardMeal, now = new Date()): boolean {
  if (meal.isSkipped || meal.status === 'skipped' || meal.status === 'delivered' || meal.status === 'delivery_failed' || meal.status === 'issue') {
    return false;
  }
  const today = startOfDay(now);
  const mealDay = startOfDay(parseMealDate(meal.date, now.getFullYear()));
  return mealDay.getTime() >= today.getTime() && (meal.status === 'upcoming' || meal.status === 'delayed' || meal.status === 'paused');
}

export function isTomorrowMeal(meal: MealDetailGuardMeal, now = new Date()): boolean {
  const today = startOfDay(now);
  const mealDay = startOfDay(parseMealDate(meal.date, now.getFullYear()));
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return mealDay.getTime() === tomorrow.getTime();
}

export function isBeforeCutoffForMeal(ctx: MealDetailGuardContext): boolean {
  return isBeforeMealModificationCutoff(ctx.now ?? new Date(), ctx.cutoff ?? mealModificationCutoff);
}

export function isSkippedMeal(meal: MealDetailGuardMeal): boolean {
  return !!meal.isSkipped || meal.status === 'skipped';
}

function skipMetadataForUndo(ctx: MealDetailGuardContext): SkipMetadata | undefined {
  if (ctx.mealSlot) {
    const slotMetadata = skipMetadataForSlot(ctx.meal, ctx.mealSlot);
    if (slotMetadata) return slotMetadata;
  }
  return ctx.meal.skipMetadata;
}

function isSkippedForUndo(ctx: MealDetailGuardContext): boolean {
  if (ctx.planBoth && ctx.mealSlot) return isSlotSkipped(ctx.meal, ctx.mealSlot);
  return isSkippedMeal(ctx.meal);
}

function isBeforeUndoCutoffForMeal(ctx: MealDetailGuardContext): boolean {
  const now = ctx.now ?? new Date();
  const deliveryDay = parseMealDate(ctx.meal.date, now.getFullYear());
  return isBeforeModificationCutoffForDeliveryDay(deliveryDay, now, ctx.cutoff ?? mealModificationCutoff);
}

export function canUndoSkip(ctx: MealDetailGuardContext): boolean {
  if (!ctx.isSubscriptionMeal) return false;
  if (!isSkippedForUndo(ctx)) return false;
  if (!skipMetadataForUndo(ctx)) return false;
  return isBeforeUndoCutoffForMeal(ctx);
}

export function canChangeAddress(ctx: MealDetailGuardContext): boolean {
  if (!ctx.isSubscriptionMeal || !isFutureMeal(ctx.meal, ctx.now)) return false;
  if (isFullySkipped(ctx.meal)) return false;
  if (ctx.planBoth && ctx.mealSlot && isSlotSkipped(ctx.meal, ctx.mealSlot)) return false;
  if (isTomorrowMeal(ctx.meal, ctx.now)) return isBeforeCutoffForMeal(ctx);
  return true;
}

export function canChangeMealPreference(ctx: MealDetailGuardContext): boolean {
  return canChangeAddress(ctx);
}

export function canSkipMeal(ctx: MealDetailGuardContext): boolean {
  if (!ctx.isSubscriptionMeal || !isFutureMeal(ctx.meal, ctx.now)) return false;
  if (ctx.planBoth && ctx.mealSlot) {
    if (isSlotSkipped(ctx.meal, ctx.mealSlot)) return false;
  } else if (isFullySkipped(ctx.meal)) {
    return false;
  }
  if (isTomorrowMeal(ctx.meal, ctx.now)) return isBeforeCutoffForMeal(ctx);
  return true;
}

export function canReportIssue(ctx: MealDetailGuardContext): boolean {
  return ctx.meal.status !== 'inactive';
}

export function getEffectiveMealAddress(meal: MealDetailGuardMeal): string {
  return meal.deliveryAddressOverride?.text ?? meal.address;
}

export function getEffectiveFoodPreference(meal: MealDetailGuardMeal): string {
  return meal.mealPreferenceOverride ?? meal.foodPreference;
}

export function formatFoodPreferenceShort(preference: string): string {
  if (preference === 'Vegetarian') return 'Veg';
  if (preference === 'Non-vegetarian') return 'Non-Veg';
  if (preference === 'Mix of both') return 'Both';
  return preference;
}

export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function isEligibleMealDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/** Restores the subscription end date from skip metadata. */
export function calculateRestoredSubscriptionEndDate(metadata: SkipMetadata): Date {
  return new Date(metadata.previousSubscriptionEndDate);
}

export function buildSkipMetadata(
  meal: {
    date: string;
    dayLabel: string;
    shortDate: string;
    status: string;
    mealMarkers?: MealMarkerState[];
    mealPreferenceOverride?: MealPreferenceValue;
    deliveryAddressOverride?: MealAddressOverride;
  },
  previousEndDate: Date,
  extendedEndDate: Date,
  skippedSlot: MealSlot,
): SkipMetadata {
  const slotIndex = markerIndexFromMarkers(meal.mealMarkers, skippedSlot);
  const previousMarkerStatus = meal.mealMarkers?.[slotIndex]?.status ?? meal.status;
  return {
    originalDeliveryDate: meal.date,
    previousStatus: meal.status,
    previousSubscriptionEndDate: previousEndDate.toISOString(),
    extendedSubscriptionEndDate: extendedEndDate.toISOString(),
    date: meal.date,
    dayLabel: meal.dayLabel,
    shortDate: meal.shortDate,
    skippedSlot,
    previousMarkerStatus,
    mealPreferenceOverride: meal.mealPreferenceOverride,
    deliveryAddressOverride: meal.deliveryAddressOverride,
  };
}

/** Adds one eligible weekday meal day after the current subscription end date. */
export function calculateExtendedSubscriptionEndDate(currentEndDate: Date): Date {
  const next = new Date(currentEndDate);
  next.setDate(next.getDate() + 1);
  while (!isEligibleMealDay(next)) next.setDate(next.getDate() + 1);
  return next;
}

export function cutoffHelperMessage(ctx: MealDetailGuardContext): string | null {
  if (!ctx.isSubscriptionMeal || !isFutureMeal(ctx.meal, ctx.now) || !isTomorrowMeal(ctx.meal, ctx.now)) return null;
  const cutoffLabel = formatCutoffTime(ctx.cutoff ?? mealModificationCutoff);
  return isBeforeCutoffForMeal(ctx)
    ? `Changes for tomorrow's meal are available until ${cutoffLabel}.`
    : "Changes for tomorrow's meal are closed.";
}

const subscriptionActions: MealDetailActionId[] = [
  'changeAddress',
  'changeMealPreference',
  'skipMeal',
  'reportIssue',
];

const trialActions: MealDetailActionId[] = ['reportIssue'];

const actionLabels: Record<MealDetailActionId, string> = {
  changeAddress: 'Change delivery address',
  changeMealPreference: 'Change meal preference',
  skipMeal: 'Skip meal',
  reportIssue: 'Report an issue',
};

const actionGuard: Record<MealDetailActionId, (ctx: MealDetailGuardContext) => boolean> = {
  changeAddress: canChangeAddress,
  changeMealPreference: canChangeMealPreference,
  skipMeal: canSkipMeal,
  reportIssue: canReportIssue,
};

export type MealDetailActionRow = {
  id: MealDetailActionId;
  title: string;
  subtitle?: string;
};

export function buildMealDetailActions(ctx: MealDetailGuardContext): MealDetailActionRow[] {
  const ids = ctx.isSubscriptionMeal ? subscriptionActions : trialActions;
  return ids
    .filter((id) => actionGuard[id](ctx))
    .map((id) => {
      const row: MealDetailActionRow = { id, title: actionLabels[id] };
      if (id === 'changeAddress') row.subtitle = getEffectiveMealAddress(ctx.meal);
      if (id === 'changeMealPreference') row.subtitle = formatFoodPreferenceShort(getEffectiveFoodPreference(ctx.meal));
      return row;
    });
}

export function mealDetailEventForAction(action: MealDetailActionId): MealDetailEvent | null {
  switch (action) {
    case 'changeAddress':
      return { type: 'CHANGE_ADDRESS' };
    case 'changeMealPreference':
      return { type: 'CHANGE_MEAL_PREFERENCE' };
    case 'skipMeal':
      return { type: 'SKIP_MEAL' };
    case 'reportIssue':
      return { type: 'REPORT_ISSUE' };
    default:
      return null;
  }
}

export function phaseToSheetFlags(phase: MealDetailPhase) {
  return {
    addressOpen: phase === 'editingAddress' || phase === 'checkingPincode' || phase === 'addressAvailable' || phase === 'addressUnavailable',
    preferencesOpen: phase === 'editingMealPreference',
    skipOpen: phase === 'confirmingSkip' || phase === 'skippingMeal',
    issueOpen: phase === 'reportingIssue',
  };
}
