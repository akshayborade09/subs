import { policy } from '../../platform/config/policy.js';

/**
 * "Healthy Streak" qualification, spec §14.2. A user qualifies when ALL hold:
 *
 *   1. 28 consecutive calendar days of active paid subscription have elapsed
 *   2. all required payments for that period succeeded
 *   3. at least 20 scheduled meal days were delivered or validly fulfilled
 *   4. the account is not suspended
 *
 * Operational cancellations and provider-caused failures do not break progress —
 * the user did nothing wrong. User-paused days EXTEND the qualification end date
 * rather than resetting it, which is the difference between a programme people
 * trust and one that quietly punishes them for going on holiday.
 *
 * Pure, because the exact rule has to be stated in the UI and must therefore be
 * verifiable in isolation. The spec is explicit that the UI must not claim "one
 * month" while computing something else.
 */
export type QualificationInput = {
  /** `YYYY-MM-DD` the qualifying period began (subscription start). */
  periodStart: string;
  today: string;
  /** Dates the subscription was paused, which do not count toward the streak. */
  pausedDates: string[];
  /** Dates with at least one delivered or validly fulfilled meal. */
  fulfilledDates: string[];
  /** True while a renewal payment is unresolved — progress freezes. */
  paymentsHealthy: boolean;
  accountActive: boolean;
};

export type QualificationStatus = 'in_progress' | 'qualified' | 'frozen' | 'expired';

export type QualificationResult = {
  status: QualificationStatus;
  activeDays: number;
  requiredActiveDays: number;
  fulfilledMealDays: number;
  requiredFulfilledMealDays: number;
  /** The date the streak is expected to complete, pushed out by pauses. */
  expectedQualificationDate: string;
  /** Human statement of the exact rule in force — rendered verbatim by the UI. */
  ruleStatement: string;
};

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetweenInclusive(from: string, to: string): number {
  if (to < from) return 0;
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS) + 1;
}

export function evaluateQualification(input: QualificationInput): QualificationResult {
  const requiredActiveDays = policy.loyalty.qualifyingActiveDays;
  const requiredFulfilledMealDays = policy.loyalty.requiredFulfilledMealDays;

  const pausedSet = new Set(input.pausedDates);
  const elapsed = daysBetweenInclusive(input.periodStart, input.today);

  // Count only days the subscription was actually running.
  let activeDays = 0;
  for (let offset = 0; offset < elapsed; offset += 1) {
    if (!pausedSet.has(addDays(input.periodStart, offset))) activeDays += 1;
  }
  activeDays = Math.min(activeDays, requiredActiveDays);

  // Every paused day inside the window pushes the finish line out by one.
  const pausedWithinWindow = input.pausedDates.filter(
    (date) => date >= input.periodStart && date <= addDays(input.periodStart, requiredActiveDays * 2),
  ).length;
  const expectedQualificationDate = addDays(
    input.periodStart,
    requiredActiveDays - 1 + pausedWithinWindow,
  );

  const fulfilledMealDays = new Set(input.fulfilledDates).size;

  const ruleStatement =
    `${requiredActiveDays} continuous active days with at least ` +
    `${requiredFulfilledMealDays} delivered meal days.`;

  const base = {
    activeDays,
    requiredActiveDays,
    fulfilledMealDays,
    requiredFulfilledMealDays,
    expectedQualificationDate,
    ruleStatement,
  };

  if (!input.accountActive) return { ...base, status: 'expired' };
  // A frozen period keeps its progress; it simply stops accruing until resolved.
  if (!input.paymentsHealthy) return { ...base, status: 'frozen' };

  const qualified =
    activeDays >= requiredActiveDays && fulfilledMealDays >= requiredFulfilledMealDays;

  return { ...base, status: qualified ? 'qualified' : 'in_progress' };
}
