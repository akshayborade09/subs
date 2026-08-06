import { useUniwind } from 'uniwind';

export const themePalette = {
  light: {
    accent: '#2563eb',
    accentSoft: '#eff6ff',
    accentMuted: '#dbeafe',
    accentForeground: '#ffffff',
    success: '#078a4b',
    muted: '#5e5e5e',
    subtle: '#949494',
  },
  dark: {
    accent: '#60a5fa',
    accentSoft: '#172554',
    accentMuted: '#132850',
    accentForeground: '#ffffff',
    success: '#55c986',
    muted: '#ababab',
    subtle: '#808080',
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
