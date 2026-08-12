import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { hapticPress } from '../haptics';
import { navContentInset } from '../subscriberNavigation';
import { MealEditorSheet } from './MealEditorSheet';
import { FoodPickerSheet } from './FoodPickerSheet';
import { NutritionMealList } from './NutritionMealList';
import { NutritionPeriodCarousel, NutritionPeriodDropdown, NutritionPeriodMenu } from './NutritionPeriodControls';
import { WaterTrackingCard } from './WaterTrackingCard';
import {
  MacroProgress,
  NutritionCard,
  ProgressTrack,
  STATES_PILL_CLEARANCE,
  SectionTitle,
  UndoToast,
} from './nutritionComponents';
import { track } from './nutritionAnalytics';
import { useNutrition } from './nutritionStore';
import { subscriptionContribution } from './nutritionTargets';
import {
  dateKey,
  dayRelation,
  isFuturePeriod,
  periodLabel,
  selectedCarouselId,
  withSelection,
} from './periodModel';
import type { NutritionFoodItem, NutritionMeal, NutritionPeriodMode } from './types';

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-body text-body-sm text-muted">{label}</Text>
      <Text className="font-mono-semibold text-body-sm text-foreground">{value}</Text>
    </View>
  );
}

export function NutritionScreen({ onEditorVisibilityChange }: { onEditorVisibilityChange?: (open: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const {
    period,
    setPeriod,
    dayFor,
    aggregateFor,
    addWater,
    setMealItems,
    addFood,
    targets,
    syncFailure,
    retrySync,
    retryDayLoad,
  } = useNutrition();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<NutritionMeal | null>(null);
  const [addingToMeal, setAddingToMeal] = useState<NutritionMeal | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [undo, setUndo] = useState<(() => void) | null>(null);

  useEffect(() => {
    track('nutrition_opened', {});
  }, []);

  useEffect(() => {
    onEditorVisibilityChange?.(Boolean(editingMeal || addingToMeal));
  }, [addingToMeal, editingMeal, onEditorVisibilityChange]);

  const todayKey = dateKey(new Date());
  const selectedDate = period.selectedDate ?? todayKey;
  const relation = dayRelation(selectedDate);
  const isDaily = period.mode === 'daily';

  const day = useMemo(() => dayFor(selectedDate), [dayFor, selectedDate]);
  const aggregate = useMemo(() => aggregateFor(period), [aggregateFor, period]);
  const contribution = useMemo(() => subscriptionContribution(day.meals), [day.meals]);
  const futurePeriod = isFuturePeriod(period);

  // Aggregate targets scale by elapsed days so a mid-week view is not compared
  // against a full week's target.
  const elapsed = aggregate.daysElapsed;
  const calories = isDaily ? day.calories : { consumed: aggregate.calories, target: aggregate.targetCalories };
  const protein = isDaily ? day.protein : { consumed: aggregate.proteinG, target: targets.proteinG * elapsed };
  const carbs = isDaily ? day.carbs : { consumed: aggregate.carbsG, target: targets.carbsG * elapsed };
  const fat = isDaily ? day.fat : { consumed: aggregate.fatG, target: targets.fatG * elapsed };
  const water = isDaily ? day.water : { consumed: aggregate.waterMl, target: aggregate.targetWaterMl };

  const caloriesHeading = isDaily ? 'Calories eaten' : period.mode === 'weekly' ? 'Calories this week' : 'Calories this month';

  const changeMode = (mode: NutritionPeriodMode) => {
    setPeriod({ ...period, mode });
    setDropdownOpen(false);
    track('nutrition_period_mode_changed', { mode });
  };

  const selectPeriod = (id: string) => {
    setPeriod(withSelection(period, id));
    track('nutrition_period_selected', { mode: period.mode, id });
  };

  const showRemovedToast = (item: NutritionFoodItem, restore: () => void) => {
    setToast(`${item.name} removed`);
    setUndo(() => restore);
  };

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        contentContainerStyle={{ paddingBottom: navContentInset(insets.bottom) }}
      >
        {/* Extra right padding keeps the period control clear of the floating dev States pill. */}
        <View style={{ paddingTop: insets.top + 12, paddingRight: STATES_PILL_CLEARANCE }} className="bg-canvas pb-3 pl-5">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="font-heading text-heading-md text-foreground">Nutrition</Text>
            <NutritionPeriodDropdown
              mode={period.mode}
              open={dropdownOpen}
              onToggle={() => setDropdownOpen((open) => !open)}
            />
          </View>
        </View>

        <View className="gap-sheet-gap pt-1">
          <NutritionPeriodCarousel period={period} onSelect={selectPeriod} />

          <View className="gap-3 px-5">
            {syncFailure ? (
              <View className="flex-row items-center justify-between gap-3 rounded-field bg-warning-soft p-sheet">
                <Text className="min-w-0 flex-1 font-body text-body-xs text-warning-emphasis">{syncFailure.message}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry sync"
                  onPress={hapticPress(retrySync, 'light')}
                  className="min-h-11 justify-center"
                >
                  <Text className="font-mono-semibold text-body-sm text-warning-emphasis">Retry</Text>
                </Pressable>
              </View>
            ) : null}

            {futurePeriod ? (
              <NutritionCard>
                <Text className="font-heading text-heading-sm text-foreground">Coming up</Text>
                <Text className="mt-2 font-body text-body-sm text-muted">
                  {isDaily && day.meals.length > 0
                    ? `${day.meals.map((meal) => meal.label).join(' and ')} are scheduled. Nutrition values will appear after meals are logged.`
                    : 'Nutrition values will appear once this period starts.'}
                </Text>
              </NutritionCard>
            ) : (
              <Animated.View key={`${period.mode}-${selectedCarouselId(period)}`} entering={FadeInUp.duration(220)} className="gap-3">
                <NutritionCard>
                  <Text className="font-body text-body-sm text-muted">{caloriesHeading}</Text>
                  <Text
                    accessibilityLabel={`${Math.round(calories.consumed)} of ${Math.round(calories.target)} kilocalories`}
                    className="mt-1 font-heading text-heading-xl text-foreground"
                  >
                    {Math.round(calories.consumed).toLocaleString('en-IN')} kcal
                  </Text>
                  <Text className="mt-1 font-body text-body-xs text-muted">
                    of {Math.round(calories.target).toLocaleString('en-IN')} kcal target
                  </Text>
                  <View className="mt-3">
                    <ProgressTrack value={calories.consumed} target={calories.target} />
                  </View>

                  <View className="mt-4 flex-row gap-3">
                    <MacroProgress label="Carbs" consumed={carbs.consumed} target={carbs.target} />
                    <MacroProgress label="Fat" consumed={fat.consumed} target={fat.target} />
                    <MacroProgress label="Protein" consumed={protein.consumed} target={protein.target} />
                  </View>

                  {isDaily && contribution.count > 0 ? (
                    <View className="mt-4 rounded-field bg-accent-soft p-sheet">
                      <Text className="font-mono-semibold text-body-sm text-foreground">
                        {contribution.labels.join(' + ')} contributed {Math.round(contribution.calories)} kcal
                      </Text>
                      <Text className="mt-1 font-body text-body-xs text-muted">
                        {contribution.count} subscription {contribution.count === 1 ? 'meal' : 'meals'} tracked automatically
                      </Text>
                    </View>
                  ) : null}
                  {!isDaily && aggregate.subscriptionMeals > 0 ? (
                    <View className="mt-4 rounded-field bg-accent-soft p-sheet">
                      <Text className="font-mono-semibold text-body-sm text-foreground">
                        {aggregate.subscriptionMeals} subscription meals tracked automatically
                      </Text>
                    </View>
                  ) : null}
                </NutritionCard>

                <WaterTrackingCard
                  consumedMl={water.consumed}
                  targetMl={water.target}
                  editable={isDaily && relation === 'today'}
                  periodLabel={isDaily ? 'Daily goal' : 'Period goal'}
                  onAdd={(ml) => {
                    addWater(selectedDate, ml);
                    track('nutrition_water_added', { ml });
                  }}
                />

                {isDaily && relation === 'today' && day.actionable ? (
                  <NutritionCard>
                    <Text className="font-body text-body-xs text-muted">One thing to focus on</Text>
                    <Text className="mt-1 font-heading text-heading-sm text-foreground">{day.actionable.title}</Text>
                    <Text className="mt-1 font-body text-body-sm text-muted">{day.actionable.body}</Text>
                    {day.actionable.actionLabel ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={day.actionable.actionLabel}
                        onPress={hapticPress(() => {
                          track('nutrition_actionable_clicked', { kind: day.actionable?.kind });
                          const amount = day.actionable?.addWaterMl;
                          if (amount) addWater(selectedDate, amount);
                        }, 'light')}
                        className="mt-2 min-h-11 justify-center self-start"
                      >
                        <Text className="font-mono-semibold text-body-sm text-accent">{day.actionable.actionLabel}</Text>
                      </Pressable>
                    ) : null}
                  </NutritionCard>
                ) : null}

                {isDaily ? (
                  <View className="gap-3">
                    <SectionTitle>{relation === 'today' ? 'Today' : periodLabel(period)}</SectionTitle>
                    <NutritionMealList
                      meals={day.meals}
                      relation={relation}
                      onEdit={(meal) => {
                        setEditingMeal(meal);
                        track('nutrition_meal_opened', { mealType: meal.type });
                      }}
                      onAddFood={(meal) => setAddingToMeal(meal)}
                      onRetry={() => retryDayLoad(selectedDate)}
                    />
                  </View>
                ) : (
                  <View className="gap-3">
                    <SectionTitle>{period.mode === 'weekly' ? 'Week summary' : 'Month summary'}</SectionTitle>
                    <NutritionCard>
                      <View className="gap-2">
                        <StatRow label="Meals tracked" value={String(aggregate.mealsTracked)} />
                        <StatRow label="Subscription meals" value={String(aggregate.subscriptionMeals)} />
                        <StatRow label="Avg kcal / day" value={`${aggregate.avgCaloriesPerDay.toLocaleString('en-IN')} kcal`} />
                        <StatRow label="Avg protein / day" value={`${aggregate.avgProteinPerDay}g`} />
                        <StatRow label="Water logged" value={`${(aggregate.waterMl / 1000).toFixed(1)} L`} />
                        <StatRow label="Days tracked" value={String(aggregate.daysCounted)} />
                      </View>
                    </NutritionCard>
                  </View>
                )}
              </Animated.View>
            )}
          </View>
        </View>
      </ScrollView>

      {dropdownOpen ? (
        <NutritionPeriodMenu
          mode={period.mode}
          top={insets.top + 60}
          right={STATES_PILL_CLEARANCE}
          onSelect={changeMode}
          onDismiss={() => setDropdownOpen(false)}
        />
      ) : null}

      {editingMeal ? (
        <MealEditorSheet
          meal={editingMeal}
          onClose={() => setEditingMeal(null)}
          onSave={(items) => setMealItems(selectedDate, editingMeal.id, items)}
          onRemoved={showRemovedToast}
        />
      ) : null}

      {addingToMeal ? (
        <FoodPickerSheet
          mealLabel={addingToMeal.label}
          onClose={() => setAddingToMeal(null)}
          onAdd={(item) => {
            addFood(selectedDate, addingToMeal.id, item);
            track('nutrition_food_added', { mealType: addingToMeal.type, source: item.source });
            setAddingToMeal(null);
          }}
        />
      ) : null}

      {toast && undo ? (
        <UndoToast
          message={toast}
          onAction={() => {
            undo();
            setToast(null);
            setUndo(null);
          }}
          onDismiss={() => {
            setToast(null);
            setUndo(null);
          }}
        />
      ) : null}
    </View>
  );
}
