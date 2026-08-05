import { useEffect, useRef, useState } from 'react';
import { Animated as NativeAnimated, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const SHIMMER_WIDTH = 48;
const SHIMMER_OVERSHOOT = 80;

export function PrimaryShimmerButton({ label, onPress, enabled = true, loading = false }: { label: string; onPress: () => void; enabled?: boolean; loading?: boolean }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const [width, setWidth] = useState(0);
  const shimmer = useRef(new NativeAnimated.Value(-SHIMMER_OVERSHOOT)).current;
  const showShimmer = enabled && !loading;

  useEffect(() => {
    if (!width || !showShimmer) {
      shimmer.stopAnimation();
      shimmer.setValue(-SHIMMER_OVERSHOOT);
      return;
    }
    shimmer.setValue(-SHIMMER_OVERSHOOT);
    const animation = NativeAnimated.loop(
      NativeAnimated.sequence([
        NativeAnimated.timing(shimmer, { toValue: width + SHIMMER_OVERSHOOT, duration: 1500, useNativeDriver: true }),
        NativeAnimated.delay(1700),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [showShimmer, shimmer, width]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !enabled, busy: loading }}
        disabled={!enabled || loading}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 20, stiffness: 360 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 300 }); }}
        className={`w-full overflow-hidden rounded-button-outer border border-foreground p-button-wrap ${enabled ? 'opacity-100' : 'opacity-40'}`}
      >
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          className="relative h-field overflow-hidden rounded-button-inner bg-foreground"
        >
          {showShimmer ? (
            <NativeAnimated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: -20,
                width: SHIMMER_WIDTH,
                height: 92,
                transform: [{ translateX: shimmer }, { rotate: '18deg' }],
              }}
              className="bg-white/25"
            />
          ) : null}
          <View className="h-field items-center justify-center">
            <Text className="font-mono-semibold text-body-md text-canvas">{loading ? 'Please wait…' : label}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

type GhostSurface = 'canvas' | 'field';

function GhostButton({ label, onPress, surface }: { label: string; onPress: () => void; surface: GhostSurface }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillClass = surface === 'canvas' ? 'bg-canvas' : 'bg-ghost-on-field';
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 20, stiffness: 360 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 300 }); }}
        className="w-full rounded-button-outer border border-foreground p-button-wrap"
      >
        <View className={`h-field items-center justify-center rounded-button-inner ${fillClass}`}>
          <Text className="font-mono-semibold text-body-md text-foreground">{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Ghost CTA for white/canvas surfaces — white fill, black border. */
export function GhostCanvasButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <GhostButton label={label} onPress={onPress} surface="canvas" />;
}

/** Ghost CTA for gray field/surface cards — darker gray fill so it reads on gray. */
export function GhostFieldButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <GhostButton label={label} onPress={onPress} surface="field" />;
}

/** @deprecated Prefer GhostFieldButton / GhostCanvasButton */
export function SecondaryFieldButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <GhostFieldButton label={label} onPress={onPress} />;
}
