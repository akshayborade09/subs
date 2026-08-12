/**
 * Analytics seam. Swap `emit` for the real SDK when one lands — call sites stay.
 * Body measurements (height, weight) are deliberately never accepted here.
 */
export type NutritionAnalyticsEvent =
  | 'nutrition_opened'
  | 'nutrition_onboarding_started'
  | 'nutrition_goal_selected'
  | 'nutrition_secondary_goal_selected'
  | 'nutrition_height_updated'
  | 'nutrition_weight_updated'
  | 'nutrition_activity_selected'
  | 'nutrition_subscription_tracking_changed'
  | 'nutrition_manual_meal_added'
  | 'nutrition_custom_meal_created'
  | 'nutrition_water_goal_changed'
  | 'nutrition_water_reminder_enabled'
  | 'nutrition_water_reminder_disabled'
  | 'nutrition_onboarding_completed'
  | 'nutrition_period_mode_changed'
  | 'nutrition_period_selected'
  | 'nutrition_meal_opened'
  | 'nutrition_food_added'
  | 'nutrition_food_removed'
  | 'nutrition_subscription_meal_edited'
  | 'nutrition_water_added'
  | 'nutrition_actionable_clicked'
  | 'diet_plan_opened'
  | 'nutrition_insights_opened';

type AnalyticsValue = string | number | boolean | null | undefined;

/** Measurement keys are stripped before dispatch — approval is required first. */
const blockedKeys = new Set(['heightCm', 'weightKg', 'height', 'weight', 'bmi', 'dob']);

function emit(event: NutritionAnalyticsEvent, properties: Record<string, AnalyticsValue>) {
  if (__DEV__) console.log(`[analytics] ${event}`, properties);
}

export function track(event: NutritionAnalyticsEvent, properties: Record<string, AnalyticsValue> = {}) {
  const safe: Record<string, AnalyticsValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!blockedKeys.has(key)) safe[key] = value;
  }
  emit(event, safe);
}
