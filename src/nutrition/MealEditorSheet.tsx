import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MinusIcon } from 'phosphor-react-native/src/icons/Minus';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { hapticPress } from '../haptics';
import { PrimaryShimmerButton } from '../primaryButton';
import { useThemePalette } from '../themeColors';
import { FoodPickerSheet } from './FoodPickerSheet';
import { SheetCloseButton, SubscriptionBadge } from './nutritionComponents';
import { track } from './nutritionAnalytics';
import type { NutritionFoodItem, NutritionMeal } from './types';

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

/**
 * Full-screen editor for correcting what was actually eaten. Totals recompute
 * on every change so the numbers never lag behind the item list.
 */
export function MealEditorSheet({
  meal,
  onClose,
  onSave,
  onRemoved,
}: {
  meal: NutritionMeal;
  onClose: () => void;
  onSave: (items: NutritionFoodItem[]) => void;
  onRemoved: (item: NutritionFoodItem, restore: () => void) => void;
}) {
  const insets = useSafeAreaInsets();
  const palette = useThemePalette();
  const [items, setItems] = useState<NutritionFoodItem[]>(meal.foodItems);
  const [pickerOpen, setPickerOpen] = useState(false);

  const totals = totalsFor(items);

  const removeItem = (item: NutritionFoodItem) => {
    const previous = items;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    track('nutrition_food_removed', { mealType: meal.type, source: item.source });
    onRemoved(item, () => setItems(previous));
  };

  return (
    <View className="absolute inset-0 z-[55] bg-canvas">
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-start justify-between gap-3 px-5 pb-3">
        <View className="min-w-0 flex-1 gap-auth-block">
          <Text className="font-heading text-heading-sm text-foreground">Edit {meal.label}</Text>
          <Text className="font-body text-body-sm text-subtle">Remove anything you didn&apos;t eat, add anything extra.</Text>
        </View>
        <SheetCloseButton onPress={onClose} label={`Close edit ${meal.label}`} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
      >
        {meal.source === 'subscription' ? (
          <View className="mb-3 flex-row">
            <SubscriptionBadge />
          </View>
        ) : null}

        <View className="rounded-field border border-border bg-canvas">
          {items.length === 0 ? (
            <View className="p-sheet">
              <Text className="font-body text-body-sm text-muted">Nothing left in this meal.</Text>
            </View>
          ) : (
            items.map((item, index) => (
              <View
                key={item.id}
                className={`flex-row items-center gap-3 p-sheet ${index > 0 ? 'border-t border-border' : ''}`}
              >
                <View className="min-w-0 flex-1">
                  <Text className="font-body-medium text-body-md text-foreground">{item.name}</Text>
                  <Text className="mt-0.5 font-body text-body-xs text-muted">
                    {item.serving ? `${item.serving} · ` : ''}
                    {item.calories} kcal · {item.proteinG}g protein
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
                  onPress={hapticPress(() => removeItem(item), 'light')}
                  hitSlop={8}
                  className="size-11 items-center justify-center rounded-full bg-surface"
                >
                  <MinusIcon size={18} weight="bold" color={palette.muted} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add food"
          onPress={hapticPress(() => setPickerOpen(true), 'light')}
          className="mt-3 min-h-11 flex-row items-center gap-2 self-start px-1"
        >
          <PlusIcon size={16} weight="bold" color={palette.accent} />
          <Text className="font-mono-semibold text-body-sm text-accent">Add food</Text>
        </Pressable>

        <View className="mt-sheet-gap rounded-field bg-surface p-sheet">
          <Text className="font-mono-semibold text-body-md text-foreground">
            {Math.round(totals.calories)} kcal · {Math.round(totals.proteinG)}g protein
          </Text>
          <Text className="mt-1 font-body text-body-xs text-muted">
            Carbs {Math.round(totals.carbsG)}g · Fat {Math.round(totals.fatG)}g
          </Text>
        </View>
      </ScrollView>

      <View
        style={{ paddingBottom: insets.bottom + 12 }}
        className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-3"
      >
        <PrimaryShimmerButton
          label="Save changes"
          onPress={() => {
            onSave(items);
            if (meal.source === 'subscription') track('nutrition_subscription_meal_edited', { mealType: meal.type });
            onClose();
          }}
        />
      </View>

      {pickerOpen ? (
        <FoodPickerSheet
          mealLabel={meal.label}
          onClose={() => setPickerOpen(false)}
          onAdd={(item) => {
            setItems((current) => [...current, item]);
            track('nutrition_food_added', { mealType: meal.type, source: item.source });
            setPickerOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
