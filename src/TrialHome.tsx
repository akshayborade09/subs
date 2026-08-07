import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated as NativeAnimated, Easing, Image, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import Animated, { Extrapolation, FadeIn, FadeInUp, interpolate, interpolateColor, scrollTo, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { type Icon, type IconWeight } from 'phosphor-react-native';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { LockKeyIcon } from 'phosphor-react-native/src/icons/LockKey';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { PauseIcon } from 'phosphor-react-native/src/icons/Pause';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
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
import { FoodPreferencePicker } from './FoodPreferencePicker';
import {
  buildMealDetailActions,
  buildSkipMetadata,
  calculateExtendedSubscriptionEndDate,
  calculateRestoredSubscriptionEndDate,
  canUndoSkip,
  cutoffHelperMessage,
  formatDisplayDate,
  getEffectiveFoodPreference,
  getEffectiveMealAddress,
  isSlotSkipped,
  markerIndexForSlot,
  mealDetailEventForAction,
  mealSlotIndex,
  parseMealDate,
  skipMetadataForSlot,
  slotLabel,
  type MealAddressOverride,
  type MealDetailActionId,
  type MealPreferenceValue,
  type MealSlot,
  type SkipMetadata,
  phaseToSheetFlags,
  useMealDetailMachine,
} from './mealDetailState';
import { DeliveryAddressFlow } from './DeliveryAddressFlow';
import { type SubscriptionPreferences } from './SubscriptionPreferenceFlow';
import { MealPreferenceImage } from './MealPreferenceImage';
import { SubscriptionPreferencePickerModal, type PickerAnchor } from './subscriptionPreferencePickerModal';
import { type SubscriptionPreferenceKind } from './subscriptionPreferenceOptions';

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

type GlyphTone = 'foreground' | 'muted' | 'accent' | 'success' | 'canvas' | 'border' | 'white';
function HomeGlyph({ icon: Glyph, size = 20, weight = 'regular', tone = 'foreground' }: { icon: Icon; size?: number; weight?: IconWeight; tone?: GlyphTone }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const palette = themePalette[dark ? 'dark' : 'light'];
  const colors: Record<GlyphTone, string> = { foreground: dark ? '#ffffff' : '#101010', muted: dark ? '#ababab' : '#5e5e5e', accent: palette.accent, success: palette.success, canvas: dark ? '#0e0e0e' : '#ffffff', border: dark ? '#242424' : '#eeeeee', white: '#ffffff' };
  return <Glyph size={Math.max(8, size - 4)} weight={weight === 'fill' ? 'fill' : 'bold'} color={colors[tone]} />;
}

export type MealStatus = 'delivered' | 'upcoming' | 'paused' | 'inactive' | 'issue' | 'delayed' | 'delivery_failed' | 'skipped';
type MealMarker = { foodPreference: string; status: MealStatus; slot?: MealSlot; skipMetadata?: SkipMetadata };
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

export type HomeLifecycleVariant = 'trial_payment_pending' | 'trial_scheduled' | 'trial_active' | 'trial_subscription_purchased' | 'trial_completed' | 'subscription_scheduled' | 'subscription_active' | 'subscription_no_meal' | 'subscription_paused' | 'subscription_ending' | 'subscription_expired' | 'subscription_renewal_failed' | 'subscription_delivery_delayed' | 'subscription_delivery_failed' | 'subscription_offline';

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

type TiffinMenuKind = 'delivered' | 'next' | 'pending';

function tiffinMenuKind(meal: TrialMeal, allMeals: TrialMeal[]): TiffinMenuKind {
  if (meal.status === 'delivered') return 'delivered';
  const firstUpcoming = planMealsFrom(allMeals).find((item) => item.status !== 'delivered');
  if (firstUpcoming?.id === meal.id) return 'next';
  return 'pending';
}

export const TRIAL_DAY_COUNT = 3;

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

const initialMeals = (food: string, bread: string, rice: string, meal: string, address: string, dailyMeals: Array<{ lunch: string; dinner: string }> = []): TrialMeal[] => {
  const offsets = [-2, -1, 1];
  return offsets.map((offset, index) => {
    const day = demoAddDays(demoStartOfDay(), offset);
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

const subscriptionWeekMeals = (food: string, bread: string, rice: string, meal: string, address: string): TrialMeal[] => {
  const weekdays = demoRollingWeekdays(5, -4);
  return weekdays.map((day, index) => {
    const labels = demoMealDateLabels(day);
    const status = index < 2 ? 'delivered' as MealStatus : 'upcoming' as MealStatus;
    return {
      id: `sub-${labels.shortDate}`,
      ...labels,
      mealType: meal === 'Dinner' ? 'Dinner' : 'Lunch',
      status,
      foodPreference: food,
      breadPreference: bread,
      ricePreference: rice,
      addressLabel: 'Home',
      address,
      nutrition,
      items: index < 2 ? menu : undefined,
      isPlanDay: true,
      mealMarkers: meal === 'Both'
        ? [
            { foodPreference: index % 2 === 0 ? 'Vegetarian' : 'Non-vegetarian', status, slot: 'lunch' as const },
            { foodPreference: 'Non-vegetarian', status: index < 2 ? 'delivered' : 'upcoming', slot: 'dinner' as const },
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
    paused: { label: 'Paused', bg: 'bg-secondary', textClass: 'text-secondary-foreground' },
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
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const scale = useRef(new NativeAnimated.Value(0.8)).current;
  const opacity = useRef(new NativeAnimated.Value(0.55)).current;
  useEffect(() => { const animation = NativeAnimated.loop(NativeAnimated.parallel([NativeAnimated.timing(scale, { toValue: 1.65, duration: 1400, useNativeDriver: true }), NativeAnimated.timing(opacity, { toValue: 0, duration: 1400, useNativeDriver: true })])); animation.start(); return () => animation.stop(); }, [opacity, scale]);
  return <NativeAnimated.View pointerEvents="none" style={{ opacity, transform: [{ scale }], borderColor: color === 'red' ? '#dc2626' : color === 'orange' ? '#f59e0b' : themePalette[dark ? 'dark' : 'light'].accent, backgroundColor: 'transparent' }} className="absolute h-7 w-7 rounded-full border-2" />;
}

function TrialDayTracker({ meals, selectedId, showBoth, animateUpcoming = true, onSelectDate, onOpenMeal }: { meals: TrialMeal[]; selectedId: string; showBoth: boolean; animateUpcoming?: boolean; onSelectDate: (meal: TrialMeal) => void; onOpenMeal: (meal: TrialMeal, slot: MealSlot) => void }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const skippedSurface = themePalette[dark ? 'dark' : 'light'].skippedSurface;
  const skippedBorder = themePalette[dark ? 'dark' : 'light'].skippedBorder;
  let upcomingRippleAssigned = false;
  return <View className="w-full flex-row">{meals.map((meal) => { const excluded = meal.isPlanDay === false; const selected = meal.id === selectedId; const markers = meal.mealMarkers?.slice(0, showBoth ? 2 : 1) ?? Array.from({ length: showBoth ? 2 : 1 }, (_, markerIndex) => ({ foodPreference: meal.foodPreference, status: meal.status, slot: (markerIndex === 0 ? 'lunch' : 'dinner') as MealSlot })); return <View key={meal.id} className="flex-1 items-center"><Pressable disabled={excluded} accessibilityRole="button" accessibilityLabel={excluded ? `${meal.date}, no meal selected` : `Select ${meal.date}`} accessibilityState={{ selected, disabled: excluded }} onPress={hapticPress(() => onSelectDate(meal), 'selection')} className={`h-14 w-full max-w-[46px] items-center justify-center rounded-field border ${selected ? 'border-foreground bg-canvas' : excluded ? 'border-transparent bg-field opacity-45' : 'border-border bg-field'}`}><Text className="font-mono-semibold text-body-md text-foreground">{meal.shortDate}</Text><Text className="mt-0.5 font-body text-body-xs text-muted">{meal.dayLabel}</Text></Pressable><View className="mt-2 items-center gap-1">{markers.map((marker, markerIndex) => { const slot: MealSlot = marker.slot ?? (markerIndex === 0 ? 'lunch' : 'dinner'); const nonVeg = marker.foodPreference.toLowerCase().includes('non'); const delayed = marker.status === 'delayed'; const failed = marker.status === 'delivery_failed' || marker.status === 'issue'; const skipped = marker.status === 'skipped'; const active = animateUpcoming && !excluded && !skipped && !upcomingRippleAssigned && (marker.status === 'upcoming' || delayed); if (active) upcomingRippleAssigned = true; const delivered = marker.status === 'delivered'; const borderColor = skipped ? skippedBorder : excluded || marker.status === 'inactive' || marker.status === 'paused' ? '#d8d8d8' : failed ? '#dc2626' : delayed ? '#f59e0b' : nonVeg ? '#dc2626' : '#078a4b'; return <Pressable key={`${meal.id}-${markerIndex}`} disabled={excluded} accessibilityRole="button" accessibilityLabel={`${slot === 'lunch' ? 'Lunch' : 'Dinner'}, ${marker.foodPreference}, ${marker.status}`} onPress={() => onOpenMeal(meal, slot)} className={`h-7 w-9 items-center justify-center ${excluded ? 'opacity-45' : ''}`}>{active ? <UpcomingRipple color={delayed ? 'orange' : nonVeg ? 'red' : 'green'} /> : null}<View style={{ borderColor, backgroundColor: skipped ? skippedSurface : delivered || failed ? borderColor : 'transparent' }} className="h-5 w-5 items-center justify-center rounded-full border-[3px]">{delivered && !excluded ? <HomeGlyph icon={CheckIcon} size={16} weight="bold" tone="white" /> : failed && !excluded ? <HomeGlyph icon={XIcon} size={15} weight="bold" tone="white" /> : null}</View></Pressable>; })}</View></View>; })}</View>;
}

function selectionClass(selected: boolean) {
  return `rounded-field border bg-canvas ${selected ? 'border-2 border-accent bg-accent-soft' : 'border-border'}`;
}

function PreferenceSummary({ meal, onEdit }: { meal: TrialMeal; onEdit?: () => void }) { return <View><View className="flex-row items-center justify-between"><SectionHeading>Selected preferences</SectionHeading>{onEdit ? <Pressable accessibilityLabel="Edit preferences for this meal" onPress={onEdit} className="size-icon-button items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={PencilSimpleIcon} size={18} /></Pressable> : null}</View><View className="mt-3 gap-2"><Meta label="Food" value={meal.foodPreference} /><Meta label="Meal" value={meal.mealType} /><Meta label="Bread" value={meal.breadPreference} /><Meta label="Rice" value={meal.ricePreference} /></View></View>; }
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

function TiffinMenuSection({ meal, allMeals }: { meal: TrialMeal; allMeals: TrialMeal[] }) {
  const kind = tiffinMenuKind(meal, allMeals);
  const title = kind === 'delivered' ? 'Today’s tiffin' : 'Tiffin menu';
  const items = kind === 'delivered' ? (meal.items ?? menu) : kind === 'next' ? (meal.items ?? nextDayMenu) : null;
  return (
    <>
      <View className="my-7 h-px bg-border" />
      <SectionHeading>{title}</SectionHeading>
      {kind === 'pending' ? (
        <Text className={`mt-3 ${headingDescriptionClass}`}>Yet to be decided</Text>
      ) : (
        <Text className="mt-3 font-body text-body-md leading-7 text-muted">{items!.map((item) => item.name).join(', ')}</Text>
      )}
    </>
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

function MealDetailActionRow({ title, subtitle, onPress, showDivider = true }: { title: string; subtitle?: string; onPress: () => void; showDivider?: boolean }) {
  const { theme } = useUniwind();
  const chevronColor = theme === 'dark' ? '#ababab' : '#5e5e5e';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className={`py-4 ${showDivider ? 'border-b border-border' : ''}`}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="font-body-medium text-body-md text-foreground">{title}</Text>
          {subtitle ? <Text className="mt-1 font-body text-body-sm leading-5 text-muted">{subtitle}</Text> : null}
        </View>
        <CaretRightIcon size={16} weight="bold" color={chevronColor} />
      </View>
    </Pressable>
  );
}

function MealDetailActionList({ actions, onAction }: { actions: ReturnType<typeof buildMealDetailActions>; onAction: (action: MealDetailActionId) => void }) {
  if (actions.length === 0) return null;
  return (
    <View className="mt-6">
      {actions.map((action, index) => (
        <MealDetailActionRow
          key={action.id}
          title={action.title}
          subtitle={action.subtitle}
          onPress={hapticPress(() => onAction(action.id), 'light')}
          showDivider={index < actions.length - 1}
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
  onUpdate: (meal: TrialMeal) => void;
  onSkipMeal: (mealId: string, slot: MealSlot, newEndDate: Date, metadata: SkipMetadata) => void;
  onUndoSkip: (mealId: string, slot: MealSlot, restoredEndDate: Date) => void;
  onToast: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const effectiveFoodPreference = getEffectiveFoodPreference(meal);
  const effectiveAddress = getEffectiveMealAddress(meal);
  const mealImage = foodImageForPreference(effectiveFoodPreference);
  const { phase, send, closeFlow } = useMealDetailMachine();
  const sheets = phaseToSheetFlags(phase);
  const contentRef = useAnimatedRef<Animated.ScrollView>();
  const mockAction = (label: string) => onToast(`${label} selected`);
  const now = new Date();
  const guardContext = {
    meal,
    isSubscriptionMeal,
    isTrialMeal: !isSubscriptionMeal,
    mealSlot,
    planBoth,
    now,
  };
  const actionRows = buildMealDetailActions(guardContext);
  const cutoffMessage = cutoffHelperMessage(guardContext);
  const slotSkipped = planBoth ? isSlotSkipped(meal, mealSlot) : (meal.isSkipped || meal.status === 'skipped');
  const activeSkipMetadata = skipMetadataForSlot(meal, mealSlot) ?? meal.skipMetadata;
  const undoAvailable = canUndoSkip(guardContext);
  const deliveryCancelled = meal.status === 'delivery_failed' || meal.status === 'issue';
  const isSkipped = slotSkipped;
  const displayMealType = planBoth ? slotLabel(mealSlot) : meal.mealType;
  const slotMarker = meal.mealMarkers?.[markerIndexForSlot(meal, mealSlot)];
  const displayFoodPreference = slotMarker?.foodPreference ?? effectiveFoodPreference;
  const isUpcoming = !isSkipped && meal.status !== 'delivered' && !deliveryCancelled;
  const projectedEndDate = calculateExtendedSubscriptionEndDate(subscriptionEndDate);

  const handleAction = (actionId: MealDetailActionId) => {
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
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = Math.max(0, event.contentOffset.y);
    },
    onEndDrag: (event) => {
      if (event.contentOffset.y < 0) scrollTo(contentRef, 0, 0, true);
    },
    onMomentumEnd: (event) => {
      if (event.contentOffset.y < 0) scrollTo(contentRef, 0, 0, true);
    },
  });

  const { rootOverflow, heroOverflow, rootBgStyle, heroAnimatedStyle, sheetPositionStyle, contentLiftStyle } = useHeroScrollSheetMotion({
    scrollY,
    collapseRange,
    initialSheetTop,
    dockedSheetTop,
    heroHeight,
    surfaceColor,
    canvasColor,
  });

  return (
    <Animated.View entering={FadeIn.duration(180)} style={[rootBgStyle, { overflow: rootOverflow }]} className="absolute inset-0 z-50 flex-1">
      <View style={{ paddingTop: headerTop }} className="absolute inset-x-0 top-0 z-20 flex-row items-center justify-between px-5 pb-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Close meal details" onPress={onClose} hitSlop={8} className="size-icon-button items-center justify-center">
          <XIcon size={24} weight="regular" color={iconColor} />
        </Pressable>
        <Text className="font-body text-body-sm tracking-body-sm text-foreground">sora kitchen</Text>
      </View>

      <View style={{ top: headerTop + headerRowHeight, height: heroHeight, overflow: heroOverflow }} pointerEvents="none" className="absolute inset-x-0 z-0 items-center">
        <Animated.View style={heroAnimatedStyle} className="size-[314px] overflow-hidden rounded-full">
          <Image source={mealImage} accessibilityLabel={`${effectiveFoodPreference} home-style meal`} resizeMode="cover" className="size-full" />
        </Animated.View>
      </View>

      <Animated.View style={[{ bottom: 0, left: 0, right: 0, position: 'absolute', overflow: 'hidden' }, sheetPositionStyle]} className="z-10 bg-canvas">
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
            <View className="gap-auth-block">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 font-heading text-heading-md text-foreground">{meal.date}</Text>
                {isSkipped ? (
                  <SkippedStatusGroup
                    onUndo={undoAvailable && activeSkipMetadata ? () => {
                      onUndoSkip(meal.id, mealSlot, calculateRestoredSubscriptionEndDate(activeSkipMetadata));
                      send({ type: 'MEAL_SKIP_UNDONE' });
                      onToast(`${slotLabel(mealSlot)} restored`);
                    } : undefined}
                  />
                ) : (
                  <StatusBadge status={slotMarker?.status ?? meal.status} />
                )}
              </View>
              <Text className={headingDescriptionClass}>{`${displayMealType} · ${displayFoodPreference}`}</Text>
            </View>
            <View className="my-7 h-px bg-border" />
            <View className="gap-auth-block">
              <SectionHeading>{meal.status === 'delivered' ? `Delivered to ${meal.addressLabel}` : deliveryCancelled ? `Delivery attempted at ${meal.addressLabel}` : isSkipped ? 'Skipped meal' : `Delivering to ${meal.addressLabel}`}</SectionHeading>
              <Text className={headingDescriptionClass}>{effectiveAddress}</Text>
              {meal.deliveryNote ? <Text className={headingDescriptionClass}>Note · {meal.deliveryNote}</Text> : null}
              {isSkipped ? <Text className={headingDescriptionClass}>This {displayMealType.toLowerCase()} was skipped. One additional meal day has been added to your subscription.</Text> : null}
            </View>
            {!deliveryCancelled && !isSkipped ? <TiffinMenuSection meal={meal} allMeals={allMeals} /> : null}
            {meal.status === 'delivered' ? (
              <>
                <View className="my-7 h-px bg-border" />
                <NutritionSection meal={meal} />
                <View className="my-7 h-px bg-border" />
                <PreferenceSummary meal={meal} />
                <View className="my-7 h-px bg-border" />
                <Feedback meal={meal} onSave={(rating, tags, note) => onUpdate({ ...meal, rating, feedbackTags: tags, feedbackNote: note })} onFocusTellMore={() => setTimeout(() => contentRef.current?.scrollToEnd({ animated: true }), 180)} />
              </>
            ) : deliveryCancelled ? (
              <>
                <View className="my-7 h-px bg-border" />
                <PreferenceSummary meal={meal} />
                <Text className={`mt-4 ${headingDescriptionClass}`}>This past delivery was cancelled. Its preferences, delivery date and delivery address can no longer be changed.</Text>
              </>
            ) : isSkipped ? (
              <>
                <View className="my-7 h-px bg-border" />
                <PreferenceSummary meal={{ ...meal, foodPreference: effectiveFoodPreference }} />
                <Text className="mt-4 font-body text-body-sm leading-6 text-muted">Nutrition details will be available after the meal is prepared.</Text>
                <MealDetailActionList actions={actionRows.filter((row) => row.id === 'reportIssue')} onAction={handleAction} />
              </>
            ) : (
              <>
                <View className="my-7 h-px bg-border" />
                <PreferenceSummary meal={{ ...meal, foodPreference: effectiveFoodPreference }} />
                {cutoffMessage ? <Text className="mt-3 font-body text-body-sm leading-5 text-muted">{cutoffMessage}</Text> : null}
                <Text className="mt-4 font-body text-body-sm leading-6 text-muted">Nutrition details will be available after the meal is prepared.</Text>
                {isUpcoming ? <MealDetailActionList actions={actionRows} onAction={handleAction} /> : null}
              </>
            )}
            {meal.status === 'delivered' || deliveryCancelled ? (
              <MealDetailActionList actions={actionRows.filter((row) => row.id === 'reportIssue')} onAction={handleAction} />
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => mockAction('Contact support')} className="mt-3 min-h-11 items-center justify-center">
              <Text className="font-body-medium text-body-sm text-muted">Need help with this meal? <Text className="text-accent">Contact support</Text></Text>
            </Pressable>
          </Animated.View>
        </Animated.ScrollView>
      </Animated.View>
      {sheets.issueOpen ? <IssueSheet mealDate={meal.date} onClose={() => closeFlow()} onSubmit={() => { closeFlow(); onToast('Issue submitted'); }} /> : null}
      {sheets.addressOpen ? (
        <DeliveryAddressFlow
          mode="meal-edit"
          initialLocation={getEffectiveMealAddress(meal)}
          onClose={() => closeFlow()}
          onConfirmed={(_saved, override) => {
            onUpdate({
              ...meal,
              deliveryAddressOverride: override,
            });
            send({ type: 'ADDRESS_UPDATED' });
            onToast('Delivery address updated for this meal');
          }}
        />
      ) : null}
      {sheets.preferencesOpen ? (
        <FoodPreferencePicker
          mealDate={meal.date}
          value={(meal.mealPreferenceOverride ?? meal.foodPreference) as MealPreferenceValue}
          onClose={() => closeFlow()}
          onSave={(preference) => {
            onUpdate({ ...meal, mealPreferenceOverride: preference });
            send({ type: 'MEAL_PREFERENCE_UPDATED' });
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

type PlanId = 'weekly' | 'monthly' | 'quarterly';
const plans = [
  { id: 'weekly' as const, name: 'Weekly', duration: '1 week', meals: 5, price: 1499, discount: 100, badge: 'Try more' as const, badgeGhost: true },
  { id: 'monthly' as const, name: 'Monthly', duration: '4 weeks', meals: 20, price: 5499, discount: 500, badge: 'Recommended' as const, badgeGhost: false },
  { id: 'quarterly' as const, name: 'Quarterly', duration: '12 weeks', meals: 60, price: 14999, discount: 2000, badge: 'Best value' as const, badgeGhost: false },
];
const lockedFeatures = ['Nutrient calculator', 'Personalised diet plan', 'Meal and nutrition history', 'Weekly nutrition insights'];
const planBenefitCarouselItems = [
  { title: 'Daily home style meals', image: require('../assets/choose-subs/daily-home.png') },
  { title: 'Nutrition values for every item', image: require('../assets/choose-subs/nutrition-values.png') },
  { title: 'Pause upcoming meals', image: require('../assets/choose-subs/pause-meal.png') },
  { title: 'Change meal preferences anytime/', image: require('../assets/choose-subs/meal-preferences.png') },
  { title: 'Manage delivery addresses', image: require('../assets/choose-subs/manage-delivery.png') },
  { title: 'Rate every food and delivery', image: require('../assets/choose-subs/rate-food.png') },
] as const;
const toolBenefits = ['Nutrient calculator', 'Personalised diet plan', 'Weekly nutrition insights', 'Meal and nutrition history'];

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

function LockedPreview({ title, description, goals }: { title: string; description?: string; goals?: string[] }) {
  return (
    <View className="rounded-field bg-field p-sheet">
      <FormHeader title={title} subtitle={description} size="sheet" />
      {goals ? (
        <View className="mt-4 flex-row flex-wrap gap-2">
          {goals.map((goal) => (
            <View key={goal} className="rounded-full bg-canvas px-3 py-2">
              <Text className="font-body-medium text-body-xs text-muted">{goal}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const mealChoices = ['Lunch', 'Dinner', 'Both'] as const;
type MealChoice = typeof mealChoices[number];

function SubscriptionMealSelector({ value, onChange }: { value: MealChoice; onChange: (value: MealChoice) => void }) {
  return (
    <View className="flex-row gap-2">
      {mealChoices.map((choice) => {
        const selected = value === choice;
        return (
          <Pressable
            key={choice}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={hapticPress(() => onChange(choice), 'selection')}
            className={`py-2.5 flex-1 items-center justify-center rounded-full border bg-canvas ${selected ? 'border-2 border-accent' : 'border-border'}`}
          >
            <Text className={`font-mono-semibold text-body-sm ${selected ? 'text-foreground' : 'text-muted'}`}>{choice}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SubscriptionPreferenceCarouselCard({ caption, title, image, animate, index, onEdit }: { caption: string; title: string; image: number; animate: boolean; index: number; onEdit: (anchor: PickerAnchor) => void }) {
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
      className="w-[161px] shrink-0 overflow-hidden rounded-field border border-border bg-canvas"
    >
      {animate ? (
        <MealPreferenceImage source={image} label={title} delayMs={80 + index * 50} />
      ) : (
        <View className="h-[116px] w-full bg-field" />
      )}
      <View className="flex-row items-center gap-2 px-3 py-2.5">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="font-body text-body-xs text-muted">{caption}</Text>
          <Text className="font-mono-semibold text-body-sm text-foreground">{title}</Text>
        </View>
        <View className="size-4 shrink-0 items-center justify-center">
          <HomeGlyph icon={PencilSimpleIcon} size={20} weight="bold" />
        </View>
      </View>
    </Pressable>
  );
}

function SubscriptionPreferencesCard({
  food,
  mealChoice,
  bread,
  rice,
  scrollSignal,
  onOpenPicker,
}: {
  food: string;
  mealChoice: string;
  bread: string;
  rice: string;
  scrollSignal: number;
  onOpenPicker: (kind: SubscriptionPreferenceKind, anchor: PickerAnchor) => void;
}) {
  const [animateImages, setAnimateImages] = useState(false);
  const sectionRef = useRef<View>(null);
  const hasAnimated = useRef(false);
  const { height: windowHeight } = useWindowDimensions();
  const cards: Array<{ kind: SubscriptionPreferenceKind; caption: string; title: string; image: number; value: string }> = [
    { kind: 'food', caption: 'Food', title: shortFoodPreferenceLabel(food), image: foodImageForPreference(food), value: food },
    { kind: 'meal', caption: 'Meal', title: mealChoice, image: preferenceImageFor(mealChoice), value: mealChoice },
    { kind: 'bread', caption: 'Bread', title: bread, image: preferenceImageFor(bread), value: bread },
    { kind: 'rice', caption: 'Rice', title: rice, image: preferenceImageFor(rice), value: rice },
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
      <SectionHeading>Current preferences</SectionHeading>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -20, overflow: 'visible' }}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingVertical: 8 }}
      >
          {cards.map((card, index) => (
            <SubscriptionPreferenceCarouselCard
              key={card.kind}
              caption={card.caption}
              title={card.title}
              image={card.image}
              animate={animateImages}
              index={index}
              onEdit={(anchor) => onOpenPicker(card.kind, anchor)}
            />
          ))}
      </ScrollView>
    </View>
  );
}

function subscriptionPlanCardClass(planId: PlanId, selected: boolean) {
  if (!selected) return 'border-border bg-canvas';
  if (planId === 'weekly') {
    return 'border-2 border-foreground bg-field';
  }
  if (planId === 'quarterly') {
    return 'border-2 border-success bg-success-soft';
  }
  return 'border-2 border-accent bg-accent-soft';
}

function SubscriptionPlanCard({ plan, selected, multiplier, trialCredit, onPress }: { plan: typeof plans[number]; selected: boolean; multiplier: number; trialCredit: number; onPress: () => void }) {
  const computedTotal = plan.price * multiplier - plan.discount * multiplier - trialCredit + Math.round((plan.price * multiplier - plan.discount * multiplier) * 0.05);
  const perMeal = Math.round(computedTotal / (plan.meals * multiplier));
  const mealCount = plan.meals * multiplier;
  const savings = plan.discount * multiplier;
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
        <Text className="font-mono-bold text-heading-sm text-foreground">{formatRupee(computedTotal)}</Text>
        <MoneyInline className="max-w-[52%] text-right font-body text-body-xs leading-4 text-muted">
          {`${formatRupee(perMeal)}/meal · save ${formatRupee(savings)}`}
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
          <Image
            source={image}
            accessibilityLabel={title}
            resizeMode="stretch"
            style={{ width: PLAN_BENEFIT_CARD_WIDTH, height: imageHeight }}
          />
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
  const marqueeItems = useMemo(
    () => [...planBenefitCarouselItems, ...planBenefitCarouselItems],
    [],
  );

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
        <NativeAnimated.View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 20,
            transform: [{ translateX }],
          }}
        >
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

function SubscriptionBenefitsSection({ scrollSignal }: { scrollSignal: number }) {
  return (
    <View className="gap-sheet-gap">
      <View className="rounded-field bg-field p-sheet">
        <FormHeader title="Unlock nutrition tools" subtitle="Personalised nutrition insights become available after you subscribe." size="sheet" />
        <View className="mt-3">
          {toolBenefits.map((item) => (
            <View key={item} className="min-h-9 flex-row items-center gap-3">
              <HomeGlyph icon={LockKeyIcon} size={18} weight="regular" tone="muted" />
              <Text className="flex-1 font-body text-body-sm text-muted">{item}</Text>
            </View>
          ))}
        </View>
      </View>
      <SubscriptionPlanBenefitsCarousel scrollSignal={scrollSignal} />
      <LockedPreview title="A meal plan built around your goals" goals={['Balanced meals', 'Increase protein', 'Manage calories', 'Improve meal consistency']} />
    </View>
  );
}

function SubscriptionSheet({ food: initialFood, bread: initialBread, rice: initialRice, address, initialMeal, dailyMeals: initialDailyMeals = [], sheetTitle = 'Choose your subscription', onClose, onActivated, onExploreMyPlanPress, onToast }: { food: string; bread: string; rice: string; address: string; initialMeal: string; dailyMeals?: Array<{ lunch: string; dinner: string }>; sheetTitle?: string; onClose: () => void; onActivated: (plan: string, meal: string, total: number, startDate: string) => void; onExploreMyPlanPress?: () => void; onToast: (text: string) => void }) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const [planId, setPlanId] = useState<PlanId>('monthly');
  const [mealChoice, setMealChoice] = useState<MealChoice>(initialMeal === 'Dinner' ? 'Dinner' : initialMeal === 'Both' ? 'Both' : 'Lunch');
  const [success, setSuccess] = useState(false);
  const [openPreferencePicker, setOpenPreferencePicker] = useState<SubscriptionPreferenceKind | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor | null>(null);
  const [preferencesScrollSignal, setPreferencesScrollSignal] = useState(0);
  const [preferences, setPreferences] = useState<SubscriptionPreferences>({
    food: initialFood,
    meal: initialMeal,
    bread: initialBread,
    rice: initialRice,
    dailyMeals: initialDailyMeals,
  });
  const selectedPlan = plans.find((plan) => plan.id === planId)!;
  const multiplier = mealChoice === 'Both' ? 2 : 1;
  const planPrice = selectedPlan.price * multiplier;
  const discount = selectedPlan.discount * multiplier;
  const trialCredit = 100;
  const taxes = Math.round((planPrice - discount) * 0.05);
  const total = planPrice - discount - trialCredit + taxes;
  const perMeal = Math.round(total / (selectedPlan.meals * multiplier));

  const handlePreferencePickerSelect = (value: string) => {
    if (openPreferencePicker === 'food') setPreferences((current) => ({ ...current, food: value }));
    if (openPreferencePicker === 'meal') {
      setPreferences((current) => ({ ...current, meal: value }));
      if (value === 'Lunch' || value === 'Dinner' || value === 'Both') setMealChoice(value);
    }
    if (openPreferencePicker === 'bread') setPreferences((current) => ({ ...current, bread: value }));
    if (openPreferencePicker === 'rice') setPreferences((current) => ({ ...current, rice: value }));
  };

  const preferencePickerValue = openPreferencePicker === 'food'
    ? preferences.food
    : openPreferencePicker === 'meal'
      ? mealChoice
      : openPreferencePicker === 'bread'
        ? preferences.bread
        : openPreferencePicker === 'rice'
          ? preferences.rice
          : '';

  if (success) {
    return (
      <Overlay onClose={onClose}>
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
                <Meta compact label="Delivery address" value={address} />
                <Meta compact label="Next meal" value="26 July · Lunch" />
              </View>
            )}
            primaryAction={<Primary label="Explore My Plan" onPress={() => { onActivated(selectedPlan.name, mealChoice, total, '26 July'); onClose(); onExploreMyPlanPress?.(); }} />}
          />
        </Animated.View>
      </Overlay>
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 132 }}
      >
        <Animated.View entering={FadeInUp.delay(170).duration(280)} className="mx-5 mt-4 gap-sheet-gap">
          <FormPageSection>
            <View className="gap-sheet-gap">
              <View className="gap-3">
                <SectionHeading>Meal selection</SectionHeading>
                <SubscriptionMealSelector value={mealChoice} onChange={setMealChoice} />
                <Text className="font-body text-body-sm leading-5 text-muted">
                  {mealChoice === 'Both' ? 'Lunch · 11:00 AM to 1:00 PM\nDinner · 6:30 PM to 8:30 PM' : mealChoice === 'Dinner' ? 'Dinner · 6:30 PM to 8:30 PM' : 'Lunch · 11:00 AM to 1:00 PM'}
                </Text>
              </View>

              <View className="gap-3">
                <SectionHeading>Subscription plans</SectionHeading>
                <View className="gap-3">
                  {plans.map((plan) => (
                    <SubscriptionPlanCard
                      key={plan.id}
                      plan={plan}
                      selected={plan.id === planId}
                      multiplier={multiplier}
                      trialCredit={trialCredit}
                      onPress={() => setPlanId(plan.id)}
                    />
                  ))}
                </View>
              </View>

              <SubscriptionPreferencesCard
                food={preferences.food}
                mealChoice={mealChoice}
                bread={preferences.bread}
                rice={preferences.rice}
                scrollSignal={preferencesScrollSignal}
                onOpenPicker={(kind, anchor) => {
                  setOpenPreferencePicker(kind);
                  setPickerAnchor(anchor);
                }}
              />

              <SubscriptionBenefitsSection scrollSignal={preferencesScrollSignal} />

              <View className="gap-3">
                <SectionHeading>Price breakdown</SectionHeading>
                <View className="gap-3 rounded-field bg-field p-sheet">
                  <Meta label="Plan price" value={formatRupee(planPrice)} />
                  <Meta label="Delivery charges" value="₹0" />
                  <Meta label="Taxes" value={formatRupee(taxes)} />
                  <Meta label="Discount" value={`−${formatRupee(discount)}`} />
                  <Meta label="Trial credit" value={`−${formatRupee(trialCredit)}`} />
                  <View className="h-px bg-border" />
                  <View className="flex-row items-center justify-between gap-4">
                    <Text className="font-body text-body-sm text-muted">Total payable</Text>
                    <MoneyText amount={total} className="text-body-md text-foreground" />
                  </View>
                </View>
                <Text className="font-body text-body-xs leading-4 text-muted">
                  {selectedPlan.name} · <MoneyInline className="font-body text-body-xs leading-4 text-muted">{`${formatRupee(perMeal)}/meal after trial credit and savings.`}</MoneyInline>
                </Text>
              </View>
            </View>
          </FormPageSection>
        </Animated.View>
      </ScrollView>

      <Animated.View entering={FadeInUp.delay(280).duration(280)} style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(16, insets.bottom + 8) }} className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-2">
        <Primary label={`Continue to payment · ${formatRupee(total)}`} onPress={() => setSuccess(true)} />
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
    </Animated.View>
  );
}

export default function TrialHome({ food, meal, dailyMeals = [], bread, rice, address, openSubscriptionOnLoad = false, openMealDetailOnLoad = false, lifecycleVariant = 'trial_active', onPaymentStatusPress, onProfilePress, onExploreMyPlanPress }: { food: string; meal: string; dailyMeals?: Array<{ lunch: string; dinner: string }>; bread: string; rice: string; address: string; openSubscriptionOnLoad?: boolean; openMealDetailOnLoad?: boolean; lifecycleVariant?: HomeLifecycleVariant; onPaymentStatusPress?: () => void; onProfilePress?: () => void; onExploreMyPlanPress?: () => void }) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const seed = useMemo(() => {
    if (lifecycleVariant.startsWith('subscription_')) {
      const week = subscriptionWeekMeals(food || 'Vegetarian', bread || 'Bhakri', rice || 'Jeera rice', meal || 'Lunch', address);
      if (lifecycleVariant === 'subscription_no_meal') return week.map((item, index) => index === 2 ? { ...item, isPlanDay: false } : item);
      if (lifecycleVariant === 'subscription_paused') return week.map((item) => item.isPlanDay === false ? item : { ...item, status: 'paused' as MealStatus, mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'paused' as MealStatus })) });
      if (lifecycleVariant === 'subscription_expired') return week.map((item) => ({ ...item, status: 'inactive' as MealStatus, mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'inactive' as MealStatus })) }));
      if (lifecycleVariant === 'subscription_renewal_failed') return week.map((item, index) => index === 2 ? { ...item, status: 'delivered' as MealStatus, mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'delivered' as MealStatus })) } : item);
      if (lifecycleVariant === 'subscription_delivery_delayed') return week.map((item, index) => index === 2 ? { ...item, mealType: 'Lunch' as const, status: 'delayed' as MealStatus, mealMarkers: item.mealMarkers?.map((marker, markerIndex) => ({ ...marker, status: markerIndex === 0 ? 'delayed' as MealStatus : 'upcoming' as MealStatus })) } : item);
      if (lifecycleVariant === 'subscription_delivery_failed') return week.map((item, index) => index === 2 ? { ...item, status: 'delivery_failed' as MealStatus, mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'delivery_failed' as MealStatus })) } : item);
      if (lifecycleVariant === 'subscription_scheduled') return week.map((item) => item.isPlanDay === false ? item : { ...item, status: 'upcoming' as MealStatus, mealMarkers: item.mealMarkers?.map((marker) => ({ ...marker, status: 'upcoming' as MealStatus })) });
      return week;
    }
    const trial = initialMeals(food || 'Vegetarian', bread || 'Bhakri', rice || 'Jeera rice', meal || 'Lunch', address, dailyMeals);
    if (lifecycleVariant === 'trial_payment_pending' || lifecycleVariant === 'trial_scheduled') return trial.map((item) => ({ ...item, status: 'upcoming' as MealStatus, items: undefined }));
    if (lifecycleVariant === 'trial_completed') return trial.map((item) => ({ ...item, status: 'delivered' as MealStatus, items: menu }));
    return trial;
  }, [address, bread, dailyMeals, food, lifecycleVariant, meal, rice]);
  const isSubscriptionHome = lifecycleVariant.startsWith('subscription_');
  const initiallySubscribed = (lifecycleVariant === 'trial_subscription_purchased' || isSubscriptionHome) && lifecycleVariant !== 'subscription_expired';
  const configs: Record<HomeLifecycleVariant, { eyebrow: string; title: string; description: string; caption?: string; selectedLabel: string }> = {
    trial_payment_pending: { eyebrow: 'Payment pending', title: 'Your trial payment is being checked', description: 'Your trial dates are saved while the payment confirmation is pending.', caption: 'Payment not confirmed', selectedLabel: 'First trial meal' },
    trial_scheduled: { eyebrow: 'Trial scheduled', title: 'Your trial starts soon', description: 'Your three selected trial dates are ready. Tap a meal-status circle to review details.', caption: 'Trial starts 27 July', selectedLabel: 'First trial meal' },
    trial_active: { eyebrow: 'Active trial', title: 'Your three-day trial', description: 'Tap a meal-status circle to view that meal’s details.', selectedLabel: 'Selected meal' },
    trial_subscription_purchased: { eyebrow: 'Active trial', title: 'Your three-day trial', description: 'Your subscription is ready and will begin after the final trial meal.', caption: 'Subscription starts after trial', selectedLabel: 'Selected meal' },
    trial_completed: { eyebrow: 'Trial complete', title: 'Your three-day trial is complete', description: 'Review your delivered meals or continue with a subscription.', caption: 'Trial completed', selectedLabel: 'Last trial meal' },
    subscription_scheduled: { eyebrow: 'Subscription scheduled', title: 'Your meals start soon', description: 'Your selected delivery days are ready for the coming week.', caption: 'Starts 26 July', selectedLabel: 'First selected meal' },
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
  const config = configs[lifecycleVariant];
  const planCard = lifecycleVariant === 'subscription_expired'
    ? { title: 'Restart your healthy meal routine', description: 'Choose a new plan while keeping your saved preferences and nutrition history.', buttonLabel: 'Renew Subscription' }
    : lifecycleVariant === 'subscription_renewal_failed'
      ? { title: 'Payment needs attention', description: 'Update your payment method to keep future subscription weeks active.', buttonLabel: 'Update Payment' }
      : lifecycleVariant === 'subscription_paused'
        ? { title: 'Your plan is paused', description: 'Your preferences and selected weekly schedule are saved until deliveries resume.', buttonLabel: 'Manage My Plan' }
        : undefined;
  const stateNotice = lifecycleVariant === 'trial_payment_pending'
    ? { title: 'Check Payment Status', body: 'Return to payment status to see whether your ₹899 trial payment is confirmed.', action: 'Check Payment Status' }
    : lifecycleVariant === 'subscription_delivery_delayed'
    ? { title: 'Delivery delayed', body: 'The 23 July delivery is delayed. The remaining selected delivery days are unchanged.', tone: 'orange' as const }
    : lifecycleVariant === 'subscription_delivery_failed'
      ? { title: 'Delivery needs attention', body: 'Check the 23 July delivery address or contact support to resolve it.', tone: 'red' as const }
      : lifecycleVariant === 'subscription_offline'
        ? { title: 'You are offline', body: 'This is your last saved weekly schedule. Changes will be available after reconnecting.', tone: 'blue' as const }
        : lifecycleVariant === 'subscription_ending'
          ? { title: 'Plan active until 20 August', body: 'Meals already included in your plan continue as scheduled.', tone: 'purple' as const, action: 'Re-subscribe to this plan' }
          : undefined;
  const [meals, setMeals] = useState(seed);
  const upcomingMeal = useMemo(() => {
    const eligible = planMealsFrom(meals);
    const today = demoStartOfDay();
    return eligible.find((item) => {
      if (item.status === 'delivered' || item.status === 'inactive' || item.status === 'skipped' || item.isSkipped) return false;
      return parseMealDate(item.date).getTime() >= today.getTime();
    }) ?? eligible[eligible.length - 1]!;
  }, [meals]);
  const [detailId, setDetailId] = useState(upcomingMeal.id);
  const [detailSlot, setDetailSlot] = useState<MealSlot>('lunch');
  const [sheetOpen, setSheetOpen] = useState(openMealDetailOnLoad);
  const [toast, setToast] = useState('');
  const [subscriptionOpen, setSubscriptionOpen] = useState(openSubscriptionOnLoad);
  const [subscription, setSubscription] = useState<{ plan: string; meal: string; total: number; startDate: string; endDate: Date } | null>(
    initiallySubscribed ? { plan: 'Monthly', meal, total: 5299, startDate: '26 July', endDate: demoAddDays(demoStartOfDay(), 14) } : null,
  );
  const eligibleMeals = meals.filter((item) => item.isPlanDay !== false);
  const selectedId = lifecycleVariant === 'subscription_expired'
    ? (eligibleMeals[Math.max(0, eligibleMeals.length - 2)]?.id ?? eligibleMeals[0]!.id)
    : upcomingMeal.id;
  const calendarSelectedId = lifecycleVariant === 'subscription_no_meal' ? (upcomingMeal.id) : selectedId;
  const selected = meals.find((item) => item.id === selectedId)!;
  const daysLeft = eligibleMeals.filter((item) => item.status !== 'delivered').length;
  const detailMeal = meals.find((item) => item.id === detailId) ?? selected;
  const updateMeal = (updated: TrialMeal) => setMeals((current) => current.map((item) => item.id === updated.id ? updated : item));
  const showToast = (text: string) => setToast(text);
  const planBoth = (subscription?.meal ?? meal) === 'Both';
  const defaultMealSlot = (target: TrialMeal): MealSlot => (
    planBoth ? 'lunch' : target.mealType === 'Dinner' ? 'dinner' : 'lunch'
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
          mealPreferenceOverride: markerMeta.mealPreferenceOverride,
          deliveryAddressOverride: markerMeta.deliveryAddressOverride,
        };
      });
    });
    setSubscription((current) => {
      const target = meals.find((item) => item.id === mealId);
      const slotIndex = target ? markerIndexForSlot(target, slot) : 0;
      const markerMeta = target?.mealMarkers?.[slotIndex]?.skipMetadata;
      if (!target || !markerMeta || !canUndoSkip({ meal: target, isSubscriptionMeal: isSubscriptionHome, isTrialMeal: !isSubscriptionHome, mealSlot: slot, planBoth })) return current;
      return current ? { ...current, endDate: restoredEndDate } : current;
    });
  };
  const subscriptionSheetTitle = lifecycleVariant === 'subscription_expired' ? 'Renew subscription' : 'Choose your subscription';
  const openPlan = () => {
    if (subscription && lifecycleVariant !== 'subscription_expired') {
      onExploreMyPlanPress?.();
      return;
    }
    setSubscriptionOpen(true);
  };
  const stateNoticeSurfaceClass = lifecycleVariant === 'trial_payment_pending' || lifecycleVariant === 'subscription_ending'
    ? 'rounded-field p-sheet bg-accent-soft'
    : lifecycleVariant === 'subscription_offline' || lifecycleVariant === 'subscription_delivery_failed' || lifecycleVariant === 'subscription_delivery_delayed'
      ? 'rounded-field p-sheet bg-warning-muted'
      : `rounded-field border p-sheet ${stateNotice?.tone === 'red' ? 'border-destructive bg-accent-soft' : stateNotice?.tone === 'orange' ? 'border-[#f59e0b] bg-accent-soft' : 'border-accent bg-accent-soft'}`;
  return <View className="flex-1 bg-canvas"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }}><View className="px-5">
    <Animated.Text entering={FadeInUp.delay(20).duration(240)} className="font-body text-body-sm tracking-body-sm text-accent">{config.eyebrow}</Animated.Text>
    <View className="gap-sheet-gap"><Animated.View entering={FadeInUp.delay(70).duration(260)}><View className="flex-row items-center justify-between gap-3"><Text className="flex-1 font-heading text-heading-md text-foreground">{config.title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => { setSheetOpen(false); onProfilePress?.(); }} className="size-icon-button items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={UserCircleIcon} size={24} weight="bold" /></Pressable></View></Animated.View><Animated.View entering={FadeInUp.delay(130).duration(260)}><FormPageSection subheading={config.description}><View className="gap-sheet-gap">{stateNotice ? <Animated.View entering={FadeInUp.delay(190).duration(260)} className={stateNoticeSurfaceClass}><Text className={`text-body-md text-foreground ${lifecycleVariant === 'subscription_offline' || lifecycleVariant === 'subscription_delivery_failed' || lifecycleVariant === 'subscription_delivery_delayed' || lifecycleVariant === 'subscription_ending' ? 'font-mono-semibold' : 'font-heading'}`}>{stateNotice.title}</Text><Text className="mt-1 font-body text-body-sm leading-5 text-muted">{stateNotice.body}</Text>{stateNotice.action ? <View className="mt-4">{lifecycleVariant === 'trial_payment_pending' ? <AccentSecondaryButton elevated label={stateNotice.action} onPress={onPaymentStatusPress ?? (() => showToast(stateNotice.action!))} /> : lifecycleVariant === 'subscription_ending' ? <AccentSecondaryButton elevated label={stateNotice.action} onPress={() => showToast('Re-subscription selected')} /> : <TrialAuthButton label={stateNotice.action} onPress={() => showToast('Re-subscription selected')} />}</View> : null}</Animated.View> : null}
    <Animated.View entering={FadeInUp.delay(210).duration(280)}><TrialDayTracker meals={meals} selectedId={calendarSelectedId} showBoth={planBoth} animateUpcoming={lifecycleVariant !== 'subscription_offline' && lifecycleVariant !== 'subscription_expired'} onSelectDate={() => {}} onOpenMeal={(item, slot) => { setDetailId(item.id); setDetailSlot(slot); setSheetOpen(true); }} /></Animated.View>
    <Animated.View entering={FadeInUp.delay(290).duration(280)}><SubscriptionCard active={!!subscription} daysLeft={daysLeft} caption={config.caption} title={planCard?.title} description={planCard?.description} buttonLabel={planCard?.buttonLabel} onPress={openPlan} /></Animated.View>
    <Animated.View entering={FadeInUp.delay(370).duration(280)} className="rounded-field border border-border bg-canvas p-sheet"><View className="flex-row items-start justify-between gap-3"><View className="flex-1"><Text className="font-body text-body-sm tracking-body-sm text-muted">{config.selectedLabel}</Text><Text className="mt-2 font-heading text-heading-sm text-foreground">{selected.date}</Text><Text className="mt-1 font-body text-body-sm leading-5 text-muted">{planBoth ? 'Lunch & dinner' : selected.mealType} · {selected.addressLabel}</Text></View><StatusBadge status={selected.status} /></View><View className="mt-5"><HomeSecondaryButton label="View meal details" onPress={() => { setDetailId(selected.id); setDetailSlot(defaultMealSlot(selected)); setSheetOpen(true); }} /></View></Animated.View></View></FormPageSection></Animated.View></View>
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
        onUpdate={updateMeal}
        onSkipMeal={skipMeal}
        onUndoSkip={undoSkipMeal}
        onToast={showToast}
      />
    ) : null}
    {subscriptionOpen ? <SubscriptionSheet food={food} bread={bread} rice={rice} address={address} initialMeal={meal} dailyMeals={dailyMeals} sheetTitle={subscriptionSheetTitle} onClose={() => setSubscriptionOpen(false)} onToast={showToast} onExploreMyPlanPress={onExploreMyPlanPress} onActivated={(plan, selectedMeal, total, startDate) => { setSubscription({ plan, meal: selectedMeal, total, startDate, endDate: demoAddDays(demoStartOfDay(), 14) }); showToast(`${plan} plan activated for ${selectedMeal}`); }} /> : null}
    {toast ? <Toast message={toast} onDismiss={() => setToast('')} /> : null}
  </View>;
}
