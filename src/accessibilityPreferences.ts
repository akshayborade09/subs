import { useEffect, useState } from 'react';
import { AccessibilityInfo, Keyboard, Platform } from 'react-native';

/**
 * Reads an AccessibilityInfo flag defensively. Several of these are iOS-only —
 * `isReduceTransparencyEnabled` is undefined on web and Android — so both the
 * getter and the change event are feature-detected before use.
 */
function useAccessibilityFlag(
  getter: 'isReduceMotionEnabled' | 'isReduceTransparencyEnabled',
  event: 'reduceMotionChanged' | 'reduceTransparencyChanged',
) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    const read = AccessibilityInfo[getter];
    if (typeof read !== 'function') return;

    void Promise.resolve(read())
      .then((value) => {
        if (active) setEnabled(Boolean(value));
      })
      .catch(() => undefined);

    let subscription: { remove: () => void } | undefined;
    try {
      subscription = AccessibilityInfo.addEventListener(event, (value) => setEnabled(Boolean(value)));
    } catch {
      // Platform does not emit this event; the initial read is enough.
    }

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [event, getter]);

  return enabled;
}

/** Reduce Motion — swap springs for instant state changes. */
export function useReduceMotion() {
  return useAccessibilityFlag('isReduceMotionEnabled', 'reduceMotionChanged');
}

/** Reduce Transparency — swap glass blur for an opaque semantic surface. */
export function useReduceTransparency() {
  return useAccessibilityFlag('isReduceTransparencyEnabled', 'reduceTransparencyChanged');
}

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // iOS reports will-show/hide; Android only emits the did-* pair.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
