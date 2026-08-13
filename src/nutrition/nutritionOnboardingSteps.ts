import type { NutritionOnboardingStep, NutritionSourceProfile } from './types';

/**
 * Steps are generated per user: anything the subscription product already knows
 * is skipped, so the progress bar reflects the questions actually asked.
 *
 * Gender is deliberately absent — app onboarding already collects it, and the
 * energy estimate derives from that rather than asking a second time.
 */
export function buildNutritionSteps(profile: NutritionSourceProfile): NutritionOnboardingStep[] {
  return [
    'primaryGoal',
    'secondaryGoals',
    profile.heightCm ? null : 'height',
    profile.weightKg ? null : 'weight',
    profile.activityLevel ? null : 'activity',
    'meals',
    'water',
    'summary',
  ].filter((step): step is NutritionOnboardingStep => step !== null);
}

export const stepTitles: Record<NutritionOnboardingStep, string> = {
  primaryGoal: "What's your main nutrition goal?",
  secondaryGoals: "Anything else you'd like to improve?",
  height: 'How tall are you?',
  weight: "What's your current weight?",
  activity: "What's a typical week like?",
  meals: 'What would you like to track?',
  water: "What's your daily water goal?",
  summary: 'Your nutrition plan is ready',
};
