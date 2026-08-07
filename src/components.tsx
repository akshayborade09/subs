import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { hapticPressOptional } from './haptics';

export function Label({ children }: PropsWithChildren) {
  return <Text className="font-medium text-sm uppercase tracking-[0.4px] text-muted">{children}</Text>;
}

export function Button({ children, onPress, icon }: PropsWithChildren<{ onPress?: () => void; icon?: ReactNode }>) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        onPress={hapticPressOptional(onPress, 'medium')}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 18, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 16, stiffness: 260 }); }}
        className="min-h-[50px] flex-row items-center justify-center gap-2 rounded-full bg-accent px-6"
      >
        {icon}
        <Text className="font-semibold text-[15px] text-accent-foreground">{children}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function Avatar({ initials }: { initials: string }) {
  return (
    <View className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-raised">
      <Text className="font-semibold text-sm text-foreground">{initials}</Text>
    </View>
  );
}

export function IconButton({ label, children, onPress }: PropsWithChildren<{ label: string; onPress?: () => void }>) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={hapticPressOptional(onPress, 'light')} className="h-11 w-11 items-center justify-center rounded-full border border-border active:opacity-60">
      <Text className="text-[19px] text-foreground">{children}</Text>
    </Pressable>
  );
}
