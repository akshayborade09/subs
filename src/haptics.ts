import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticFeedback = 'light' | 'medium' | 'selection' | 'success' | 'warning';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

async function runHaptic(feedback: HapticFeedback) {
  if (!supported) return;

  switch (feedback) {
    case 'light':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    case 'medium':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    case 'selection':
      await Haptics.selectionAsync();
      return;
    case 'success':
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    case 'warning':
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
  }
}

/** Fire-and-forget haptic — safe on web/simulators. */
export function triggerHaptic(feedback: HapticFeedback = 'light') {
  void runHaptic(feedback).catch(() => undefined);
}

/** Wrap a press handler with haptic feedback. */
export function hapticPress(onPress: () => void, feedback: HapticFeedback = 'light') {
  return () => {
    triggerHaptic(feedback);
    onPress();
  };
}

/** Optional press handler — only fires haptic when handler exists. */
export function hapticPressOptional(onPress: (() => void) | undefined, feedback: HapticFeedback = 'light') {
  return onPress
    ? () => {
        triggerHaptic(feedback);
        onPress();
      }
    : undefined;
}
