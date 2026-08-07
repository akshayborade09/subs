import { useEffect, useRef } from 'react';
import { Animated as NativeAnimated, PanResponder, Text, useWindowDimensions } from 'react-native';

export const COVERAGE_REQUEST_SUCCESS_TOAST = 'Thanks for sharing. We will soon start service in your location.';

export function BottomToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const translateX = useRef(new NativeAnimated.Value(0)).current;
  const translateY = useRef(new NativeAnimated.Value(24)).current;
  const opacity = useRef(new NativeAnimated.Value(0)).current;
  const dismissing = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = (direction: 'down' | 'left' | 'right' = 'down') => {
    if (dismissing.current) return;
    dismissing.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    NativeAnimated.parallel([
      NativeAnimated.timing(translateX, {
        toValue: direction === 'left' ? -screenWidth : direction === 'right' ? screenWidth : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      NativeAnimated.timing(translateY, {
        toValue: direction === 'down' ? 24 : 0,
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
    NativeAnimated.parallel([
      NativeAnimated.timing(translateY, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
      NativeAnimated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) timeoutRef.current = setTimeout(() => dismiss('down'), 5000);
    });
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || gesture.dy > 4,
    onPanResponderMove: (_, gesture) => {
      const verticalDistance = Math.max(0, gesture.dy);
      translateX.setValue(gesture.dx);
      translateY.setValue(verticalDistance);
      opacity.setValue(Math.max(0, 1 - Math.max(Math.abs(gesture.dx), verticalDistance) / 140));
    },
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > 50 || Math.abs(gesture.vx) > 0.65) {
        dismiss(gesture.dx < 0 || gesture.vx < -0.65 ? 'left' : 'right');
        return;
      }
      if (gesture.dy > 40 || gesture.vy > 0.65) {
        dismiss('down');
        return;
      }
      NativeAnimated.parallel([
        NativeAnimated.timing(translateX, { toValue: 0, duration: 160, useNativeDriver: true }),
        NativeAnimated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
        NativeAnimated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    },
    onPanResponderTerminate: () => {
      NativeAnimated.parallel([
        NativeAnimated.timing(translateX, { toValue: 0, duration: 160, useNativeDriver: true }),
        NativeAnimated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
        NativeAnimated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    },
  })).current;

  return (
    <NativeAnimated.View
      {...panResponder.panHandlers}
      accessibilityRole="alert"
      style={{ bottom: 48, backgroundColor: '#064E3B', opacity, transform: [{ translateX }, { translateY }] }}
      className="absolute inset-x-5 z-[100] rounded-full px-5 py-4"
    >
      <Text className="font-semibold text-center text-white">{message}</Text>
    </NativeAnimated.View>
  );
}
