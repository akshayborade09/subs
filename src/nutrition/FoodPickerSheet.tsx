import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { hapticPress } from '../haptics';
import { useFieldPlaceholderColor, useThemePalette } from '../themeColors';
import { SheetCloseButton } from './nutritionComponents';
import { foodDatabase, toFoodItem, type FoodDatabaseEntry } from './nutritionMockData';
import type { NutritionFoodItem } from './types';

/** Recents are session-scoped in V1; the backend will own this list later. */
const recentFoodNames: string[] = [];

function rememberRecent(name: string) {
  const existing = recentFoodNames.indexOf(name);
  if (existing >= 0) recentFoodNames.splice(existing, 1);
  recentFoodNames.unshift(name);
  if (recentFoodNames.length > 6) recentFoodNames.pop();
}

function FoodRow({ entry, onAdd }: { entry: FoodDatabaseEntry; onAdd: () => void }) {
  const palette = useThemePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${entry.name}, ${entry.calories} calories, ${entry.proteinG} grams protein`}
      onPress={hapticPress(onAdd, 'light')}
      className="min-h-11 flex-row items-center gap-3 py-2.5"
    >
      <View className="min-w-0 flex-1">
        <Text className="font-body-medium text-body-md text-foreground">{entry.name}</Text>
        <Text className="mt-0.5 font-body text-body-xs text-muted">
          {entry.serving ? `${entry.serving} · ` : ''}
          {entry.calories} kcal · {entry.proteinG}g protein
        </Text>
      </View>
      <PlusIcon size={18} weight="bold" color={palette.accent} />
    </Pressable>
  );
}

export function FoodPickerSheet({
  mealLabel,
  onClose,
  onAdd,
}: {
  mealLabel: string;
  onClose: () => void;
  onAdd: (item: NutritionFoodItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const placeholderColor = useFieldPlaceholderColor();
  const palette = useThemePalette();

  const trimmed = query.trim();
  const results = useMemo(() => {
    if (!trimmed) return [];
    const lowered = trimmed.toLowerCase();
    return foodDatabase.filter((entry) => entry.name.toLowerCase().includes(lowered));
  }, [trimmed]);

  const recents = useMemo(
    () => recentFoodNames.map((name) => foodDatabase.find((entry) => entry.name === name)).filter(Boolean) as FoodDatabaseEntry[],
    [],
  );
  const common = useMemo(() => foodDatabase.filter((entry) => entry.common), []);

  const addEntry = (entry: FoodDatabaseEntry) => {
    const { common: _common, ...rest } = entry;
    rememberRecent(entry.name);
    onAdd(toFoodItem(rest));
  };

  const addCustom = () => {
    onAdd(
      toFoodItem({
        name: trimmed,
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        source: 'custom',
      }),
    );
  };

  return (
    <View className="absolute inset-0 z-[60] bg-canvas">
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-start justify-between gap-3 px-5 pb-3">
        <View className="min-w-0 flex-1 gap-auth-block">
          <Text className="font-heading text-heading-sm text-foreground">Add food</Text>
          <Text className="font-body text-body-sm text-subtle">{mealLabel}</Text>
        </View>
        <SheetCloseButton onPress={onClose} label="Close food search" />
      </View>

      <View className="px-5">
        <View className="h-field flex-row items-center gap-2 rounded-field bg-field px-4">
          <MagnifyingGlassIcon size={18} weight="regular" color={palette.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Search foods"
            placeholderTextColor={placeholderColor}
            accessibilityLabel="Search foods"
            returnKeyType="search"
            className="min-w-0 flex-1 font-body-medium text-body-md tracking-body-md text-foreground"
          />
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 32 }}
      >
        {trimmed ? (
          <View>
            {results.length > 0 ? (
              results.map((entry) => <FoodRow key={entry.name} entry={entry} onAdd={() => addEntry(entry)} />)
            ) : (
              <View className="gap-3">
                <Text className="font-body text-body-sm text-muted">No match for &quot;{trimmed}&quot;.</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${trimmed} as a custom food`}
                  onPress={hapticPress(addCustom, 'light')}
                  className="min-h-11 flex-row items-center gap-2 self-start"
                >
                  <PlusIcon size={16} weight="bold" color={palette.accent} />
                  <Text className="font-mono-semibold text-body-sm text-accent">Add &quot;{trimmed}&quot; as custom food</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View className="gap-sheet-gap">
            {recents.length > 0 ? (
              <View>
                <Text className="mb-1 font-heading text-heading-sm text-foreground">Recent</Text>
                {recents.map((entry) => (
                  <FoodRow key={`recent-${entry.name}`} entry={entry} onAdd={() => addEntry(entry)} />
                ))}
              </View>
            ) : null}
            <View>
              <Text className="mb-1 font-heading text-heading-sm text-foreground">Common foods</Text>
              {common.map((entry) => (
                <FoodRow key={`common-${entry.name}`} entry={entry} onAdd={() => addEntry(entry)} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
