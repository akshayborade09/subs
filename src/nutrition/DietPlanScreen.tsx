import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticPress } from '../haptics';
import { navContentInset } from '../subscriberNavigation';
import { NutritionPreferencesSheet } from './NutritionPreferencesSheet';
import { MacroProgress, NutritionCard, SectionTitle } from './nutritionComponents';
import { track } from './nutritionAnalytics';
import { mealSlotLabel, useNutrition } from './nutritionStore';
import { subscriptionContribution } from './nutritionTargets';
import { dateKey } from './periodModel';
import { formatWaterGoal } from './WaterGoalRuler';
import type { NutritionGoal } from './types';

const goalLabels: Record<NutritionGoal, string> = {
  lose_weight: 'Lose weight',
  maintain: 'Eat healthier & maintain weight',
  gain_weight: 'Gain weight',
  build_muscle: 'Build muscle / increase protein',
  understand: 'Understand my nutrition',
};

function TargetRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-body text-body-sm text-muted">{label}</Text>
      <Text className="font-mono-semibold text-body-md text-foreground">{value}</Text>
    </View>
  );
}

export function DietPlanScreen() {
  const insets = useSafeAreaInsets();
  const { setup, targets, dayFor, profile } = useNutrition();
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    track('diet_plan_opened', {});
  }, []);

  const today = dateKey(new Date());
  const day = useMemo(() => dayFor(today), [dayFor, today]);
  const contribution = useMemo(() => subscriptionContribution(day.meals), [day.meals]);

  const coveredShare = targets.calories > 0 ? Math.round((contribution.calories / targets.calories) * 100) : 0;

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: navContentInset(insets.bottom) }}
      >
        <View style={{ paddingTop: insets.top + 12 }} className="px-5 pb-3">
          <Text className="font-heading text-heading-md text-foreground">Diet Plan</Text>
        </View>

        <View className="gap-3 px-5">
          <NutritionCard>
            <Text className="font-body text-body-xs text-muted">Your goal</Text>
            <Text className="mt-1 font-heading text-heading-sm text-foreground">
              {setup.primaryGoal ? goalLabels[setup.primaryGoal] : 'Understand my nutrition'}
            </Text>
            {setup.activityLevel ? (
              <Text className="mt-2 font-body text-body-sm text-muted">
                Targets are based on your body details and a {setup.activityLevel.replace('_', ' ')} weekly routine.
              </Text>
            ) : null}
          </NutritionCard>

          <NutritionCard>
            <Text className="font-heading text-heading-sm text-foreground">Daily targets</Text>
            <View className="mt-3 gap-2">
              <TargetRow label="Calories" value={`${targets.calories.toLocaleString('en-IN')} kcal`} />
              <TargetRow label="Protein" value={`${targets.proteinG}g`} />
              <TargetRow label="Carbs" value={`${targets.carbsG}g`} />
              <TargetRow label="Fat" value={`${targets.fatG}g`} />
              <TargetRow label="Water" value={formatWaterGoal(targets.waterMl)} />
            </View>
            <View className="mt-3 flex-row items-center justify-between gap-3">
              <Text className="min-w-0 flex-1 font-body text-body-xs text-muted">
                Water reminders {setup.waterRemindersEnabled ? `every ${setup.waterReminderIntervalHours ?? 3} hours` : 'off'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit water preferences"
                onPress={hapticPress(() => setPreferencesOpen(true), 'light')}
                className="min-h-11 shrink-0 justify-center"
              >
                <Text className="font-mono-semibold text-body-sm text-accent">Edit water</Text>
              </Pressable>
            </View>
          </NutritionCard>

          <NutritionCard>
            <Text className="font-heading text-heading-sm text-foreground">Your subscription covers</Text>
            {contribution.count > 0 ? (
              <>
                <Text className="mt-2 font-mono-semibold text-body-md text-foreground">
                  {contribution.labels.join(' + ')}
                </Text>
                <Text className="mt-1 font-body text-body-sm text-muted">
                  ~{Math.round(contribution.calories)} kcal · ~{Math.round(contribution.proteinG)}g protein — about{' '}
                  {coveredShare}% of your daily calorie target.
                </Text>
                <View className="mt-4 flex-row gap-3">
                  <MacroProgress
                    label="Calories covered"
                    consumed={contribution.calories}
                    target={targets.calories}
                    unit=" kcal"
                  />
                  <MacroProgress label="Protein covered" consumed={contribution.proteinG} target={targets.proteinG} />
                </View>
              </>
            ) : (
              <Text className="mt-2 font-body text-body-sm text-muted">
                No subscription meals are being tracked right now.
              </Text>
            )}
          </NutritionCard>

          <View className="gap-3">
            <SectionTitle>Tracked meals</SectionTitle>
            <NutritionCard>
              <View className="gap-2">
                {profile.subscribedMeals
                  .filter((slot) => setup.subscriptionMealTracking[slot] !== false)
                  .map((slot) => (
                    <TargetRow key={slot} label={mealSlotLabel(slot)} value="Automatic" />
                  ))}
                {setup.manualMealSlots.map((slot) => (
                  <TargetRow key={slot} label={mealSlotLabel(slot)} value="Manual" />
                ))}
                {setup.customMealSlots.map((slot) => (
                  <TargetRow key={slot.id} label={slot.name} value="Manual" />
                ))}
              </View>
            </NutritionCard>
          </View>

          <NutritionCard>
            <Text className="font-heading text-heading-sm text-foreground">Coming soon</Text>
            <Text className="mt-2 font-body text-body-sm text-muted">
              Meal recommendations, goal adjustments and diet guidance will build on these targets.
            </Text>
          </NutritionCard>
        </View>
      </ScrollView>

      {preferencesOpen ? <NutritionPreferencesSheet onClose={() => setPreferencesOpen(false)} /> : null}
    </View>
  );
}
