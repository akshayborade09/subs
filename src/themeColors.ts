import { useUniwind } from 'uniwind';

export const themePalette = {
  light: {
    accentLighter: '#eff6ff',
    accentLight: '#dbeafe',
    accentModerate: '#2563eb',
    accentDark: '#1d4ed8',
    accentDarker: '#1e3a8a',
    accent: '#2563eb',
    accentSoft: '#eff6ff',
    accentMuted: '#dbeafe',
    accentForeground: '#ffffff',
    success: '#078a4b',
    muted: '#5e5e5e',
    subtle: '#949494',
    skippedSurface: '#eeeeee',
    skippedBorder: '#d8d8d8',
  },
  dark: {
    accentLighter: '#172554',
    accentLight: '#22386d',
    accentModerate: '#60a5fa',
    accentDark: '#3b82f6',
    accentDarker: '#2563eb',
    accent: '#60a5fa',
    accentSoft: '#172554',
    accentMuted: '#22386d',
    accentForeground: '#ffffff',
    success: '#55c986',
    muted: '#ababab',
    subtle: '#808080',
    skippedSurface: '#262626',
    skippedBorder: '#404040',
  },
} as const;

export function useThemePalette() {
  const { theme } = useUniwind();
  return themePalette[theme === 'dark' ? 'dark' : 'light'];
}

export function useAccentColor() {
  return useThemePalette().accent;
}

export function useSuccessColor() {
  return useThemePalette().success;
}

export function useForegroundColor() {
  const { theme } = useUniwind();
  return theme === 'dark' ? '#ffffff' : '#101010';
}

/** Multiline + single-line field placeholder tint (delivery instructions reference). */
export function fieldPlaceholderColor(dark: boolean) {
  return dark ? 'rgba(255,255,255,0.35)' : 'rgba(16,16,16,0.35)';
}

export function useFieldPlaceholderColor() {
  const { theme } = useUniwind();
  return fieldPlaceholderColor(theme === 'dark');
}
