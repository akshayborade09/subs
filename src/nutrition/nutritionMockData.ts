/**
 * Local nutrition data used until the backend ships. Dish names mirror the
 * subscription menu rendered on Home so the same meal reads consistently in
 * both places; macros are numeric here because Nutrition has to add them up.
 */
import { addDays, dateKey, startOfDay } from './periodModel';
import type { NutritionDayLog, NutritionFoodItem, NutritionSourceProfile } from './types';

export type FoodDatabaseEntry = Omit<NutritionFoodItem, 'id'> & { common?: boolean };

export const foodDatabase: FoodDatabaseEntry[] = [
  { name: 'Poha', serving: '1 bowl', calories: 250, proteinG: 5, carbsG: 45, fatG: 6, source: 'food_database', common: true },
  { name: 'Boiled eggs', serving: '2 eggs', calories: 155, proteinG: 13, carbsG: 1, fatG: 11, source: 'food_database', common: true },
  { name: 'Banana', serving: '1 medium', calories: 105, proteinG: 1, carbsG: 27, fatG: 0, source: 'food_database', common: true },
  { name: 'Curd', serving: '150 g', calories: 90, proteinG: 6, carbsG: 7, fatG: 4, source: 'food_database', common: true },
  { name: 'Milk tea', serving: '1 cup', calories: 90, proteinG: 3, carbsG: 12, fatG: 3, source: 'food_database', common: true },
  { name: 'Sprouts', serving: '100 g', calories: 120, proteinG: 9, carbsG: 21, fatG: 1, source: 'food_database', common: true },
  { name: 'Idli', serving: '2 pieces', calories: 140, proteinG: 4, carbsG: 30, fatG: 1, source: 'food_database' },
  { name: 'Upma', serving: '1 bowl', calories: 230, proteinG: 6, carbsG: 38, fatG: 7, source: 'food_database' },
  { name: 'Masala dosa', serving: '1 piece', calories: 310, proteinG: 7, carbsG: 48, fatG: 10, source: 'food_database' },
  { name: 'Paneer bhurji', serving: '150 g', calories: 280, proteinG: 17, carbsG: 8, fatG: 20, source: 'food_database' },
  { name: 'Grilled chicken', serving: '150 g', calories: 250, proteinG: 43, carbsG: 0, fatG: 8, source: 'food_database' },
  { name: 'Peanut chikki', serving: '30 g', calories: 150, proteinG: 4, carbsG: 18, fatG: 7, source: 'food_database' },
  { name: 'Roasted chana', serving: '40 g', calories: 145, proteinG: 8, carbsG: 22, fatG: 2, source: 'food_database' },
  { name: 'Filter coffee', serving: '1 cup', calories: 70, proteinG: 2, carbsG: 9, fatG: 3, source: 'food_database' },
  { name: 'Green tea', serving: '1 cup', calories: 2, proteinG: 0, carbsG: 0, fatG: 0, source: 'food_database' },
  { name: 'Whey protein shake', serving: '1 scoop', calories: 130, proteinG: 25, carbsG: 3, fatG: 2, source: 'food_database' },
  { name: 'Almonds', serving: '15 pieces', calories: 105, proteinG: 4, carbsG: 4, fatG: 9, source: 'food_database' },
  { name: 'Apple', serving: '1 medium', calories: 95, proteinG: 0, carbsG: 25, fatG: 0, source: 'food_database' },
  { name: 'Buttermilk', serving: '1 glass', calories: 60, proteinG: 3, carbsG: 6, fatG: 2, source: 'food_database' },
  { name: 'Vada pav', serving: '1 piece', calories: 290, proteinG: 7, carbsG: 42, fatG: 11, source: 'food_database' },
];

export const lunchMenuItems: Omit<NutritionFoodItem, 'id'>[] = [
  { name: 'Paneer masala', serving: '180 g', calories: 260, proteinG: 13, carbsG: 14, fatG: 17, source: 'subscription' },
  { name: 'Dal tadka', serving: '150 g', calories: 150, proteinG: 8, carbsG: 20, fatG: 4, source: 'subscription' },
  { name: 'Bhakri', serving: '2 pieces', calories: 130, proteinG: 3, carbsG: 26, fatG: 1, source: 'subscription' },
  { name: 'Jeera rice', serving: '160 g', calories: 150, proteinG: 3, carbsG: 31, fatG: 2, source: 'subscription' },
  { name: 'Salad', serving: '80 g', calories: 20, proteinG: 1, carbsG: 4, fatG: 0, source: 'subscription' },
  { name: 'Pickle', serving: '15 g', calories: 10, proteinG: 0, carbsG: 2, fatG: 0, source: 'subscription' },
];

