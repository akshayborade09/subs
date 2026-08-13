/**
 * Nutrition domain models. Body measurements are normalised to metric here —
 * cm/ft-in and kg/lbs exist only as display units inside the pickers.
 */

export type SubscriberTab = 'home' | 'nutrition' | 'diet_plan' | 'insights';

export type NutritionGoal =
  | 'lose_weight'
  | 'maintain'
  | 'gain_weight'
  | 'build_muscle'
  | 'understand';

export type NutritionSecondaryGoal =
  | 'balanced_meals'
  | 'more_protein'
  | 'portion_awareness'
  | 'more_water'
  | 'meal_consistency';

export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'very_active';

export type NutritionCalculationSex = 'female' | 'male';

export type MealSlotType = 'breakfast' | 'lunch' | 'snack' | 'tea' | 'dinner' | 'custom';

export type CustomMealSlot = {
  id: string;
  name: string;
};

export type WaterReminderIntervalHours = 2 | 3 | 4;

export type NutritionOnboardingStep =
  | 'primaryGoal'
  | 'secondaryGoals'
  | 'height'
  | 'weight'
  | 'activity'
  | 'meals'
  | 'water'
  | 'summary';

export type NutritionOnboardingState = {
  completed: boolean;
  primaryGoal?: NutritionGoal;
  secondaryGoals: NutritionSecondaryGoal[];
  heightCm?: number;
  weightKg?: number;
  activityLevel?: ActivityLevel;
  calculationSex?: NutritionCalculationSex;
  subscriptionMealTracking: { lunch?: boolean; dinner?: boolean };
  manualMealSlots: Exclude<MealSlotType, 'lunch' | 'dinner' | 'custom'>[];
  customMealSlots: CustomMealSlot[];
  waterGoalMl: number;
  waterRemindersEnabled: boolean;
  waterReminderIntervalHours?: WaterReminderIntervalHours;
};

export type NutritionFoodItem = {
  id: string;
  name: string;
  serving?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: 'subscription' | 'food_database' | 'custom';
};

export type NutritionMealTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type NutritionMeal = {
  id: string;
  label: string;
  type: MealSlotType;
  source: 'subscription' | 'manual';
  /** Menu name for subscription meals, e.g. "Maharashtrian Veg". */
  menuLabel?: string;
  foodItems: NutritionFoodItem[];
  totals: NutritionMealTotals;
  /** Subscription meal whose nutrition details failed to load — card stays, shows Retry. */
  loadFailed?: boolean;
  /** Scheduled but not yet delivered, used by the future-day state. */
  scheduled?: boolean;
};

export type NutritionActionableKind =
  | 'no_water'
  | 'protein_gap'
  | 'calorie_gap'
  | 'water_behind'
  | 'balanced';

export type NutritionActionable = {
  kind: NutritionActionableKind;
  title: string;
  body: string;
  actionLabel?: string;
  /** Quick water top-up offered straight from the card. */
  addWaterMl?: number;
};

export type NutritionTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
};

export type MacroProgressValue = {
  consumed: number;
  target: number;
};

export type DailyNutritionState = {
  date: string;
  calories: MacroProgressValue;
  protein: MacroProgressValue;
  carbs: MacroProgressValue;
  fat: MacroProgressValue;
  water: MacroProgressValue;
  meals: NutritionMeal[];
  actionable?: NutritionActionable;
};

/** Only the mutable slice of a day is stored; targets and menus are derived. */
export type NutritionDayLog = {
  date: string;
  waterMl: number;
  /** Food items per meal id. Absent means "not touched, use the seeded default". */
  mealItems: Record<string, NutritionFoodItem[]>;
};

export type NutritionPeriodMode = 'daily' | 'weekly' | 'monthly';

export type NutritionPeriodState = {
  mode: NutritionPeriodMode;
  selectedDate?: string;
  selectedWeekStart?: string;
  selectedMonth?: string;
};

export type NutritionAggregate = {
  label: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  /** Days in the period that have any tracked data. */
  daysCounted: number;
  /** Days of the period that have already elapsed — the basis for targets. */
  daysElapsed: number;
  mealsTracked: number;
  subscriptionMeals: number;
  avgCaloriesPerDay: number;
  avgProteinPerDay: number;
  targetCalories: number;
  targetWaterMl: number;
};

/** Profile fields Nutrition reuses from the subscription product. */
export type NutritionSourceProfile = {
  name?: string;
  dob?: string;
  ageYears?: number;
  /** Label collected during app onboarding: Male, Female or Others. */
  gender?: string;
  foodPreference?: string;
  subscribedMeals: Array<'lunch' | 'dinner'>;
  lunchMenuLabel?: string;
  dinnerMenuLabel?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: ActivityLevel;
  calculationSex?: NutritionCalculationSex;
};
