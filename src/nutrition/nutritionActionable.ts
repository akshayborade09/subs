import type { DailyNutritionState, NutritionActionable } from './types';

const PROTEIN_GAP_RATIO = 0.6;
const CALORIE_GAP_RATIO = 0.5;
const WATER_BEHIND_RATIO = 0.5;

function formatLitres(ml: number) {
  return `${(ml / 1000).toFixed(1).replace(/\.0$/, '')} L`;
}

/** Expected water progress for the current hour, so mornings are not flagged. */
function expectedWaterRatio(now: Date) {
  const wakingStart = 7;
  const wakingEnd = 22;
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour <= wakingStart) return 0;
  if (hour >= wakingEnd) return 1;
  return (hour - wakingStart) / (wakingEnd - wakingStart);
}

/**
 * Exactly one actionable, picked by the V1 priority ladder. Only surfaced for
 * today — past days are summaries, not nudges.
 */
export function pickActionable(
  day: Pick<DailyNutritionState, 'calories' | 'protein' | 'water'>,
  now = new Date(),
): NutritionActionable {
  const { calories, protein, water } = day;

  if (water.consumed === 0) {
    return {
      kind: 'no_water',
      title: 'No water logged yet today',
      body: `Start with a glass and work toward your ${formatLitres(water.target)} goal.`,
      actionLabel: '+250 ml',
      addWaterMl: 250,
    };
  }

  const proteinGap = protein.target - protein.consumed;
  if (protein.target > 0 && protein.consumed < protein.target * PROTEIN_GAP_RATIO) {
    return {
      kind: 'protein_gap',
      title: 'Protein is your clearest gap today',
      body: `You're around ${Math.round(proteinGap)}g below your daily target.`,
      actionLabel: 'See easy additions',
    };
  }

  const calorieGap = calories.target - calories.consumed;
  if (calories.target > 0 && calories.consumed < calories.target * CALORIE_GAP_RATIO) {
    return {
      kind: 'calorie_gap',
      title: 'You have room left today',
      body: `About ${Math.round(calorieGap)} kcal of your ${Math.round(calories.target)} kcal target is still unlogged.`,
      actionLabel: 'Add a meal',
    };
  }

  const expected = water.target * expectedWaterRatio(now) * WATER_BEHIND_RATIO;
  if (water.consumed < expected) {
    return {
      kind: 'water_behind',
      title: 'Hydration is behind today',
      body: `You've logged ${water.consumed} ml of your ${formatLitres(water.target)} goal.`,
      actionLabel: '+250 ml',
      addWaterMl: 250,
    };
  }

  return {
    kind: 'balanced',
    title: 'Today looks balanced',
    body: 'Calories, protein and water are all tracking close to your targets.',
  };
}
