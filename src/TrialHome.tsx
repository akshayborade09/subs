import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated as NativeAnimated, Image, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import Animated, { Easing, Extrapolation, FadeIn, FadeInUp, interpolate, interpolateColor, runOnJS, scrollTo, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { type Icon, type IconWeight } from 'phosphor-react-native';
import { BowlSteamIcon } from 'phosphor-react-native/src/icons/BowlSteam';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CreditCardIcon } from 'phosphor-react-native/src/icons/CreditCard';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { LockKeyIcon } from 'phosphor-react-native/src/icons/LockKey';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { PauseIcon } from 'phosphor-react-native/src/icons/Pause';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { ProhibitIcon } from 'phosphor-react-native/src/icons/Prohibit';
import { SlidersHorizontalIcon } from 'phosphor-react-native/src/icons/SlidersHorizontal';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { UserCircleIcon } from 'phosphor-react-native/src/icons/UserCircle';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { themePalette } from './themeColors';
import { Toast } from './toast';
import { SheetBackdrop } from './sheetOverlay';
import { PrimaryShimmerButton, GhostFieldButton, GhostCanvasButton, AccentSecondaryButton } from './primaryButton';
import { hapticPress } from './haptics';
import { useHeroScrollSheetMotion } from './heroScrollSheetMotion';
import {
  FormHeader,
  FormModalLayout,
  FormPageSection,
  SectionHeading,
} from './formLayout';
import { headingDescriptionClass } from './typographyClasses';
import { formatInr, formatRupee } from './formatCurrency';
import { MoneyInline, MoneyText, moneyValueTypography } from './moneyText';
import { foodImages } from './foodImages';
import {
  buildMealDetailActions,
  buildSkipMetadata,
  calculateExtendedSubscriptionEndDate,
  calculateShortenedSubscriptionEndDate,
  canUndoSkip,
  cutoffHelperMessage,
  preferenceCutoffNotice,
  formatDisplayDate,
  getEffectiveFoodPreference,
  getEffectiveMealAddress,
  isFutureMeal,
  isSlotSkipped,
  markerIndexForSlot,
  mealDetailEventForAction,
  mealSlotIndex,
  parseMealDate,
  skipMetadataForSlot,
  slotLabel,
  subscriptionReferenceNow,
  type MealAddressOverride,
  type MealDetailActionId,
  type MealPreferenceValue,
  type MealSlot,
  type SkipMetadata,
  phaseToSheetFlags,
  useMealDetailMachine,
} from './mealDetailState';
import { addressDetailLine, detailsFromSavedAddress, emptyAddressDetails, formatSavedAddressLines, mealOverrideFromSavedAddress, editAddressHeaderTitle, type SavedAddress } from './addressTypes';
import { SavedAddressesSheet } from './deliveryAddressComponents';
import { DeliveryAddressFlow } from './DeliveryAddressFlow';
import { useSavedAddresses } from './savedAddressesStore';
import { SubscriptionPreferencePickerModal, type PickerAnchor } from './subscriptionPreferencePickerModal';
import { subscriptionFoodOptions } from './subscriptionPreferenceOptions';
import { SubscriptionSheet, calculateSubscriptionPricing, plans } from './subscriptionSheet';
import type { TrialMealDeliveryState } from './trialOnboardingSummary';
import { MealPreferenceImage } from './MealPreferenceImage';
import { PlanRestartDateSheet, nextWeekdayDateKey, restartDateFromKey, restartDateLabel, restartDateShortLabel } from './planRestartDateSheet';

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

type GlyphTone = 'foreground' | 'muted' | 'accent' | 'success' | 'canvas' | 'border' | 'white';
function HomeGlyph({ icon: Glyph, size = 20, weight = 'regular', tone = 'foreground' }: { icon: Icon; size?: number; weight?: IconWeight; tone?: GlyphTone }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const palette = themePalette[dark ? 'dark' : 'light'];
  const colors: Record<GlyphTone, string> = { foreground: dark ? '#ffffff' : '#101010', muted: dark ? '#ababab' : '#5e5e5e', accent: palette.accent, success: palette.success, canvas: dark ? '#0e0e0e' : '#ffffff', border: dark ? '#242424' : '#eeeeee', white: '#ffffff' };
  return <Glyph size={Math.max(8, size - 4)} weight={weight === 'fill' ? 'fill' : 'bold'} color={colors[tone]} />;
}

import { backendEnabled, isSignedIn } from './api/client';
import type { AppStateHome } from './api/client';

export type MealStatus = 'delivered' | 'upcoming' | 'paused' | 'inactive' | 'issue' | 'delayed' | 'delivery_failed' | 'skipped';
type MealMarker = {
  foodPreference: string;
  status: MealStatus;
  slot?: MealSlot;
  skipMetadata?: SkipMetadata;
  deliveryAddressOverride?: MealAddressOverride;
};
type Nutrition = { calories: string; protein: string; carbohydrates: string; fat: string; fibre: string; sodium: string };
type MealItem = { name: string; serving: string; calories: string; protein: string };
type TrialMeal = {
  id: string; date: string; dayLabel: string; shortDate: string; mealType: 'Lunch' | 'Dinner'; status: MealStatus;
  foodPreference: string; breadPreference: string; ricePreference: string; addressLabel: string; address: string;
  deliveryNote?: string; items?: MealItem[]; nutrition: Nutrition; rating?: number; feedbackTags?: string[]; feedbackNote?: string; isPlanDay?: boolean; mealMarkers?: MealMarker[];
  mealPreferenceOverride?: MealPreferenceValue;
  deliveryAddressOverride?: MealAddressOverride;
  originalDeliveryDate?: string;
  isSkipped?: boolean;
  skippedAt?: string;
  skipMetadata?: SkipMetadata;
};

export type HomeLifecycleVariant = 'trial_payment_pending' | 'trial_scheduled' | 'trial_active' | 'trial_subscription_purchased' | 'trial_completed' | 'subscription_scheduled' | 'subscription_restarted' | 'subscription_active' | 'subscription_no_meal' | 'subscription_paused' | 'subscription_ending' | 'subscription_expired' | 'subscription_renewal_failed' | 'subscription_delivery_delayed' | 'subscription_delivery_failed' | 'subscription_offline';

const nutrition: Nutrition = { calories: '720 kcal', protein: '28 g', carbohydrates: '92 g', fat: '24 g', fibre: '11 g', sodium: '680 mg' };
const menu: MealItem[] = [
  { name: 'Paneer masala', serving: '180 g', calories: '260 kcal', protein: '13 g' },
  { name: 'Dal tadka', serving: '150 g', calories: '150 kcal', protein: '8 g' },
  { name: 'Bhakri', serving: '2 pieces', calories: '130 kcal', protein: '3 g' },
  { name: 'Jeera rice', serving: '160 g', calories: '150 kcal', protein: '3 g' },
  { name: 'Salad', serving: '80 g', calories: '20 kcal', protein: '1 g' },
  { name: 'Pickle', serving: '15 g', calories: '10 kcal', protein: '0 g' },
];
const nextDayMenu: MealItem[] = [
  { name: 'Mix veg sabzi', serving: '180 g', calories: '180 kcal', protein: '6 g' },
  { name: 'Rajma curry', serving: '160 g', calories: '210 kcal', protein: '11 g' },
  { name: 'Chapati', serving: '3 pieces', calories: '180 kcal', protein: '5 g' },
  { name: 'Plain rice', serving: '150 g', calories: '140 kcal', protein: '3 g' },
  { name: 'Raita', serving: '100 g', calories: '60 kcal', protein: '3 g' },
  { name: 'Papad', serving: '1 piece', calories: '35 kcal', protein: '2 g' },
];

function planMealsFrom(allMeals: TrialMeal[]) {
  return allMeals
    .filter((item) => item.isPlanDay !== false)
    .sort((a, b) => parseMealDate(a.date).getTime() - parseMealDate(b.date).getTime());
}

type MealDetailNavEntry = { mealId: string; slot: MealSlot };

function buildMealDetailNavEntries(meals: TrialMeal[], planBoth: boolean): MealDetailNavEntry[] {
  return planMealsFrom(meals).flatMap((item) => {
    if (planBoth) {
      return [
        { mealId: item.id, slot: 'lunch' as const },
        { mealId: item.id, slot: 'dinner' as const },
      ];
    }
    return [{ mealId: item.id, slot: item.mealType === 'Dinner' ? 'dinner' as const : 'lunch' as const }];
  });
}

function findMealDetailNavIndex(entries: MealDetailNavEntry[], mealId: string, slot: MealSlot) {
  return entries.findIndex((entry) => entry.mealId === mealId && entry.slot === slot);
}

function isMarkerComplete(status: MealStatus | string) {
  return status === 'delivered' || status === 'skipped' || status === 'inactive';
}

function isMealFullyComplete(meal: TrialMeal) {
  if (meal.isPlanDay === false) return true;
  if (meal.isSkipped || meal.status === 'skipped' || meal.status === 'inactive') return true;
  if (meal.mealMarkers?.length) {
    return meal.mealMarkers.every((marker) => isMarkerComplete(marker.status));
  }
  return meal.status === 'delivered';
}

function pendingFocusMeal(meals: TrialMeal[]) {
  const eligible = planMealsFrom(meals);
  return eligible.find((item) => !isMealFullyComplete(item)) ?? eligible[eligible.length - 1]!;
}

function firstFuturePendingMeal(meals: TrialMeal[]) {
  const eligible = planMealsFrom(meals);
  const today = demoStartOfDay().getTime();
  return eligible.find((item) => (
    !isMealFullyComplete(item) && parseMealDate(item.date).getTime() >= today
  )) ?? pendingFocusMeal(meals);
}

function firstUpcomingPlanMeal(meals: TrialMeal[]) {
  const eligible = planMealsFrom(meals);
  return eligible.find((item) => item.status === 'upcoming') ?? eligible[0]!;
}

function firstPendingSlotForMeal(meal: TrialMeal): MealSlot {
  if (meal.mealMarkers?.length) {
    const pendingIndex = meal.mealMarkers.findIndex((marker) => !isMarkerComplete(marker.status));
    if (pendingIndex >= 0) {
      return meal.mealMarkers[pendingIndex]?.slot ?? (pendingIndex === 0 ? 'lunch' : 'dinner');
    }
  }
  return meal.mealType === 'Dinner' ? 'dinner' : 'lunch';
}

function calendarTrackerFocusId(
  meals: TrialMeal[],
  lifecycleVariant: HomeLifecycleVariant,
) {
  if (lifecycleVariant === 'subscription_active') {
    return pendingFocusMeal(meals).id;
  }
  if (lifecycleVariant === 'subscription_restarted') {
    return firstUpcomingPlanMeal(meals).id;
  }
  if (lifecycleVariant === 'subscription_scheduled') {
    return calendarFocusMeal(meals)?.id ?? firstFuturePendingMeal(meals).id;
  }
  if (lifecycleVariant === 'trial_scheduled' || lifecycleVariant === 'trial_payment_pending') {
    return pendingFocusMeal(meals).id;
  }
  if (lifecycleVariant === 'subscription_expired') {
    const eligible = planMealsFrom(meals);
    return eligible[Math.max(0, eligible.length - 2)]?.id ?? eligible[0]!.id;
  }
  return pendingFocusMeal(meals).id;
}

function bottomCardFocusMeal(meals: TrialMeal[], lifecycleVariant: HomeLifecycleVariant) {
  if (lifecycleVariant === 'subscription_active') {
    return pendingFocusMeal(meals);
  }
  if (lifecycleVariant === 'subscription_restarted') {
    return firstUpcomingPlanMeal(meals);
  }
  if (lifecycleVariant === 'subscription_scheduled') {
    return firstFuturePendingMeal(meals);
  }
  if (lifecycleVariant === 'trial_scheduled' || lifecycleVariant === 'trial_payment_pending') {
    return pendingFocusMeal(meals);
  }
  if (lifecycleVariant === 'subscription_expired') {
    const eligible = planMealsFrom(meals);
    return eligible[Math.max(0, eligible.length - 2)] ?? eligible[0]!;
  }
  return pendingFocusMeal(meals);
}

function calendarFocusMeal(meals: TrialMeal[]) {
  const today = demoStartOfDay().getTime();
  return planMealsFrom(meals).find((item) => parseMealDate(item.date).getTime() === today) ?? null;
}

type TiffinMenuKind = 'delivered' | 'next' | 'pending';

function tiffinMenuKind(meal: TrialMeal, allMeals: TrialMeal[]): TiffinMenuKind {
  if (meal.status === 'delivered') return 'delivered';
  const firstUpcoming = planMealsFrom(allMeals).find((item) => item.status !== 'delivered');
  if (firstUpcoming?.id === meal.id) return 'next';
  return 'pending';
}

const SUBSCRIPTION_DAY_COUNT = 20;
const TRACKER_VISIBLE_DAYS = 5;
const TRACKER_OVERFLOW_PEEK = 16;
const TRACKER_EDGE_PADDING = 10;

export const TRIAL_DAY_COUNT = 3;

function trackerScrollOffset(focusIndex: number, totalDays: number, dayWidth: number, center = false) {
  if (totalDays <= TRACKER_VISIBLE_DAYS || focusIndex < 0) return 0;
  const maxOffset = (totalDays - TRACKER_VISIBLE_DAYS) * dayWidth;
  if (center) {
    if (focusIndex < 3) return 0;
    if (focusIndex >= totalDays - 3) return maxOffset;
    return (focusIndex - 2) * dayWidth;
  }
  return Math.min(maxOffset, focusIndex * dayWidth);
}

function demoStartOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function demoAddDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return demoStartOfDay(next);
}

function demoMealDateLabels(date: Date) {
  return {
    date: date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
    dayLabel: date.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase(),
    shortDate: String(date.getDate()),
  };
}

function demoRollingWeekdays(count: number, startOffset: number) {
  const days: Date[] = [];
  let cursor = demoAddDays(demoStartOfDay(), startOffset);
  while (days.length < count) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) days.push(new Date(cursor));
    cursor = demoAddDays(cursor, 1);
  }
  return days;
}

