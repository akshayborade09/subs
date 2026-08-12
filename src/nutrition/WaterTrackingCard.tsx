import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { hapticPress } from '../haptics';
import { PrimaryShimmerButton } from '../primaryButton';
import { useFieldPlaceholderColor, useThemePalette } from '../themeColors';
import { NutritionSheet, ProgressTrack, SheetCloseButton } from './nutritionComponents';

function formatLitres(ml: number) {
  return `${(ml / 1000).toFixed(1)} L`;
}

function CustomWaterSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (ml: number) => void }) {
  const [value, setValue] = useState('');
  const placeholderColor = useFieldPlaceholderColor();
  const parsed = Number.parseInt(value, 10);
  const valid = Number.isFinite(parsed) && parsed > 0;
  return (
    <NutritionSheet onClose={onClose} closeLabel="Close custom water amount">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-auth-block">
          <Text className="font-heading text-heading-sm text-foreground">Custom amount</Text>
          <Text className="font-body text-body-sm text-subtle">How much did you drink?</Text>
        </View>
        <SheetCloseButton onPress={onClose} label="Close custom water amount" />
      </View>
      <View className="mt-sheet-gap gap-sheet-gap">
        <View className="h-field flex-row items-center gap-2 rounded-field bg-field px-4">
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            keyboardType="number-pad"
            placeholder="250"
            placeholderTextColor={placeholderColor}
            accessibilityLabel="Water amount in millilitres"
            className="min-w-0 flex-1 font-body-medium text-body-md tracking-body-md text-foreground"
          />
          <Text className="font-body text-body-sm text-muted">ml</Text>
        </View>
        <PrimaryShimmerButton label="Add water" enabled={valid} onPress={() => onAdd(parsed)} />
      </View>
    </NutritionSheet>
  );
}

export function WaterTrackingCard({
  consumedMl,
  targetMl,
  editable,
  onAdd,
  periodLabel,
}: {
  consumedMl: number;
  targetMl: number;
  editable: boolean;
  onAdd: (ml: number) => void;
  periodLabel?: string;
}) {
  const palette = useThemePalette();
  const [quickOpen, setQuickOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <View className="rounded-field border border-border bg-canvas p-sheet">
      <View className="flex-row items-start justify-between gap-3">
        <View
          accessible
          accessibilityLabel={`Water, ${formatLitres(consumedMl)} of ${formatLitres(targetMl)}`}
          className="min-w-0 flex-1"
        >
          <Text className="font-heading text-heading-sm text-foreground">Water</Text>
          <Text className="mt-2 font-heading text-heading-md text-foreground">
            {consumedMl.toLocaleString('en-IN')} ml
          </Text>
          <Text className="mt-1 font-body text-body-sm text-muted">
            {periodLabel ?? 'Daily goal'} {targetMl.toLocaleString('en-IN')} ml
          </Text>
        </View>
        {editable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add water"
            onPress={hapticPress(() => setQuickOpen((open) => !open), 'light')}
            className="size-11 items-center justify-center rounded-full bg-accent-soft"
          >
            <PlusIcon size={20} weight="bold" color={palette.accent} />
          </Pressable>
        ) : null}
      </View>

      <View className="mt-3">
        <ProgressTrack value={consumedMl} target={targetMl} />
      </View>

      {quickOpen && editable ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {[250, 500].map((amount) => (
            <Pressable
              key={amount}
              accessibilityRole="button"
              accessibilityLabel={`Add ${amount} millilitres`}
              onPress={hapticPress(() => {
                onAdd(amount);
                setQuickOpen(false);
              }, 'light')}
              className="min-h-11 justify-center rounded-field bg-surface px-4"
            >
              <Text className="font-mono-semibold text-body-sm text-foreground">+{amount} ml</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Custom amount"
            onPress={hapticPress(() => {
              setQuickOpen(false);
              setCustomOpen(true);
            }, 'light')}
            className="min-h-11 justify-center rounded-field bg-surface px-4"
          >
            <Text className="font-mono-semibold text-body-sm text-foreground">Custom amount</Text>
          </Pressable>
        </View>
      ) : null}

      {customOpen ? (
        <CustomWaterSheet
          onClose={() => setCustomOpen(false)}
          onAdd={(ml) => {
            onAdd(ml);
            setCustomOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
