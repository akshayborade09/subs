import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { pullNutritionDay, pushMealItems, pushNutritionSetup, pushWaterTotal } from './nutritionApi';
import { demoSourceProfile, seededHistory, seededTodayLog, subscriptionMenuFor } from './nutritionMockData';
import { pickActionable } from './nutritionActionable';
import { ageFromDob, mealTotals, targetsFromSetup } from './nutritionTargets';
import { dateKey, dayRelation, periodDayKeys, periodLabel } from './periodModel';
import type {
  CustomMealSlot,
  DailyNutritionState,
  NutritionAggregate,
  NutritionDayLog,
  NutritionFoodItem,
  NutritionMeal,
  NutritionOnboardingState,
  NutritionPeriodState,
  NutritionSourceProfile,
  NutritionTargets,
  MealSlotType,
} from './types';

const SETUP_STORAGE_KEY = 'nutrition.v1.setup';
const LOGS_STORAGE_KEY = 'nutrition.v1.logs';

export const defaultNutritionSetup: NutritionOnboardingState = {
  completed: false,
  secondaryGoals: [],
  subscriptionMealTracking: {},
  manualMealSlots: [],
  customMealSlots: [],
  waterGoalMl: 2500,
  waterRemindersEnabled: false,
};

/**
 * A plausible finished setup, used by the lifecycle state selector to jump
 * straight to a tracking screen without walking through onboarding first.
 */
export function demoCompletedSetup(profile: NutritionSourceProfile): NutritionOnboardingState {
  return {
    ...defaultNutritionSetup,
    completed: true,
    primaryGoal: 'maintain',
    secondaryGoals: ['more_protein', 'more_water'],
    heightCm: profile.heightCm ?? 173,
    weightKg: profile.weightKg ?? 74,
    activityLevel: profile.activityLevel ?? 'light',
    calculationSex: profile.calculationSex ?? 'male',
    subscriptionMealTracking: {
      lunch: profile.subscribedMeals.includes('lunch') ? true : undefined,
      dinner: profile.subscribedMeals.includes('dinner') ? true : undefined,
    },
    manualMealSlots: ['breakfast', 'snack'],
    waterGoalMl: 2500,
  };
}

const mealSlotLabels: Record<Exclude<MealSlotType, 'custom'>, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  tea: 'Tea / Coffee',
  dinner: 'Dinner',
};

/** Section 47 order: subscription Dinner always closes the day. */
const mealDisplayOrder: MealSlotType[] = ['breakfast', 'lunch', 'snack', 'tea', 'custom', 'dinner'];

export function mealSlotLabel(type: Exclude<MealSlotType, 'custom'>) {
  return mealSlotLabels[type];
}