function demoParseMonthDay(label: string, reference = new Date()) {
  const parsed = new Date(`${label.trim()} ${reference.getFullYear()}`);
  return Number.isNaN(parsed.getTime()) ? demoStartOfDay(reference) : demoStartOfDay(parsed);
}

function demoWeekdaysFrom(start: Date, count: number) {
  const days: Date[] = [];
  let cursor = demoStartOfDay(start);
  while (days.length < count) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) days.push(new Date(cursor));
    cursor = demoAddDays(cursor, 1);
  }
  return days;
}

const initialMeals = (food: string, bread: string, rice: string, meal: string, address: string, dailyMeals: Array<{ lunch: string; dinner: string }> = []): TrialMeal[] => {
  const trialDays = demoRollingWeekdays(TRIAL_DAY_COUNT, -2);
  return trialDays.map((day, index) => {
    const labels = demoMealDateLabels(day);
    return {
      id: `trial-${labels.shortDate}`,
      ...labels,
      mealType: meal === 'Dinner' ? 'Dinner' : 'Lunch',
      status: index < 2 ? 'delivered' : 'upcoming',
      foodPreference: dailyMeals[index]?.lunch || food,
      breadPreference: bread,
      ricePreference: rice,
      addressLabel: 'Home',
      address,
      deliveryNote: index === 0 ? 'Leave with security if unavailable.' : undefined,
      items: index < 2 ? menu : undefined,
      nutrition,
    };
  });
};

/**
 * Backend mode: the server's Home payload is the week strip. Statuses map 1:1
 * (the backend catalogue was synced to this file's MealStatus union), so this
 * only reshapes — labels, per-slot markers and plan-day flags come as-is.
 */
const serverHomeMeals = (
  home: AppStateHome,
  bread: string,
  rice: string,
  fallbackAddress: string,
): TrialMeal[] => {
  const foodLabel = (type?: string) => (type === 'non_vegetarian' ? 'Non-vegetarian' : 'Vegetarian');
  return home.week.map((day) => {
    const first = day.markers[0];
    const labels = demoMealDateLabels(new Date(`${day.date}T00:00:00`));
    return {
      id: first?.mealOrderId ?? `day-${day.date}`,
      date: labels.date,
      dayLabel: day.dayLabel,
      shortDate: day.shortDate,
      mealType: first?.slot === 'dinner' ? 'Dinner' : 'Lunch',
      status: (first?.status as MealStatus | undefined) ?? 'inactive',
      foodPreference: foodLabel(first?.foodType),
      breadPreference: bread,
      ricePreference: rice,
      addressLabel: 'Home',
      address: fallbackAddress,
      nutrition,
      isPlanDay: !day.isDisabled,
      items: first?.status === 'delivered' ? menu : undefined,
      mealMarkers:
        day.markers.length > 1
          ? day.markers.map((marker) => ({
              foodPreference: foodLabel(marker.foodType),
              status: marker.status as MealStatus,
              slot: marker.slot,
            }))
          : undefined,
    };
  });
};

const subscriptionWeekMeals = (
  food: string,
  bread: string,
  rice: string,
  meal: string,
  address: string,
  options?: { startDate?: Date; allUpcoming?: boolean },
): TrialMeal[] => {
  const weekdays = options?.startDate
    ? demoWeekdaysFrom(options.startDate, SUBSCRIPTION_DAY_COUNT)
    : demoRollingWeekdays(SUBSCRIPTION_DAY_COUNT, -4);
  return weekdays.map((day, index) => {
    const labels = demoMealDateLabels(day);
    const status = options?.allUpcoming ? 'upcoming' as MealStatus : (index < 2 ? 'delivered' as MealStatus : 'upcoming' as MealStatus);
    return {
      id: `sub-${day.toISOString().slice(0, 10)}`,
      ...labels,
      mealType: meal === 'Dinner' ? 'Dinner' : 'Lunch',
      status,
      foodPreference: food,
      breadPreference: bread,
      ricePreference: rice,
      addressLabel: 'Home',
      address,
      nutrition,
      items: options?.allUpcoming ? undefined : (index < 2 ? menu : undefined),
      isPlanDay: true,
      mealMarkers: meal === 'Both'
        ? [
            { foodPreference: index % 2 === 0 ? 'Vegetarian' : 'Non-vegetarian', status, slot: 'lunch' as const },
            { foodPreference: 'Non-vegetarian', status, slot: 'dinner' as const },
          ]
        : [{ foodPreference: food, status, slot: meal === 'Dinner' ? 'dinner' as const : 'lunch' as const }],
    };
  });
};

function TrialAuthButton({ label, onPress, enabled = true }: { label: string; onPress: () => void; enabled?: boolean }) {
  return <PrimaryShimmerButton label={label} onPress={onPress} enabled={enabled} />;
}

function HomeSecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <GhostFieldButton label={label} onPress={onPress} />;
}

function Primary({ label, onPress, enabled = true }: { label: string; onPress: () => void; enabled?: boolean }) {
  return <TrialAuthButton label={label} onPress={onPress} enabled={enabled} />;
}

function Overlay({ children, onClose, level = 40 }: { children: React.ReactNode; onClose: () => void; level?: number }) {
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0} style={{ zIndex: level }} className="absolute inset-0 justify-end"><SheetBackdrop /><Pressable accessibilityRole="button" accessibilityLabel="Close overlay" className="absolute inset-0" onPress={onClose} />{children}</KeyboardAvoidingView>;
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

