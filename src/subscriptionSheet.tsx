import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated as NativeAnimated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { LockKeyIcon } from 'phosphor-react-native/src/icons/LockKey';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { type Icon, type IconWeight } from 'phosphor-react-native';
import { FormHeader, FormModalLayout, FormPageSection, SectionHeading } from './formLayout';
import { formatRupee } from './formatCurrency';
import { MoneyInline, MoneyText, moneyValueTypography } from './moneyText';
import { foodImages } from './foodImages';
import { MealPreferenceImage } from './MealPreferenceImage';
import { PrimaryShimmerButton } from './primaryButton';
import { SheetBackdrop } from './sheetOverlay';
import { themePalette } from './themeColors';
import { hapticPress } from './haptics';
import { addressLabelDisplay, formatSavedAddressLines, type AddressLabelType } from './addressTypes';
import { AddressLabelIcon } from './deliveryAddressComponents';
import { DeliveryAddressFlow } from './DeliveryAddressFlow';
import { SubscriptionPreferencePickerModal, type PickerAnchor } from './subscriptionPreferencePickerModal';
import { type SubscriptionPreferenceKind } from './subscriptionPreferenceOptions';
import type { TrialMealDeliveryState } from './trialOnboardingSummary';

type PlanId = 'weekly' | 'monthly' | 'quarterly';
type MealChoice = 'Lunch' | 'Dinner' | 'Both';
type SubscriptionMealSlot = 'lunch' | 'dinner';

export const plans = [
  { id: 'weekly' as const, name: 'Weekly', duration: '1 week', meals: 5, price: 1499, discount: 100, badge: 'Try more' as const, badgeGhost: true },
  { id: 'monthly' as const, name: 'Monthly', duration: '4 weeks', meals: 20, price: 5499, discount: 500, badge: 'Recommended' as const, badgeGhost: false },
  { id: 'quarterly' as const, name: 'Quarterly', duration: '12 weeks', meals: 60, price: 14999, discount: 2000, badge: 'Best value' as const, badgeGhost: false },
];

const planBenefitCarouselItems = [
  { title: 'Daily home style meals', image: require('../assets/choose-subs/daily-home.png') },
  { title: 'Nutrition values for every item', image: require('../assets/choose-subs/nutrition-values.png') },
  { title: 'Pause upcoming meals', image: require('../assets/choose-subs/pause-meal.png') },
  { title: 'Change meal preferences anytime', image: require('../assets/choose-subs/meal-preferences.png') },
  { title: 'Manage delivery addresses', image: require('../assets/choose-subs/manage-delivery.png') },
  { title: 'Rate every food and delivery', image: require('../assets/choose-subs/rate-food.png') },
] as const;

const toolBenefits = ['Nutrient calculator', 'Personalised diet plan', 'Weekly nutrition insights', 'Meal and nutrition history'];

const subscriptionDeliveryDays = [
  { label: 'M', weekday: 1 },
  { label: 'T', weekday: 2 },
  { label: 'W', weekday: 3 },
  { label: 'T', weekday: 4 },
  { label: 'F', weekday: 5 },
  { label: 'S', weekday: 6 },
  { label: 'S', weekday: 0 },
] as const;

type SubscriptionMealConfig = {
  deliveryAddress: string;
  addressLabel: string;
  labelType: AddressLabelType;
  selectedDays: number[];
  food: string;
  bread: string;
  rice: string;
};

type SubscriptionPricing = ReturnType<typeof calculateSubscriptionPricing>;

function foodImageForPreference(preference: string) {
  if (preference === 'Non-vegetarian') return foodImages['Non-vegetarian'];
  if (preference === 'Mix of both') return foodImages['Mix of both'];
  return foodImages.Vegetarian;
}

function preferenceImageFor(value: string) {
  return foodImages[value as keyof typeof foodImages] ?? foodImages.Vegetarian;
}

function shortFoodPreferenceLabel(preference: string) {
  if (preference === 'Non-vegetarian') return 'Non-veg';
  if (preference === 'Vegetarian') return 'Veg';
  return preference;
}

function subscriptionPreferenceCardTitle(kind: 'food' | 'bread' | 'rice', value: string) {
  if (kind === 'food') return shortFoodPreferenceLabel(value);
  if (kind === 'rice' && value === 'Jeera Rice') return 'Jeera rice';
  if (kind === 'rice' && value === 'Plain Rice') return 'Plain rice';
  return value;
}

function mealChoiceFromInitial(initialMeal: string): MealChoice {
  if (initialMeal === 'Dinner') return 'Dinner';
  if (initialMeal === 'Both') return 'Both';
  return 'Lunch';
}

function buildInitialMealConfig(
  slot: SubscriptionMealSlot,
  delivery: TrialMealDeliveryState | null | undefined,
  fallbackAddress: string,
  food: string,
  bread: string,
  rice: string,
  dailyMeals: Array<{ lunch: string; dinner: string }>,
): SubscriptionMealConfig {
  const deliveryAddress = delivery
    ? formatSavedAddressLines({ ...delivery.address, deliveryLocation: delivery.deliveryLocation, pincode: delivery.address.pincode })
    : fallbackAddress;
  const addressLabel = delivery ? addressLabelDisplay(delivery.address) : 'Home';
  const labelType = delivery?.address.labelType ?? 'home';
  const slotFood = food === 'Mix of both'
    ? (slot === 'lunch' ? dailyMeals[0]?.lunch || 'Vegetarian' : dailyMeals[0]?.dinner || 'Vegetarian')
    : food;
  return {
    deliveryAddress,
    addressLabel,
    labelType,
    selectedDays: [1, 2, 3, 4, 5],
    food: slotFood || 'Vegetarian',
    bread: bread || 'Chapati',
    rice: rice || 'Plain Rice',
  };
}

