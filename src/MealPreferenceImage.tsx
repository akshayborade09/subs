import { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

export function MealPreferenceImage({ source, label, delayMs = 0, fillHeight = false, alignBottom = false }: { source: number; label: string; delayMs?: number; fillHeight?: boolean; alignBottom?: boolean }) {
  const opacity = useSharedValue(delayMs > 0 ? 0 : 1);
  const translateY = useSharedValue(delayMs > 0 ? 72 : 0);
  const scale = useSharedValue(delayMs > 0 ? 0.72 : 1);

  useEffect(() => {
    if (delayMs <= 0) return;
    cancelAnimation(opacity);
    cancelAnimation(translateY);
    cancelAnimation(scale);
    opacity.value = 0;
    translateY.value = 72;
    scale.value = 0.72;
    opacity.value = withDelay(delayMs, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delayMs, withTiming(0, { duration: 336, easing: Easing.out(Easing.cubic) }));
    scale.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1.06, { duration: 336, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 144, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(translateY);
      cancelAnimation(scale);
    };
  }, [delayMs, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const containerClass = fillHeight && alignBottom
    ? 'w-[161px] shrink-0 self-stretch overflow-hidden'
    : fillHeight
      ? 'w-[161px] shrink-0 self-stretch overflow-hidden pt-3'
      : alignBottom
        ? 'h-[116px] w-[161px] shrink-0 overflow-hidden'
        : 'h-[116px] w-[161px] shrink-0 overflow-hidden pt-2';

  const imageStyle = alignBottom
    ? { position: 'absolute' as const, bottom: 0, left: 0, width: 181, height: 181 }
    : { position: 'absolute' as const, top: 0, left: 0, width: 181, height: 181 };

  return (
    <View className={containerClass}>
      <View className="relative h-full w-full overflow-hidden">
        <Animated.View style={[imageStyle, animatedStyle]}>
          <Image source={source} accessibilityLabel={label} resizeMode="cover" style={{ width: 181, height: 181 }} />
        </Animated.View>
      </View>
    </View>
  );
}