function SheetFrame({ children, onClose, title = 'Meal details', subtitle }: { children: React.ReactNode; onClose: () => void; title?: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return <Animated.View entering={FadeInUp.duration(260)} style={{ marginTop: insets.top + 16, marginBottom: 16 }} className="mx-4 max-h-[94%] flex-1 overflow-hidden rounded-[20px] bg-canvas">
    <View className="min-h-16 flex-row items-center px-5 py-3"><View className="flex-1 pr-12"><FormHeader title={title} subtitle={subtitle} size="sheet" /></View><View className="absolute right-3 top-3"><SheetCloseButton onPress={onClose} label={`Close ${title.toLowerCase()}`} /></View></View>
    <Animated.View entering={FadeInUp.delay(110).duration(280)} className="flex-1">{children}</Animated.View>
  </Animated.View>;
}

export type AdaptiveSheetControls = { scrollEnabled: boolean; expand: () => void; setContentHeight: (height: number) => void; onScrollBeginDrag: () => void; onScrollEndDrag: (event: any) => void };

export function AdaptiveSheetFrame({ children, onClose, title, onExpansionChange }: { children: (controls: AdaptiveSheetControls) => React.ReactNode; onClose: () => void; title: string; onExpansionChange?: (expanded: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const safeTop = insets.top > 0 ? insets.top : Platform.OS === 'android' ? 24 : 59;
  const expandedTop = 0;
  const dockedTop = useRef(safeTop + 16);
  const contentHeight = useRef(0);
  const top = useRef(new NativeAnimated.Value(dockedTop.current)).current;
  const side = useRef(new NativeAnimated.Value(16)).current;
  const bottom = useRef(new NativeAnimated.Value(16)).current;
  const radius = useRef(new NativeAnimated.Value(20)).current;
  const headerHeight = useRef(new NativeAnimated.Value(64)).current;
  const headerPaddingTop = useRef(new NativeAnimated.Value(0)).current;
  const expanded = useRef(false);
  const dragging = useRef(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollAtTop = useRef(true);

  useEffect(() => {
    const measuredTop = contentHeight.current > 0 ? Math.max(safeTop + 16, windowHeight - contentHeight.current - 64 - 16) : safeTop + 16;
    dockedTop.current = measuredTop;
    if (!expanded.current) top.setValue(measuredTop);
  }, [safeTop, top, windowHeight]);
  const snapTo = (nextExpanded: boolean) => {
    expanded.current = nextExpanded;
    setIsExpanded(nextExpanded);
    onExpansionChange?.(nextExpanded);
    const spring = (value: NativeAnimated.Value, toValue: number) => NativeAnimated.spring(value, { toValue, damping: 28, stiffness: 240, mass: 0.9, overshootClamping: true, useNativeDriver: false });
    NativeAnimated.parallel([
      spring(top, nextExpanded ? expandedTop : dockedTop.current),
      spring(side, nextExpanded ? 0 : 16),
      spring(bottom, nextExpanded ? 0 : 16),
      spring(radius, nextExpanded ? 0 : 20),
      spring(headerHeight, nextExpanded ? 64 + safeTop : 64),
      spring(headerPaddingTop, nextExpanded ? safeTop : 0),
    ]).start();
  };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => (!expanded.current || (scrollAtTop.current && gesture.dy > 0)) && Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMoveShouldSetPanResponder: (_, gesture) => (!expanded.current || (scrollAtTop.current && gesture.dy > 0)) && Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => { dragging.current = true; },
    onPanResponderMove: (_, gesture) => {
      const base = expanded.current ? expandedTop : dockedTop.current;
      const nextTop = Math.max(expandedTop, Math.min(dockedTop.current + 80, base + gesture.dy));
      const progress = dockedTop.current > 0 ? Math.max(0, Math.min(1, 1 - nextTop / dockedTop.current)) : 1;
      top.setValue(nextTop);
      side.setValue(16 * (1 - progress));
      bottom.setValue(16 * (1 - progress));
      radius.setValue(20 * (1 - progress));
      headerHeight.setValue(64 + safeTop * progress);
      headerPaddingTop.setValue(safeTop * progress);
    },
    onPanResponderRelease: (_, gesture) => {
      dragging.current = false;
      if (gesture.dy > 120 || gesture.vy > 1.25) { if (expanded.current) snapTo(false); else onClose(); }
      else if (gesture.dy < -48 || gesture.vy < -0.65) snapTo(true);
      else snapTo(expanded.current);
    },
    onPanResponderTerminate: () => { dragging.current = false; snapTo(expanded.current); },
  })).current;
  const controls: AdaptiveSheetControls = {
    scrollEnabled: isExpanded,
    expand: () => snapTo(true),
    setContentHeight: (height) => {
      contentHeight.current = height;
      if (dragging.current) return;
      const measuredTop = Math.max(safeTop + 16, windowHeight - height - 64 - 16);
      dockedTop.current = measuredTop;
      if (!expanded.current) top.setValue(measuredTop);
    },
    onScrollBeginDrag: () => {},
    onScrollEndDrag: (event) => {
      const y = event.nativeEvent.contentOffset?.y ?? 0;
      scrollAtTop.current = y <= 1;
      if (!expanded.current && y > 4) snapTo(true);
      if (!expanded.current && y <= 0 && (event.nativeEvent.velocity?.y ?? 0) < -0.35) onClose();
      if (expanded.current && y <= 1 && (event.nativeEvent.velocity?.y ?? 0) < -0.35) snapTo(false);
    },
  };
  return <NativeAnimated.View {...pan.panHandlers} style={{ position: 'absolute', left: side, right: side, top, bottom, overflow: 'hidden', borderRadius: radius }} className="bg-canvas">
    <NativeAnimated.View style={{ height: headerHeight, paddingTop: headerPaddingTop }} className="flex-row items-center px-5"><View className="flex-1 pr-12"><FormHeader title={title} size="sheet" /></View><View className="absolute bottom-3 right-3"><SheetCloseButton onPress={onClose} label={`Close ${title.toLowerCase()}`} /></View></NativeAnimated.View>
    <View className="flex-1">{children(controls)}</View>
  </NativeAnimated.View>;
}

function StatusBadge({ status }: { status: MealStatus }) {
  const config: Record<MealStatus, { label: string; bg: string; textClass: string }> = {
    delivered: { label: 'Delivered', bg: 'bg-success', textClass: 'text-white' },
    upcoming: { label: 'Upcoming', bg: 'bg-accent', textClass: 'text-white' },
    delayed: { label: 'Delayed', bg: 'bg-[#f59e0b]', textClass: 'text-white' },
    delivery_failed: { label: 'Not delivered', bg: 'bg-destructive', textClass: 'text-white' },
    issue: { label: 'Issue', bg: 'bg-destructive', textClass: 'text-white' },
    paused: { label: 'Paused', bg: 'bg-surface-raised', textClass: 'text-muted' },
    inactive: { label: 'Inactive', bg: 'bg-secondary', textClass: 'text-secondary-foreground' },
    skipped: { label: 'Skipped', bg: 'bg-surface-raised', textClass: 'text-muted' },
  };
  const { label, bg, textClass } = config[status];
  return (
    <View className={`rounded-full px-3 py-1.5 ${bg}`}>
      <Text className={`font-body-medium text-body-xs ${textClass}`}>{label}</Text>
    </View>
  );
}

function SkippedStatusGroup({ onUndo }: { onUndo?: () => void }) {
  return (
    <View className="shrink-0 flex-row items-center gap-3">
      <View className="rounded-full bg-surface-raised px-3 py-1.5">
        <Text className="font-body-medium text-body-xs text-muted">Skipped</Text>
      </View>
      {onUndo ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Undo skip" onPress={onUndo} hitSlop={8} className="rounded-full bg-accent-soft px-3 py-1.5">
          <Text className="font-mono-semibold text-body-sm text-accent">Undo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function UpcomingRipple({ color = 'green' }: { color?: 'green' | 'red' | 'orange' }) {
  const scale = useRef(new NativeAnimated.Value(0.8)).current;
  const opacity = useRef(new NativeAnimated.Value(0.55)).current;
  useEffect(() => { const animation = NativeAnimated.loop(NativeAnimated.parallel([NativeAnimated.timing(scale, { toValue: 1.65, duration: 1400, useNativeDriver: true }), NativeAnimated.timing(opacity, { toValue: 0, duration: 1400, useNativeDriver: true })])); animation.start(); return () => animation.stop(); }, [opacity, scale]);
  const borderColor = color === 'red' ? '#dc2626' : color === 'orange' ? '#f59e0b' : '#078a4b';
  return <NativeAnimated.View pointerEvents="none" style={{ opacity, transform: [{ scale }], borderColor, backgroundColor: 'transparent' }} className="absolute h-7 w-7 rounded-full border-2" />;
}

const MARKER_STATUS_SIZE = 20;

function FoodMarkerIcon({ color, size = MARKER_STATUS_SIZE }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 19.5V22.5H6V19.5H18ZM19.5 18V6C19.5 5.17157 18.8284 4.5 18 4.5H6C5.17157 4.5 4.5 5.17157 4.5 6V18C4.5 18.8284 5.17157 19.5 6 19.5V22.5C3.59234 22.5 1.62632 20.6092 1.50586 18.2314L1.5 18V6C1.5 3.51472 3.51472 1.5 6 1.5H18L18.2314 1.50586C20.6092 1.62632 22.5 3.59234 22.5 6V18L22.4941 18.2314C22.3776 20.5325 20.5325 22.3776 18.2314 22.4941L18 22.5V19.5C18.8284 19.5 19.5 18.8284 19.5 18Z"
        fill={color}
      />
      <Circle cx="12" cy="12" r="4.5" fill={color} />
    </Svg>
  );
}

function MealStatusMarker({
  meal,
  marker,
  markerIndex,
  excluded,
  animateUpcoming,
  assignUpcomingRipple,
  onOpenMeal,
}: {
  meal: TrialMeal;
  marker: MealMarker;
  markerIndex: number;
  excluded: boolean;
  animateUpcoming: boolean;
  assignUpcomingRipple: () => boolean;
  onOpenMeal: (meal: TrialMeal, slot: MealSlot) => void;
}) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const skippedSurface = themePalette[dark ? 'dark' : 'light'].skippedSurface;
  const skippedBorder = themePalette[dark ? 'dark' : 'light'].skippedBorder;
  const mutedIcon = theme === 'dark' ? '#ababab' : '#5e5e5e';
  const slot: MealSlot = marker.slot ?? (markerIndex === 0 ? 'lunch' : 'dinner');
  const nonVeg = marker.foodPreference.toLowerCase().includes('non-veg') || marker.foodPreference.toLowerCase() === 'non-vegetarian';
  const delayed = marker.status === 'delayed';
  const failed = marker.status === 'delivery_failed' || marker.status === 'issue';
  const skipped = marker.status === 'skipped';
  const paused = marker.status === 'paused';
  const delivered = marker.status === 'delivered';
  const inactive = marker.status === 'inactive' || excluded;
  const upcoming = marker.status === 'upcoming' || delayed;
  const showRipple = animateUpcoming && !excluded && !skipped && !paused && upcoming && assignUpcomingRipple();
  const borderColor = skipped
    ? skippedBorder
    : inactive || paused
      ? '#d8d8d8'
      : failed
        ? '#dc2626'
        : delayed
          ? '#f59e0b'
          : nonVeg
            ? '#dc2626'
            : '#078a4b';
  const fillColor = skipped ? skippedSurface : delivered || failed ? borderColor : 'transparent';
  const rippleColor = delayed ? 'orange' as const : nonVeg ? 'red' as const : 'green' as const;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${slot === 'lunch' ? 'Lunch' : 'Dinner'}, ${marker.foodPreference}, ${marker.status}`}
      disabled={excluded}
      onPress={() => onOpenMeal(meal, slot)}
      className={`h-9 w-11 items-center justify-center rounded-field border bg-canvas ${excluded ? 'border-transparent opacity-45' : 'border-border'}`}
    >
      {showRipple ? <UpcomingRipple color={rippleColor} /> : null}
      {delivered && !excluded ? (
        <View style={{ borderColor, backgroundColor: borderColor }} className="h-5 w-5 items-center justify-center rounded-full border-[3px]">
          <HomeGlyph icon={CheckIcon} size={16} weight="bold" tone="white" />
        </View>
      ) : failed && !excluded ? (
        <View style={{ borderColor, backgroundColor: borderColor }} className="h-5 w-5 items-center justify-center rounded-full border-[3px]">
          <HomeGlyph icon={XIcon} size={15} weight="bold" tone="white" />
        </View>
      ) : skipped && !excluded ? (
        <View style={{ borderColor: skippedBorder, backgroundColor: skippedSurface }} className="h-5 w-5 rounded-full border-[3px]" />
      ) : paused && !excluded ? (
        <PauseIcon size={14} weight="fill" color={mutedIcon} />
      ) : upcoming && !excluded ? (
        <FoodMarkerIcon color={borderColor} size={MARKER_STATUS_SIZE} />
      ) : (
        <View style={{ borderColor, backgroundColor: fillColor }} className="h-5 w-5 rounded-full border-[3px]" />
      )}
    </Pressable>
  );
}

function TrialDayTracker({ meals, selectedId, showBoth, centerFocus = false, animateUpcoming = true, onSelectDate, onOpenMeal }: { meals: TrialMeal[]; selectedId: string; showBoth: boolean; centerFocus?: boolean; animateUpcoming?: boolean; onSelectDate: (meal: TrialMeal) => void; onOpenMeal: (meal: TrialMeal, slot: MealSlot) => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const scrollable = meals.length > TRACKER_VISIBLE_DAYS;
  const dayWidth = (screenWidth - TRACKER_OVERFLOW_PEEK) / TRACKER_VISIBLE_DAYS;
  const scrollRef = useRef<ScrollView>(null);
  const focusIndex = selectedId ? meals.findIndex((meal) => meal.id === selectedId) : -1;
  const scrollOffset = trackerScrollOffset(focusIndex, meals.length, dayWidth, centerFocus);
  let upcomingRippleAssigned = false;
  const assignUpcomingRipple = () => {
    if (upcomingRippleAssigned) return false;
    upcomingRippleAssigned = true;
    return true;
  };

  useEffect(() => {
    if (!scrollable) return;
    scrollRef.current?.scrollTo({ x: scrollOffset, animated: true });
  }, [scrollOffset, scrollable, selectedId]);

  const dayColumns = meals.map((meal) => {
    const excluded = meal.isPlanDay === false;
    const selected = meal.id === selectedId;
    const markers = meal.mealMarkers?.slice(0, showBoth ? 2 : 1)
      ?? Array.from({ length: showBoth ? 2 : 1 }, (_, markerIndex) => ({
        foodPreference: meal.foodPreference,
        status: meal.status,
        slot: (markerIndex === 0 ? 'lunch' : 'dinner') as MealSlot,
      }));

    return (
      <View key={meal.id} style={scrollable ? { width: dayWidth } : undefined} className={`items-center ${scrollable ? '' : 'flex-1'}`}>
        <Pressable
          disabled={excluded}
          accessibilityRole="button"
          accessibilityLabel={excluded ? `${meal.date}, no meal selected` : `Select ${meal.date}`}
          accessibilityState={{ selected, disabled: excluded }}
          onPress={hapticPress(() => onSelectDate(meal), 'selection')}
          className={`h-14 w-full max-w-[46px] items-center justify-center rounded-field border ${selected ? 'border-foreground bg-canvas' : excluded ? 'border-transparent bg-field opacity-45' : 'border-border bg-field'}`}
        >
          <Text className="font-mono-semibold text-body-md text-foreground">{meal.shortDate}</Text>
          <Text className="mt-0.5 font-body text-body-xs text-muted">{meal.dayLabel}</Text>
        </Pressable>
        <View className="mt-2 items-center gap-1">
          {markers.map((marker, markerIndex) => (
            <MealStatusMarker
              key={`${meal.id}-${markerIndex}`}
              meal={meal}
              marker={marker}
              markerIndex={markerIndex}
              excluded={excluded}
              animateUpcoming={animateUpcoming}
              assignUpcomingRipple={assignUpcomingRipple}
              onOpenMeal={onOpenMeal}
            />
          ))}
        </View>
      </View>
    );
  });

  if (!scrollable) {
    return (
      <View style={{ marginHorizontal: -20, paddingHorizontal: TRACKER_EDGE_PADDING }} className="flex-row">
        {dayColumns}
      </View>
    );
  }

  return (
    <View style={{ marginHorizontal: -20, overflow: 'visible' }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled
        style={{ overflow: 'visible' }}
        contentContainerStyle={{ paddingLeft: TRACKER_EDGE_PADDING, paddingRight: TRACKER_EDGE_PADDING }}
      >
        {dayColumns}
      </ScrollView>
    </View>
  );
}

function selectionClass(selected: boolean) {
  return `rounded-field border bg-canvas ${selected ? 'border-2 border-accent bg-accent-soft' : 'border-border'}`;
}

function MealDetailOverviewList({
  meal,
  allMeals,
  foodPreference,
  mealType,
  actions,
  onAction,
  showTiffin,
}: {
  meal: TrialMeal;
  allMeals: TrialMeal[];
  foodPreference: string;
  mealType: string;
  actions: ReturnType<typeof buildMealDetailActions>;
  onAction: (action: MealDetailActionId, anchor?: PickerAnchor) => void;
  showTiffin: boolean;
}) {
  type OverviewRow =
    | { key: string; kind: 'action'; action: ReturnType<typeof buildMealDetailActions>[number] }
    | { key: string; kind: 'info'; title: string; subtitle: string; icon: Icon };

  const skipAction = actions.find((action) => action.id === 'skipMeal');
  const primaryActions = actions.filter((action) => action.id !== 'skipMeal');
  const preferenceActionRef = useRef<View>(null);

  const rows: OverviewRow[] = primaryActions.map((action) => ({ key: action.id, kind: 'action', action }));
  if (showTiffin) {
    rows.push({
      key: 'tiffin',
      kind: 'info',
      title: mealDetailTiffinTitle(meal, allMeals),
      subtitle: mealDetailTiffinSubtitle(meal, allMeals),
      icon: BowlSteamIcon,
    });
  }
  rows.push({
    key: 'preferences',
    kind: 'info',
    title: 'Selected preferences',
    subtitle: mealDetailPreferencesSubtitle(meal, foodPreference, mealType),
    icon: SlidersHorizontalIcon,
  });
  if (skipAction) {
    rows.push({ key: skipAction.id, kind: 'action', action: skipAction });
  }

  if (rows.length === 0) return null;

  return (
    <View>
      {rows.map((row, index) => {
        const showDivider = index < rows.length - 1;
        const isFirst = index === 0;
        const isLast = index === rows.length - 1;
        if (row.kind === 'action') {
          const openAction = () => {
            if (row.action.id === 'changeMealPreference' && preferenceActionRef.current) {
              preferenceActionRef.current.measureInWindow((x, y, width, height) => {
                onAction(row.action.id, { x, y, width, height });
              });
              return;
            }
            onAction(row.action.id);
          };
          const rowContent = (
            <MealDetailActionRow
              title={row.action.title}
              subtitle={row.action.subtitle}
              icon={mealDetailActionIcons[row.action.id]}
              onPress={hapticPress(openAction, 'light')}
              showDivider={showDivider}
              isFirst={isFirst}
              isLast={isLast}
              tone={row.action.id === 'skipMeal' ? 'destructive' : 'default'}
            />
          );
          if (row.action.id === 'changeMealPreference') {
            return (
              <View key={row.key} ref={preferenceActionRef} collapsable={false}>
                {rowContent}
              </View>
            );
          }
          return <View key={row.key}>{rowContent}</View>;
        }
        return (
          <MealDetailInfoRow
            key={row.key}
            title={row.title}
            subtitle={row.subtitle}
            icon={row.icon}
            showDivider={showDivider}
            isFirst={isFirst}
            isLast={isLast}
          />
        );
      })}
    </View>
  );
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

function NutritionSection({ meal }: { meal: TrialMeal }) {
  return <View><SectionHeading>Nutrition summary</SectionHeading><View className="mt-3 gap-2"><Meta label="Calories" value={meal.nutrition.calories} /><Meta label="Protein" value={meal.nutrition.protein} /><Meta label="Carbohydrates" value={meal.nutrition.carbohydrates} /><Meta label="Fat" value={meal.nutrition.fat} /><Meta label="Fibre" value={meal.nutrition.fibre} /><Meta label="Sodium" value={meal.nutrition.sodium} /></View><Text className="mt-3 font-body text-body-xs leading-5 text-muted">Nutritional values are approximate and may vary based on portion size, ingredients and preparation method.</Text></View>;
}

function FloatingNav({ active, onChange }: { active: 'home' | 'profile'; onChange: (tab: 'home' | 'profile') => void }) {
  const noShadow = { elevation: 0, shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } } as const;
  const tabs = [{ id: 'home' as const, icon: HouseIcon, label: 'Home' }, { id: 'profile' as const, icon: UserCircleIcon, label: 'Profile' }];
  const content = <View className={`flex-1 flex-row p-1.5 ${Platform.OS === 'android' ? 'bg-surface-raised/40' : 'bg-surface-raised/55'}`}>{tabs.map(({ id, icon, label }) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: active === id }} accessibilityLabel={label} onPress={hapticPress(() => onChange(id), 'selection')} className={`flex-1 flex-row items-center justify-center gap-2 rounded-full ${active === id ? 'bg-foreground' : ''}`}><HomeGlyph icon={icon} size={20} weight={active === id ? 'fill' : 'regular'} tone={active === id ? 'canvas' : 'foreground'} /><Text className={`font-mono-semibold text-body-sm ${active === id ? 'text-canvas' : 'text-foreground'}`}>{label}</Text></Pressable>)}</View>;
  return <View pointerEvents="box-none" style={{ bottom: 20 }} className="absolute inset-x-0 z-30 items-center"><View style={noShadow} className="h-16 w-[220px] overflow-hidden rounded-full">{isLiquidGlassAvailable() ? <GlassView glassEffectStyle="regular" isInteractive style={[StyleSheet.absoluteFill, noShadow]}>{content}</GlassView> : <View style={noShadow} className="flex-1"><BlurView intensity={Platform.OS === 'android' ? 8 : 55} tint="default" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'} style={[StyleSheet.absoluteFill, noShadow]} /><View className={`absolute inset-0 ${Platform.OS === 'android' ? 'bg-surface-raised/15' : 'bg-surface-raised/20'}`} />{content}</View>}</View></View>;
}

const feedbackOptions = ['Tasty', 'Good quantity', 'Fresh', 'Well packed', 'Too spicy', 'Less quantity', 'Packaging issue', 'Arrived cold'];

function feedbackThanksCopy(stars: number) {
  if (stars >= 4) {
    return {
      title: 'Thank you for the love!',
      body: 'We’re so glad this meal hit the spot. Your kind words keep our kitchen going — we’ll keep serving you food you can look forward to.',
    };
  }
  return {
    title: 'Thanks for sharing',
    body: 'We’re sorry this meal didn’t meet expectations. Your feedback goes straight to our team and helps us cook better for you with every tiffin.',
  };
}

function Feedback({ meal, onSave, onFocusTellMore }: { meal: TrialMeal; onSave: (rating: number, tags: string[], note: string) => void; onFocusTellMore: () => void }) {
  const [rating, setRating] = useState(meal.rating ?? 0);
  const [tags, setTags] = useState(meal.feedbackTags ?? []);
  const [note, setNote] = useState(meal.feedbackNote ?? '');
  const [editing, setEditing] = useState(!meal.rating);
  const submittedRating = meal.rating ?? rating;
  const thanks = feedbackThanksCopy(submittedRating);

  if (!editing && submittedRating > 0) {
    return (
      <View className="rounded-field bg-accent-soft p-sheet">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="min-w-0 flex-1 font-mono-semibold text-body-md text-foreground">{thanks.title}</Text>
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} className="shrink-0">
            <Text className="font-mono-semibold text-body-sm text-accent">Edit feedback</Text>
          </Pressable>
        </View>
        <Text className={`mt-3 ${headingDescriptionClass}`}>{thanks.body}</Text>
      </View>
    );
  }

  return (
    <View>
      <SectionHeading>How was your meal?</SectionHeading>
      <View className="mt-3 flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            accessibilityRole="radio"
            accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
            accessibilityState={{ checked: rating === star }}
            onPress={hapticPress(() => setRating(star), 'selection')}
            className="size-11 items-center justify-center"
          >
            <HomeGlyph icon={StarIcon} size={30} weight={star <= rating ? 'fill' : 'regular'} tone={star <= rating ? 'accent' : 'muted'} />
          </Pressable>
        ))}
      </View>
      {rating === 0 ? <Text className="mt-2 font-body text-body-xs text-muted">Select a star rating to submit feedback.</Text> : null}
      <View className="mt-3 flex-row flex-wrap gap-2">
        {feedbackOptions.map((tag) => {
          const active = tags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={hapticPress(() => setTags(active ? tags.filter((item) => item !== tag) : [...tags, tag]), 'selection')}
              className={`min-h-11 justify-center rounded-field border px-3 ${active ? 'border-2 border-accent bg-accent-soft' : 'border-border bg-canvas'}`}
            >
              <Text className={`font-mono-semibold text-body-xs ${active ? 'text-foreground' : 'text-muted'}`}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        onFocus={onFocusTellMore}
        multiline
        placeholder="Optional feedback"
        placeholderTextColor="#8b8a84"
        className="mt-4 min-h-[92px] rounded-field border border-border bg-field p-sheet font-body-medium text-body-md text-foreground"
      />
      <View className="mt-4">
        <Primary
          label="Submit feedback"
          enabled={rating > 0}
          onPress={() => {
            onSave(rating, tags, note);
            setEditing(false);
          }}
        />
      </View>
    </View>
  );
}

const issueCategories = ['Meal missing', 'Wrong meal', 'Bread preference not followed', 'Rice preference not followed', 'Food quality issue', 'Packaging issue', 'Delivery issue', 'Other'];
function IssueSheet({ mealDate, onClose, onSubmit }: { mealDate: string; onClose: () => void; onSubmit: () => void }) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState(issueCategories[0]!);
  const [description, setDescription] = useState('');

  return (
    <Animated.View entering={FadeIn.duration(180)} className="absolute inset-0 z-[70] bg-canvas">
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-start justify-between px-5 pb-3">
        <View className="flex-1 pr-3">
          <FormHeader title="Report an issue" subtitle={`For ${mealDate}`} size="sheet" />
        </View>
        <SheetCloseButton onPress={onClose} label="Close report issue" />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>
        <Text className="font-body text-body-sm leading-5 text-muted">Choose the problem that best describes this meal.</Text>
        <View className="mt-4 gap-sheet-gap">
          <View className="flex-row flex-wrap gap-2">
            {issueCategories.map((item) => (
              <Pressable
                key={item}
                onPress={hapticPress(() => setCategory(item), 'selection')}
                className={`min-h-11 justify-center rounded-field border px-3 ${category === item ? 'border-2 border-accent bg-accent-soft' : 'border-border bg-canvas'}`}
              >
                <Text className={`font-mono-semibold text-body-xs ${category === item ? 'text-foreground' : 'text-muted'}`}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            placeholder="Optional description"
            placeholderTextColor="#8b8a84"
            className="min-h-[100px] rounded-field border border-border bg-field px-sheet py-sheet font-body-medium text-body-md leading-6 text-foreground"
          />
          <Pressable accessibilityRole="button" className="h-24 items-center justify-center rounded-field border border-border bg-canvas">
            <View className="flex-row items-center gap-2">
              <HomeGlyph icon={PlusIcon} size={18} weight="bold" tone="muted" />
              <Text className="font-mono-semibold text-body-sm text-muted">Add photo</Text>
            </View>
            <Text className="mt-1 font-body text-body-xs text-muted">Local placeholder</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={{ paddingBottom: Math.max(16, insets.bottom + 8) }} className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-3">
        <Primary label="Submit issue" onPress={onSubmit} />
      </View>
    </Animated.View>
  );
}

function PauseSheet({ meal, onClose, onConfirm }: { meal: TrialMeal; onClose: () => void; onConfirm: () => void }) {
  return <Overlay onClose={onClose} level={60}><Animated.View entering={FadeInUp.duration(220)} className="mx-4 mb-4 rounded-sheet bg-canvas p-sheet"><FormModalLayout title="Pause this meal?" subtitle={`${meal.date} · ${meal.mealType}. You can reactivate it later during this preview.`} primaryAction={<Primary label="Confirm pause" onPress={onConfirm} />} secondaryAction={<GhostCanvasButton label="Keep meal active" onPress={onClose} />} /></Animated.View></Overlay>;
}

function mealDetailPreferencesSubtitle(meal: TrialMeal, foodPreference: string, mealType: string) {
  return `${foodPreference} · ${mealType} · ${meal.breadPreference} · ${meal.ricePreference}`;
}

function mealDetailTiffinSubtitle(meal: TrialMeal, allMeals: TrialMeal[]) {
  const kind = tiffinMenuKind(meal, allMeals);
  if (kind === 'pending') return 'Yet to be decided';
  const items = kind === 'delivered' ? (meal.items ?? menu) : (meal.items ?? nextDayMenu);
  return items.map((item) => item.name).join(', ');
}

function mealDetailTiffinTitle(meal: TrialMeal, allMeals: TrialMeal[]) {
  return tiffinMenuKind(meal, allMeals) === 'delivered' ? 'Today’s tiffin' : 'Tiffin menu';
}

function mealDetailRowPaddingClass(isFirst: boolean, isLast: boolean) {
  if (isFirst && isLast) return '';
  if (isFirst) return 'pb-4';
  if (isLast) return 'pt-4';
  return 'py-4';
}

function MealDetailRowShell({
  title,
  subtitle,
  icon: RowIcon,
  showDivider = true,
  isFirst = false,
  isLast = false,
  tone = 'default',
  onPress,
  trailing,
}: {
  title: string;
  subtitle?: string;
  icon: Icon;
  showDivider?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  tone?: 'default' | 'destructive';
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const { theme } = useUniwind();
  const destructiveColor = theme === 'dark' ? '#f87171' : '#dc2626';
  const iconColor = tone === 'destructive' ? destructiveColor : theme === 'dark' ? '#ffffff' : '#101010';
  const titleClass = tone === 'destructive' ? 'font-body-medium text-body-md leading-6 text-destructive' : 'font-body-medium text-body-md leading-6 text-foreground';
  const rowClass = `${mealDetailRowPaddingClass(isFirst, isLast)} ${showDivider ? 'border-b border-border' : ''}`.trim();
  const content = (
    <View className="flex-row items-start gap-3">
      <View className="h-6 w-6 shrink-0 items-center justify-center">
        <RowIcon size={20} weight="regular" color={iconColor} />
      </View>
      <View className="min-w-0 flex-1 flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className={titleClass}>{title}</Text>
          {subtitle ? <Text className="mt-1 font-body text-body-sm leading-5 text-muted">{subtitle}</Text> : null}
        </View>
        {trailing ? <View className="h-6 shrink-0 items-center justify-center">{trailing}</View> : null}
      </View>
    </View>
  );
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} className={rowClass}>
        {content}
      </Pressable>
    );
  }
  return <View className={rowClass}>{content}</View>;
}

function MealDetailActionRow({ title, subtitle, icon, onPress, showDivider = true, isFirst = false, isLast = false, tone = 'default' }: { title: string; subtitle?: string; icon: Icon; onPress: () => void; showDivider?: boolean; isFirst?: boolean; isLast?: boolean; tone?: 'default' | 'destructive' }) {
  const { theme } = useUniwind();
  const chevronColor = theme === 'dark' ? '#ababab' : '#5e5e5e';
  return (
    <MealDetailRowShell
      title={title}
      subtitle={subtitle}
      icon={icon}
      showDivider={showDivider}
      isFirst={isFirst}
      isLast={isLast}
      tone={tone}
      onPress={onPress}
      trailing={<CaretRightIcon size={16} weight="bold" color={chevronColor} />}
    />
  );
}

function MealDetailInfoRow({ title, subtitle, icon, showDivider = true, isFirst = false, isLast = false }: { title: string; subtitle?: string; icon: Icon; showDivider?: boolean; isFirst?: boolean; isLast?: boolean }) {
  return <MealDetailRowShell title={title} subtitle={subtitle} icon={icon} showDivider={showDivider} isFirst={isFirst} isLast={isLast} />;
}

const mealDetailActionIcons: Record<MealDetailActionId, Icon> = {
  changeAddress: MapPinIcon,
  changeMealPreference: PencilSimpleIcon,
  skipMeal: ProhibitIcon,
  reportIssue: WarningCircleIcon,
};

const upcomingMealActionIds: MealDetailActionId[] = ['changeAddress', 'changeMealPreference', 'skipMeal'];

function MealDetailActionList({ actions, onAction, className = 'mt-6' }: { actions: ReturnType<typeof buildMealDetailActions>; onAction: (action: MealDetailActionId) => void; className?: string }) {
  if (actions.length === 0) return null;
  return (
    <View className={className}>
      {actions.map((action, index) => (
        <MealDetailActionRow
          key={action.id}
          title={action.title}
          subtitle={action.subtitle}
          icon={mealDetailActionIcons[action.id]}
          onPress={hapticPress(() => onAction(action.id), 'light')}
          showDivider={index < actions.length - 1}
          isFirst={index === 0}
          isLast={index === actions.length - 1}
        />
      ))}
    </View>
  );
}

function SkipMealSheet({ mealDate, newEndDate, mealSlot, onClose, onConfirm }: { mealDate: string; newEndDate: Date; mealSlot: MealSlot; onClose: () => void; onConfirm: () => void }) {
  const skipLabel = slotLabel(mealSlot).toLowerCase();
  return (
    <Overlay onClose={onClose} level={60}>
      <Animated.View entering={FadeInUp.duration(220)} className="mx-4 mb-4 rounded-sheet bg-canvas p-sheet">
        <FormModalLayout
          title={`Skip tomorrow's ${skipLabel}?`}
          subtitle="You won't lose this meal. One additional meal day will be added to your subscription."
          fields={(
            <View className="rounded-field bg-field p-sheet">
              <Text className="font-body text-body-sm text-muted">New subscription end date</Text>
              <Text className="mt-2 font-mono-semibold text-body-md text-foreground">{formatDisplayDate(newEndDate)}</Text>
              <Text className="mt-2 font-body text-body-xs leading-5 text-muted">{mealDate} · {slotLabel(mealSlot)}</Text>
            </View>
          )}
          primaryAction={<Primary label="Confirm skip" onPress={onConfirm} />}
          secondaryAction={<GhostFieldButton label="Keep meal" onPress={onClose} />}
        />
      </Animated.View>
    </Overlay>
  );
}

function MealDetailSheet({
  meal,
  allMeals,
  isSubscriptionMeal,
  planBoth,
  mealSlot,
  subscriptionEndDate,
  onClose,
  onNavigate,
  onUpdate,
  onSkipMeal,
  onUndoSkip,
  onToast,
}: {
  meal: TrialMeal;
  allMeals: TrialMeal[];
  isSubscriptionMeal: boolean;
  planBoth: boolean;
  mealSlot: MealSlot;
  subscriptionEndDate: Date;
  onClose: () => void;
  onNavigate: (mealId: string, slot: MealSlot) => void;
  onUpdate: (meal: TrialMeal) => void;
  onSkipMeal: (mealId: string, slot: MealSlot, newEndDate: Date, metadata: SkipMetadata) => void;
  onUndoSkip: (mealId: string, slot: MealSlot, restoredEndDate: Date) => void;
  onToast: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: windowHeight } = useWindowDimensions();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const effectiveFoodPreference = getEffectiveFoodPreference(meal, mealSlot);
  const heroFoodPreference = effectiveFoodPreference;
  const mealImage = foodImageForPreference(heroFoodPreference);
  const { phase, send, closeFlow } = useMealDetailMachine();
  const sheets = phaseToSheetFlags(phase);
  const { savedAddresses, defaultAddressId, removeAddress } = useSavedAddresses();
  const [savedAddressSheetOpen, setSavedAddressSheetOpen] = useState(false);
  const [addressFlowOpen, setAddressFlowOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor | null>(null);
  const contentRef = useAnimatedRef<Animated.ScrollView>();
  const scrollAtTop = useRef(true);
  const isDismissing = useRef(false);
  const setScrollAtTop = useCallback((atTop: boolean) => { scrollAtTop.current = atTop; }, []);
  const pendingNavDirection = useRef<'next' | 'prev' | null>(null);
  const navEntries = useMemo(() => buildMealDetailNavEntries(allMeals, planBoth), [allMeals, planBoth]);
  const navIndex = findMealDetailNavIndex(navEntries, meal.id, mealSlot);
  const hasPrevMeal = navIndex > 0;
  const hasNextMeal = navIndex >= 0 && navIndex < navEntries.length - 1;
  const swipeEnabled = (phase === 'viewing' || phase === 'skipped') && navEntries.length > 1;
  const mockAction = (label: string) => onToast(`${label} selected`);
  const referenceNow = useMemo(
    () => (isSubscriptionMeal ? subscriptionReferenceNow(allMeals) : new Date()),
    [allMeals, isSubscriptionMeal],
  );
  const guardContext = {
    meal,
    isSubscriptionMeal,
    isTrialMeal: !isSubscriptionMeal,
    mealSlot,
    planBoth,
    now: referenceNow,
  };
  const actionRows = buildMealDetailActions(guardContext);
  const upcomingPrimaryActions = actionRows.filter((row) => upcomingMealActionIds.includes(row.id));
  const reportIssueActions = actionRows.filter((row) => row.id === 'reportIssue');
  const cutoffMessage = cutoffHelperMessage(guardContext);
  const preferenceCutoffNote = preferenceCutoffNotice(guardContext);
  const slotSkipped = planBoth ? isSlotSkipped(meal, mealSlot) : (meal.isSkipped || meal.status === 'skipped');
  const activeSkipMetadata = skipMetadataForSlot(meal, mealSlot) ?? meal.skipMetadata;
  const undoAvailable = canUndoSkip(guardContext);
  const deliveryCancelled = meal.status === 'delivery_failed' || meal.status === 'issue';
  const isSkipped = slotSkipped;
  const displayMealType = planBoth ? slotLabel(mealSlot) : meal.mealType;
  const slotMarker = meal.mealMarkers?.[markerIndexForSlot(meal, mealSlot)];
  const displayFoodPreference = effectiveFoodPreference;
  const slotStatus = slotMarker?.status ?? meal.status;
  const isDelivered = slotStatus === 'delivered';
  const isUpcoming = !isSkipped && !isDelivered && !deliveryCancelled;
  const overviewActions = isUpcoming ? upcomingPrimaryActions : [];
  const showOverviewTiffin = !deliveryCancelled && !isSkipped && !isDelivered;
  const showModificationDetails = overviewActions.length > 0;
  const projectedEndDate = calculateExtendedSubscriptionEndDate(subscriptionEndDate);

  const handleAction = (actionId: MealDetailActionId, anchor?: PickerAnchor) => {
    if (actionId === 'changeAddress') {
      setSavedAddressSheetOpen(true);
      return;
    }
    if (actionId === 'changeMealPreference') {
      if (anchor) setPickerAnchor(anchor);
      return;
    }
    const event = mealDetailEventForAction(actionId);
    if (!event) return;
    send(event);
  };

  const headerTop = insets.top + 8;
  const headerRowHeight = 52;
  const heroHeight = 186;
  const closeIconSize = 36;
  const dockGap = 12;
  const initialSheetTop = headerTop + headerRowHeight + heroHeight;
  const dockedSheetTop = headerTop + closeIconSize + dockGap;
  const collapseRange = initialSheetTop - dockedSheetTop;
  const surfaceColor = theme === 'dark' ? '#0d0d0d' : '#f6f6f6';
  const canvasColor = theme === 'dark' ? '#000000' : '#ffffff';

  const scrollY = useSharedValue(0);
  const atTopShared = useSharedValue(true);
  const swipeX = useSharedValue(0);
  const dismissY = useSharedValue(0);
  const plateNavY = useSharedValue(0);
  const plateNavOpacity = useSharedValue(1);
  const plateEnterOffset = heroHeight + 80;
  const plateEasing = Easing.out(Easing.quad);
  const nestedSheetOpen = sheets.issueOpen || sheets.skipOpen || savedAddressSheetOpen || addressFlowOpen || !!pickerAnchor;
  const finishDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const triggerDismiss = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    dismissY.value = withTiming(windowHeight, { duration: 220, easing: plateEasing }, (finished) => {
      if (finished) runOnJS(finishDismiss)();
    });
  }, [dismissY, finishDismiss, plateEasing, windowHeight]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const offsetY = event.contentOffset.y;
      scrollY.value = Math.max(0, offsetY);
      // Mirror "is the sheet back at its default position" onto the JS thread so the
      // pan responder can read it — worklets cannot mutate refs across threads.
      const nextAtTop = offsetY <= 8;
      if (atTopShared.value !== nextAtTop) {
        atTopShared.value = nextAtTop;
        runOnJS(setScrollAtTop)(nextAtTop);
      }
    },
    onEndDrag: (event) => {
      if (event.contentOffset.y < 0) scrollTo(contentRef, 0, 0, true);
    },
    onMomentumEnd: (event) => {
      if (event.contentOffset.y < 0) scrollTo(contentRef, 0, 0, true);
    },
  });

  const finishMealNavigation = useCallback((direction: 'next' | 'prev') => {
    const targetIndex = direction === 'next' ? navIndex + 1 : navIndex - 1;
    const entry = navEntries[targetIndex];
    if (!entry) {
      swipeX.value = withTiming(0, { duration: 180 });
      return;
    }
    pendingNavDirection.current = direction;
    onNavigate(entry.mealId, entry.slot);
  }, [navEntries, navIndex, onNavigate, swipeX]);

  const navigateMeal = useCallback((direction: 'next' | 'prev') => {
    const targetIndex = direction === 'next' ? navIndex + 1 : navIndex - 1;
    if (targetIndex < 0 || targetIndex >= navEntries.length) {
      swipeX.value = withTiming(0, { duration: 180 });
      return;
    }
    const outX = direction === 'next' ? -screenWidth : screenWidth;
    plateNavOpacity.value = 0;
    swipeX.value = withTiming(outX, { duration: 220, easing: plateEasing }, (finished) => {
      if (finished) runOnJS(finishMealNavigation)(direction);
    });
  }, [finishMealNavigation, navEntries.length, navIndex, plateEasing, plateNavOpacity, screenWidth, swipeX]);

  useEffect(() => {
    if (!pendingNavDirection.current) return;
    const direction = pendingNavDirection.current;
    pendingNavDirection.current = null;
    scrollY.value = 0;
    scrollAtTop.current = true;
    atTopShared.value = true;
    isDismissing.current = false;
    dismissY.value = 0;
    setPickerAnchor(null);
    setSavedAddressSheetOpen(false);
    setAddressFlowOpen(false);
    setEditingAddress(null);
    requestAnimationFrame(() => scrollTo(contentRef, 0, 0, false));
    swipeX.value = direction === 'next' ? screenWidth : -screenWidth;
    swipeX.value = withTiming(0, { duration: 240, easing: plateEasing });
    plateNavY.value = plateEnterOffset;
    plateNavOpacity.value = 1;
    plateNavY.value = withTiming(0, { duration: 300, easing: plateEasing });
  }, [contentRef, meal.id, mealSlot, plateEnterOffset, plateEasing, plateNavOpacity, plateNavY, screenWidth, scrollY, swipeX]);

  const isPullDown = (gesture: { dx: number; dy: number }) => gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx);

  const panResponder = useMemo(() => PanResponder.create({
    // Pull-to-close is only armed once the sheet is back at its default position,
    // so the first swipe collapses the sheet and only the next one closes the screen.
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      !nestedSheetOpen && !isDismissing.current && scrollAtTop.current && isPullDown(gesture),
    onMoveShouldSetPanResponder: (_, gesture) => {
      if (nestedSheetOpen || isDismissing.current) return false;
      if (scrollAtTop.current && isPullDown(gesture)) return true;
      return swipeEnabled
        && scrollAtTop.current
        && Math.abs(gesture.dx) > 10
        && Math.abs(gesture.dx) > Math.abs(gesture.dy);
    },
    onPanResponderMove: (_, gesture) => {
      if (gesture.dy > 0 && gesture.dy > Math.abs(gesture.dx)) {
        dismissY.value = gesture.dy;
        return;
      }
      const atStart = gesture.dx > 0 && !hasPrevMeal;
      const atEnd = gesture.dx < 0 && !hasNextMeal;
      swipeX.value = (atStart || atEnd) ? gesture.dx * 0.25 : gesture.dx;
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 0 && gesture.dy > Math.abs(gesture.dx)) {
        if (gesture.dy > 90 || gesture.vy > 0.9) triggerDismiss();
        else dismissY.value = withTiming(0, { duration: 180, easing: plateEasing });
        return;
      }
      if (gesture.dx < -screenWidth * 0.18 && hasNextMeal) {
        navigateMeal('next');
        return;
      }
      if (gesture.dx > screenWidth * 0.18 && hasPrevMeal) {
        navigateMeal('prev');
        return;
      }
      swipeX.value = withTiming(0, { duration: 180, easing: plateEasing });
    },
    onPanResponderTerminate: () => {
      dismissY.value = withTiming(0, { duration: 180, easing: plateEasing });
      swipeX.value = withTiming(0, { duration: 180, easing: plateEasing });
    },
  }), [dismissY, hasNextMeal, hasPrevMeal, navigateMeal, nestedSheetOpen, plateEasing, screenWidth, swipeEnabled, swipeX, triggerDismiss]);

  const { rootBgStyle, heroAnimatedStyle, sheetPositionStyle, contentLiftStyle } = useHeroScrollSheetMotion({
    scrollY,
    collapseRange,
    initialSheetTop,
    dockedSheetTop,
    heroHeight,
    surfaceColor,
    canvasColor,
  });

  const contentSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  const plateNavStyle = useAnimatedStyle(() => ({
    opacity: plateNavOpacity.value,
    transform: [{ translateY: plateNavY.value }],
  }));

  const dismissRadius = 24;

  const dismissStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissY.value }],
    borderRadius: interpolate(
      dismissY.value,
      [0, 120],
      [0, dismissRadius],
      Extrapolation.CLAMP,
    ),
    overflow: dismissY.value > 0 ? 'hidden' : 'visible',
    opacity: interpolate(
      dismissY.value,
      [0, windowHeight * 0.5, windowHeight],
      [1, 1, 0],
      Extrapolation.CLAMP,
    ),
  }), [windowHeight]);

  return (
    <Animated.View entering={FadeIn.duration(180)} style={[rootBgStyle, dismissStyle]} className="absolute inset-0 z-50 flex-1">
      <View style={{ paddingTop: headerTop }} className="absolute inset-x-0 top-0 z-20 flex-row items-center justify-between px-5 pb-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Close meal details" onPress={onClose} hitSlop={8} className="size-icon-button items-center justify-center">
          <XIcon size={24} weight="regular" color={iconColor} />
        </Pressable>
        <Text className="font-body text-body-sm tracking-body-sm text-foreground">sora kitchen</Text>
      </View>

      <View style={{ top: headerTop + headerRowHeight, height: heroHeight, overflow: 'visible' }} pointerEvents="none" className="absolute inset-x-0 z-0 items-center">
        <Animated.View style={[heroAnimatedStyle, plateNavStyle]} className="size-[314px] overflow-hidden rounded-full">
          <Image source={mealImage} accessibilityLabel={`${heroFoodPreference} home-style meal`} resizeMode="cover" className="size-full" />
        </Animated.View>
      </View>

      <Animated.View style={[{ bottom: 0, left: 0, right: 0, position: 'absolute', overflow: 'hidden' }, sheetPositionStyle]} {...panResponder.panHandlers} className="z-10 bg-canvas">
        <Animated.ScrollView
          ref={contentRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
          nestedScrollEnabled
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 40 }}
        >
          <View style={{ height: collapseRange }} />
          <Animated.View style={contentLiftStyle}>
            <Animated.View style={contentSwipeStyle}>
            <View className="gap-4">
              <View className="gap-2">
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="flex-1 font-heading text-heading-md text-foreground">{meal.date}</Text>
                  {isSkipped ? (
                    <SkippedStatusGroup
                      onUndo={undoAvailable && activeSkipMetadata ? () => {
                        onUndoSkip(meal.id, mealSlot, calculateShortenedSubscriptionEndDate(subscriptionEndDate));
                        send({ type: 'MEAL_SKIP_UNDONE' });
                        onToast(`${slotLabel(mealSlot)} restored`);
                      } : undefined}
                    />
                  ) : (
                    <StatusBadge status={slotMarker?.status ?? meal.status} />
                  )}
                </View>
                <Text className={headingDescriptionClass}>{`${displayMealType} · ${displayFoodPreference}`}</Text>
                {preferenceCutoffNote ? (
                  <View className="rounded-field bg-warning-muted px-3 py-2.5">
                    <Text className="font-body text-body-sm leading-5 text-foreground">{preferenceCutoffNote}</Text>
                  </View>
                ) : null}
              </View>
              {!isDelivered ? (
                <>
                  <View className="h-px bg-border" />
                  <MealDetailOverviewList
                    meal={meal}
                    allMeals={allMeals}
                    foodPreference={displayFoodPreference}
                    mealType={displayMealType}
                    actions={overviewActions}
                    onAction={handleAction}
                    showTiffin={showOverviewTiffin}
                  />
                </>
              ) : null}
            </View>
            {isDelivered ? (
              <>
                <View className="my-5 h-px bg-border" />
                <NutritionSection meal={meal} />
                <View className="my-5 h-px bg-border" />
                <Feedback meal={meal} onSave={(rating, tags, note) => onUpdate({ ...meal, rating, feedbackTags: tags, feedbackNote: note })} onFocusTellMore={() => setTimeout(() => contentRef.current?.scrollToEnd({ animated: true }), 180)} />
              </>
            ) : deliveryCancelled ? (
              <>
                <View className="my-5 h-px bg-border" />
                <Text className={headingDescriptionClass}>This past delivery was cancelled. Its preferences, delivery date and delivery address can no longer be changed.</Text>
              </>
            ) : isSkipped ? (
              <>
                <View className="my-5 h-px bg-border" />
                <Text className={headingDescriptionClass}>This {displayMealType.toLowerCase()} was skipped. One additional meal day has been added to your subscription.</Text>
                <Text className="mt-4 font-body text-body-sm leading-6 text-muted">Nutrition details will be available after the meal is prepared.</Text>
                <MealDetailActionList actions={reportIssueActions} onAction={handleAction} />
              </>
            ) : (
              <>
                <View className="my-5 h-px bg-border" />
                {showModificationDetails && cutoffMessage ? <Text className="font-body text-body-sm leading-5 text-muted">{cutoffMessage}</Text> : null}
                <Text className={`${showModificationDetails && cutoffMessage ? 'mt-4' : ''} font-body text-body-sm leading-6 text-muted`}>Nutrition details will be available after the meal is prepared.</Text>
                <MealDetailActionList actions={reportIssueActions} onAction={handleAction} />
              </>
            )}
            {isDelivered || deliveryCancelled ? (
              <MealDetailActionList actions={reportIssueActions} onAction={handleAction} />
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => mockAction('Contact support')} className="mt-3 min-h-11 items-center justify-center">
              <Text className="font-body-medium text-body-sm text-muted">Need help with this meal? <Text className="text-accent">Contact support</Text></Text>
            </Pressable>
            </Animated.View>
          </Animated.View>
        </Animated.ScrollView>
      </Animated.View>
      {sheets.issueOpen ? <IssueSheet mealDate={meal.date} onClose={() => closeFlow()} onSubmit={() => { closeFlow(); onToast('Issue submitted'); }} /> : null}
      {savedAddressSheetOpen ? (
        <SavedAddressesSheet
          addresses={savedAddresses}
          defaultAddressId={defaultAddressId}
          onClose={() => setSavedAddressSheetOpen(false)}
          onAddNew={() => {
            setSavedAddressSheetOpen(false);
            setEditingAddress(null);
            setAddressFlowOpen(true);
          }}
          onEdit={(address) => {
            setSavedAddressSheetOpen(false);
            setEditingAddress(address);
            setAddressFlowOpen(true);
          }}
          onSelect={(address) => {
            const override = mealOverrideFromSavedAddress(address);
            const slotIndex = markerIndexForSlot(meal, mealSlot);
            onUpdate(
              meal.mealMarkers?.length
                ? {
                    ...meal,
                    mealMarkers: meal.mealMarkers.map((marker, index) => (
                      index === slotIndex ? { ...marker, deliveryAddressOverride: override } : marker
                    )),
                  }
                : {
                    ...meal,
                    deliveryAddressOverride: override,
                  },
            );
            setSavedAddressSheetOpen(false);
            onToast('Delivery address updated for this meal');
          }}
          onDelete={(address) => {
            removeAddress(address.id);
            if (savedAddresses.length <= 1) setSavedAddressSheetOpen(false);
          }}
        />
      ) : null}
      {addressFlowOpen ? (
        <DeliveryAddressFlow
          mode="meal-edit"
          mealSlot={mealSlot}
          editingAddressId={editingAddress?.id}
          headerTitleOverride={editingAddress ? editAddressHeaderTitle() : undefined}
          initialLocation={editingAddress?.deliveryLocation ?? getEffectiveMealAddress(meal, mealSlot)}
          initialDetails={editingAddress ? {
            ...detailsFromSavedAddress(editingAddress),
            number: addressDetailLine(editingAddress),
            society: '',
            landmark: '',
          } : emptyAddressDetails(getEffectiveMealAddress(meal, mealSlot))}
          onClose={() => {
            setAddressFlowOpen(false);
            setEditingAddress(null);
          }}
          onConfirmed={(_saved, override) => {
            const wasEditing = !!editingAddress;
            const slotIndex = markerIndexForSlot(meal, mealSlot);
            onUpdate(
              meal.mealMarkers?.length
                ? {
                    ...meal,
                    mealMarkers: meal.mealMarkers.map((marker, index) => (
                      index === slotIndex ? { ...marker, deliveryAddressOverride: override } : marker
                    )),
                  }
                : {
                    ...meal,
                    deliveryAddressOverride: override,
                  },
            );
            setAddressFlowOpen(false);
            setEditingAddress(null);
            onToast(wasEditing ? 'Address updated' : 'Delivery address updated for this meal');
          }}
        />
      ) : null}
      {pickerAnchor ? (
        <SubscriptionPreferencePickerModal
          kind="food"
          value={getEffectiveFoodPreference(meal, mealSlot) as MealPreferenceValue}
          anchor={pickerAnchor}
          options={subscriptionFoodOptions}
          onClose={() => setPickerAnchor(null)}
          onSelect={(preference) => {
            const nextPreference = preference as MealPreferenceValue;
            const slotIndex = markerIndexForSlot(meal, mealSlot);
            onUpdate(
              meal.mealMarkers?.length
                ? {
                    ...meal,
                    mealMarkers: meal.mealMarkers.map((marker, index) => (
                      index === slotIndex ? { ...marker, foodPreference: nextPreference } : marker
                    )),
                  }
                : {
                    ...meal,
                    mealPreferenceOverride: nextPreference,
                    foodPreference: nextPreference,
                  },
            );
            onToast('Meal preference updated for this meal');
          }}
        />
      ) : null}
      {sheets.skipOpen ? (
        <SkipMealSheet
          mealDate={meal.date}
          newEndDate={projectedEndDate}
          mealSlot={mealSlot}
          onClose={() => closeFlow()}
          onConfirm={() => {
            const metadata = buildSkipMetadata(meal, subscriptionEndDate, projectedEndDate, mealSlot);
            onSkipMeal(meal.id, mealSlot, projectedEndDate, metadata);
            send({ type: 'MEAL_SKIPPED' });
            onToast(`${slotLabel(mealSlot)} skipped. Your subscription end date has been updated.`);
            scrollY.value = 0;
            requestAnimationFrame(() => scrollTo(contentRef, 0, 0, true));
          }}
        />
      ) : null}
    </Animated.View>
  );
}

