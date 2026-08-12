import { Pressable, Text, View } from 'react-native';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { hapticPress } from '../haptics';
import { useThemePalette } from '../themeColors';
import { SubscriptionBadge } from './nutritionComponents';
import type { DayRelation } from './periodModel';
import type { NutritionMeal } from './types';

function MealAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={hapticPress(onPress, 'light')}
      className="min-h-11 justify-center"
    >
      <Text className="font-mono-semibold text-body-sm text-accent">{label}</Text>
    </Pressable>
  );
}

function MealCard({
  meal,
  relation,
  onEdit,
  onAddFood,
  onRetry,
}: {
  meal: NutritionMeal;
  relation: DayRelation;
  onEdit: (meal: NutritionMeal) => void;
  onAddFood: (meal: NutritionMeal) => void;
  onRetry: (meal: NutritionMeal) => void;
}) {
  const palette = useThemePalette();
  const editable = relation === 'today';
  const hasItems = meal.foodItems.length > 0;

  return (
    <View className="rounded-field border border-border bg-canvas p-sheet">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-heading text-heading-sm text-foreground">{meal.label}</Text>
          {meal.menuLabel ? <Text className="mt-0.5 font-body text-body-xs text-muted">{meal.menuLabel}</Text> : null}
        </View>
        {meal.source === 'subscription' ? <SubscriptionBadge /> : null}
      </View>

      {meal.loadFailed ? (
        <View className="mt-3 gap-2">
          <Text className="font-body text-body-sm text-muted">We couldn&apos;t load nutrition details for this meal.</Text>
          <MealAction label="Retry" onPress={() => onRetry(meal)} />
        </View>
      ) : meal.scheduled ? (
        <Text className="mt-3 font-body text-body-sm text-muted">
          Scheduled. Nutrition values will appear after the meal is logged.
        </Text>
      ) : hasItems ? (
        <View className="mt-3">
          <View className="gap-1">
            {meal.foodItems.map((item) => (
              <Text key={item.id} className="font-body text-body-sm text-foreground">
                {item.name}
              </Text>
            ))}
          </View>
          <Text
            accessibilityLabel={`${Math.round(meal.totals.calories)} calories, ${Math.round(
              meal.totals.proteinG,
            )} grams protein`}
            className="mt-3 font-mono-semibold text-body-sm text-foreground"
          >
            {Math.round(meal.totals.calories)} kcal · {Math.round(meal.totals.proteinG)}g protein
          </Text>
          {editable ? (
            <View className="mt-1 flex-row items-center gap-4">
              <MealAction
                label={meal.source === 'subscription' ? 'Edit what I ate' : 'Edit'}
                onPress={() => onEdit(meal)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add food to ${meal.label}`}
                onPress={hapticPress(() => onAddFood(meal), 'light')}
                className="min-h-11 flex-row items-center gap-1.5"
              >
                <PlusIcon size={14} weight="bold" color={palette.accent} />
                <Text className="font-mono-semibold text-body-sm text-accent">Add</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="mt-3 gap-1">
          <Text className="font-body text-body-sm text-muted">
            {meal.source === 'subscription'
              ? "Today's subscribed meal will appear here automatically."
              : 'Nothing logged yet.'}
          </Text>
          {editable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add food to ${meal.label}`}
              onPress={hapticPress(() => onAddFood(meal), 'light')}
              className="min-h-11 flex-row items-center gap-1.5 self-start"
            >
              <PlusIcon size={14} weight="bold" color={palette.accent} />
              <Text className="font-mono-semibold text-body-sm text-accent">Add food</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function NutritionMealList({
  meals,
  relation,
  onEdit,
  onAddFood,
  onRetry,
}: {
  meals: NutritionMeal[];
  relation: DayRelation;
  onEdit: (meal: NutritionMeal) => void;
  onAddFood: (meal: NutritionMeal) => void;
  onRetry: (meal: NutritionMeal) => void;
}) {
  if (meals.length === 0) {
    return (
      <View className="rounded-field border border-border bg-canvas p-sheet">
        <Text className="font-body text-body-sm text-muted">
          No meals are set up for tracking yet. You can change this in your nutrition preferences.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {meals.map((meal) => (
        <MealCard
          key={meal.id}
          meal={meal}
          relation={relation}
          onEdit={onEdit}
          onAddFood={onAddFood}
          onRetry={onRetry}
        />
      ))}
    </View>
  );
}