export function calculateSubscriptionPricing(plan: typeof plans[number], mealChoice: MealChoice, trialCredit = 100) {
  const multiplier = mealChoice === 'Both' ? 2 : 1;
  const planPrice = plan.price * multiplier;
  const discount = plan.discount * multiplier;
  const taxes = Math.round((planPrice - discount) * 0.05);
  const total = planPrice - discount - trialCredit + taxes;
  const perMeal = Math.round(total / (plan.meals * multiplier));
  const lunchPlanPrice = mealChoice === 'Dinner' ? 0 : mealChoice === 'Both' ? plan.price : planPrice;
  const dinnerPlanPrice = mealChoice === 'Lunch' ? 0 : mealChoice === 'Both' ? plan.price : planPrice;
  const lunchDiscount = mealChoice === 'Dinner' ? 0 : mealChoice === 'Both' ? plan.discount : discount;
  const dinnerDiscount = mealChoice === 'Lunch' ? 0 : mealChoice === 'Both' ? plan.discount : discount;
  return {
    multiplier,
    planPrice,
    discount,
    taxes,
    trialCredit,
    total,
    perMeal,
    lunchPlanPrice,
    dinnerPlanPrice,
    lunchDiscount,
    dinnerDiscount,
  };
}

type GlyphTone = 'foreground' | 'muted' | 'accent' | 'accent-foreground' | 'success' | 'canvas';
function SheetGlyph({ icon: Glyph, size = 20, weight = 'regular', tone = 'foreground' }: { icon: Icon; size?: number; weight?: IconWeight; tone?: GlyphTone }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const colors: Record<GlyphTone, string> = {
    foreground: dark ? '#ffffff' : '#101010',
    muted: dark ? '#ababab' : '#5e5e5e',
    accent: dark ? '#60a5fa' : '#2563eb',
    'accent-foreground': themePalette[dark ? 'dark' : 'light'].accentForeground,
    success: themePalette[dark ? 'dark' : 'light'].success,
    canvas: dark ? '#0e0e0e' : '#ffffff',
  };
  return <Glyph size={Math.max(8, size - 4)} weight={weight === 'fill' ? 'fill' : 'bold'} color={colors[tone]} />;
}

function Meta({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  const sizeClass = compact ? 'text-body-sm' : 'text-body-md';
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="max-w-[40%] shrink-0 font-body text-body-sm text-muted">{label}</Text>
      <View className="min-w-0 flex-1">
        <Text className={moneyValueTypography(value, sizeClass)}>{value}</Text>
      </View>
    </View>
  );
}

function SheetCloseButton({ onPress, label }: { onPress: () => void; label: string }) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={hapticPress(onPress, 'light')} hitSlop={8} className="size-icon-button shrink-0 items-center justify-center">
      <XIcon size={24} weight="regular" color={iconColor} />
    </Pressable>
  );
}

function SubscriptionOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <View className="absolute inset-0 justify-end">
      <SheetBackdrop />
      <Pressable accessibilityRole="button" accessibilityLabel="Close overlay" className="absolute inset-0" onPress={onClose} />
      {children}
    </View>
  );
}

function MealConfigSectionHeading({ children, carousel = false }: { children: string; carousel?: boolean }) {
  if (carousel) {
    return (
      <Text
        accessibilityRole="header"
        className="font-body font-mono-bold text-body-md text-foreground"
        style={Platform.OS === 'android' ? { includeFontPadding: false } : undefined}
      >
        {children}
      </Text>
    );
  }
  return <SectionHeading>{children}</SectionHeading>;
}

/** Matches the `leading-5` on the address text — keeps both carousel cards the same height. */
const ADDRESS_LINE_HEIGHT = 20;

function SubscriptionLocationRow({ addressLabel, labelType, address, onEdit, carouselSectionHeadings = false, reserveAddressLines = false }: { addressLabel: string; labelType: AddressLabelType; address: string; onEdit: () => void; carouselSectionHeadings?: boolean; reserveAddressLines?: boolean }) {
  return (
    <View className="gap-2">
      <MealConfigSectionHeading carousel={carouselSectionHeadings}>Location</MealConfigSectionHeading>
      <View className="flex-row items-center gap-1.5 self-start rounded-full border border-control-border bg-ghost-on-field px-2.5 py-1">
        <AddressLabelIcon labelType={labelType} size={14} />
        <Text className="font-body-medium text-body-xs text-foreground">{addressLabel}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit delivery location"
        onPress={hapticPress(onEdit, 'light')}
        className="flex-row items-center gap-3"
      >
        <Text
          numberOfLines={3}
          style={reserveAddressLines ? { minHeight: ADDRESS_LINE_HEIGHT * 3 } : undefined}
          className="min-w-0 flex-1 font-body text-body-sm leading-5 text-foreground"
        >
          {address}
        </Text>
        <View className="size-8 shrink-0 items-center justify-center">
          <SheetGlyph icon={PencilSimpleIcon} size={20} weight="regular" />
        </View>
      </Pressable>
    </View>
  );
}

