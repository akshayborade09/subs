import type { NutritionPeriodMode, NutritionPeriodState } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthLabels = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthShortLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Weeks run Sunday to Saturday, matching the home week strip. */
export function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -date.getDay());
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function parseMonthKey(key: string): Date {
  const [year, month] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export type DayRelation = 'past' | 'today' | 'future';

export function dayRelation(key: string, now = new Date()): DayRelation {
  const day = startOfDay(parseDateKey(key)).getTime();
  const today = startOfDay(now).getTime();
  if (day === today) return 'today';
  return day < today ? 'past' : 'future';
}

export function defaultPeriodState(now = new Date()): NutritionPeriodState {
  return {
    mode: 'daily',
    selectedDate: dateKey(now),
    selectedWeekStart: dateKey(startOfWeek(now)),
    selectedMonth: monthKey(now),
  };
}

export type PeriodCarouselItem = {
  id: string;
  primary: string;
  secondary?: string;
  relation: DayRelation;
};

const DAILY_PAST_DAYS = 30;
const DAILY_FUTURE_DAYS = 6;

export function dailyCarouselItems(now = new Date()): PeriodCarouselItem[] {
  const today = startOfDay(now);
  const items: PeriodCarouselItem[] = [];
  for (let offset = -DAILY_PAST_DAYS; offset <= DAILY_FUTURE_DAYS; offset += 1) {
    const day = addDays(today, offset);
    const key = dateKey(day);
    items.push({
      id: key,
      primary: offset === 0 ? 'Today' : weekdayLabels[day.getDay()]!,
      secondary: String(day.getDate()),
      relation: dayRelation(key, now),
    });
  }
  return items;
}

function weekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const startMonth = monthShortLabels[weekStart.getMonth()]!;
  const endMonth = monthShortLabels[weekEnd.getMonth()]!;
  if (startMonth === endMonth) return `${weekStart.getDate()} – ${weekEnd.getDate()} ${endMonth}`;
  return `${weekStart.getDate()} ${startMonth} – ${weekEnd.getDate()} ${endMonth}`;
}

const WEEKLY_PAST_WEEKS = 12;
const WEEKLY_FUTURE_WEEKS = 1;

export function weeklyCarouselItems(now = new Date()): PeriodCarouselItem[] {
  const currentWeekStart = startOfWeek(now);
  const items: PeriodCarouselItem[] = [];
  for (let offset = -WEEKLY_PAST_WEEKS; offset <= WEEKLY_FUTURE_WEEKS; offset += 1) {
    const weekStart = addDays(currentWeekStart, offset * 7);
    items.push({
      id: dateKey(weekStart),
      primary: weekRangeLabel(weekStart),
      secondary: offset === 0 ? 'This week' : undefined,
      relation: offset === 0 ? 'today' : offset < 0 ? 'past' : 'future',
    });
  }
  return items;
}

const MONTHLY_PAST_MONTHS = 11;
const MONTHLY_FUTURE_MONTHS = 1;

export function monthlyCarouselItems(now = new Date()): PeriodCarouselItem[] {
  const items: PeriodCarouselItem[] = [];
  for (let offset = -MONTHLY_PAST_MONTHS; offset <= MONTHLY_FUTURE_MONTHS; offset += 1) {
    const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    items.push({
      id: monthKey(month),
      primary: monthLabels[month.getMonth()]!,
      secondary: month.getFullYear() === now.getFullYear() ? undefined : String(month.getFullYear()),
      relation: offset === 0 ? 'today' : offset < 0 ? 'past' : 'future',
    });
  }
  return items;
}

export function carouselItems(mode: NutritionPeriodMode, now = new Date()): PeriodCarouselItem[] {
  if (mode === 'weekly') return weeklyCarouselItems(now);
  if (mode === 'monthly') return monthlyCarouselItems(now);
  return dailyCarouselItems(now);
}

export function selectedCarouselId(period: NutritionPeriodState, now = new Date()): string {
  if (period.mode === 'weekly') return period.selectedWeekStart ?? dateKey(startOfWeek(now));
  if (period.mode === 'monthly') return period.selectedMonth ?? monthKey(now);
  return period.selectedDate ?? dateKey(now);
}

export function withSelection(period: NutritionPeriodState, id: string): NutritionPeriodState {
  if (period.mode === 'weekly') return { ...period, selectedWeekStart: id };
  if (period.mode === 'monthly') return { ...period, selectedMonth: id };
  return { ...period, selectedDate: id };
}

/** Days inside the selected period, clamped so future days are never aggregated. */
export function periodDayKeys(period: NutritionPeriodState, now = new Date()): string[] {
  const today = startOfDay(now);
  if (period.mode === 'daily') return [period.selectedDate ?? dateKey(now)];

  let start: Date;
  let end: Date;
  if (period.mode === 'weekly') {
    start = parseDateKey(period.selectedWeekStart ?? dateKey(startOfWeek(now)));
    end = addDays(start, 6);
  } else {
    start = parseMonthKey(period.selectedMonth ?? monthKey(now));
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  }
  if (end.getTime() > today.getTime()) end = today;

  const keys: string[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
    keys.push(dateKey(new Date(time)));
  }
  return keys;
}

export function periodLabel(period: NutritionPeriodState, now = new Date()): string {
  if (period.mode === 'weekly') {
    const start = parseDateKey(period.selectedWeekStart ?? dateKey(startOfWeek(now)));
    return weekRangeLabel(start);
  }
  if (period.mode === 'monthly') {
    const month = parseMonthKey(period.selectedMonth ?? monthKey(now));
    return `${monthLabels[month.getMonth()]} ${month.getFullYear()}`;
  }
  const day = parseDateKey(period.selectedDate ?? dateKey(now));
  if (isSameDay(day, now)) return 'Today';
  return `${weekdayLabels[day.getDay()]} ${day.getDate()} ${monthShortLabels[day.getMonth()]}`;
}

/** True when the whole selected period lies ahead of today. */
export function isFuturePeriod(period: NutritionPeriodState, now = new Date()): boolean {
  if (period.mode === 'daily') return dayRelation(period.selectedDate ?? dateKey(now), now) === 'future';
  return periodDayKeys(period, now).length === 0;
}