const lockedFeatures = ['Nutrient calculator', 'Personalised diet plan', 'Meal and nutrition history', 'Weekly nutrition insights'];

function planDurationLabel(plan: string) {
  if (plan === 'Weekly') return '1 week';
  if (plan === 'Quarterly') return '12 weeks';
  return '4 weeks';
}

function planMealsCount(plan: string, mealChoice: string) {
  const base = plan === 'Weekly' ? 5 : plan === 'Quarterly' ? 60 : 20;
  return base * (mealChoice === 'Both' ? 2 : 1);
}

function PlanMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="font-body text-body-sm text-muted">{label}</Text>
      <Text className="max-w-[60%] text-right font-body text-body-sm text-foreground">{value}</Text>
    </View>
  );
}

function PlanPreferenceCard({ caption, title, image }: { caption: string; title: string; image: number }) {
  return (
    <View className="min-w-0 flex-1 overflow-hidden rounded-field border border-border bg-canvas">
      <View className="h-[88px] w-full items-center overflow-hidden bg-field">
        <MealPreferenceImage source={image} label={title} delayMs={0} width={106} height={88} imageSize={106} />
      </View>
      <View className="gap-0.5 px-2 py-2">
        <Text className="font-body text-body-xs text-muted">{caption}</Text>
        <Text numberOfLines={1} className="font-mono-semibold text-body-sm text-foreground">{title}</Text>
      </View>
    </View>
  );
}

