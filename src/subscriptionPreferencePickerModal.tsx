import { Modal, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { MealPreferenceImage } from './MealPreferenceImage';
import { hapticPress } from './haptics';
import {
  subscriptionPreferenceOptions,
  type PreferenceOption,
  type SubscriptionPreferenceKind,
} from './subscriptionPreferenceOptions';

export type PickerAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const OPTION_WIDTH = 74;
const OPTION_IMAGE_HEIGHT = 48;
const OPTION_IMAGE_SIZE = 84;
const OPTION_GAP = 5;
const TOOLTIP_PADDING = 6;
const TOOLTIP_RADIUS = 14;

function tooltipShadowStyle(canvasColor: string) {
  return Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.48,
      shadowRadius: 36,
      backgroundColor: canvasColor,
    },
    android: {
      elevation: 32,
      backgroundColor: canvasColor,
    },
    default: {
      backgroundColor: canvasColor,
    },
  });
}

function CompactPreferenceOption({
  option,
  selected,
  index,
  onPress,
}: {
  option: PreferenceOption;
  selected: boolean;
  index: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={hapticPress(onPress, 'selection')}
      style={{ width: OPTION_WIDTH }}
      className={`overflow-hidden rounded-[12px] border bg-canvas ${selected ? 'border-2 border-accent bg-accent-soft' : 'border-border'}`}
    >
      <View className="w-full overflow-hidden bg-field">
        <MealPreferenceImage
          source={option.image}
          label={option.shortLabel}
          delayMs={80 + index * 50}
          width={OPTION_WIDTH}
          height={OPTION_IMAGE_HEIGHT}
          imageSize={OPTION_IMAGE_SIZE}
        />
      </View>
      <Text className="py-1 text-center font-mono-semibold text-body-xs text-foreground">{option.shortLabel}</Text>
    </Pressable>
  );
}

export function SubscriptionPreferencePickerModal({
  kind,
  value,
  anchor,
  onClose,
  onSelect,
}: {
  kind: SubscriptionPreferenceKind;
  value: string;
  anchor: PickerAnchor;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const { theme } = useUniwind();
  const canvasColor = theme === 'dark' ? '#000000' : '#ffffff';
  const options = subscriptionPreferenceOptions[kind];
  const tooltipWidth = options.length * OPTION_WIDTH + (options.length - 1) * OPTION_GAP + TOOLTIP_PADDING * 2;
  const left = Math.max(12, Math.min(anchor.x + anchor.width / 2 - tooltipWidth / 2, screenWidth - tooltipWidth - 12));
  const top = anchor.y;

  const choose = (next: string) => {
    onSelect(next);
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close preference picker" className="absolute inset-0" onPress={hapticPress(onClose, 'light')} />
      <Animated.View
        entering={FadeInUp.duration(180)}
        style={{
          position: 'absolute',
          left,
          top,
          width: tooltipWidth,
          zIndex: 2,
          borderRadius: TOOLTIP_RADIUS,
          ...tooltipShadowStyle(canvasColor),
        }}
      >
        <View className="overflow-hidden rounded-[14px] border border-border bg-canvas p-1.5">
          <View className="flex-row" style={{ gap: OPTION_GAP }}>
            {options.map((option, index) => (
              <CompactPreferenceOption
                key={option.title}
                option={option}
                selected={value === option.title}
                index={index}
                onPress={() => choose(option.title)}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
