import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { AccentSwitch, PrimaryShimmerButton } from '../primaryButton';
import { hapticPress } from '../haptics';
import { useFieldPlaceholderColor, useThemePalette } from '../themeColors';
import { track } from './nutritionAnalytics';
import { buildNutritionSteps, stepTitles } from './nutritionOnboardingSteps';
import { defaultNutritionSetup, mealSlotLabel, useNutrition } from './nutritionStore';
import {
  InfoNotice,
  NutritionSheet,
  STATES_PILL_CLEARANCE,
  SelectionCard,
  SelectionChip,
  SheetCloseButton,
  SubscriptionBadge,
} from './nutritionComponents';
import {
  UnitToggle,
  VerticalValuePicker,
  heightOptions,
  weightOptions,
  type HeightUnit,
  type WeightUnit,
} from './VerticalValuePicker';
import { WaterGoalRuler, formatWaterGoal } from './WaterGoalRuler';
import { openNotificationSettings, requestWaterReminderPermission, scheduleWaterReminders } from './waterReminders';
import { subscriptionContribution, targetsFromSetup, ageFromDob } from './nutritionTargets';
import { dateKey } from './periodModel';
import { subscriptionMenuFor } from './nutritionMockData';
import type {
  ActivityLevel,
  CustomMealSlot,
  NutritionGoal,
  NutritionOnboardingState,
  NutritionSecondaryGoal,
  WaterReminderIntervalHours,
} from './types';

const primaryGoals: Array<{ id: NutritionGoal; title: string }> = [
  { id: 'lose_weight', title: 'Lose weight' },
  { id: 'maintain', title: 'Eat healthier & maintain weight' },
  { id: 'gain_weight', title: 'Gain weight' },
  { id: 'build_muscle', title: 'Build muscle / increase protein' },
  { id: 'understand', title: 'Understand my nutrition' },
];

const secondaryGoals: Array<{ id: NutritionSecondaryGoal; title: string }> = [
  { id: 'balanced_meals', title: 'Eat more balanced meals' },
  { id: 'more_protein', title: 'Get more protein' },
  { id: 'portion_awareness', title: 'Improve portion awareness' },
  { id: 'more_water', title: 'Drink more water' },
  { id: 'meal_consistency', title: 'Be more consistent with meals' },
];

const activityLevels: Array<{ id: ActivityLevel; title: string; description: string }> = [
  { id: 'sedentary', title: 'Mostly sitting', description: 'Little structured activity.' },
  { id: 'light', title: 'Lightly active', description: 'Some walking or activity during the week.' },
  { id: 'active', title: 'Active most days', description: 'Regular exercise or an active routine.' },
  { id: 'very_active', title: 'Very active', description: 'High daily activity or frequent training.' },
];

const manualSlots = ['breakfast', 'snack', 'tea'] as const;
const reminderIntervals: WaterReminderIntervalHours[] = [2, 3, 4];

function ProgressHeader({
  step,
  total,
  title,
  onBack,
}: {
  step: number;
  total: number;
  title: string;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  return (
    // Right padding keeps the progress bar and title clear of the dev States pill.
    <View style={{ paddingTop: insets.top + 12, paddingRight: STATES_PILL_CLEARANCE }} className="bg-canvas pb-2 pl-5">
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step + 1} of ${total}`}
        accessibilityValue={{ min: 1, max: total, now: step + 1 }}
        className="h-1.5 flex-row gap-1.5"
      >
        {Array.from({ length: total }, (_, index) => (
          <View key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-accent' : 'bg-surface'}`} />
        ))}
      </View>
      <View className="mt-4 flex-row items-start gap-3">
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={hapticPress(onBack, 'light')}
            hitSlop={12}
            className="size-6 items-center justify-center"
          >
            <CaretLeftIcon size={24} weight="regular" color={iconColor} />
          </Pressable>
        ) : null}
        <Text className="min-w-0 flex-1 font-heading text-heading-md text-foreground">{title}</Text>
      </View>
    </View>
  );
}

function AddCustomMealSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  const placeholderColor = useFieldPlaceholderColor();
  const trimmed = name.trim();
  return (
    <NutritionSheet onClose={onClose} closeLabel="Close add meal">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-auth-block">
          <Text className="font-heading text-heading-sm text-foreground">Add another meal</Text>
          <Text className="font-body text-body-sm text-subtle">Evening snack, pre-workout, late dinner — whatever fits your day.</Text>
        </View>
        <SheetCloseButton onPress={onClose} label="Close add meal" />
      </View>
      <View className="mt-sheet-gap gap-sheet-gap">
        <TextInput
          value={name}
          onChangeText={setName}
          autoFocus
          placeholder="Meal name"
          placeholderTextColor={placeholderColor}
          returnKeyType="done"
          onSubmitEditing={() => trimmed && onAdd(trimmed)}
          accessibilityLabel="Meal name"
          className="h-field rounded-field bg-field px-4 font-body-medium text-body-md tracking-body-md text-foreground"
        />
        <PrimaryShimmerButton label="Add meal" enabled={trimmed.length > 0} onPress={() => onAdd(trimmed)} />
      </View>
    </NutritionSheet>
  );
}

export function NutritionOnboarding({ onComplete }: { onComplete: () => void }) {
  const insets = useSafeAreaInsets();
  const { profile, completeSetup, setup: storedSetup } = useNutrition();
  const palette = useThemePalette();

  const steps = useMemo(() => buildNutritionSteps(profile), [profile]);
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<NutritionOnboardingState>(() => ({
    ...defaultNutritionSetup,
    ...storedSetup,
    completed: false,
    heightCm: storedSetup.heightCm ?? profile.heightCm ?? 170,
    weightKg: storedSetup.weightKg ?? profile.weightKg ?? 70,
    activityLevel: storedSetup.activityLevel ?? profile.activityLevel,
    calculationSex: storedSetup.calculationSex ?? profile.calculationSex,
    subscriptionMealTracking: {
      lunch: profile.subscribedMeals.includes('lunch') ? storedSetup.subscriptionMealTracking.lunch ?? true : undefined,
      dinner: profile.subscribedMeals.includes('dinner') ? storedSetup.subscriptionMealTracking.dinner ?? true : undefined,
    },
  }));
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [customSheetOpen, setCustomSheetOpen] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    track('nutrition_onboarding_started', { steps: steps.length });
  }, [steps.length]);

  const step = steps[stepIndex] ?? 'summary';
  const isLast = stepIndex === steps.length - 1;

  const patch = (next: Partial<NutritionOnboardingState>) => setDraft((current) => ({ ...current, ...next }));

  const goBack = stepIndex > 0 ? () => setStepIndex((index) => index - 1) : undefined;

  const advance = async () => {
    if (step === 'water' && draft.waterRemindersEnabled) {
      const result = await requestWaterReminderPermission();
      if (result === 'granted') {
        await scheduleWaterReminders(draft.waterReminderIntervalHours ?? 3);
        setPermissionDenied(false);
      } else if (result === 'denied') {
        // Reminders stay off, but onboarding is never blocked on the OS prompt.
        setPermissionDenied(true);
        patch({ waterRemindersEnabled: false });
      }
    }
    if (isLast) {
      setSaving(true);
      await completeSetup(draft);
      track('nutrition_onboarding_completed', {
        primaryGoal: draft.primaryGoal,
        manualMeals: draft.manualMealSlots.length,
        customMeals: draft.customMealSlots.length,
        waterGoalMl: draft.waterGoalMl,
      });
      setSaving(false);
      onComplete();
      return;
    }
    setStepIndex((index) => index + 1);
  };

  const canAdvance = (() => {
    if (step === 'primaryGoal') return Boolean(draft.primaryGoal);
    if (step === 'activity') return Boolean(draft.activityLevel);
    if (step === 'calculationSex') return Boolean(draft.calculationSex);
    return true;
  })();

  const ctaLabel = isLast ? 'Start tracking today' : 'Next';

  return (
    <View className="absolute inset-0 z-40 bg-canvas">
      <ProgressHeader step={stepIndex} total={steps.length} title={stepTitles[step]} onBack={goBack} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 140 }}
      >
        <Animated.View key={step} entering={FadeInUp.duration(240)}>
          {step === 'primaryGoal' ? (
            <View className="gap-3">
              {primaryGoals.map((goal) => (
                <SelectionCard
                  key={goal.id}
                  title={goal.title}
                  selected={draft.primaryGoal === goal.id}
                  onPress={() => {
                    patch({ primaryGoal: goal.id });
                    track('nutrition_goal_selected', { goal: goal.id });
                  }}
                />
              ))}
            </View>
          ) : null}

          {step === 'secondaryGoals' ? (
            <View className="gap-3">
              <Text className="font-body text-body-sm text-subtle">Optional — pick as many as you like.</Text>
              {secondaryGoals.map((goal) => {
                const selected = draft.secondaryGoals.includes(goal.id);
                return (
                  <SelectionCard
                    key={goal.id}
                    title={goal.title}
                    multi
                    selected={selected}
                    onPress={() => {
                      const next = selected
                        ? draft.secondaryGoals.filter((item) => item !== goal.id)
                        : [...draft.secondaryGoals, goal.id];
                      patch({ secondaryGoals: next });
                      if (!selected) track('nutrition_secondary_goal_selected', { goal: goal.id });
                    }}
                  />
                );
              })}
            </View>
          ) : null}

          {step === 'height' ? (
            <View className="gap-sheet-gap">
              <UnitToggle
                options={[
                  { id: 'cm' as HeightUnit, label: 'cm' },
                  { id: 'ft_in' as HeightUnit, label: 'ft/in' },
                ]}
                value={heightUnit}
                onChange={setHeightUnit}
              />
              <VerticalValuePicker
                options={heightOptions(heightUnit)}
                value={draft.heightCm ?? 170}
                onChange={(value) => {
                  patch({ heightCm: value });
                  track('nutrition_height_updated', { unit: heightUnit });
                }}
                accessibilityLabel="Height"
                suffix={heightUnit === 'cm' ? 'centimetres' : undefined}
              />
              <Text className="text-center font-body text-body-sm text-subtle">
                Used only to estimate your daily energy needs.
              </Text>
            </View>
          ) : null}

          {step === 'weight' ? (
            <View className="gap-sheet-gap">
              <Text className="text-center font-body text-body-sm text-subtle">
                An estimate is fine. You can update it anytime.
              </Text>
              <UnitToggle
                options={[
                  { id: 'kg' as WeightUnit, label: 'kg' },
                  { id: 'lbs' as WeightUnit, label: 'lbs' },
                ]}
                value={weightUnit}
                onChange={setWeightUnit}
              />
              <VerticalValuePicker
                options={weightOptions(weightUnit)}
                value={draft.weightKg ?? 70}
                onChange={(value) => {
                  patch({ weightKg: value });
                  track('nutrition_weight_updated', { unit: weightUnit });
                }}
                accessibilityLabel="Weight"
                suffix={weightUnit === 'kg' ? 'kilograms' : undefined}
              />
            </View>
          ) : null}

          {step === 'activity' ? (
            <View className="gap-3">
              {activityLevels.map((level) => (
                <SelectionCard
                  key={level.id}
                  title={level.title}
                  description={level.description}
                  selected={draft.activityLevel === level.id}
                  onPress={() => {
                    patch({ activityLevel: level.id });
                    track('nutrition_activity_selected', { level: level.id });
                  }}
                />
              ))}
            </View>
          ) : null}

          {step === 'calculationSex' ? (
            <View className="gap-3">
              <Text className="font-body text-body-sm text-subtle">
                Which should we use when estimating your daily energy needs?
              </Text>
              <SelectionCard
                title="Female"
                selected={draft.calculationSex === 'female'}
                onPress={() => patch({ calculationSex: 'female' })}
              />
              <SelectionCard
                title="Male"
                selected={draft.calculationSex === 'male'}
                onPress={() => patch({ calculationSex: 'male' })}
              />
            </View>
          ) : null}

          {step === 'meals' ? (
            <View className="gap-sheet-gap">
              <View className="gap-3">
                {profile.subscribedMeals.map((slot) => {
                  const on = draft.subscriptionMealTracking[slot] !== false;
                  const menuLabel = slot === 'lunch' ? profile.lunchMenuLabel : profile.dinnerMenuLabel;
                  return (
                    <View key={slot} className="rounded-field border border-border bg-canvas p-sheet">
                      <View className="flex-row items-center gap-3">
                        <View className="min-w-0 flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text className="font-mono-semibold text-body-md text-foreground">{mealSlotLabel(slot)}</Text>
                            <SubscriptionBadge />
                          </View>
                          {menuLabel ? <Text className="mt-1 font-body text-body-sm text-muted">{menuLabel}</Text> : null}
                        </View>
                        <AccentSwitch
                          value={on}
                          onValueChange={(value) => {
                            patch({ subscriptionMealTracking: { ...draft.subscriptionMealTracking, [slot]: value } });
                            track('nutrition_subscription_tracking_changed', { slot, enabled: value });
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
                <InfoNotice>This only changes nutrition tracking. Your food subscription is unaffected.</InfoNotice>
              </View>

              <View className="gap-3">
                <Text className="font-heading text-heading-sm text-foreground">Add meals outside your subscription</Text>
                <View className="flex-row flex-wrap gap-2">
                  {manualSlots.map((slot) => {
                    const selected = draft.manualMealSlots.includes(slot);
                    return (
                      <SelectionChip
                        key={slot}
                        label={mealSlotLabel(slot)}
                        selected={selected}
                        onPress={() => {
                          const next = selected
                            ? draft.manualMealSlots.filter((item) => item !== slot)
                            : [...draft.manualMealSlots, slot];
                          patch({ manualMealSlots: next });
                          if (!selected) track('nutrition_manual_meal_added', { slot });
                        }}
                      />
                    );
                  })}
                </View>

                {draft.customMealSlots.length > 0 ? (
                  <View className="gap-2">
                    {draft.customMealSlots.map((slot) => (
                      <View key={slot.id} className="min-h-11 flex-row items-center justify-between gap-3 rounded-field border border-border bg-canvas px-4">
                        <Text className="min-w-0 flex-1 font-body-medium text-body-md text-foreground">{slot.name}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${slot.name}`}
                          onPress={hapticPress(
                            () => patch({ customMealSlots: draft.customMealSlots.filter((item) => item.id !== slot.id) }),
                            'light',
                          )}
                          hitSlop={8}
                        >
                          <Text className="font-mono-semibold text-body-sm text-muted">Remove</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add another meal"
                  onPress={hapticPress(() => setCustomSheetOpen(true), 'light')}
                  className="min-h-11 flex-row items-center gap-2 self-start rounded-field px-1"
                >
                  <PlusIcon size={16} weight="bold" color={palette.accent} />
                  <Text className="font-mono-semibold text-body-sm text-accent">Add another meal</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === 'water' ? (
            <View className="gap-sheet-gap">
              <WaterGoalRuler
                valueMl={draft.waterGoalMl}
                onChange={(ml) => {
                  patch({ waterGoalMl: ml });
                  track('nutrition_water_goal_changed', { waterGoalMl: ml });
                }}
              />
              <View className="rounded-field border border-border bg-canvas p-sheet">
                <View className="flex-row items-center gap-3">
                  <Text className="min-w-0 flex-1 font-mono-semibold text-body-md text-foreground">
                    Remind me to drink water
                  </Text>
                  <AccentSwitch
                    value={draft.waterRemindersEnabled}
                    onValueChange={(value) => {
                      patch({
                        waterRemindersEnabled: value,
                        waterReminderIntervalHours: value ? draft.waterReminderIntervalHours ?? 3 : undefined,
                      });
                      setPermissionDenied(false);
                      track(value ? 'nutrition_water_reminder_enabled' : 'nutrition_water_reminder_disabled', {});
                    }}
                  />
                </View>
                {draft.waterRemindersEnabled ? (
                  <View className="mt-4 gap-2">
                    <Text className="font-body text-body-sm text-muted">Reminder frequency</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {reminderIntervals.map((hours) => (
                        <SelectionChip
                          key={hours}
                          label={`Every ${hours} hours`}
                          selected={draft.waterReminderIntervalHours === hours}
                          onPress={() => patch({ waterReminderIntervalHours: hours })}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
              {permissionDenied ? (
                <View className="gap-2">
                  <InfoNotice tone="warning">
                    Water reminders couldn&apos;t be enabled because notifications are turned off.
                  </InfoNotice>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open settings"
                    onPress={hapticPress(openNotificationSettings, 'light')}
                    className="min-h-11 justify-center self-start px-1"
                  >
                    <Text className="font-mono-semibold text-body-sm text-accent">Open settings</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {step === 'summary' ? <PlanSummary draft={draft} /> : null}
        </Animated.View>
      </ScrollView>

      <View
        style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom + 8 : Math.max(16, insets.bottom + 8) }}
        className="absolute inset-x-0 bottom-0 gap-2 bg-canvas px-5 pt-3"
      >
        <PrimaryShimmerButton label={ctaLabel} enabled={canAdvance && !saving} loading={saving} onPress={() => void advance()} />
        {step === 'secondaryGoals' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip"
            onPress={hapticPress(() => setStepIndex((index) => index + 1), 'light')}
            className="min-h-11 items-center justify-center"
          >
            <Text className="font-mono-semibold text-body-sm text-muted">Skip</Text>
          </Pressable>
        ) : null}
      </View>

      {customSheetOpen ? (
        <AddCustomMealSheet
          onClose={() => setCustomSheetOpen(false)}
          onAdd={(name) => {
            const slot: CustomMealSlot = { id: `custom-${Date.now().toString(36)}`, name };
            patch({ customMealSlots: [...draft.customMealSlots, slot] });
            track('nutrition_custom_meal_created', { name });
            setCustomSheetOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

function PlanSummary({ draft }: { draft: NutritionOnboardingState }) {
  const { profile } = useNutrition();
  const palette = useThemePalette();
  const targets = useMemo(() => targetsFromSetup(draft, ageFromDob(profile.dob)), [draft, profile.dob]);

  const trackedSubscription = (['lunch', 'dinner'] as const).filter(
    (slot) => profile.subscribedMeals.includes(slot) && draft.subscriptionMealTracking[slot] !== false,
  );

  const today = dateKey(new Date());
  const contribution = useMemo(() => {
    const meals = trackedSubscription.map((slot) => {
      const items = subscriptionMenuFor(slot, today);
      return {
        id: slot,
        label: mealSlotLabel(slot),
        type: slot,
        source: 'subscription' as const,
        foodItems: items,
        totals: items.reduce(
          (accumulator, item) => ({
            calories: accumulator.calories + item.calories,
            proteinG: accumulator.proteinG + item.proteinG,
            carbsG: accumulator.carbsG + item.carbsG,
            fatG: accumulator.fatG + item.fatG,
          }),
          { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
        ),
      };
    });
    return subscriptionContribution(meals);
  }, [today, trackedSubscription]);

  const trackedList = [
    ...draft.manualMealSlots.includes('breakfast') ? ['Breakfast'] : [],
    ...trackedSubscription.includes('lunch') ? ['Lunch · automatic'] : [],
    ...draft.manualMealSlots.includes('snack') ? ['Snack'] : [],
    ...draft.manualMealSlots.includes('tea') ? ['Tea / Coffee'] : [],
    ...draft.customMealSlots.map((slot) => slot.name),
    ...trackedSubscription.includes('dinner') ? ['Dinner · automatic'] : [],
    'Water',
  ];

  return (
    <View className="gap-sheet-gap">
      <View className="rounded-field border border-border bg-canvas p-sheet">
        <Text className="font-heading text-heading-xl text-foreground">{targets.calories.toLocaleString('en-IN')} kcal</Text>
        <Text className="mt-1 font-body text-body-sm text-muted">Daily target</Text>
        <View className="mt-4 gap-2">
          <SummaryRow label="Protein" value={`${targets.proteinG}g`} />
          <SummaryRow label="Carbs" value={`${targets.carbsG}g`} />
          <SummaryRow label="Fat" value={`${targets.fatG}g`} />
          <SummaryRow label="Water" value={formatWaterGoal(draft.waterGoalMl)} />
        </View>
      </View>

      {contribution.count > 0 ? (
        <View className="rounded-field bg-accent-soft p-sheet">
          <Text className="font-heading text-heading-sm text-foreground">Your subscription already covers</Text>
          <Text className="mt-2 font-mono-semibold text-body-md text-foreground">{contribution.labels.join(' + ')}</Text>
          <Text className="mt-1 font-body text-body-sm text-muted">
            ~{contribution.calories} kcal · ~{contribution.proteinG}g protein
          </Text>
        </View>
      ) : null}

      <View className="gap-3">
        <Text className="font-heading text-heading-sm text-foreground">You&apos;re tracking</Text>
        <View className="gap-2">
          {trackedList.map((item) => (
            <View key={item} className="flex-row items-center gap-2">
              <CheckIcon size={16} weight="bold" color={palette.success} />
              <Text className="font-body text-body-md text-foreground">{item}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-body text-body-sm text-muted">{label}</Text>
      <Text className="font-mono-semibold text-body-sm text-foreground">{value}</Text>
    </View>
  );
}
