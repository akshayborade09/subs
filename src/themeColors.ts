import { useUniwind } from 'uniwind';

export const themePalette = {
  light: {
    accent: '#2563eb',
    accentForeground: '#ffffff',
    success: '#078a4b',
  },
  dark: {
    accent: '#60a5fa',
    accentForeground: '#ffffff',
    success: '#55c986',
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
