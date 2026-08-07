import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useUniwind } from 'uniwind';

export function sheetBlurIntensity(isDark: boolean) {
  if (isDark) return Platform.OS === 'android' ? 18 : 24;
  return Platform.OS === 'android' ? 24 : 32;
}

export function sheetBlurTint(isDark: boolean): 'dark' | 'default' {
  return 'dark';
}

export function SheetBackdrop() {
  const { theme } = useUniwind();
  const isDark = theme === 'dark';

  return (
    <>
      <BlurView
        intensity={sheetBlurIntensity(isDark)}
        tint={sheetBlurTint(isDark)}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" className="absolute inset-0 bg-overlay" />
    </>
  );
}