function PlanDetailsSheet({
  onClose,
  plan,
  mealChoice,
  food,
  bread,
  rice,
  address,
  startDate,
  renewDate,
  statusLabel,
  statusTone,
  showRestartCard = false,
  onRestartPlan,
}: {
  onClose: () => void;
  plan: string;
  mealChoice: string;
  food: string;
  bread: string;
  rice: string;
  address: string;
  startDate: string;
  renewDate: string;
  statusLabel: string;
  statusTone: 'success' | 'warning' | 'paused';
  showRestartCard?: boolean;
  onRestartPlan?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const badgeClass = statusTone === 'paused'
    ? 'bg-surface-raised'
    : statusTone === 'warning'
      ? 'bg-warning-muted'
      : 'bg-success-soft';
  const badgeTextClass = statusTone === 'paused'
    ? 'text-muted'
    : statusTone === 'warning'
      ? 'text-warning-foreground'
      : 'text-success';
  const mealLabel = mealChoice === 'Both' ? 'Lunch & dinner' : mealChoice;

  return (
    <Animated.View entering={FadeIn.duration(180)} className="absolute inset-0 z-50 bg-canvas">
      <View style={{ paddingTop: insets.top + 12 }} className="bg-canvas px-5 pb-1">
        <View className="flex-row items-center gap-3">
          <Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={onClose} hitSlop={8} className="size-6 items-center justify-center">
            <CaretLeftIcon size={24} weight="regular" color={iconColor} />
          </Pressable>
          <Text className="flex-1 font-heading text-heading-md text-foreground">My plan</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <Animated.View entering={FadeInUp.delay(120).duration(280)} className="mx-5 mt-4 gap-sheet-gap">
          <FormPageSection subheading="Review your active subscription, preferences and delivery settings.">
            <View className="gap-sheet-gap">
              {showRestartCard ? (
                <View className="rounded-field p-sheet bg-success-soft">
                  <Text className="font-heading text-body-md text-foreground">Restart the plan</Text>
                  <Text className="mt-1 font-body text-body-sm leading-5 text-muted">Resume deliveries now. Your weekly schedule and preferences stay saved until you restart.</Text>
                  <View className="mt-4">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Restart the plan"
                      onPress={hapticPress(() => onRestartPlan?.(), 'light')}
                      className="w-full rounded-button-outer"
                    >
                      <View
                        className="h-field items-center justify-center rounded-button-inner"
                        style={{ backgroundColor: theme === 'dark' ? '#1e422d' : '#d4eedf' }}
                      >
                        <Text className="font-mono-semibold text-body-md text-success">Restart the plan</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              <View className="gap-3">
                <SectionHeading>Plan</SectionHeading>
                <View className="rounded-field border border-border bg-canvas p-sheet">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1">
                      <Text className="font-mono-semibold text-body-md text-foreground">{plan}</Text>
                      <Text className="mt-1 font-body text-body-sm text-muted">{planDurationLabel(plan)} · {planMealsCount(plan, mealChoice)} meals</Text>
                    </View>
                    <View className={`rounded-full px-2.5 py-1 ${badgeClass}`}>
                      <Text className={`font-body-medium text-body-xs ${badgeTextClass}`}>{statusLabel}</Text>
                    </View>
                  </View>
                  <View className="my-3 h-px bg-border" />
                  <View className="gap-3">
                    <PlanMetaRow label="Meals" value={mealLabel} />
                    <PlanMetaRow label="Started" value={startDate} />
                    <PlanMetaRow label="Renews" value={renewDate} />
                  </View>
                </View>
              </View>
              <View className="gap-3">
                <SectionHeading>Current preferences</SectionHeading>
                <View className="flex-row gap-2">
                  <PlanPreferenceCard caption="Food" title={subscriptionPreferenceCardTitle('food', food)} image={foodImageForPreference(food)} />
                  <PlanPreferenceCard caption="Bread" title={subscriptionPreferenceCardTitle('bread', bread)} image={preferenceImageFor(bread)} />
                  <PlanPreferenceCard caption="Rice" title={subscriptionPreferenceCardTitle('rice', rice)} image={preferenceImageFor(rice)} />
                </View>
              </View>
              <View className="gap-3">
                <SectionHeading>Delivery address</SectionHeading>
                <View className="rounded-field border border-border bg-canvas p-sheet">
                  <View className="flex-row items-start gap-3">
                    <View className="h-5 shrink-0 items-center justify-center">
                      <HomeGlyph icon={MapPinIcon} size={20} tone="muted" />
                    </View>
                    <Text className="min-w-0 flex-1 font-body-medium text-body-sm leading-5 text-foreground">Home · {address}</Text>
                  </View>
                </View>
              </View>
              <View className="gap-3">
                <SectionHeading>Payment method</SectionHeading>
                <View className="rounded-field border border-border bg-canvas p-sheet">
                  <View className="flex-row items-start gap-3">
                    <View className="h-5 shrink-0 items-center justify-center">
                      <HomeGlyph icon={CreditCardIcon} size={20} tone="muted" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-body-medium text-body-sm leading-5 text-foreground">UPI</Text>
                      <Text className="mt-0.5 font-body text-body-xs text-muted">Pay using any UPI app</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </FormPageSection>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

function SubscriptionCard({ active, daysLeft, caption, title, description, buttonLabel, onPress }: { active: boolean; daysLeft: number; caption?: string; title?: string; description?: string; buttonLabel?: string; onPress: () => void }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const features = active ? ['Nutrient Calculator', 'My Diet Plan', 'Nutrition History', 'Weekly Insights'] : lockedFeatures;
  const captionText = caption ?? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left of trial`;
  const status = captionText.toLowerCase();
  const captionColor = status === 'trial completed'
    ? '#7f1d1d'
    : ['action required', 'renewal failed', 'plan ended', 'no meal today'].includes(status) || (!caption && daysLeft <= 1)
      ? (dark ? '#f87171' : '#dc2626')
      : status === 'delivery delayed' || (!caption && daysLeft === 2)
        ? (dark ? '#fb923c' : '#d97706')
        : !caption && daysLeft === 3
          ? (dark ? '#facc15' : '#a16207')
          : themePalette[dark ? 'dark' : 'light'].accent;
  return <View className="rounded-field border border-border bg-canvas p-sheet"><Text style={{ color: captionColor }} className="mb-2 font-body-medium text-body-sm">{captionText}</Text><FormHeader title={title ?? (active ? 'Your nutrition tools are ready' : 'Continue your healthy meal routine')} subtitle={description ?? (active ? 'Explore your subscribed meals and personalised nutrition tools.' : 'Subscribe for fresh everyday meals and unlock personalised nutrition tools designed around your goals.')} size="sheet" /><View className="mt-1">{features.map((feature) => <View key={feature} className="min-h-9 flex-row items-center"><View className="h-8 w-8 shrink-0 items-center justify-center">{active ? <HomeGlyph icon={CheckIcon} size={18} weight="bold" tone="success" /> : <HomeGlyph icon={LockKeyIcon} size={18} weight="regular" tone="muted" />}</View><Text className={`ml-3 flex-1 font-body text-body-sm ${active ? 'text-foreground' : 'text-muted'}`}>{feature}</Text></View>)}</View><View className="mt-4"><TrialAuthButton label={buttonLabel ?? (active ? 'Explore My Plan' : 'Avail Subscription')} onPress={onPress} /></View></View>;
}

export default function TrialHome({ food, meal, dailyMeals = [], bread, rice, address, lunchDelivery = null, dinnerDelivery = null, openSubscriptionOnLoad = false, openMealDetailOnLoad = false, lifecycleVariant = 'trial_active', initialPlanResumeDateKey = null, serverHome = null, onServerStateRefresh, onPaymentStatusPress, onProfilePress, onExploreMyPlanPress }: { food: string; meal: string; dailyMeals?: Array<{ lunch: string; dinner: string }>; bread: string; rice: string; address: string; lunchDelivery?: TrialMealDeliveryState | null; dinnerDelivery?: TrialMealDeliveryState | null; openSubscriptionOnLoad?: boolean; openMealDetailOnLoad?: boolean; lifecycleVariant?: HomeLifecycleVariant; initialPlanResumeDateKey?: string | null; serverHome?: AppStateHome | null; onServerStateRefresh?: () => void; onPaymentStatusPress?: () => void; onProfilePress?: () => void; onExploreMyPlanPress?: () => void }) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const seed = useMemo(() => {
    if (lifecycleVariant.startsWith('subscription_')) {
      const restartStartDate = lifecycleVariant === 'subscription_scheduled'
        ? demoParseMonthDay('26 July')
        : undefined;
      const week = subscriptionWeekMeals(
        food || 'Vegetarian',
        bread || 'Bhakri',
        rice || 'Jeera rice',
        meal || 'Lunch',
        address,
        restartStartDate ? { startDate: restartStartDate } : undefined,
      );
      if (lifecycleVariant === 'subscription_no_meal') return week.map((item, index) => index === 2 ? { ...item, isPlanDay: false } : item);
      if (lifecycleVariant === 'subscription_paused') return week.map((item) => item.isPlanDay === false ? item : { ...item, status: 'paused' as MealStatus, mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'paused' as MealStatus })) });
      if (lifecycleVariant === 'subscription_restarted') {
        const restartKey = initialPlanResumeDateKey ?? nextWeekdayDateKey();
        return subscriptionWeekMeals(
          food || 'Vegetarian',
          bread || 'Bhakri',
          rice || 'Jeera rice',
          meal || 'Lunch',
          address,
          { startDate: restartDateFromKey(restartKey), allUpcoming: true },
        );
      }
      if (lifecycleVariant === 'subscription_expired') return week.map((item) => ({ ...item, status: 'inactive' as MealStatus, mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'inactive' as MealStatus })) }));
      if (lifecycleVariant === 'subscription_renewal_failed') return week.map((item, index) => index === 2 ? { ...item, status: 'delivered' as MealStatus, mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'delivered' as MealStatus })) } : item);
      if (lifecycleVariant === 'subscription_delivery_delayed') return week.map((item, index) => index === 2 ? { ...item, mealType: 'Lunch' as const, status: 'delayed' as MealStatus, mealMarkers: item.mealMarkers?.map((marker, markerIndex) => ({ ...marker, status: markerIndex === 0 ? 'delayed' as MealStatus : 'upcoming' as MealStatus })) } : item);
      if (lifecycleVariant === 'subscription_delivery_failed') return week.map((item, index) => index === 2 ? { ...item, status: 'delivery_failed' as MealStatus, mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'delivery_failed' as MealStatus })) } : item);
      if (lifecycleVariant === 'subscription_scheduled') return week.map((item) => item.isPlanDay === false ? item : { ...item, status: 'upcoming' as MealStatus, mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'upcoming' as MealStatus })) });
      if (lifecycleVariant === 'subscription_active') {
        return week.map((item, index) => {
          if (index <= 1) {
            return {
              ...item,
              status: 'delivered' as MealStatus,
              items: menu,
              mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'delivered' as MealStatus })),
            };
          }
          if (index === 2) {
            return {
              ...item,
              status: 'upcoming' as MealStatus,
              items: undefined,
              mealMarkers: item.mealMarkers?.map((marker, markerIndex) => ({
                ...marker,
                status: (markerIndex === 0 ? 'delivered' : 'upcoming') as MealStatus,
              })),
            };
          }
          return {
            ...item,
            status: 'upcoming' as MealStatus,
            items: undefined,
            mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'upcoming' as MealStatus })),
          };
        });
      }
      return week;
    }
    // Server-rendered trial Home: real meal orders, not the demo seed. The
    // subscription variants keep their richer local scaffolding until that
    // slice is wired.
    if (serverHome && serverHome.week.length > 0 && lifecycleVariant.startsWith('trial')) {
      return serverHomeMeals(serverHome, bread || 'Bhakri', rice || 'Jeera rice', address);
    }
    const trial = initialMeals(food || 'Vegetarian', bread || 'Bhakri', rice || 'Jeera rice', meal || 'Lunch', address, dailyMeals);
    if (lifecycleVariant === 'trial_payment_pending' || lifecycleVariant === 'trial_scheduled') return trial.map((item) => ({ ...item, status: 'upcoming' as MealStatus, items: undefined }));
    if (lifecycleVariant === 'trial_completed') return trial.map((item) => ({ ...item, status: 'delivered' as MealStatus, items: menu }));
    return trial;
  }, [address, bread, dailyMeals, food, initialPlanResumeDateKey, lifecycleVariant, meal, rice, serverHome]);
  // A subscription bought against the server: refetch app-state when the
  // sheet closes so Home flips to the real subscription variant.
  const serverPurchaseRef = useRef(false);
  const [planResumeDateKey, setPlanResumeDateKey] = useState<string | null>(
    () => initialPlanResumeDateKey ?? (lifecycleVariant === 'subscription_restarted' ? nextWeekdayDateKey() : null),
  );
  const effectiveLifecycleVariant: HomeLifecycleVariant = (
    (planResumeDateKey && lifecycleVariant === 'subscription_paused') || lifecycleVariant === 'subscription_restarted'
  ) ? 'subscription_restarted' : lifecycleVariant;
  const isSubscriptionHome = effectiveLifecycleVariant.startsWith('subscription_');
  const initiallySubscribed = (effectiveLifecycleVariant === 'trial_subscription_purchased' || isSubscriptionHome) && effectiveLifecycleVariant !== 'subscription_expired';
  const configs: Record<HomeLifecycleVariant, { eyebrow: string; title: string; description: string; caption?: string; selectedLabel: string }> = {
    trial_payment_pending: { eyebrow: 'Payment pending', title: 'Your trial payment is being checked', description: 'Your trial dates are saved while the payment confirmation is pending.', caption: 'Payment not confirmed', selectedLabel: 'First trial meal' },
    trial_scheduled: { eyebrow: 'Trial scheduled', title: 'Your trial starts soon', description: 'Your three selected trial dates are ready. Tap a meal-status circle to review details.', caption: 'Trial starts 27 July', selectedLabel: 'First trial meal' },
    trial_active: { eyebrow: 'Active trial', title: 'Your three-day trial', description: 'Tap a meal-status circle to view that meal’s details.', selectedLabel: 'Selected meal' },
    trial_subscription_purchased: { eyebrow: 'Active trial', title: 'Your three-day trial', description: 'Your subscription is ready and will begin after the final trial meal.', caption: 'Subscription starts after trial', selectedLabel: 'Selected meal' },
    trial_completed: { eyebrow: 'Trial complete', title: 'Your three-day trial is complete', description: 'Review your delivered meals or continue with a subscription.', caption: 'Trial completed', selectedLabel: 'Last trial meal' },
    subscription_scheduled: { eyebrow: 'Subscription scheduled', title: 'Your meals start soon', description: 'Your selected delivery days are ready for the coming week.', caption: 'Starts 26 July', selectedLabel: 'First selected meal' },
    subscription_restarted: { eyebrow: 'Subscription restarted', title: 'Your meal restarts soon', description: 'Your selected delivery days are ready for the coming week.', caption: 'Restarts 2 August', selectedLabel: 'First selected meal' },
    subscription_active: { eyebrow: 'Active subscription', title: 'Your meals this week', description: 'Tap a selected delivery day to view or update that meal.', caption: 'Monthly subscription', selectedLabel: 'Next selected meal' },
    subscription_no_meal: { eyebrow: 'Active subscription', title: 'Your meals this week', description: 'There is no meal selected today. Your next selected delivery remains available below.', caption: 'No meal today', selectedLabel: 'Next selected meal' },
    subscription_paused: { eyebrow: 'Subscription paused', title: 'Your meals are paused', description: 'The same weekly schedule is preserved and resumes on 2 August.', caption: 'Resumes 2 August', selectedLabel: 'Next meal after resume' },
    subscription_ending: { eyebrow: 'Subscription ending', title: 'Your meals this week', description: 'Your paid deliveries remain active until 20 August.', caption: 'Active until 20 August', selectedLabel: 'Next selected meal' },
    subscription_expired: { eyebrow: 'Subscription ended', title: 'Your saved meal schedule', description: 'Your plan has ended. Previous meals and nutrition history remain available.', caption: 'Plan ended', selectedLabel: 'Last scheduled meal' },
    subscription_renewal_failed: { eyebrow: 'Payment action needed', title: 'Your meals this week', description: 'Paid meals remain confirmed. Update payment to keep future weeks active.', caption: 'Renewal failed', selectedLabel: 'Next confirmed meal' },
    subscription_delivery_delayed: { eyebrow: 'Delivery update', title: 'Your meals this week', description: 'One selected delivery is delayed. Your weekly schedule has not changed.', caption: 'Delivery delayed', selectedLabel: 'Affected meal' },
    subscription_delivery_failed: { eyebrow: 'Delivery issue', title: 'Your meals this week', description: 'One delivery needs an address or support resolution.', caption: 'Action required', selectedLabel: 'Affected meal' },
    subscription_offline: { eyebrow: 'Offline', title: 'Your saved meals this week', description: 'Showing the latest saved schedule. Changes are unavailable until you reconnect.', caption: 'Last updated 10:42 AM', selectedLabel: 'Next saved meal' },
  };
  const config = configs[effectiveLifecycleVariant];
  const planCard = effectiveLifecycleVariant === 'subscription_expired'
    ? { title: 'Restart your healthy meal routine', description: 'Choose a new plan while keeping your saved preferences and nutrition history.', buttonLabel: 'Renew Subscription' }
    : effectiveLifecycleVariant === 'subscription_renewal_failed'
      ? { title: 'Payment needs attention', description: 'Update your payment method to keep future subscription weeks active.', buttonLabel: 'Update Payment' }
      : effectiveLifecycleVariant === 'subscription_paused'
        ? { title: 'Your plan is paused', description: 'Your preferences and selected weekly schedule are saved until deliveries resume.', buttonLabel: 'Manage My Plan' }
        : undefined;
  const stateNotice = effectiveLifecycleVariant === 'trial_payment_pending'
    ? { title: 'Check Payment Status', body: 'Return to payment status to see whether your ₹899 trial payment is confirmed.', action: 'Check Payment Status' }
    : effectiveLifecycleVariant === 'subscription_delivery_delayed'
    ? { title: 'Delivery delayed', body: 'The 23 July delivery is delayed. The remaining selected delivery days are unchanged.', tone: 'orange' as const }
    : effectiveLifecycleVariant === 'subscription_delivery_failed'
      ? { title: 'Delivery needs attention', body: 'Check the 23 July delivery address or contact support to resolve it.', tone: 'red' as const }
      : effectiveLifecycleVariant === 'subscription_offline'
        ? { title: 'You are offline', body: 'This is your last saved weekly schedule. Changes will be available after reconnecting.', tone: 'blue' as const }
        : effectiveLifecycleVariant === 'subscription_ending'
          ? { title: 'Plan active until 20 August', body: 'Meals already included in your plan continue as scheduled.', tone: 'purple' as const, action: 'Re-subscribe to this plan' }
          : undefined;
  const [meals, setMeals] = useState(seed);
  const pendingMeal = useMemo(() => pendingFocusMeal(meals), [meals]);
  const [detailId, setDetailId] = useState(pendingMeal.id);
  const [detailSlot, setDetailSlot] = useState<MealSlot>('lunch');
  const [sheetOpen, setSheetOpen] = useState(openMealDetailOnLoad);
  const [toast, setToast] = useState('');
  const [subscriptionOpen, setSubscriptionOpen] = useState(openSubscriptionOnLoad);
  const [planDetailsOpen, setPlanDetailsOpen] = useState(false);
  const [restartCalendarOpen, setRestartCalendarOpen] = useState(false);
  const seededSubscriptionMeal = meal === 'Dinner' || meal === 'Both' || meal === 'Lunch' ? meal : 'Lunch';
  const seededSubscriptionTotal = calculateSubscriptionPricing(
    plans.find((plan) => plan.id === 'monthly') ?? plans[1]!,
    seededSubscriptionMeal === 'Dinner' ? 'Dinner' : seededSubscriptionMeal === 'Both' ? 'Both' : 'Lunch',
  ).total;
  const [subscription, setSubscription] = useState<{ plan: string; meal: string; total: number; startDate: string; endDate: Date } | null>(
    initiallySubscribed ? { plan: 'Monthly', meal, total: seededSubscriptionTotal, startDate: '26 July', endDate: demoAddDays(demoStartOfDay(), 14) } : null,
  );
  const eligibleMeals = meals.filter((item) => item.isPlanDay !== false);
  const trackerMeals = useMemo(() => planMealsFrom(meals), [meals]);
  const bottomFocusMeal = useMemo(() => bottomCardFocusMeal(meals, effectiveLifecycleVariant), [effectiveLifecycleVariant, meals]);
  const selectedId = bottomFocusMeal.id;
  const calendarSelectedId = calendarTrackerFocusId(meals, effectiveLifecycleVariant);
  const isPreStartState = effectiveLifecycleVariant === 'subscription_scheduled' || effectiveLifecycleVariant === 'subscription_restarted' || effectiveLifecycleVariant === 'trial_scheduled';
  const centerTrackerFocus = (isSubscriptionHome && !isPreStartState)
    || effectiveLifecycleVariant === 'trial_active'
    || effectiveLifecycleVariant === 'trial_subscription_purchased'
    || effectiveLifecycleVariant === 'trial_completed'
    || effectiveLifecycleVariant === 'subscription_restarted';
  const selected = meals.find((item) => item.id === selectedId)!;
  const daysLeft = eligibleMeals.filter((item) => item.status !== 'delivered').length;
  const detailMeal = meals.find((item) => item.id === detailId) ?? selected;
  const updateMeal = (updated: TrialMeal) => setMeals((current) => current.map((item) => item.id === updated.id ? updated : item));
  const showToast = (text: string) => setToast(text);
  const planBoth = (subscription?.meal ?? meal) === 'Both';
  const defaultMealSlot = (target: TrialMeal): MealSlot => (
    planBoth ? firstPendingSlotForMeal(target) : target.mealType === 'Dinner' ? 'dinner' : 'lunch'
  );
  const skipMeal = (mealId: string, slot: MealSlot, newEndDate: Date, metadata: SkipMetadata) => {
    setMeals((current) => current.map((item) => {
      if (item.id !== mealId) return item;
      const slotIndex = markerIndexForSlot(item, slot);
      const updatedMarkers = item.mealMarkers?.map((marker, index) => (
        index === slotIndex
          ? { ...marker, status: 'skipped' as MealStatus, skipMetadata: metadata }
          : marker
      ));
      const allSkipped = updatedMarkers?.every((marker) => marker.status === 'skipped') ?? false;
      return {
        ...item,
        mealMarkers: updatedMarkers,
        isSkipped: allSkipped,
        skippedAt: allSkipped ? new Date().toISOString() : item.skippedAt,
        status: allSkipped ? 'skipped' as MealStatus : item.status,
        skipMetadata: allSkipped ? metadata : item.skipMetadata,
      };
    }));
    setSubscription((current) => current ? { ...current, endDate: newEndDate } : current);
  };
  const undoSkipMeal = (mealId: string, slot: MealSlot, restoredEndDate: Date) => {
    setMeals((current) => {
      const target = current.find((item) => item.id === mealId);
      const slotIndex = target ? markerIndexForSlot(target, slot) : 0;
      const markerMeta = target?.mealMarkers?.[slotIndex]?.skipMetadata;
      const guard = {
        meal: target ?? { status: 'upcoming', date: '', address: '', foodPreference: '' },
        isSubscriptionMeal: isSubscriptionHome,
        isTrialMeal: !isSubscriptionHome,
        mealSlot: slot,
        planBoth,
      };
      if (!target || !markerMeta || !canUndoSkip(guard)) return current;
      return current.map((item) => {
        if (item.id !== mealId) return item;
        const updatedMarkers = item.mealMarkers?.map((marker, index) => (
          index === slotIndex
            ? { ...marker, status: markerMeta.previousMarkerStatus as MealStatus, skipMetadata: undefined }
            : marker
        ));
        const allSkipped = updatedMarkers?.every((marker) => marker.status === 'skipped') ?? false;
        return {
          ...item,
          mealMarkers: updatedMarkers,
          isSkipped: allSkipped,
          skippedAt: allSkipped ? item.skippedAt : undefined,
          skipMetadata: allSkipped ? item.skipMetadata : undefined,
          status: allSkipped ? 'skipped' as MealStatus : markerMeta.previousStatus as MealStatus,
          date: markerMeta.date,
          dayLabel: markerMeta.dayLabel,
          shortDate: markerMeta.shortDate,
        };
      });
    });
    setSubscription((current) => (current ? { ...current, endDate: restoredEndDate } : current));
  };
  const subscriptionSheetTitle = effectiveLifecycleVariant === 'subscription_expired' ? 'Renew subscription' : 'Choose your subscription';
  const planButtonLabel = planCard?.buttonLabel ?? ((subscription || initiallySubscribed) ? 'Explore My Plan' : 'Avail Subscription');
  const openPlanDetails = () => setPlanDetailsOpen(true);
  const openPlan = () => {
    if (planButtonLabel === 'Renew Subscription') {
      setSubscriptionOpen(true);
      return;
    }
    if (planButtonLabel === 'Update Payment') {
      showToast('Update payment selected');
      return;
    }
    if (planButtonLabel === 'Explore My Plan' || planButtonLabel === 'Manage My Plan') {
      openPlanDetails();
      return;
    }
    setSubscriptionOpen(true);
  };
  const activePlan = subscription ?? (initiallySubscribed ? { plan: 'Monthly', meal, total: seededSubscriptionTotal, startDate: '26 July', endDate: demoAddDays(demoStartOfDay(), 14) } : null);
  const planStatusLabel = effectiveLifecycleVariant === 'subscription_restarted' || effectiveLifecycleVariant === 'subscription_scheduled'
    ? 'Scheduled'
    : effectiveLifecycleVariant === 'subscription_paused'
      ? 'Paused'
      : effectiveLifecycleVariant === 'trial_subscription_purchased'
        ? 'Starts after trial'
        : 'Active';
  const planStatusTone: 'success' | 'warning' | 'paused' = effectiveLifecycleVariant === 'subscription_paused'
    ? 'paused'
    : effectiveLifecycleVariant === 'subscription_restarted' || effectiveLifecycleVariant === 'subscription_scheduled' || effectiveLifecycleVariant === 'trial_subscription_purchased'
      ? 'warning'
      : 'success';
  const restartDateKey = planResumeDateKey ?? (effectiveLifecycleVariant === 'subscription_restarted' ? nextWeekdayDateKey() : null);
  const homeCaption = restartDateKey && effectiveLifecycleVariant === 'subscription_restarted'
    ? `Restarts ${restartDateShortLabel(restartDateKey)}`
    : config.caption;
  const stateNoticeSurfaceClass = effectiveLifecycleVariant === 'trial_payment_pending' || effectiveLifecycleVariant === 'subscription_ending'
    ? 'rounded-field p-sheet bg-accent-soft'
    : effectiveLifecycleVariant === 'subscription_offline' || effectiveLifecycleVariant === 'subscription_delivery_failed' || effectiveLifecycleVariant === 'subscription_delivery_delayed'
      ? 'rounded-field p-sheet bg-warning-muted'
      : `rounded-field border p-sheet ${stateNotice?.tone === 'red' ? 'border-destructive bg-accent-soft' : stateNotice?.tone === 'orange' ? 'border-[#f59e0b] bg-accent-soft' : 'border-accent bg-accent-soft'}`;
  return <View className="flex-1 bg-canvas"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }}><View className="px-5">
    <Animated.Text entering={FadeInUp.delay(20).duration(240)} className="font-body text-body-sm tracking-body-sm text-accent">{config.eyebrow}</Animated.Text>
    <View className="gap-sheet-gap"><Animated.View entering={FadeInUp.delay(70).duration(260)}><View className="gap-2"><View className="flex-row items-center justify-between gap-3"><Text className="flex-1 font-heading text-heading-md text-foreground">{config.title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => { setSheetOpen(false); onProfilePress?.(); }} className="size-icon-button items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={UserCircleIcon} size={24} weight="bold" /></Pressable></View><Text className={headingDescriptionClass}>{config.description}</Text></View></Animated.View><Animated.View entering={FadeInUp.delay(130).duration(260)}><View className="gap-sheet-gap">{stateNotice ? <Animated.View entering={FadeInUp.delay(190).duration(260)} className={stateNoticeSurfaceClass}><Text className={`text-body-md text-foreground ${effectiveLifecycleVariant === 'subscription_offline' || effectiveLifecycleVariant === 'subscription_delivery_failed' || effectiveLifecycleVariant === 'subscription_delivery_delayed' || effectiveLifecycleVariant === 'subscription_ending' ? 'font-mono-semibold' : 'font-heading'}`}>{stateNotice.title}</Text><Text className="mt-1 font-body text-body-sm leading-5 text-muted">{stateNotice.body}</Text>{stateNotice.action ? <View className="mt-4">{effectiveLifecycleVariant === 'trial_payment_pending' ? <AccentSecondaryButton elevated label={stateNotice.action} onPress={onPaymentStatusPress ?? (() => showToast(stateNotice.action!))} /> : effectiveLifecycleVariant === 'subscription_ending' ? <AccentSecondaryButton elevated label={stateNotice.action} onPress={() => showToast('Re-subscription selected')} /> : <TrialAuthButton label={stateNotice.action} onPress={() => showToast('Re-subscription selected')} />}</View> : null}</Animated.View> : null}
    <Animated.View entering={FadeInUp.delay(210).duration(280)}><TrialDayTracker meals={trackerMeals} selectedId={calendarSelectedId} showBoth={planBoth} centerFocus={centerTrackerFocus} animateUpcoming={effectiveLifecycleVariant !== 'subscription_offline' && effectiveLifecycleVariant !== 'subscription_expired'} onSelectDate={(item) => { setDetailId(item.id); setDetailSlot(defaultMealSlot(item)); setSheetOpen(true); }} onOpenMeal={(item, slot) => { setDetailId(item.id); setDetailSlot(slot); setSheetOpen(true); }} /></Animated.View>
    <Animated.View entering={FadeInUp.delay(290).duration(280)}><SubscriptionCard active={!!subscription || initiallySubscribed} daysLeft={daysLeft} caption={homeCaption} title={planCard?.title} description={planCard?.description} buttonLabel={planButtonLabel} onPress={openPlan} /></Animated.View>
    <Animated.View entering={FadeInUp.delay(370).duration(280)} className="rounded-field border border-border bg-canvas p-sheet"><View className="flex-row items-start justify-between gap-3"><View className="flex-1"><Text className="font-body text-body-sm tracking-body-sm text-muted">{config.selectedLabel}</Text><Text className="mt-2 font-heading text-heading-sm text-foreground">{selected.date}</Text><Text className="mt-1 font-body text-body-sm leading-5 text-muted">{planBoth ? 'Lunch & dinner' : selected.mealType} · {selected.addressLabel}</Text></View><StatusBadge status={selected.status} /></View><View className="mt-5"><HomeSecondaryButton label="View meal details" onPress={() => { setDetailId(selected.id); setDetailSlot(defaultMealSlot(selected)); setSheetOpen(true); }} /></View></Animated.View></View></Animated.View></View>
  </View></ScrollView>
    {sheetOpen ? (
      <MealDetailSheet
        meal={detailMeal}
        allMeals={meals}
        isSubscriptionMeal={isSubscriptionHome}
        planBoth={planBoth}
        mealSlot={detailSlot}
        subscriptionEndDate={subscription?.endDate ?? demoAddDays(demoStartOfDay(), 14)}
        onClose={() => setSheetOpen(false)}
        onNavigate={(mealId, slot) => {
          setDetailId(mealId);
          setDetailSlot(slot);
        }}
        onUpdate={updateMeal}
        onSkipMeal={skipMeal}
        onUndoSkip={undoSkipMeal}
        onToast={showToast}
      />
    ) : null}
    {subscriptionOpen ? <SubscriptionSheet food={food} bread={bread} rice={rice} address={address} initialMeal={meal} dailyMeals={dailyMeals} lunchDelivery={lunchDelivery} dinnerDelivery={dinnerDelivery} sheetTitle={subscriptionSheetTitle} onClose={() => { setSubscriptionOpen(false); if (serverPurchaseRef.current) { serverPurchaseRef.current = false; onServerStateRefresh?.(); } }} onToast={showToast} onExploreMyPlanPress={openPlanDetails} onActivated={(plan, selectedMeal, total, startDate) => { serverPurchaseRef.current = backendEnabled && isSignedIn(); setSubscription({ plan, meal: selectedMeal, total, startDate, endDate: demoAddDays(demoStartOfDay(), 14) }); showToast(`${plan} plan activated for ${selectedMeal}`); }} /> : null}
    {planDetailsOpen && activePlan ? (
      <PlanDetailsSheet
        onClose={() => setPlanDetailsOpen(false)}
        plan={activePlan.plan}
        mealChoice={activePlan.meal}
        food={food}
        bread={bread}
        rice={rice}
        address={address}
        startDate={activePlan.startDate}
        renewDate={formatDisplayDate(activePlan.endDate)}
        statusLabel={planStatusLabel}
        statusTone={planStatusTone}
        showRestartCard={lifecycleVariant === 'subscription_paused' && !planResumeDateKey}
        onRestartPlan={() => setRestartCalendarOpen(true)}
      />
    ) : null}
    {restartCalendarOpen ? (
      <PlanRestartDateSheet
        initialDate={planResumeDateKey ?? undefined}
        onClose={() => setRestartCalendarOpen(false)}
        onConfirm={(dateKey) => {
          setPlanResumeDateKey(dateKey);
          setMeals(subscriptionWeekMeals(
            food || 'Vegetarian',
            bread || 'Bhakri',
            rice || 'Jeera rice',
            meal || 'Lunch',
            address,
            { startDate: restartDateFromKey(dateKey), allUpcoming: true },
          ));
          setRestartCalendarOpen(false);
          setPlanDetailsOpen(false);
          setSubscription((current) => (
            current ? { ...current, startDate: restartDateShortLabel(dateKey) } : current
          ));
          showToast(`Plan restarts on ${restartDateLabel(dateKey)}`);
        }}
      />
    ) : null}
    {toast ? <Toast message={toast} onDismiss={() => setToast('')} /> : null}
  </View>;
}
