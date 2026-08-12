import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { hapticPress } from '../haptics';
import { useThemePalette } from '../themeColors';
import { carouselItems, selectedCarouselId } from './periodModel';
import type { NutritionPeriodMode, NutritionPeriodState } from './types';

const modeLabels: Record<NutritionPeriodMode, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export function NutritionPeriodDropdown({
  mode,
  open,
  onToggle,
}: {
  mode: NutritionPeriodMode;
  open: boolean;
  onToggle: () => void;
}) {
  const palette = useThemePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Period, ${modeLabels[mode]}`}
      accessibilityState={{ expanded: open }}
      onPress={hapticPress(onToggle, 'light')}
      className="min-h-11 flex-row items-center gap-1.5 rounded-field bg-surface px-3"
    >
      <Text className="font-mono-semibold text-body-sm text-foreground">{modeLabels[mode]}</Text>
      <CaretDownIcon size={14} weight="bold" color={palette.muted} />
    </Pressable>
  );
}

/**
 * Rendered at screen root rather than under the trigger so its dismiss backdrop
 * can sit above the scrolling content without covering the menu itself.
 */
export function NutritionPeriodMenu({
  mode,
  top,
  right,
  onSelect,
  onDismiss,
}: {
  mode: NutritionPeriodMode;
  top: number;
  /** Aligned to the trigger, which is inset from the screen edge. */
  right: number;
  onSelect: (mode: NutritionPeriodMode) => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close period menu"
        onPress={onDismiss}
        className="absolute inset-0 z-40"
      />
      <View
        style={{ top, right }}
        className="absolute z-50 w-40 overflow-hidden rounded-field border border-border bg-canvas shadow-md"
      >
        {(Object.keys(modeLabels) as NutritionPeriodMode[]).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="menuitem"
            accessibilityState={{ selected: option === mode }}
            accessibilityLabel={modeLabels[option]}
            onPress={hapticPress(() => onSelect(option), 'selection')}
            className={`min-h-11 justify-center px-4 ${option === mode ? 'bg-surface' : ''}`}
          >
            <Text
              className={`text-body-sm ${option === mode ? 'font-mono-semibold text-foreground' : 'font-body text-muted'}`}
            >
              {modeLabels[option]}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const ITEM_GAP = 8;

export function NutritionPeriodCarousel({
  period,
  onSelect,
}: {
  period: NutritionPeriodState;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const items = carouselItems(period.mode);
  const selectedId = selectedCarouselId(period);
  const selectedIndex = Math.max(0, items.findIndex((item) => item.id === selectedId));
  const itemWidth = period.mode === 'daily' ? 64 : period.mode === 'weekly' ? 132 : 104;

  useEffect(() => {
    // Keep the active period near the centre when the mode changes.
    const offset = Math.max(0, selectedIndex * (itemWidth + ITEM_GAP) - itemWidth);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: offset, animated: false }));
  }, [itemWidth, period.mode, selectedIndex]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: ITEM_GAP }}
    >
      {items.map((item) => {
        const selected = item.id === selectedId;
        const disabled = item.relation === 'future' && period.mode !== 'daily';
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${item.primary}${item.secondary ? ` ${item.secondary}` : ''}`}
            disabled={disabled}
            onPress={hapticPress(() => onSelect(item.id), 'selection')}
            style={{ width: itemWidth }}
            className={`min-h-11 items-center justify-center rounded-field border py-2 ${
              selected ? 'border-2 border-accent bg-accent-soft' : 'border-border bg-canvas'
            } ${disabled ? 'opacity-40' : ''}`}
          >
            <Text
              numberOfLines={1}
              className={`text-body-xs ${selected ? 'font-mono-semibold text-foreground' : 'font-body text-muted'}`}
            >
              {item.primary}
            </Text>
            {item.secondary ? (
              <Text
                className={`mt-0.5 text-body-sm ${
                  selected ? 'font-mono-semibold text-foreground' : 'font-body text-muted'
                }`}
              >
                {item.secondary}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