function SubscriptionDeliveryDaySelector({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const { theme } = useUniwind();
  const light = theme !== 'dark';
  const toggleDay = (weekday: number) => {
    onChange(
      value.includes(weekday)
        ? value.filter((day) => day !== weekday)
        : [...value, weekday].sort((a, b) => a - b),
    );
  };

  return (
    <View className="flex-row justify-between gap-1.5">
      {subscriptionDeliveryDays.map(({ label, weekday }, index) => {
        const selected = value.includes(weekday);
        const textClass = selected
          ? (light ? 'text-white' : 'text-success-foreground')
          : (light ? 'text-black' : 'text-foreground');
        return (
          <Pressable
            key={`${label}-${weekday}-${index}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${label} delivery day`}
            onPress={hapticPress(() => toggleDay(weekday), 'selection')}
            className={`size-8 items-center justify-center rounded-full border ${selected ? 'border-success bg-success' : 'border-control-border bg-transparent'}`}
          >
            <Text className={`font-mono-semibold text-body-sm ${textClass}`}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SubscriptionPreferenceRowCard({ caption, title, image, animate, index, onEdit }: { caption: string; title: string; image: number; animate: boolean; index: number; onEdit: (anchor: PickerAnchor) => void }) {
  const cardRef = useRef<View>(null);
  const handleEditPress = () => {
    cardRef.current?.measureInWindow((x, y, width, height) => {
      onEdit({ x, y, width, height });
    });
  };

  return (
    <Pressable
      ref={cardRef}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${caption.toLowerCase()} preference`}
      onPress={hapticPress(handleEditPress, 'light')}
      className="min-w-0 flex-1 overflow-hidden rounded-field border border-control-border bg-canvas"
    >
      <View className="h-[88px] w-full items-center overflow-hidden bg-field">
        {animate ? (
          <MealPreferenceImage source={image} label={title} delayMs={80 + index * 50} width={106} height={88} imageSize={106} />
        ) : (
          <View className="h-full w-full bg-field" />
        )}
      </View>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="font-body text-body-xs text-muted">{caption}</Text>
          <Text numberOfLines={1} className="font-mono-semibold text-body-sm text-foreground">{title}</Text>
        </View>
        <View className="size-4 shrink-0 items-center justify-center">
          <SheetGlyph icon={PencilSimpleIcon} size={20} weight="regular" />
        </View>
      </View>
    </Pressable>
  );
}

function SubscriptionMealPreferencesSection({
  food,
  bread,
  rice,
  scrollSignal,
  onOpenPicker,
  carouselSectionHeadings = false,
}: {
  food: string;
  bread: string;
  rice: string;
  scrollSignal: number;
  onOpenPicker: (kind: SubscriptionPreferenceKind, anchor: PickerAnchor) => void;
  carouselSectionHeadings?: boolean;
}) {
  const [animateImages, setAnimateImages] = useState(false);
  const sectionRef = useRef<View>(null);
  const hasAnimated = useRef(false);
  const { height: windowHeight } = useWindowDimensions();
  const cards: Array<{ kind: 'food' | 'bread' | 'rice'; caption: string; title: string; image: number }> = [
    { kind: 'food', caption: 'Food', title: subscriptionPreferenceCardTitle('food', food), image: foodImageForPreference(food) },
    { kind: 'bread', caption: 'Bread', title: subscriptionPreferenceCardTitle('bread', bread), image: preferenceImageFor(bread) },
    { kind: 'rice', caption: 'Rice', title: subscriptionPreferenceCardTitle('rice', rice), image: preferenceImageFor(rice) },
  ];

  const revealImages = useCallback(() => {
    if (hasAnimated.current) return;
    sectionRef.current?.measureInWindow((_x, y, _width, height) => {
      if (y + height * 0.2 < windowHeight) {
        hasAnimated.current = true;
        setAnimateImages(true);
      }
    });
  }, [windowHeight]);

  useEffect(() => {
    revealImages();
  }, [scrollSignal, revealImages]);

  return (
    <View ref={sectionRef} onLayout={revealImages} className="gap-3">
      <MealConfigSectionHeading carousel={carouselSectionHeadings}>Meal preferences</MealConfigSectionHeading>
      <View className="flex-row gap-2">
        {cards.map((card, index) => (
          <SubscriptionPreferenceRowCard
            key={card.kind}
            caption={card.caption}
            title={card.title}
            image={card.image}
            animate={animateImages}
            index={index}
            onEdit={(anchor) => onOpenPicker(card.kind, anchor)}
          />
        ))}
      </View>
    </View>
  );
}

function SubscriptionMealConfigContent({
  config,
  onChange,
  onEditAddress,
  onOpenPicker,
  scrollSignal,
  carouselSectionHeadings = false,
  reserveAddressLines = false,
}: {
  config: SubscriptionMealConfig;
  onChange: (patch: Partial<SubscriptionMealConfig>) => void;
  onEditAddress: () => void;
  onOpenPicker: (kind: SubscriptionPreferenceKind, anchor: PickerAnchor) => void;
  scrollSignal: number;
  carouselSectionHeadings?: boolean;
  reserveAddressLines?: boolean;
}) {
  return (
    <View className={carouselSectionHeadings ? 'gap-4' : 'gap-sheet-gap'}>
      <SubscriptionLocationRow
        addressLabel={config.addressLabel}
        labelType={config.labelType}
        address={config.deliveryAddress}
        onEdit={onEditAddress}
        carouselSectionHeadings={carouselSectionHeadings}
        reserveAddressLines={reserveAddressLines}
      />
      <View className="gap-2">
        <MealConfigSectionHeading carousel={carouselSectionHeadings}>Select days</MealConfigSectionHeading>
        <SubscriptionDeliveryDaySelector
          value={config.selectedDays}
          onChange={(selectedDays) => onChange({ selectedDays })}
        />
      </View>
      <SubscriptionMealPreferencesSection
        food={config.food}
        bread={config.bread}
        rice={config.rice}
        scrollSignal={scrollSignal}
        onOpenPicker={onOpenPicker}
        carouselSectionHeadings={carouselSectionHeadings}
      />
    </View>
  );
}

function MealSlotCheckbox({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${label.toLowerCase()}`}
      onPress={hapticPress(onPress, 'selection')}
      className={`h-10 flex-row items-center gap-field-inline rounded-full border-2 px-4 ${selected ? 'border-accent bg-accent-soft' : 'border-border bg-canvas'}`}
    >
      <View className={`size-5 shrink-0 items-center justify-center rounded-sm border-2 ${selected ? 'border-accent bg-accent' : 'border-border bg-transparent'}`}>
        {selected ? <SheetGlyph icon={CheckIcon} size={16} weight="bold" tone="accent-foreground" /> : null}
      </View>
      <Text numberOfLines={1} className={`font-mono-semibold text-body-md ${selected ? 'text-accent' : 'text-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function SubscriptionMealSlotSelector({
  lunchSelected,
  dinnerSelected,
  onToggle,
}: {
  lunchSelected: boolean;
  dinnerSelected: boolean;
  onToggle: (slot: SubscriptionMealSlot) => void;
}) {
  return (
    <View className="gap-3">
      <SectionHeading>Select meal</SectionHeading>
      <View className="flex-row gap-2">
        <MealSlotCheckbox label="Lunch" selected={lunchSelected} onPress={() => onToggle('lunch')} />
        <MealSlotCheckbox label="Dinner" selected={dinnerSelected} onPress={() => onToggle('dinner')} />
      </View>
    </View>
  );
}

function mealConfigTitle(slot: SubscriptionMealSlot | 'Lunch' | 'Dinner') {
  const label = slot === 'lunch' || slot === 'Lunch' ? 'Lunch' : 'Dinner';
  return `Meal configuration - ${label}`;
}

function SubscriptionMealConfigCard({
  config,
  onChange,
  onEditAddress,
  onOpenPicker,
  scrollSignal,
  fill = false,
}: {
  config: SubscriptionMealConfig;
  onChange: (patch: Partial<SubscriptionMealConfig>) => void;
  onEditAddress: () => void;
  onOpenPicker: (kind: SubscriptionPreferenceKind, anchor: PickerAnchor) => void;
  scrollSignal: number;
  fill?: boolean;
}) {
  return (
    <View className={`rounded-field border border-control-border bg-surface p-3 ${fill ? 'flex-1' : ''}`}>
      <SubscriptionMealConfigContent
        config={config}
        onChange={onChange}
        onEditAddress={onEditAddress}
        onOpenPicker={onOpenPicker}
        scrollSignal={scrollSignal}
        carouselSectionHeadings
        reserveAddressLines={fill}
      />
    </View>
  );
}

function SubscriptionMealConfigCarousel({
  lunchConfig,
  dinnerConfig,
  onChangeLunch,
  onChangeDinner,
  onEditAddress,
  onOpenPicker,
  scrollSignal,
  activeIndex,
  onActiveIndexChange,
}: {
  lunchConfig: SubscriptionMealConfig;
  dinnerConfig: SubscriptionMealConfig;
  onChangeLunch: (patch: Partial<SubscriptionMealConfig>) => void;
  onChangeDinner: (patch: Partial<SubscriptionMealConfig>) => void;
  onEditAddress: (slot: SubscriptionMealSlot) => void;
  onOpenPicker: (slot: SubscriptionMealSlot, kind: SubscriptionPreferenceKind, anchor: PickerAnchor) => void;
  scrollSignal: number;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}) {
  const { width } = useWindowDimensions();
  const edgePadding = 20;
  const peek = 28;
  const cardGap = 12;
  const cardWidth = width - edgePadding * 2 - peek;
  const snapInterval = cardWidth + cardGap;

  return (
    <View className="gap-3">
      <SectionHeading>{mealConfigTitle(activeIndex === 0 ? 'lunch' : 'dinner')}</SectionHeading>
      <View style={{ marginHorizontal: -edgePadding, overflow: 'visible' }}>
        <ScrollView
          horizontal
          snapToInterval={snapInterval}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          style={{ overflow: 'visible' }}
          contentContainerStyle={{ paddingHorizontal: edgePadding }}
          onMomentumScrollEnd={(event) => {
            onActiveIndexChange(Math.round(event.nativeEvent.contentOffset.x / snapInterval));
          }}
        >
          <View style={{ width: cardWidth, marginRight: cardGap }}>
            <SubscriptionMealConfigCard
              config={lunchConfig}
              onChange={onChangeLunch}
              onEditAddress={() => onEditAddress('lunch')}
              onOpenPicker={(kind, anchor) => onOpenPicker('lunch', kind, anchor)}
              scrollSignal={scrollSignal}
              fill
            />
          </View>
          <View style={{ width: cardWidth }}>
            <SubscriptionMealConfigCard
              config={dinnerConfig}
              onChange={onChangeDinner}
              onEditAddress={() => onEditAddress('dinner')}
              onOpenPicker={(kind, anchor) => onOpenPicker('dinner', kind, anchor)}
              scrollSignal={scrollSignal}
              fill
            />
          </View>
        </ScrollView>
      </View>
      <View className="flex-row items-center justify-center gap-1.5">
        {[0, 1].map((index) => (
          <View key={index} className={`size-2 rounded-full ${activeIndex === index ? 'bg-foreground' : 'bg-border'}`} />
        ))}
      </View>
    </View>
  );
}

function subscriptionPlanCardClass(planId: PlanId, selected: boolean) {
  if (!selected) return 'border-border bg-canvas';
  if (planId === 'weekly') return 'border-2 border-foreground bg-field';
  if (planId === 'quarterly') return 'border-2 border-success bg-success-soft';
  return 'border-2 border-accent bg-accent-soft';
}

function SubscriptionPlanCard({ plan, selected, pricing, onPress }: { plan: typeof plans[number]; selected: boolean; pricing: SubscriptionPricing; onPress: () => void }) {
  const mealCount = plan.meals * pricing.multiplier;
  const savings = pricing.discount;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={hapticPress(onPress, 'selection')}
      className={`rounded-field border p-sheet ${subscriptionPlanCardClass(plan.id, selected)}`}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text className="font-mono-semibold text-body-sm text-foreground">{plan.name}</Text>
          <Text className="mt-1 font-body text-body-xs leading-4 text-muted">{plan.duration} · {mealCount} meals</Text>
        </View>
        {plan.badge ? (
          plan.badgeGhost ? (
            <View className="shrink-0 rounded-full border border-border bg-canvas px-2.5 py-1">
              <Text className="font-body-medium text-body-xs text-muted">{plan.badge}</Text>
            </View>
          ) : (
            <View className={`shrink-0 rounded-full px-2.5 py-1 ${plan.badge === 'Recommended' ? 'bg-accent' : 'bg-success'}`}>
              <Text className="font-body-medium text-body-xs text-accent-foreground">{plan.badge}</Text>
            </View>
          )
        ) : null}
      </View>
      <View className="mt-3 flex-row items-end justify-between gap-2">
        <Text className="font-mono-bold text-heading-sm text-foreground">{formatRupee(pricing.total)}</Text>
        <MoneyInline className="max-w-[52%] text-right font-body text-body-xs leading-4 text-muted">
          {`${formatRupee(pricing.perMeal)}/meal · save ${formatRupee(savings)}`}
        </MoneyInline>
      </View>
    </Pressable>
  );
}

const PLAN_BENEFIT_CARD_WIDTH = 161;
const PLAN_BENEFIT_CARD_GAP = 12;
const PLAN_BENEFIT_IMAGE_ASPECT = 744 / 720;
const PLAN_BENEFIT_MARQUEE_LOOP_WIDTH = planBenefitCarouselItems.length * (PLAN_BENEFIT_CARD_WIDTH + PLAN_BENEFIT_CARD_GAP);

function planBenefitImageHeight(_image: number, cardWidth = PLAN_BENEFIT_CARD_WIDTH) {
  if (typeof Image.resolveAssetSource === 'function') {
    const asset = Image.resolveAssetSource(_image);
    if (asset.width > 0 && asset.height > 0) {
      return cardWidth * (asset.height / asset.width);
    }
  }
  return cardWidth * PLAN_BENEFIT_IMAGE_ASPECT;
}

function SubscriptionPlanBenefitCarouselCard({ title, image, animate, index }: { title: string; image: number; animate: boolean; index: number }) {
  const opacity = useRef(new NativeAnimated.Value(0)).current;
  const imageHeight = planBenefitImageHeight(image);

  useEffect(() => {
    if (!animate) return;
    NativeAnimated.timing(opacity, {
      toValue: 1,
      duration: 320,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, [animate, index, opacity]);

  return (
    <View style={{ width: PLAN_BENEFIT_CARD_WIDTH }} className="shrink-0 overflow-hidden rounded-field border border-border bg-canvas">
      {animate ? (
        <NativeAnimated.View style={{ opacity, width: PLAN_BENEFIT_CARD_WIDTH, height: imageHeight }}>
          <Image source={image} accessibilityLabel={title} resizeMode="stretch" style={{ width: PLAN_BENEFIT_CARD_WIDTH, height: imageHeight }} />
        </NativeAnimated.View>
      ) : (
        <View style={{ width: PLAN_BENEFIT_CARD_WIDTH, height: imageHeight }} className="bg-field" />
      )}
      <View className="px-3 pb-3 pt-2">
        <Text className="font-mono-semibold text-body-sm leading-5 text-foreground">{title}</Text>
      </View>
    </View>
  );
}

function SubscriptionPlanBenefitsCarousel({ scrollSignal }: { scrollSignal: number }) {
  const [animateImages, setAnimateImages] = useState(false);
  const sectionRef = useRef<View>(null);
  const hasAnimated = useRef(false);
  const translateX = useRef(new NativeAnimated.Value(0)).current;
  const { height: windowHeight } = useWindowDimensions();
  const marqueeItems = useMemo(() => [...planBenefitCarouselItems, ...planBenefitCarouselItems], []);

  const revealImages = useCallback(() => {
    if (hasAnimated.current) return;
    sectionRef.current?.measureInWindow((_x, y, _width, height) => {
      if (y + height * 0.2 < windowHeight) {
        hasAnimated.current = true;
        setAnimateImages(true);
      }
    });
  }, [windowHeight]);

  useEffect(() => {
    revealImages();
  }, [scrollSignal, revealImages]);

  useEffect(() => {
    if (!animateImages) return;
    translateX.setValue(0);
    const animation = NativeAnimated.loop(
      NativeAnimated.timing(translateX, {
        toValue: -PLAN_BENEFIT_MARQUEE_LOOP_WIDTH,
        duration: PLAN_BENEFIT_MARQUEE_LOOP_WIDTH * 32,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [animateImages, translateX]);

  return (
    <View ref={sectionRef} onLayout={revealImages} className="gap-3">
      <SectionHeading>Included with every plan</SectionHeading>
      <View style={{ marginHorizontal: -20, overflow: 'hidden' }} className="py-2">
        <NativeAnimated.View style={{ flexDirection: 'row', paddingHorizontal: 20, transform: [{ translateX }] }}>
          {marqueeItems.map((item, index) => (
            <View key={`${item.title}-${index}`} style={{ marginRight: PLAN_BENEFIT_CARD_GAP }}>
              <SubscriptionPlanBenefitCarouselCard
                title={item.title}
                image={item.image}
                animate={animateImages}
                index={index % planBenefitCarouselItems.length}
              />
            </View>
          ))}
        </NativeAnimated.View>
      </View>
    </View>
  );
}

function SubscriptionBenefitsSection() {
  return (
    <View className="rounded-field border border-control-border bg-surface p-sheet">
      <FormHeader title="Unlock nutrition tools" subtitle="Personalised nutrition insights become available after you subscribe." size="sheet" />
      <View className="mt-3">
        {toolBenefits.map((item) => (
          <View key={item} className="min-h-9 flex-row items-center gap-3">
            <SheetGlyph icon={LockKeyIcon} size={18} weight="regular" tone="muted" />
            <Text className="flex-1 font-body text-body-sm text-muted">{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SubscriptionPriceBreakupSheet({
  mealChoice,
  selectedPlan,
  pricing,
  onClose,
  onContinue,
}: {
  mealChoice: MealChoice;
  selectedPlan: typeof plans[number];
  pricing: SubscriptionPricing;
  onClose: () => void;
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="absolute inset-0 z-[90]">
      <SheetBackdrop />
      <Pressable accessibilityRole="button" accessibilityLabel="Close price breakdown" className="absolute inset-0" onPress={onClose} />
      <View pointerEvents="box-none" className="absolute inset-0 justify-end">
        <Animated.View
          entering={FadeInUp.duration(220)}
          style={{ marginBottom: Math.max(16, insets.bottom > 0 ? 0 : 16) }}
          className="mx-4 max-h-[85%] overflow-hidden rounded-sheet bg-canvas"
        >
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            <FormModalLayout
              title="Price breakdown"
              fields={(
                <View className="gap-3">
                  {mealChoice !== 'Dinner' && pricing.lunchPlanPrice > 0 ? (
                    <Meta label={mealChoice === 'Both' ? 'Lunch' : 'Lunch subscription'} value={formatRupee(pricing.lunchPlanPrice)} />
                  ) : null}
                  {mealChoice !== 'Lunch' && pricing.dinnerPlanPrice > 0 ? (
                    <Meta label={mealChoice === 'Both' ? 'Dinner' : 'Dinner subscription'} value={formatRupee(pricing.dinnerPlanPrice)} />
                  ) : null}
                  <Meta label="Delivery charges" value="₹0" />
                  <Meta label="Discount" value={`−${formatRupee(pricing.discount)}`} />
                  <Meta label="Trial credit" value={`−${formatRupee(pricing.trialCredit)}`} />
                  <Meta label="Taxes" value={formatRupee(pricing.taxes)} />
                  <View className="h-px bg-border" />
                  <View className="flex-row items-center justify-between gap-4">
                    <Text className="font-body text-body-sm text-muted">Total</Text>
                    <MoneyText amount={pricing.total} className="text-body-md text-foreground" />
                  </View>
                  <Text className="font-body text-body-xs leading-4 text-muted">
                    {selectedPlan.name} · <MoneyInline className="font-body text-body-xs leading-4 text-muted">{`${formatRupee(pricing.perMeal)}/meal after trial credit and savings.`}</MoneyInline>
                  </Text>
                </View>
              )}
              primaryAction={<PrimaryShimmerButton label="Continue to payment" onPress={onContinue} />}
            />
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

function SubscriptionPaymentFooter({ total, onContinue, onViewBreakup }: { total: number; onContinue: () => void; onViewBreakup: () => void }) {
  return (
    <View className="gap-3">
      <PrimaryShimmerButton label={`Continue to payment · ${formatRupee(total)}`} onPress={onContinue} />
      <Pressable accessibilityRole="button" accessibilityLabel="View price breakdown" onPress={onViewBreakup} className="items-center pb-0 pt-1">
        <Text className="font-mono-semibold text-body-sm text-accent">Price breakdown</Text>
      </Pressable>
    </View>
  );
}

export function SubscriptionSheet({
  food: initialFood,
  bread: initialBread,
  rice: initialRice,
  address,
  initialMeal,
  dailyMeals: initialDailyMeals = [],
  lunchDelivery,
  dinnerDelivery,
  sheetTitle = 'Choose your subscription',
  onClose,
  onActivated,
  onExploreMyPlanPress,
}: {
  food: string;
  bread: string;
  rice: string;
  address: string;
  initialMeal: string;
  dailyMeals?: Array<{ lunch: string; dinner: string }>;
  lunchDelivery?: TrialMealDeliveryState | null;
  dinnerDelivery?: TrialMealDeliveryState | null;
  sheetTitle?: string;
  onClose: () => void;
  onActivated: (plan: string, meal: string, total: number, startDate: string) => void;
  onExploreMyPlanPress?: () => void;
  onToast: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const [mealChoice, setMealChoice] = useState<MealChoice>(() => mealChoiceFromInitial(initialMeal));
  const showMealCarousel = mealChoice === 'Both';
  const activeMealSlot: SubscriptionMealSlot = mealChoice === 'Dinner' ? 'dinner' : 'lunch';
  const lunchSelected = mealChoice === 'Lunch' || mealChoice === 'Both';
  const dinnerSelected = mealChoice === 'Dinner' || mealChoice === 'Both';

  const [planId, setPlanId] = useState<PlanId>('monthly');
  const [success, setSuccess] = useState(false);
  const [breakupOpen, setBreakupOpen] = useState(false);
  const [activeMealCard, setActiveMealCard] = useState(0);
  const [openPreferencePicker, setOpenPreferencePicker] = useState<SubscriptionPreferenceKind | null>(null);
  const [preferenceEditSlot, setPreferenceEditSlot] = useState<SubscriptionMealSlot>('lunch');
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor | null>(null);
  const [preferencesScrollSignal, setPreferencesScrollSignal] = useState(0);
  const [addressFlowSlot, setAddressFlowSlot] = useState<SubscriptionMealSlot | null>(null);
  const [lunchConfig, setLunchConfig] = useState<SubscriptionMealConfig>(() =>
    buildInitialMealConfig('lunch', lunchDelivery, address, initialFood, initialBread, initialRice, initialDailyMeals),
  );
  const [dinnerConfig, setDinnerConfig] = useState<SubscriptionMealConfig>(() =>
    buildInitialMealConfig('dinner', dinnerDelivery, address, initialFood, initialBread, initialRice, initialDailyMeals),
  );

  const selectedPlan = plans.find((plan) => plan.id === planId)!;
  const pricing = calculateSubscriptionPricing(selectedPlan, mealChoice);
  const activeConfig = activeMealSlot === 'dinner' ? dinnerConfig : lunchConfig;

  const toggleMealSlot = (slot: SubscriptionMealSlot) => {
    setMealChoice((current) => {
      const lunchOn = current === 'Lunch' || current === 'Both';
      const dinnerOn = current === 'Dinner' || current === 'Both';
      const nextLunch = slot === 'lunch' ? !lunchOn : lunchOn;
      const nextDinner = slot === 'dinner' ? !dinnerOn : dinnerOn;
      // At least one meal has to stay subscribed — ignore a tap that would clear both.
      if (!nextLunch && !nextDinner) return current;
      if (nextLunch && nextDinner) return 'Both';
      return nextLunch ? 'Lunch' : 'Dinner';
    });
    // The carousel remounts scrolled to the first card whenever the slot set changes.
    setActiveMealCard(0);
  };

  const handlePreferencePickerSelect = (value: string) => {
    const apply = (current: SubscriptionMealConfig): SubscriptionMealConfig => ({
      ...current,
      ...(openPreferencePicker === 'food'
        ? { food: value }
        : openPreferencePicker === 'bread'
          ? { bread: value }
          : { rice: value }),
    });
    if (preferenceEditSlot === 'lunch') setLunchConfig(apply);
    else setDinnerConfig(apply);
  };

  const preferencePickerValue = openPreferencePicker === 'food'
    ? (preferenceEditSlot === 'lunch' ? lunchConfig.food : dinnerConfig.food)
    : openPreferencePicker === 'bread'
      ? (preferenceEditSlot === 'lunch' ? lunchConfig.bread : dinnerConfig.bread)
      : openPreferencePicker === 'rice'
        ? (preferenceEditSlot === 'lunch' ? lunchConfig.rice : dinnerConfig.rice)
        : '';

  const openPreferencePickerFor = (slot: SubscriptionMealSlot, kind: SubscriptionPreferenceKind, anchor: PickerAnchor) => {
    setPreferenceEditSlot(slot);
    setOpenPreferencePicker(kind);
    setPickerAnchor(anchor);
  };

  const successAddress = mealChoice === 'Both'
    ? `Lunch · ${lunchConfig.deliveryAddress}\nDinner · ${dinnerConfig.deliveryAddress}`
    : activeConfig.deliveryAddress;

  if (success) {
    return (
      <SubscriptionOverlay onClose={onClose}>
        <Animated.View entering={FadeInUp.duration(240)} style={{ marginBottom: 16 }} className="mx-4 rounded-sheet bg-canvas p-sheet">
          <FormModalLayout
            title="Your subscription is active"
            subtitle="Your meals and nutrition tools are now ready."
            headerAction={<SheetCloseButton onPress={onClose} label="Close subscription active" />}
            fields={(
              <View className="gap-3 rounded-field bg-field p-sheet">
                <Meta compact label="Duration" value={selectedPlan.duration} />
                <Meta compact label="Start date" value="26 July" />
                <Meta compact label="Meal preference" value={mealChoice} />
                <Meta compact label="Delivery address" value={successAddress} />
                <Meta compact label="Next meal" value="26 July · Lunch" />
              </View>
            )}
            primaryAction={<PrimaryShimmerButton label="Explore My Plan" onPress={() => { onClose(); onExploreMyPlanPress?.(); }} />}
          />
        </Animated.View>
      </SubscriptionOverlay>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(180)} className="absolute inset-0 z-50 bg-canvas">
      <View style={{ paddingTop: insets.top + 12 }} className="bg-canvas px-5 pb-1">
        <View className="flex-row items-center gap-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={onClose} hitSlop={8} className="size-6 items-center justify-center">
            <CaretLeftIcon size={24} weight="regular" color={iconColor} />
          </Pressable>
          <Text className="flex-1 font-heading text-heading-md text-foreground">{sheetTitle}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={() => setPreferencesScrollSignal((value) => value + 1)}
        contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}
      >
        <Animated.View entering={FadeInUp.delay(170).duration(280)} style={{ overflow: 'visible' }} className="mx-5 mt-4 gap-sheet-gap">
          <FormPageSection>
            <View className="gap-sheet-gap">
              <SubscriptionMealSlotSelector
                lunchSelected={lunchSelected}
                dinnerSelected={dinnerSelected}
                onToggle={toggleMealSlot}
              />

              {showMealCarousel ? (
                <SubscriptionMealConfigCarousel
                  lunchConfig={lunchConfig}
                  dinnerConfig={dinnerConfig}
                  onChangeLunch={(patch) => setLunchConfig((current) => ({ ...current, ...patch }))}
                  onChangeDinner={(patch) => setDinnerConfig((current) => ({ ...current, ...patch }))}
                  onEditAddress={setAddressFlowSlot}
                  onOpenPicker={openPreferencePickerFor}
                  scrollSignal={preferencesScrollSignal}
                  activeIndex={activeMealCard}
                  onActiveIndexChange={setActiveMealCard}
                />
              ) : (
                <View className="gap-3">
                  <SectionHeading>{mealConfigTitle(mealChoice)}</SectionHeading>
                  <SubscriptionMealConfigCard
                    config={activeConfig}
                    onChange={(patch) => {
                      if (activeMealSlot === 'dinner') setDinnerConfig((current) => ({ ...current, ...patch }));
                      else setLunchConfig((current) => ({ ...current, ...patch }));
                    }}
                    onEditAddress={() => setAddressFlowSlot(activeMealSlot)}
                    onOpenPicker={(kind, anchor) => openPreferencePickerFor(activeMealSlot, kind, anchor)}
                    scrollSignal={preferencesScrollSignal}
                  />
                </View>
              )}

              <View className="gap-3">
                <SectionHeading>Subscription plans</SectionHeading>
                <View className="gap-3">
                  {plans.map((plan) => (
                    <SubscriptionPlanCard
                      key={plan.id}
                      plan={plan}
                      selected={plan.id === planId}
                      pricing={calculateSubscriptionPricing(plan, mealChoice)}
                      onPress={() => setPlanId(plan.id)}
                    />
                  ))}
                </View>
              </View>

              <SubscriptionBenefitsSection />
              <SubscriptionPlanBenefitsCarousel scrollSignal={preferencesScrollSignal} />
            </View>
          </FormPageSection>
        </Animated.View>
      </ScrollView>

      <Animated.View entering={FadeInUp.delay(280).duration(280)} style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(8, insets.bottom) }} className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-2">
        <SubscriptionPaymentFooter
          total={pricing.total}
          onContinue={() => {
            onActivated(selectedPlan.name, mealChoice, pricing.total, '26 July');
            setSuccess(true);
          }}
          onViewBreakup={() => setBreakupOpen(true)}
        />
      </Animated.View>

      {openPreferencePicker && pickerAnchor ? (
        <SubscriptionPreferencePickerModal
          kind={openPreferencePicker}
          value={preferencePickerValue}
          anchor={pickerAnchor}
          onClose={() => {
            setOpenPreferencePicker(null);
            setPickerAnchor(null);
          }}
          onSelect={handlePreferencePickerSelect}
        />
      ) : null}

      {addressFlowSlot ? (
        <DeliveryAddressFlow
          mode="subscription"
          mealSlot={addressFlowSlot}
          initialLocation={addressFlowSlot === 'lunch' ? lunchConfig.deliveryAddress : dinnerConfig.deliveryAddress}
          onClose={() => setAddressFlowSlot(null)}
          onConfirmed={(saved) => {
            const formatted = formatSavedAddressLines(saved);
            const label = addressLabelDisplay(saved);
            const patch = { deliveryAddress: formatted, addressLabel: label, labelType: saved.labelType };
            if (addressFlowSlot === 'lunch') {
              setLunchConfig((current) => ({ ...current, ...patch }));
            } else {
              setDinnerConfig((current) => ({ ...current, ...patch }));
            }
            setAddressFlowSlot(null);
          }}
        />
      ) : null}

      {breakupOpen ? (
        <SubscriptionPriceBreakupSheet
          mealChoice={mealChoice}
          selectedPlan={selectedPlan}
          pricing={pricing}
          onClose={() => setBreakupOpen(false)}
          onContinue={() => {
            setBreakupOpen(false);
            onActivated(selectedPlan.name, mealChoice, pricing.total, '26 July');
            setSuccess(true);
          }}
        />
      ) : null}
    </Animated.View>
  );
}
