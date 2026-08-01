import { DateTime } from 'luxon';
import { policy } from './config/policy.js';

/** `YYYY-MM-DD` in the delivery timezone. A calendar fact, never an instant. */
export type PlainDate = string;
/** `HH:mm` wall clock in the delivery timezone. */
export type WallClock = string;

export const ZONE = policy.deliveryTimezone;

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertPlainDate(value: string): PlainDate {
  if (!PLAIN_DATE.test(value)) throw new Error(`Expected YYYY-MM-DD, received "${value}"`);
  return value;
}

/** The calendar date it is *in the delivery timezone* at a given instant. */
export function todayIn(now: Date): PlainDate {
  return DateTime.fromJSDate(now, { zone: ZONE }).toISODate()!;
}

/** Resolve an IST wall-clock time on a calendar date to a UTC instant. */
export function instantAt(date: PlainDate, time: WallClock): Date {
  const [hour, minute] = time.split(':').map(Number);
  return DateTime.fromISO(date, { zone: ZONE })
    .set({ hour: hour ?? 0, minute: minute ?? 0, second: 0, millisecond: 0 })
    .toJSDate();
}

export function addDays(date: PlainDate, days: number): PlainDate {
  return DateTime.fromISO(date, { zone: ZONE }).plus({ days }).toISODate()!;
}

export function daysBetween(from: PlainDate, to: PlainDate): number {
  return Math.round(
    DateTime.fromISO(to, { zone: ZONE }).diff(DateTime.fromISO(from, { zone: ZONE }), 'days').days,
  );
}

/** ISO weekday, 1 = Monday … 7 = Sunday. Matches `subscriptions.selected_weekdays`. */
export function weekdayOf(date: PlainDate): number {
  return DateTime.fromISO(date, { zone: ZONE }).weekday;
}

export type MealSlot = 'lunch' | 'dinner';

export function deliveryWindow(date: PlainDate, slot: MealSlot): { start: Date; end: Date } {
  const window = policy.deliveryWindows[slot];
  return { start: instantAt(date, window.start), end: instantAt(date, window.end) };
}

/**
 * Preferences for a service date lock at 20:00 IST the previous day. Derived on
 * every read and re-derived inside every write transaction — deliberately not a
 * column, so there is no nightly job flipping millions of rows at 20:00 and no
 * window where the stored value disagrees with the clock.
 */
export function preferenceCutoffFor(date: PlainDate, _slot: MealSlot): Date {
  return instantAt(addDays(date, -1), `${String(policy.cutoffs.preferenceHourIst).padStart(2, '0')}:00`);
}

export function isPastCutoff(date: PlainDate, slot: MealSlot, now: Date): boolean {
  return now >= preferenceCutoffFor(date, slot);
}

/** Display helpers. Labels are always derived — never stored, never sorted on. */
export function dayLabel(date: PlainDate): string {
  return DateTime.fromISO(date, { zone: ZONE }).toFormat('ccc').toUpperCase();
}

export function shortDate(date: PlainDate): string {
  return DateTime.fromISO(date, { zone: ZONE }).toFormat('d');
}

/** e.g. "Monday, 21 July" — the format the app's mock data uses. */
export function longDate(date: PlainDate): string {
  return DateTime.fromISO(date, { zone: ZONE }).toFormat('cccc, d LLLL');
}

/** e.g. "27 July" — used inside Home copy and captions. */
export function mediumDate(date: PlainDate): string {
  return DateTime.fromISO(date, { zone: ZONE }).toFormat('d LLLL');
}

/** e.g. "22 Jul 2026 · 10:42 AM" — the format the transactions list uses. */
export function transactionTimestamp(instant: Date): string {
  return DateTime.fromJSDate(instant, { zone: ZONE }).toFormat("dd LLL yyyy '·' h:mm a");
}
