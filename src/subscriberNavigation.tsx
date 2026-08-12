import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { type Icon, type IconWeight } from 'phosphor-react-native';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { ForkKnifeIcon } from 'phosphor-react-native/src/icons/ForkKnife';
import { ClipboardTextIcon } from 'phosphor-react-native/src/icons/ClipboardText';
import { ChartLineUpIcon } from 'phosphor-react-native/src/icons/ChartLineUp';
import { useReduceMotion, useReduceTransparency } from './accessibilityPreferences';
import { hapticPress } from './haptics';
import { themePalette } from './themeColors';
import type { HomeLifecycleVariant } from './TrialHome';
import type { SubscriberTab } from './nutrition/types';

export const NAV_HEIGHT = 72;
export const NAV_BOTTOM_GAP = 8;
export const NAV_SIDE_INSET = 16;

/** Height the nav occupies above the safe area — for screens that already pad by it. */
export const NAV_OVERLAY_HEIGHT = NAV_HEIGHT + NAV_BOTTOM_GAP + 12;

/** Bottom padding a scroll view needs so content clears the floating nav. */
export function navContentInset(safeAreaBottom: number) {
  return NAV_OVERLAY_HEIGHT + safeAreaBottom;
}

/**
 * Nutrition and its sibling tabs are a subscriber feature. The prototype has no
 * live subscription record, so this reads the lifecycle variant; swap the body
 * for `subscription.status === 'active'` once that endpoint is wired.
 */
export function isActiveSubscriber(variant: HomeLifecycleVariant | undefined): boolean {
  return variant === 'subscription_active' || variant === 'subscription_restarted';
}

const tabs: Array<{ id: SubscriberTab; icon: Icon; label: string }> = [
  { id: 'home', icon: HouseIcon, label: 'Home' },
  { id: 'nutrition', icon: ForkKnifeIcon, label: 'Nutrition' },
  { id: 'diet_plan', icon: ClipboardTextIcon, label: 'Diet Plan' },
  { id: 'insights', icon: ChartLineUpIcon, label: 'Insights' },
];

function TabGlyph({ icon: IconComponent, active, dark }: { icon: Icon; active: boolean; dark: boolean }) {
  // Weight carries the active state too, so selection never relies on colour alone.
  const weight: IconWeight = active ? 'fill' : 'regular';
  const palette = themePalette[dark ? 'dark' : 'light'];
  const color = active ? (dark ? '#ffffff' : '#101010') : palette.muted;
  return <IconComponent size={20} weight={weight} color={color} />;
}

export function SubscriberGlassNav({
  active,
  onChange,
  hidden = false,
}: {
  active: SubscriberTab;
  onChange: (tab: SubscriberTab) => void;
  hidden?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const reduceMotion = useReduceMotion();
  const reduceTransparency = useReduceTransparency();
  const [trackWidth, setTrackWidth] = useState(0);

  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === active));
  const capsuleWidth = trackWidth > 0 ? trackWidth / tabs.length : 0;
  const translateX = useSharedValue(0);

  useEffect(() => {
    const target = capsuleWidth * activeIndex;
    translateX.value = reduceMotion ? target : withSpring(target, { damping: 20, stiffness: 210, mass: 0.7 });
  }, [activeIndex, capsuleWidth, reduceMotion, translateX]);

  const capsuleStyle = useAnimatedStyle(() => ({
    width: capsuleWidth,
    transform: [{ translateX: translateX.value }],
  }));

  if (hidden) return null;

  const noShadow = {
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  } as const;

  const content = (
    <View className="flex-1 justify-center p-1.5" onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
      {capsuleWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={capsuleStyle}
          className="absolute bottom-1.5 top-1.5 rounded-full border border-glass-capsule-border bg-glass-capsule"
        />
      ) : null}
      <View className="flex-row">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab`}
              onPress={hapticPress(() => onChange(tab.id), 'selection')}
              className="min-h-11 flex-1 items-center justify-center gap-1 rounded-full"
            >
              <TabGlyph icon={tab.icon} active={isActive} dark={dark} />
              <Text
                numberOfLines={1}
                className={`text-body-xs ${isActive ? 'font-mono-semibold text-foreground' : 'font-body text-muted'}`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View
      pointerEvents="box-none"
      style={{ bottom: insets.bottom + NAV_BOTTOM_GAP, left: NAV_SIDE_INSET, right: NAV_SIDE_INSET }}
      className="absolute z-30"
    >
      <View style={noShadow} className="h-nav overflow-hidden rounded-nav shadow-sm">
        {reduceTransparency ? (
          <View className="flex-1 border border-border bg-surface-raised">{content}</View>
        ) : isLiquidGlassAvailable() ? (
          <GlassView glassEffectStyle="regular" isInteractive style={[StyleSheet.absoluteFill, noShadow]}>
            {content}
          </GlassView>
        ) : (
          <View style={noShadow} className="flex-1">
            <BlurView
              intensity={Platform.OS === 'android' ? 12 : 60}
              tint={dark ? 'dark' : 'light'}
              experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
              style={[StyleSheet.absoluteFill, noShadow]}
            />
            <View pointerEvents="none" className="absolute inset-0 border border-glass-nav-border bg-glass-nav" />
            {content}
          </View>
        )}
      </View>
    </View>
  );
}
