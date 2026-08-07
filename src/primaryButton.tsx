import { useEffect, useRef, useState } from 'react';
import { Animated as NativeAnimated, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { useThemePalette } from './themeColors';

const SHIMMER_WIDTH = 48;
const SHIMMER_OVERSHOOT = 80;

export function PrimaryShimmerButton({ label, onPress, enabled = true, loading = false, variant = 'primary' }: { label: string; onPress: () => void; enabled?: boolean; loading?: boolean; variant?: 'primary' | 'accent' }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const [width, setWidth] = useState(0);
  const shimmer = useRef(new NativeAnimated.Value(-SHIMMER_OVERSHOOT)).current;
  const showShimmer = enabled && !loading;
  const accent = variant === 'accent';
  const shimmerColor = accent || !dark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.14)';

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
        className={`w-full overflow-hidden rounded-button-outer border p-button-wrap ${accent ? 'border-accent' : 'border-foreground'} ${enabled ? 'opacity-100' : 'opacity-40'}`}
      >
        <View
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          className={`relative h-field overflow-hidden rounded-button-inner ${accent ? 'bg-accent' : 'bg-foreground'}`}
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
                backgroundColor: shimmerColor,
                transform: [{ translateX: shimmer }, { rotate: '18deg' }],
              }}
            />
          ) : null}
          <View className="h-field items-center justify-center">
            <Text className={`font-mono-semibold text-body-md ${accent ? 'text-accent-foreground' : 'text-canvas'}`}>{loading ? 'Please wait…' : label}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function AccentShimmerButton({ label, onPress, enabled = true, loading = false }: { label: string; onPress: () => void; enabled?: boolean; loading?: boolean }) {
  return <PrimaryShimmerButton label={label} onPress={onPress} enabled={enabled} loading={loading} variant="accent" />;
}

/** Secondary accent surface on accent-lighter cards — matches payment-status elevated styling in dark mode. */
export function accentSecondarySurfaceClass({ elevated = false, dark = false }: { elevated?: boolean; dark?: boolean } = {}) {
  const useElevated = elevated && dark;
  return useElevated ? 'border border-accent-dark/35 bg-accent-light' : 'bg-accent-light';
}

/** Blue secondary CTA — accent-light fill on accent-lighter cards. Use elevated on dark accent-lighter notices. */
export function AccentSecondaryButton({ label, onPress, enabled = true, elevated = false }: { label: string; onPress: () => void; enabled?: boolean; elevated?: boolean }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillClass = accentSecondarySurfaceClass({ elevated, dark });
  const textClass = 'text-accent';
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 20, stiffness: 360 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 300 }); }}
        className={`w-full rounded-button-outer ${enabled ? 'opacity-100' : 'opacity-40'}`}
      >
        <View className={`h-field items-center justify-center rounded-button-inner ${fillClass}`}>
          <Text className={`font-mono-semibold text-body-md ${textClass}`}>{label}</Text>
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
        className="w-full rounded-button-outer"
      >
        <View className={`h-field items-center justify-center rounded-button-inner ${fillClass}`}>
          <Text className="font-mono-semibold text-body-md text-foreground">{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Ghost CTA for white/canvas surfaces — white fill, no border. */
export function GhostCanvasButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <GhostButton label={label} onPress={onPress} surface="canvas" />;
}

/** Ghost CTA for gray field/surface cards — darker gray fill so it reads on gray. */
export function GhostFieldButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <GhostButton label={label} onPress={onPress} surface="field" />;
}

/** Yellow secondary CTA — muted warning fill on warning-soft cards. */
export function WarningFieldButton({ label, onPress, enabled = true }: { label: string; onPress: () => void; enabled?: boolean }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 20, stiffness: 360 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 300 }); }}
        className={`w-full rounded-button-outer ${enabled ? 'opacity-100' : 'opacity-40'}`}
      >
        <View className="h-field items-center justify-center rounded-button-inner bg-warning-muted">
          <Text className="font-mono-semibold text-body-md text-warning-emphasis">{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** @deprecated Prefer GhostFieldButton / GhostCanvasButton */
export function SecondaryFieldButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <GhostFieldButton label={label} onPress={onPress} />;
}

/** Branded toggle — muted blue track when on, accent blue thumb. */
export function AccentSwitch({ value, onValueChange, disabled = false }: { value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean }) {
  const palette = useThemePalette();
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const trackOff = dark ? '#404040' : '#d4d4d4';
  const thumbOff = dark ? '#737373' : '#ffffff';
  const thumbShadow = value
    ? {
        shadowColor: palette.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: dark ? 0.5 : 0.32,
        shadowRadius: 3,
        elevation: 3,
      }
    : {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: dark ? 0.4 : 0.16,
        shadowRadius: 2,
        elevation: 2,
      };

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={{ backgroundColor: value ? palette.accentMuted : trackOff }}
      className={`h-4 w-14 items-center justify-center rounded-full p-0.5 ${disabled ? 'opacity-60' : ''}`}
    >
      <View
        style={{ backgroundColor: value ? palette.accent : thumbOff, ...thumbShadow }}
        className={`size-6 w-8 items-center justify-center rounded-2xl ${value ? 'self-end' : 'self-start'}`}
      />
    </Pressable>
  );
}
