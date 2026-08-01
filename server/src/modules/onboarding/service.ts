import { db } from '../../platform/db/index.js';
import type { OnboardingStep } from '../../platform/db/types.js';

/**
 * The 14 steps of the wizard in src/TrialFlow.tsx, in order. Persisting the exact
 * step (not a coarse status) is what lets an interrupted user resume where they
 * left off rather than restarting (lifecycle spec §3.2).
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'personal',
  'intro',
  'food',
  'meal',
  'mixMeals',
  'bread',
  'rice',
  'locate',
  'address',
  'confirm',
  'summary',
  'payment',
  'success',
  'tracker',
] as const;

function nextStep(step: OnboardingStep, skipMixMeals: boolean): OnboardingStep {
  const index = ONBOARDING_STEPS.indexOf(step);
  let next = ONBOARDING_STEPS[index + 1] ?? 'tracker';
  // mixMeals only applies when the user chose "mix of both".
  if (next === 'mixMeals' && skipMixMeals) next = 'bread';
  return next;
}

export async function getDraft(userId: string) {
  const draft = await db
    .selectFrom('onboarding_drafts')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return (
    draft ??
    db
      .insertInto('onboarding_drafts')
      .values({ user_id: userId, resume_step: 'personal' })
      .returningAll()
      .executeTakeFirstOrThrow()
  );
}

export async function completeStep(
  userId: string,
  step: OnboardingStep,
  payloadPatch: Record<string, unknown>,
) {
  const draft = await getDraft(userId);
  const payload = { ...(draft.payload as Record<string, unknown>), ...payloadPatch };
  const skipMixMeals = payload['foodPreference'] !== 'mix';
  const resume = nextStep(step, skipMixMeals);

  return db
    .updateTable('onboarding_drafts')
    .set({
      last_completed_step: step,
      resume_step: resume,
      payload,
      status: resume === 'tracker' ? 'complete' : 'in_progress',
    })
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** Called when a trial payment succeeds — the wizard is over at that point. */
export async function markComplete(userId: string): Promise<void> {
  await db
    .updateTable('onboarding_drafts')
    .set({ status: 'complete', resume_step: 'tracker', last_completed_step: 'success' })
    .where('user_id', '=', userId)
    .execute();
}