export const dinnerMenuItems: Omit<NutritionFoodItem, 'id'>[] = [
  { name: 'Mix veg sabzi', serving: '180 g', calories: 180, proteinG: 6, carbsG: 18, fatG: 9, source: 'subscription' },
  { name: 'Rajma curry', serving: '160 g', calories: 210, proteinG: 11, carbsG: 30, fatG: 5, source: 'subscription' },
  { name: 'Chapati', serving: '3 pieces', calories: 180, proteinG: 5, carbsG: 36, fatG: 2, source: 'subscription' },
  { name: 'Plain rice', serving: '150 g', calories: 140, proteinG: 3, carbsG: 30, fatG: 1, source: 'subscription' },
  { name: 'Raita', serving: '100 g', calories: 60, proteinG: 3, carbsG: 6, fatG: 2, source: 'subscription' },
  { name: 'Papad', serving: '1 piece', calories: 35, proteinG: 2, carbsG: 5, fatG: 1, source: 'subscription' },
];

let idCounter = 0;

export function foodItemId(prefix = 'food'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function toFoodItem(entry: Omit<NutritionFoodItem, 'id'>, prefix = 'food'): NutritionFoodItem {
  return { ...entry, id: foodItemId(prefix) };
}

export function subscriptionMenuFor(mealType: 'lunch' | 'dinner', date: string): NutritionFoodItem[] {
  const source = mealType === 'lunch' ? lunchMenuItems : dinnerMenuItems;
  return source.map((entry, index) => ({ ...entry, id: `${date}-${mealType}-${index}` }));
}

/** Profile the subscription product already knows, wired from Home props. */
export const demoSourceProfile: NutritionSourceProfile = {
  name: 'Akshay',
  dob: '1992-07-18',
  gender: 'Male',
  foodPreference: 'Mix of both',
  subscribedMeals: ['lunch', 'dinner'],
  lunchMenuLabel: 'Maharashtrian Veg',
  dinnerMenuLabel: 'Maharashtrian Non-Veg',
};

const seededManualFoods: Array<Omit<NutritionFoodItem, 'id'>[]> = [
  [foodEntry('Poha'), foodEntry('Milk tea')],
  [foodEntry('Idli'), foodEntry('Filter coffee')],
  [foodEntry('Boiled eggs'), foodEntry('Banana')],
  [foodEntry('Upma'), foodEntry('Curd')],
  [foodEntry('Sprouts'), foodEntry('Green tea')],
];

function foodEntry(name: string): Omit<NutritionFoodItem, 'id'> {
  const found = foodDatabase.find((item) => item.name === name);
  if (!found) throw new Error(`Unknown seed food: ${name}`);
  const { common, ...entry } = found;
  return entry;
}

/**
 * A day that has already been logged by hand: breakfast, a snack and part of the
 * water goal. Subscription meals are not included because those auto-populate.
 */
export function seededTodayLog(date: string): NutritionDayLog {
  const breakfast = [foodEntry('Poha'), foodEntry('Boiled eggs'), foodEntry('Milk tea')];
  const snack = [foodEntry('Banana'), foodEntry('Roasted chana')];
  return {
    date,
    waterMl: 1250,
    mealItems: {
      [`${date}-breakfast`]: breakfast.map((entry, index) => ({ ...entry, id: `${date}-breakfast-${index}` })),
      [`${date}-snack`]: snack.map((entry, index) => ({ ...entry, id: `${date}-snack-${index}` })),
    },
  };
}

/**
 * Past-day history so weekly and monthly aggregates are not empty on first run.
 * Deterministic per date, so the same day always renders the same numbers.
 */
export function seededHistory(now = new Date(), days = 75): Record<string, NutritionDayLog> {
  const today = startOfDay(now);
  const logs: Record<string, NutritionDayLog> = {};
  for (let offset = 1; offset <= days; offset += 1) {
    const day = addDays(today, -offset);
    const key = dateKey(day);
    // Skip roughly one day a week so "meals tracked" counts look realistic.
    if (day.getDay() === 0 && offset % 3 === 0) continue;

    const breakfast = seededManualFoods[offset % seededManualFoods.length]!;
    logs[key] = {
      date: key,
      waterMl: 1500 + ((offset * 250) % 1500),
      mealItems: {
        [`${key}-breakfast`]: breakfast.map((entry, index) => ({ ...entry, id: `${key}-breakfast-${index}` })),
        [`${key}-lunch`]: subscriptionMenuFor('lunch', key),
        [`${key}-dinner`]: subscriptionMenuFor('dinner', key),
      },
    };
  }
  return logs;
}
