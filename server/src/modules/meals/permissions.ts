import { policy } from '../../platform/config/policy.js';
import { preferenceCutoffFor, todayIn, type MealSlot, type PlainDate } from '../../platform/time.js';
import type { OpsStatus } from '../../platform/db/types.js';

/**
 * What a user may still change about one meal, and why not if not.
 *
 * Derived on every read AND re-derived inside every write transaction. Never a
 * stored column: a boolean in the database would need a job to flip millions of
 * rows at 20:00 IST and would disagree with the clock for the minutes around it.
 * The handoff doc lists these fields inside MealOrder — that is the response DTO,
 * not the table.
 *
 * Pure, so the whole matrix of cases is unit-testable.
 */
export type MealPermissions = {
  canChangeDate: boolean;
  canChangeAddress: boolean;
  canChangePreference: boolean;
  lockedReason: string | null;
  /** When the edit window closes, so the client can show it before it passes. */
  cutoffAt: string;
};

export type PermissionInput = {
  serviceDate: PlainDate;
  slot: MealSlot;
  opsStatus: OpsStatus | null;
};

const LOCKED = (reason: string, cutoffAt: string): MealPermissions => ({
  canChangeDate: false,
  canChangeAddress: false,
  canChangePreference: false,
  lockedReason: reason,
  cutoffAt,
});

export function derivePermissions(order: PermissionInput, now: Date): MealPermissions {
  const cutoff = preferenceCutoffFor(order.serviceDate, order.slot);
  const cutoffAt = cutoff.toISOString();

  switch (order.opsStatus) {
    case 'delivered':
      return LOCKED('This meal has already been delivered.', cutoffAt);
    case 'cancelled':
    case 'skipped':
      return LOCKED('This meal is not scheduled.', cutoffAt);
    case 'preparing':
    case 'out_for_delivery':
      return LOCKED('This meal is already being prepared.', cutoffAt);
    case 'delayed':
      return LOCKED('This delivery is running late. Contact support to make changes.', cutoffAt);
    case 'delivery_failed':
      // The one exception: fixing the address is the whole point of state R, even
      // though the date and the meal itself are settled.
      return {
        canChangeDate: false,
        canChangeAddress: true,
        canChangePreference: false,
        lockedReason: 'This delivery failed. Check the address or contact support.',
        cutoffAt,
      };
    case null:
      break;
  }

  const today = todayIn(now);
  if (order.serviceDate < today) {
    return LOCKED('This delivery date has passed.', cutoffAt);
  }
  if (order.serviceDate === today && !policy.cutoffs.allowSameDayChanges) {
    return LOCKED('Same-day changes are not available.', cutoffAt);
  }
  if (now >= cutoff) {
    const hour = policy.cutoffs.preferenceHourIst;
    const label = hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
    const locked = LOCKED(
      `Changes for this meal are locked after ${label} the previous day.`,
      cutoffAt,
    );
    // Ops may later decide a redirect is cheaper than a failed delivery, in which
    // case address changes outlive the kitchen cutoff. Config, not a code change.
    return policy.cutoffs.addressFollowsPreference ? locked : { ...locked, canChangeAddress: true };
  }

  return {
    canChangeDate: true,
    canChangeAddress: true,
    canChangePreference: true,
    lockedReason: null,
    cutoffAt,
  };
}