function totalsFor(items: NutritionFoodItem[]) {
  return items.reduce(
    (accumulator, item) => ({
      calories: accumulator.calories + item.calories,
      proteinG: accumulator.proteinG + item.proteinG,
      carbsG: accumulator.carbsG + item.carbsG,
      fatG: accumulator.fatG + item.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export function mealIdFor(date: string, slot: string) {
  return `${date}-${slot}`;
}

type SyncFailure = { kind: 'water' | 'meal'; message: string };

/** Demo data shapes the lifecycle selector can launch into. */
export type NutritionDemoDataMode = 'first_time' | 'history_only' | 'returning';

type NutritionContextValue = {
  hydrated: boolean;
  setup: NutritionOnboardingState;
  profile: NutritionSourceProfile;
  targets: NutritionTargets;
  period: NutritionPeriodState;
  setPeriod: (period: NutritionPeriodState) => void;
  dayFor: (date: string) => DailyNutritionState;
  aggregateFor: (period: NutritionPeriodState) => NutritionAggregate;
  completeSetup: (setup: NutritionOnboardingState) => Promise<void>;
  updateSetup: (patch: Partial<NutritionOnboardingState>) => void;
  addWater: (date: string, deltaMl: number) => void;
  setMealItems: (date: string, mealId: string, items: NutritionFoodItem[]) => void;
  addFood: (date: string, mealId: string, item: NutritionFoodItem) => void;
  removeFood: (date: string, mealId: string, itemId: string) => void;
  syncFailure: SyncFailure | null;
  retrySync: () => void;
  clearSyncFailure: () => void;
  resetSetup: () => void;
  /** Marks setup complete with demo values when it isn't already. */
  seedCompletedSetup: () => void;
  applyDemoLogs: (mode: NutritionDemoDataMode) => void;
  retryDayLoad: (date: string) => void;
};

const NutritionContext = createContext<NutritionContextValue | null>(null);

export function NutritionProvider({
  children,
  profile = demoSourceProfile,
}: {
  children: ReactNode;
  profile?: NutritionSourceProfile;
}) {
  const [hydrated, setHydrated] = useState(false);
  const [setup, setSetup] = useState<NutritionOnboardingState>(defaultNutritionSetup);
  const [logs, setLogs] = useState<Record<string, NutritionDayLog>>(() => seededHistory());
  const [period, setPeriod] = useState<NutritionPeriodState>(() => ({
    mode: 'daily',
    selectedDate: dateKey(new Date()),
  }));
  const [syncFailure, setSyncFailure] = useState<SyncFailure | null>(null);
  const lastFailedSync = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [storedSetup, storedLogs] = await AsyncStorage.multiGet([SETUP_STORAGE_KEY, LOGS_STORAGE_KEY]);
        if (cancelled) return;
        const setupValue = storedSetup?.[1];
        if (setupValue) setSetup({ ...defaultNutritionSetup, ...(JSON.parse(setupValue) as NutritionOnboardingState) });
        const logsValue = storedLogs?.[1];
        if (logsValue) {
          const parsed = JSON.parse(logsValue) as Record<string, NutritionDayLog>;
          setLogs((current) => ({ ...current, ...parsed }));
        }
      } catch {
        // Corrupt or unavailable storage falls back to defaults rather than blocking Nutrition.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistSetup = useCallback((next: NutritionOnboardingState) => {
    void AsyncStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const persistLogs = useCallback((next: Record<string, NutritionDayLog>) => {
    void AsyncStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const ageYears = useMemo(() => ageFromDob(profile.dob), [profile.dob]);
  const targets = useMemo(() => targetsFromSetup(setup, ageYears), [setup, ageYears]);

  const updateSetup = useCallback(
    (patch: Partial<NutritionOnboardingState>) => {
      setSetup((current) => {
        const next = { ...current, ...patch };
        persistSetup(next);
        return next;
      });
    },
    [persistSetup],
  );

  const completeSetup = useCallback(
    async (next: NutritionOnboardingState) => {
      const completed = { ...next, completed: true };
      setSetup(completed);
      persistSetup(completed);
      try {
        await pushNutritionSetup(completed);
      } catch {
        // Setup is already local-first; a failed push retries on the next change.
      }
    },
    [persistSetup],
  );

  const resetSetup = useCallback(() => {
    setSetup(defaultNutritionSetup);
    persistSetup(defaultNutritionSetup);
  }, [persistSetup]);

  /**
   * Replaces logged data so the lifecycle selector can show a genuinely empty
   * first run, a day not yet logged, or a day already filled in.
   */
  const applyDemoLogs = useCallback(
    (mode: NutritionDemoDataMode) => {
      const today = dateKey(new Date());
      const next =
        mode === 'first_time'
          ? {}
          : mode === 'history_only'
            ? seededHistory()
            : { ...seededHistory(), [today]: seededTodayLog(today) };
      setLogs(next);
      persistLogs(next);
    },
    [persistLogs],
  );

  const seedCompletedSetup = useCallback(() => {
    setSetup((current) => {
      if (current.completed) return current;
      const seeded = demoCompletedSetup(profile);
      persistSetup(seeded);
      return seeded;
    });
  }, [persistSetup, profile]);

  /**
   * Writes a day log derived from the state of the current render. The next
   * value is computed here rather than inside a setState updater so the caller
   * can hand the same value to the sync request.
   */
  const writeLog = useCallback(
    (date: string, next: NutritionDayLog) => {
      setLogs((current) => {
        const merged = { ...current, [date]: next };
        persistLogs(merged);
        return merged;
      });
    },
    [persistLogs],
  );

  const logFor = useCallback(
    (date: string): NutritionDayLog => logs[date] ?? { date, waterMl: 0, mealItems: {} },
    [logs],
  );

  const runSync = useCallback(async (kind: SyncFailure['kind'], message: string, operation: () => Promise<void>) => {
    try {
      await operation();
      setSyncFailure((current) => (current?.kind === kind ? null : current));
      lastFailedSync.current = null;
    } catch {
      lastFailedSync.current = operation;
      setSyncFailure({ kind, message });
    }
  }, []);

  const addWater = useCallback(
    (date: string, deltaMl: number) => {
      const log = logFor(date);
      const nextTotal = Math.max(0, log.waterMl + deltaMl);
      writeLog(date, { ...log, waterMl: nextTotal });
      void runSync('water', "Couldn't sync your water update.", () => pushWaterTotal(date, nextTotal));
    },
    [logFor, runSync, writeLog],
  );

  const setMealItems = useCallback(
    (date: string, mealId: string, items: NutritionFoodItem[]) => {
      const log = logFor(date);
      writeLog(date, { ...log, mealItems: { ...log.mealItems, [mealId]: items } });
      void runSync('meal', "Couldn't sync this meal.", () => pushMealItems(date, mealId, items));
    },
    [logFor, runSync, writeLog],
  );

  const addFood = useCallback(
    (date: string, mealId: string, item: NutritionFoodItem) => {
      const log = logFor(date);
      const nextItems = [...(log.mealItems[mealId] ?? defaultItemsFor(date, mealId, setup)), item];
      writeLog(date, { ...log, mealItems: { ...log.mealItems, [mealId]: nextItems } });
      void runSync('meal', "Couldn't sync this meal.", () => pushMealItems(date, mealId, nextItems));
    },
    [logFor, runSync, setup, writeLog],
  );

  const removeFood = useCallback(
    (date: string, mealId: string, itemId: string) => {
      const log = logFor(date);
      const current = log.mealItems[mealId] ?? defaultItemsFor(date, mealId, setup);
      const nextItems = current.filter((item) => item.id !== itemId);
      writeLog(date, { ...log, mealItems: { ...log.mealItems, [mealId]: nextItems } });
      void runSync('meal', "Couldn't sync this meal.", () => pushMealItems(date, mealId, nextItems));
    },
    [logFor, runSync, setup, writeLog],
  );

  const retrySync = useCallback(() => {
    const operation = lastFailedSync.current;
    if (!operation) {
      setSyncFailure(null);
      return;
    }
    void (async () => {
      try {
        await operation();
        lastFailedSync.current = null;
        setSyncFailure(null);
      } catch {
        // Keeps the optimistic value and the retry affordance in place.
      }
    })();
  }, []);

  const clearSyncFailure = useCallback(() => setSyncFailure(null), []);

  /**
   * Re-resolves a day's meals. Day content is derived locally in V1, so this
   * only re-attempts the server refresh; it never clears what is already shown.
   */
  const retryDayLoad = useCallback((date: string) => {
    void pullNutritionDay(date).catch(() => undefined);
    setLogs((current) => ({ ...current }));
  }, []);

  const buildMeals = useCallback(
    (date: string): NutritionMeal[] => {
      const log = logs[date];
      const relation = dayRelation(date);
      const meals: NutritionMeal[] = [];

      const trackedSubscriptionMeals = (['lunch', 'dinner'] as const).filter(
        (slot) => profile.subscribedMeals.includes(slot) && setup.subscriptionMealTracking[slot] !== false,
      );

      for (const slot of mealDisplayOrder) {
        if (slot === 'custom') {
          for (const custom of setup.customMealSlots) {
            const id = mealIdFor(date, custom.id);
            const items = log?.mealItems[id] ?? [];
            meals.push({
              id,
              label: custom.name,
              type: 'custom',
              source: 'manual',
              foodItems: items,
              totals: totalsFor(items),
            });
          }
          continue;
        }

        if (slot === 'lunch' || slot === 'dinner') {
          if (!trackedSubscriptionMeals.includes(slot)) continue;
          const id = mealIdFor(date, slot);
          const scheduled = relation === 'future';
          const items = scheduled ? [] : log?.mealItems[id] ?? subscriptionMenuFor(slot, date);
          // An unresolvable menu keeps the card mounted with a Retry affordance
          // rather than dropping Lunch or Dinner from the day.
          const loadFailed = !scheduled && items.length === 0;
          meals.push({
            id,
            label: mealSlotLabels[slot],
            type: slot,
            source: 'subscription',
            menuLabel: slot === 'lunch' ? profile.lunchMenuLabel : profile.dinnerMenuLabel,
            foodItems: items,
            totals: totalsFor(items),
            scheduled,
            loadFailed,
          });
          continue;
        }

        if (!setup.manualMealSlots.includes(slot)) continue;
        const id = mealIdFor(date, slot);
        const items = log?.mealItems[id] ?? [];
        meals.push({
          id,
          label: mealSlotLabels[slot],
          type: slot,
          source: 'manual',
          foodItems: items,
          totals: totalsFor(items),
        });
      }

      return meals;
    },
    [logs, profile, setup],
  );

  const dayFor = useCallback(
    (date: string): DailyNutritionState => {
      const meals = buildMeals(date);
      const totals = mealTotals(meals);
      const waterMl = logs[date]?.waterMl ?? 0;
      const state: DailyNutritionState = {
        date,
        calories: { consumed: totals.calories, target: targets.calories },
        protein: { consumed: totals.proteinG, target: targets.proteinG },
        carbs: { consumed: totals.carbsG, target: targets.carbsG },
        fat: { consumed: totals.fatG, target: targets.fatG },
        water: { consumed: waterMl, target: targets.waterMl },
        meals,
      };
      if (dayRelation(date) === 'today') {
        state.actionable = pickActionable(state);
      }
      return state;
    },
    [buildMeals, logs, targets],
  );

  const aggregateFor = useCallback(
    (target: NutritionPeriodState): NutritionAggregate => {
      const keys = periodDayKeys(target);
      let calories = 0;
      let proteinG = 0;
      let carbsG = 0;
      let fatG = 0;
      let waterMl = 0;
      let mealsTracked = 0;
      let subscriptionMeals = 0;
      let daysCounted = 0;

      for (const key of keys) {
        const day = dayFor(key);
        const dayMeals = day.meals.filter((meal) => meal.foodItems.length > 0);
        if (dayMeals.length === 0 && day.water.consumed === 0) continue;
        daysCounted += 1;
        calories += day.calories.consumed;
        proteinG += day.protein.consumed;
        carbsG += day.carbs.consumed;
        fatG += day.fat.consumed;
        waterMl += day.water.consumed;
        mealsTracked += dayMeals.length;
        subscriptionMeals += dayMeals.filter((meal) => meal.source === 'subscription').length;
      }

      const divisor = Math.max(1, daysCounted);
      const daysElapsed = Math.max(1, keys.length);
      return {
        label: periodLabel(target),
        calories,
        proteinG,
        carbsG,
        fatG,
        waterMl,
        daysCounted,
        daysElapsed,
        mealsTracked,
        subscriptionMeals,
        avgCaloriesPerDay: Math.round(calories / divisor),
        avgProteinPerDay: Math.round(proteinG / divisor),
        targetCalories: targets.calories * daysElapsed,
        targetWaterMl: targets.waterMl * daysElapsed,
      };
    },
    [dayFor, targets],
  );

  const value = useMemo<NutritionContextValue>(
    () => ({
      hydrated,
      setup,
      profile,
      targets,
      period,
      setPeriod,
      dayFor,
      aggregateFor,
      completeSetup,
      updateSetup,
      addWater,
      setMealItems,
      addFood,
      removeFood,
      syncFailure,
      retrySync,
      clearSyncFailure,
      resetSetup,
      seedCompletedSetup,
      applyDemoLogs,
      retryDayLoad,
    }),
    [
      hydrated,
      setup,
      profile,
      targets,
      period,
      dayFor,
      aggregateFor,
      completeSetup,
      updateSetup,
      addWater,
      setMealItems,
      addFood,
      removeFood,
      syncFailure,
      retrySync,
      clearSyncFailure,
      resetSetup,
      seedCompletedSetup,
      applyDemoLogs,
      retryDayLoad,
    ],
  );

  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>;
}

/** Subscription meals start pre-filled, so edits diff against the menu. */
function defaultItemsFor(date: string, mealId: string, setup: NutritionOnboardingState): NutritionFoodItem[] {
  if (mealId === mealIdFor(date, 'lunch') && setup.subscriptionMealTracking.lunch !== false) {
    return subscriptionMenuFor('lunch', date);
  }
  if (mealId === mealIdFor(date, 'dinner') && setup.subscriptionMealTracking.dinner !== false) {
    return subscriptionMenuFor('dinner', date);
  }
  return [];
}

export function useNutrition() {
  const context = useContext(NutritionContext);
  if (!context) throw new Error('useNutrition must be used within NutritionProvider');
  return context;
}

export function useCustomMealSlotFactory() {
  return useCallback((name: string): CustomMealSlot => ({ id: `custom-${Date.now().toString(36)}`, name }), []);
}
