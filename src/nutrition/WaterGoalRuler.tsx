import { useEffect, useRef } from 'react';
import { ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useThemePalette } from '../themeColors';

const MIN_ML = 1000;
const MAX_ML = 5000;
const STEP_ML = 100;
const MAJOR_EVERY_ML = 500;
const TICK_SPACING = 14;
const TICK_COUNT = (MAX_ML - MIN_ML) / STEP_ML + 1;

export function formatWaterGoal(ml: number) {
  return `${(ml / 1000).toFixed(1)} L`;
}

/**
 * Horizontal ruler with a fixed centre marker: the scale slides underneath the
 * marker and the centred tick is the value. Range 1.0–5.0 L in 100 ml steps.
 */
export function WaterGoalRuler({ valueMl, onChange }: { valueMl: number; onChange: (ml: number) => void }) {
  const { width } = useWindowDimensions();
  const palette = useThemePalette();
  const scrollRef = useRef<ScrollView>(null);
  const sidePadding = width / 2;
  const lastValue = useRef(valueMl);
  const didInitialScroll = useRef(false);

  useEffect(() => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;
    const offset = ((valueMl - MIN_ML) / STEP_ML) * TICK_SPACING;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: offset, animated: false }));
  }, [valueMl]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / TICK_SPACING);
    const clamped = Math.max(0, Math.min(TICK_COUNT - 1, index));
    const next = MIN_ML + clamped * STEP_ML;
    if (next !== lastValue.current) {
      lastValue.current = next;
      onChange(next);
    }
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Daily water goal"
      accessibilityValue={{ text: formatWaterGoal(valueMl) }}
    >
      <View className="items-center">
        <Text className="font-heading text-heading-xl text-foreground">{formatWaterGoal(valueMl)}</Text>
        <Text className="mt-1 font-body text-body-sm text-muted">Daily water goal</Text>
      </View>

      <View className="mt-6">
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK_SPACING}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScroll}
          contentContainerStyle={{ paddingHorizontal: sidePadding }}
        >
          <View className="flex-row items-end" style={{ height: 64 }}>
            {Array.from({ length: TICK_COUNT }, (_, index) => {
              const ml = MIN_ML + index * STEP_ML;
              const major = ml % MAJOR_EVERY_ML === 0;
              return (
                <View key={ml} style={{ width: TICK_SPACING }} className="items-center justify-end">
                  {major ? <Text className="mb-1 font-body text-body-xs text-subtle">{(ml / 1000).toFixed(1)}</Text> : null}
                  <View
                    style={{
                      width: major ? 2 : 1,
                      height: major ? 28 : 16,
                      backgroundColor: major ? palette.muted : palette.subtle,
                    }}
                    className="rounded-full"
                  />
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View pointerEvents="none" className="absolute inset-x-0 bottom-0 items-center">
          <View style={{ width: 3, height: 40, backgroundColor: palette.accent }} className="rounded-full" />
        </View>
      </View>
    </View>
  );
}
