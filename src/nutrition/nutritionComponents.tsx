import { useEffect, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { useUniwind } from 'uniwind';
import { hapticPress } from '../haptics';
import { SheetBackdrop } from '../sheetOverlay';
import { useThemePalette } from '../themeColors';

/** Width reserved for the dev-only States pill anchored to the top right of every screen. */
export const STATES_PILL_CLEARANCE = 92;

export function NutritionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`rounded-field border border-border bg-canvas p-sheet ${className}`}>{children}</View>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-heading text-heading-sm text-foreground">{children}</Text>
      {action}
    </View>
  );
}

export function SelectionCard({
  title,
  description,
  selected,
  onPress,
  multi = false,
  trailing,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
  trailing?: ReactNode;
}) {
  const palette = useThemePalette();
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={hapticPress(onPress, 'selection')}
      className={`min-h-11 flex-row items-center gap-3 rounded-field border p-sheet ${
        selected ? 'border-2 border-accent bg-accent-soft' : 'border-border bg-canvas'
      }`}
    >
      <View className="min-w-0 flex-1">
        <Text className="font-mono-semibold text-body-md text-foreground">{title}</Text>
        {description ? <Text className="mt-1 font-body text-body-sm text-muted">{description}</Text> : null}
      </View>
      {trailing ?? (
        <View
          className={`size-6 shrink-0 items-center justify-center border ${multi ? 'rounded-md' : 'rounded-full'} ${
            selected ? 'border-accent bg-accent' : 'border-control-border'
          }`}
        >
          {selected ? <CheckIcon size={14} weight="bold" color={palette.accentForeground} /> : null}
        </View>
      )}
    </Pressable>
  );
}

export function SelectionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = useThemePalette();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={hapticPress(onPress, 'selection')}
      className={`min-h-11 flex-row items-center gap-2 rounded-field border px-4 ${
        selected ? 'border-2 border-accent bg-accent-soft' : 'border-border bg-canvas'
      }`}
    >
      <Text className={`text-body-sm ${selected ? 'font-mono-semibold text-foreground' : 'font-body text-muted'}`}>{label}</Text>
      {selected ? <CheckIcon size={14} weight="bold" color={palette.accent} /> : null}
    </Pressable>
  );
}

export function ProgressTrack({
  value,
  target,
  tone = 'accent',
}: {
  value: number;
  target: number;
  tone?: 'accent' | 'success';
}) {
  const ratio = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  return (
    <View className="h-2 overflow-hidden rounded-full bg-surface">
      <View
        style={{ width: `${ratio * 100}%` }}
        className={`h-full rounded-full ${tone === 'success' ? 'bg-success' : 'bg-accent'}`}
      />
    </View>
  );
}

export function MacroProgress({
  label,
  consumed,
  target,
  unit = 'g',
}: {
  label: string;
  consumed: number;
  target: number;
  unit?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${Math.round(consumed)} ${unit === 'g' ? 'grams' : unit} of ${Math.round(target)} ${
        unit === 'g' ? 'grams' : unit
      }`}
      className="flex-1 gap-1.5"
    >
      <Text className="font-body text-body-xs text-muted">{label}</Text>
      <Text className="font-mono-semibold text-body-sm text-foreground">
        {Math.round(consumed)} / {Math.round(target)}
        {unit}
      </Text>
      <ProgressTrack value={consumed} target={target} />
    </View>
  );
}

export function SubscriptionBadge() {
  return (
    <View className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1">
      <Text className="font-mono-semibold text-body-xs text-accent">Subscription</Text>
    </View>
  );
}

export function InfoNotice({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warning' }) {
  return (
    <View className={`rounded-field p-sheet ${tone === 'warning' ? 'bg-warning-soft' : 'bg-surface'}`}>
      <Text className={`font-body text-body-xs leading-5 ${tone === 'warning' ? 'text-warning-emphasis' : 'text-muted'}`}>
        {children}
      </Text>
    </View>
  );
}

export function NutritionSheet({
  children,
  onClose,
  closeLabel,
}: {
  children: ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <View className="absolute inset-0 z-50">
      <SheetBackdrop />
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} className="absolute inset-0" onPress={onClose} />
      <View pointerEvents="box-none" className="flex-1 justify-end">
        <Animated.View entering={FadeInUp.duration(220)} className="mx-4 mb-4 overflow-hidden rounded-sheet bg-canvas">
          <View className="p-sheet">{children}</View>
        </Animated.View>
      </View>
    </View>
  );
}

export function SheetCloseButton({ onPress, label }: { onPress: () => void; label: string }) {
  const { theme } = useUniwind();
  const color = theme === 'dark' ? '#ffffff' : '#101010';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className="size-icon-button shrink-0 items-center justify-center rounded-full bg-surface"
    >
      <XIcon size={18} weight="regular" color={color} />
    </Pressable>
  );
}

/** Partial skeleton used while an independent section is still loading. */
export function SkeletonBlock({ height = 16, width = '100%' }: { height?: number; width?: number | string }) {
  return <View style={{ height, width: width as number }} className="rounded-field bg-surface" />;
}

/**
 * Toast with an inline action. The shared `Toast` is message-only, and item
 * removal needs Undo rather than a confirmation modal.
 */
export function UndoToast({
  message,
  actionLabel = 'Undo',
  onAction,
  onDismiss,
}: {
  message: string;
  actionLabel?: string;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const timeout = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timeout);
  }, [message, onDismiss]);

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      accessibilityRole="alert"
      style={{ top: insets.top + 8 }}
      className="absolute inset-x-4 z-[100] flex-row items-center gap-3 rounded-2xl bg-toast px-4 py-3 shadow-md"
    >
      <Text className="min-w-0 flex-1 font-body-medium text-body-sm text-toast-foreground">{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={hapticPress(onAction, 'light')}
        hitSlop={8}
        className="min-h-11 shrink-0 justify-center"
      >
        <Text className="font-mono-semibold text-body-sm text-toast-foreground underline">{actionLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}
