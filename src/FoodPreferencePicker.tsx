import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { foodImages } from './foodImages';
import { FormHeader } from './formLayout';
import { MealPreferenceImage } from './MealPreferenceImage';
import { PrimaryShimmerButton } from './primaryButton';
import type { MealPreferenceValue } from './mealDetailState';

type FoodOption = {
  title: MealPreferenceValue;
  description: string;
  image: number;
};

const foodOptions: FoodOption[] = [
  { title: 'Vegetarian', description: 'Seasonal vegetables, paneer and home-style dals.', image: foodImages.Vegetarian },
  { title: 'Non-vegetarian', description: 'Home-style chicken, mutton and egg preparations.', image: foodImages['Non-vegetarian'] },
  { title: 'Mix of both', description: 'Enjoy vegetarian and non-vegetarian meals during your plan.', image: foodImages['Mix of both'] },
];

function selectionCardClass(selected: boolean) {
  return `overflow-hidden rounded-field border bg-canvas ${selected ? 'border-2 border-accent bg-accent-soft' : 'border-border'}`;
}

function FoodPreferenceCards({ value, onChange }: { value: MealPreferenceValue; onChange: (value: MealPreferenceValue) => void }) {
  return (
    <View className="gap-4">
      {foodOptions.map((option, index) => {
        const selected = value === option.title;
        return (
          <Pressable
            key={option.title}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.title)}
            className={`flex-row items-stretch ${selectionCardClass(selected)}`}
          >
            <View className="min-w-0 flex-1 justify-center gap-2 p-sheet">
              <Text className="font-mono-semibold text-body-md text-foreground">{option.title}</Text>
              <Text className="font-body text-body-xs leading-5 text-muted">{option.description}</Text>
            </View>
            <MealPreferenceImage source={option.image} label={`${option.title} meal`} delayMs={360 + index * 120} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function FoodPreferencePicker({
  mealDate,
  value,
  onClose,
  onSave,
}: {
  mealDate: string;
  value: MealPreferenceValue;
  onClose: () => void;
  onSave: (preference: MealPreferenceValue) => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const [selected, setSelected] = useState(value);

  return (
    <Animated.View entering={FadeIn.duration(180)} className="absolute inset-0 z-[70] bg-canvas">
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-start justify-between px-5 pb-3">
        <View className="flex-1 pr-3">
          <FormHeader title="What do you enjoy eating?" subtitle={`Only for ${mealDate}`} size="sheet" />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close food preference editor" onPress={onClose} hitSlop={8} className="size-icon-button shrink-0 items-center justify-center">
          <XIcon size={24} weight="regular" color={iconColor} />
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>
        <FoodPreferenceCards value={selected} onChange={setSelected} />
      </ScrollView>
      <View style={{ paddingBottom: Math.max(16, insets.bottom + 8) }} className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-3">
        <PrimaryShimmerButton label="Save for this meal" onPress={() => onSave(selected)} />
      </View>
    </Animated.View>
  );
}
