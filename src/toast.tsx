import { useEffect, useRef } from 'react';
import { Animated as NativeAnimated, PanResponder, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const COVERAGE_REQUEST_SUCCESS_TOAST = "Thanks! We've received your request.";

const AUTO_DISMISS_MS = 3000;
const HIDDEN_OFFSET = -120;

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new NativeAnimated.Value(HIDDEN_OFFSET)).current;
  const opacity = useRef(new NativeAnimated.Value(0)).current;
  const dismissing = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (dismissing.current) return;
    dismissing.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    NativeAnimated.parallel([
      NativeAnimated.timing(translateY, {
        toValue: HIDDEN_OFFSET,
        duration: 220,
        useNativeDriver: true,
      }),
      NativeAnimated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDismiss();
    });
  };

  useEffect(() => {
    dismissing.current = false;
    translateY.setValue(HIDDEN_OFFSET);
    opacity.setValue(0);
    NativeAnimated.parallel([
      NativeAnimated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
      NativeAnimated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) timeoutRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    });
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [message, opacity, translateY]);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
    onPanResponderMove: (_, gesture) => {
      const upward = Math.min(0, gesture.dy);
      translateY.setValue(upward);
      opacity.setValue(Math.max(0, 1 - Math.abs(upward) / 100));
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy < -40 || gesture.vy < -0.65) {
        dismiss();
        return;
      }
      NativeAnimated.parallel([
        NativeAnimated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
        NativeAnimated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    },
    onPanResponderTerminate: () => {
      NativeAnimated.parallel([
        NativeAnimated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
        NativeAnimated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    },
  })).current;

  return (
    <NativeAnimated.View
      {...panResponder.panHandlers}
      accessibilityRole="alert"
      style={{ top: insets.top + 8, opacity, transform: [{ translateY }] }}
      className="absolute inset-x-4 z-[100] rounded-2xl bg-toast px-4 py-3.5 shadow-md"
    >
      <Text className="text-center font-body-medium text-body-sm text-toast-foreground">{message}</Text>
    </NativeAnimated.View>
  );
}

/** @deprecated Use `Toast` */
export const BottomToast = Toast;
