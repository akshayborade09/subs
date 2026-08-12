import type {
  ActivityLevel,
  NutritionCalculationSex,
  NutritionGoal,
  NutritionMeal,
  NutritionOnboardingState,
  NutritionTargets,
} from './types';

const activityMultiplier: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  active: 1.55,
  very_active: 1.725,
};

/** kcal delta applied to maintenance for each goal. */
const goalCalorieDelta: Record<NutritionGoal, number> = {
  lose_weight: -400,
  maintain: 0,
  gain_weight: 400,
  build_muscle: 250,
  understand: 0,
};

/** Grams of protein per kg of bodyweight. */
const goalProteinPerKg: Record<NutritionGoal, number> = {
  lose_weight: 1.6,
  maintain: 1.2,
  gain_weight: 1.6,
  build_muscle: 1.8,
  understand: 1.2,
};

const FAT_CALORIE_SHARE = 0.28;
const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARB = 4;
const KCAL_PER_G_FAT = 9;

const DEFAULT_HEIGHT_CM = 170;
const DEFAULT_WEIGHT_KG = 70;
const DEFAULT_AGE_YEARS = 30;

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

/** Mifflin-St Jeor. */
export function basalMetabolicRate({
  heightCm,
  weightKg,
  ageYears,
  sex,
}: {
  heightCm: number;
  weightKg: number;
  ageYears: number;
  sex: NutritionCalculationSex;
}) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'male' ? base + 5 : base - 161;
}

export function calculateNutritionTargets({
  heightCm = DEFAULT_HEIGHT_CM,
  weightKg = DEFAULT_WEIGHT_KG,
  ageYears = DEFAULT_AGE_YEARS,
  calculationSex = 'female',
  activityLevel = 'light',
  primaryGoal = 'maintain',
  waterGoalMl = 2500,
}: {
  heightCm?: number;
  weightKg?: number;
  ageYears?: number;
  calculationSex?: NutritionCalculationSex;
  activityLevel?: ActivityLevel;
  primaryGoal?: NutritionGoal;
  waterGoalMl?: number;
}): NutritionTargets {
  const maintenance = basalMetabolicRate({ heightCm, weightKg, ageYears, sex: calculationSex }) * activityMultiplier[activityLevel];
  const calories = Math.max(1200, roundTo(maintenance + goalCalorieDelta[primaryGoal], 10));

  const proteinG = roundTo(weightKg * goalProteinPerKg[primaryGoal], 5);
  const fatG = roundTo((calories * FAT_CALORIE_SHARE) / KCAL_PER_G_FAT, 5);
  const remainingCalories = calories - proteinG * KCAL_PER_G_PROTEIN - fatG * KCAL_PER_G_FAT;
  const carbsG = Math.max(0, roundTo(remainingCalories / KCAL_PER_G_CARB, 5));

  return { calories, proteinG, carbsG, fatG, waterMl: waterGoalMl };
}

export function targetsFromSetup(
  setup: NutritionOnboardingState,
  ageYears: number | undefined,
): NutritionTargets {
  return calculateNutritionTargets({
    heightCm: setup.heightCm,
    weightKg: setup.weightKg,
    ageYears,
    calculationSex: setup.calculationSex,
    activityLevel: setup.activityLevel,
    primaryGoal: setup.primaryGoal,
    waterGoalMl: setup.waterGoalMl,
  });
}

export function ageFromDob(dob: string | undefined, now = new Date()): number | undefined {
  if (!dob) return undefined;
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return undefined;
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDelta = now.getMonth() - parsed.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < parsed.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : undefined;
}

export function mealTotals(meals: NutritionMeal[]) {
  return meals.reduce(
    (accumulator, meal) => ({
      calories: accumulator.calories + meal.totals.calories,
      proteinG: accumulator.proteinG + meal.totals.proteinG,
      carbsG: accumulator.carbsG + meal.totals.carbsG,
      fatG: accumulator.fatG + meal.totals.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** What the subscription itself contributes — the core differentiator copy. */
export function subscriptionContribution(meals: NutritionMeal[]) {
  const subscriptionMeals = meals.filter((meal) => meal.source === 'subscription' && !meal.scheduled);
  const totals = mealTotals(subscriptionMeals);
  return {
    count: subscriptionMeals.length,
    labels: subscriptionMeals.map((meal) => meal.label),
    calories: totals.calories,
    proteinG: totals.proteinG,
  };
}
