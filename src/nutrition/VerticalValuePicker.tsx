import { useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { hapticPress } from '../haptics';

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const PICKER_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const PADDING = (PICKER_HEIGHT - ROW_HEIGHT) / 2;

export type PickerOption = {
  value: number;
  label: string;
};

/**
 * Snapping wheel. Rows fade with distance from the centre, and the centred row
 * is the selected value — the same mechanic as the date-of-birth wheel in the
 * trial onboarding, generalised over arbitrary numeric options.
 */
export function VerticalValuePicker({
  options,
  value,
  onChange,
  accessibilityLabel,
  suffix,
}: {
  options: PickerOption[];
  value: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  suffix?: string;
}) {
  const listRef = useRef<FlatList<PickerOption>>(null);
  const selectedIndex = useMemo(() => {
    const exact = options.findIndex((option) => option.value === value);
    if (exact >= 0) return exact;
    // Unit switches land between steps — snap to the nearest available option.
    let nearest = 0;
    let smallestDelta = Number.POSITIVE_INFINITY;
    options.forEach((option, index) => {
      const delta = Math.abs(option.value - value);
      if (delta < smallestDelta) {
        smallestDelta = delta;
        nearest = index;
      }
    });
    return nearest;
  }, [options, value]);

  const scrolledIndex = useRef(selectedIndex);

  useEffect(() => {
    if (scrolledIndex.current === selectedIndex) return;
    scrolledIndex.current = selectedIndex;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: selectedIndex * ROW_HEIGHT, animated: false });
    });
  }, [selectedIndex]);

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: scrolledIndex.current * ROW_HEIGHT, animated: false });
    });
  }, []);

  const selectFromOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT)));
    scrolledIndex.current = index;
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
  };

  const selectedLabel = options[selectedIndex]?.label ?? '';

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: `${selectedLabel}${suffix ? ` ${suffix}` : ''}` }}
      style={{ height: PICKER_HEIGHT }}
      className="relative"
    >
      <View pointerEvents="none" style={{ top: PADDING, height: ROW_HEIGHT }} className="absolute inset-x-0 rounded-field bg-surface" />
      <FlatList
        ref={listRef}
        data={options}
        keyExtractor={(option) => String(option.value)}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        initialScrollIndex={selectedIndex}
        contentContainerStyle={{ paddingVertical: PADDING }}
        onScroll={selectFromOffset}
        onMomentumScrollEnd={selectFromOffset}
        renderItem={({ item, index }) => {
          const distance = Math.abs(index - selectedIndex);
          const active = distance === 0;
          const textClass = active
            ? 'font-mono-semibold text-heading-md text-foreground'
            : distance === 1
              ? 'font-body text-body-md text-muted'
              : 'font-body text-body-sm text-subtle';
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.label}${suffix ? ` ${suffix}` : ''}`}
              onPress={hapticPress(() => {
                onChange(item.value);
                listRef.current?.scrollToOffset({ offset: index * ROW_HEIGHT, animated: true });
              }, 'selection')}
              style={{ height: ROW_HEIGHT, opacity: distance >= 2 ? 0.45 : 1 }}
              className="items-center justify-center"
            >
              <Text className={textClass}>{item.label}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

export type HeightUnit = 'cm' | 'ft_in';
export type WeightUnit = 'kg' | 'lbs';

const MIN_HEIGHT_CM = 120;
const MAX_HEIGHT_CM = 220;
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 200;

export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;

export function heightOptions(unit: HeightUnit): PickerOption[] {
  if (unit === 'cm') {
    return Array.from({ length: MAX_HEIGHT_CM - MIN_HEIGHT_CM + 1 }, (_, index) => {
      const cm = MIN_HEIGHT_CM + index;
      return { value: cm, label: String(cm) };
    });
  }
  const minInches = Math.round(MIN_HEIGHT_CM / CM_PER_INCH);
  const maxInches = Math.round(MAX_HEIGHT_CM / CM_PER_INCH);
  return Array.from({ length: maxInches - minInches + 1 }, (_, index) => {
    const totalInches = minInches + index;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    // Value stays in cm so the stored measurement never depends on display unit.
    return { value: Math.round(totalInches * CM_PER_INCH), label: `${feet}' ${inches}"` };
  });
}

export function weightOptions(unit: WeightUnit): PickerOption[] {
  if (unit === 'kg') {
    return Array.from({ length: MAX_WEIGHT_KG - MIN_WEIGHT_KG + 1 }, (_, index) => {
      const kg = MIN_WEIGHT_KG + index;
      return { value: kg, label: String(kg) };
    });
  }
  const minLbs = Math.round(MIN_WEIGHT_KG / KG_PER_LB);
  const maxLbs = Math.round(MAX_WEIGHT_KG / KG_PER_LB);
  return Array.from({ length: maxLbs - minLbs + 1 }, (_, index) => {
    const lbs = minLbs + index;
    return { value: Math.round(lbs * KG_PER_LB * 10) / 10, label: String(lbs) };
  });
}

export function UnitToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row self-center rounded-field bg-surface p-1">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={option.label}
            onPress={hapticPress(() => onChange(option.id), 'selection')}
            className={`min-h-11 min-w-20 items-center justify-center rounded-field px-4 ${active ? 'bg-canvas' : ''}`}
          >
            <Text className={`text-body-sm ${active ? 'font-mono-semibold text-foreground' : 'font-body text-muted'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
