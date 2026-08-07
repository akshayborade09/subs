/** Daily cutoff for modifying tomorrow's meal. Change here only — not in UI copy. */
export const mealModificationCutoff = '20:00';

export function parseCutoffTime(cutoff = mealModificationCutoff): { hours: number; minutes: number } {
  const [hours, minutes] = cutoff.split(':').map(Number);
  return { hours: hours ?? 20, minutes: minutes ?? 0 };
}

export function formatCutoffTime(cutoff = mealModificationCutoff, locale = 'en-IN'): string {
  const { hours, minutes } = parseCutoffTime(cutoff);
  const sample = new Date();
  sample.setHours(hours, minutes, 0, 0);
  return sample.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: minutes > 0 ? '2-digit' : undefined,
    hour12: true,
  });
}

export function isBeforeMealModificationCutoff(now = new Date(), cutoff = mealModificationCutoff): boolean {
  const { hours, minutes } = parseCutoffTime(cutoff);
  const cutoffAt = new Date(now);
  cutoffAt.setHours(hours, minutes, 0, 0);
  return now.getTime() < cutoffAt.getTime();
}

/** True until the configured cutoff on the calendar day before delivery. */
export function isBeforeModificationCutoffForDeliveryDay(
  deliveryDay: Date,
  now = new Date(),
  cutoff = mealModificationCutoff,
): boolean {
  const mealDay = new Date(deliveryDay.getFullYear(), deliveryDay.getMonth(), deliveryDay.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (mealDay.getTime() <= today.getTime()) return false;
  const cutoffDay = new Date(mealDay);
  cutoffDay.setDate(cutoffDay.getDate() - 1);
  const { hours, minutes } = parseCutoffTime(cutoff);
  const cutoffAt = new Date(cutoffDay);
  cutoffAt.setHours(hours, minutes, 0, 0);
  return now.getTime() < cutoffAt.getTime();
}
