import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated as NativeAnimated, Image, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { type Icon, type IconWeight } from 'phosphor-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { LockKeyIcon } from 'phosphor-react-native/src/icons/LockKey';
import { PauseIcon } from 'phosphor-react-native/src/icons/Pause';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { UserCircleIcon } from 'phosphor-react-native/src/icons/UserCircle';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { themePalette } from './themeColors';

const mealPhoto = require('../assets/food-thali.png');

type GlyphTone = 'foreground' | 'muted' | 'accent' | 'success' | 'canvas' | 'border' | 'white';
function HomeGlyph({ icon: Glyph, size = 20, weight = 'regular', tone = 'foreground' }: { icon: Icon; size?: number; weight?: IconWeight; tone?: GlyphTone }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const palette = themePalette[dark ? 'dark' : 'light'];
  const colors: Record<GlyphTone, string> = { foreground: dark ? '#ffffff' : '#101010', muted: dark ? '#ababab' : '#5e5e5e', accent: palette.accent, success: palette.success, canvas: dark ? '#0e0e0e' : '#ffffff', border: dark ? '#242424' : '#eeeeee', white: '#ffffff' };
  return <Glyph size={Math.max(8, size - 4)} weight={weight === 'fill' ? 'fill' : 'bold'} color={colors[tone]} />;
}

export type MealStatus = 'delivered' | 'upcoming' | 'paused' | 'inactive' | 'issue' | 'delayed' | 'delivery_failed';
type MealMarker = { foodPreference: string; status: MealStatus };
type Nutrition = { calories: string; protein: string; carbohydrates: string; fat: string; fibre: string; sodium: string };
type MealItem = { name: string; serving: string; calories: string; protein: string };
type TrialMeal = {
  id: string; date: string; dayLabel: string; shortDate: string; mealType: 'Lunch' | 'Dinner'; status: MealStatus;
  foodPreference: string; breadPreference: string; ricePreference: string; addressLabel: string; address: string;
  deliveryNote?: string; items?: MealItem[]; nutrition: Nutrition; rating?: number; feedbackTags?: string[]; feedbackNote?: string; isPlanDay?: boolean; mealMarkers?: MealMarker[];
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

export const TRIAL_DAY_COUNT = 3;

const initialMeals = (food: string, bread: string, rice: string, meal: string, address: string, dailyMeals: Array<{ lunch: string; dinner: string }> = []): TrialMeal[] => [
  { id: '21', date: 'Monday, 21 July', dayLabel: 'MON', shortDate: '21', mealType: 'Lunch', status: 'delivered', foodPreference: dailyMeals[0]?.lunch || food, breadPreference: bread, ricePreference: rice, addressLabel: 'Home', address, deliveryNote: 'Leave with security if unavailable.', items: menu, nutrition },
  { id: '22', date: 'Tuesday, 22 July', dayLabel: 'TUE', shortDate: '22', mealType: 'Lunch', status: 'delivered', foodPreference: dailyMeals[1]?.lunch || food, breadPreference: bread, ricePreference: rice, addressLabel: 'Home', address, items: menu, nutrition },
  { id: '23', date: 'Wednesday, 23 July', dayLabel: 'WED', shortDate: '23', mealType: meal === 'Dinner' ? 'Dinner' : 'Lunch', status: 'upcoming', foodPreference: dailyMeals[2]?.lunch || food, breadPreference: bread, ricePreference: rice, addressLabel: 'Home', address, nutrition },
];

const subscriptionWeekMeals = (food: string, bread: string, rice: string, meal: string, address: string): TrialMeal[] => {
  const days = [
    ['21', 'Monday, 21 July', 'MON', true], ['22', 'Tuesday, 22 July', 'TUE', true], ['23', 'Wednesday, 23 July', 'WED', true],
    ['24', 'Thursday, 24 July', 'THU', true], ['25', 'Friday, 25 July', 'FRI', true], ['26', 'Saturday, 26 July', 'SAT', false], ['27', 'Sunday, 27 July', 'SUN', false],
  ] as const;
  return days.map(([id, date, dayLabel, isPlanDay], index) => ({
    id: `sub-${id}`, date, dayLabel, shortDate: id, mealType: meal === 'Dinner' ? 'Dinner' : 'Lunch', status: index < 2 ? 'delivered' : 'upcoming',
    foodPreference: food, breadPreference: bread, ricePreference: rice, addressLabel: 'Home', address, nutrition, items: index < 2 ? menu : undefined, isPlanDay,
    mealMarkers: meal === 'Both'
      ? [{ foodPreference: index % 2 === 0 ? 'Vegetarian' : 'Non-vegetarian', status: index < 2 ? 'delivered' : index === 2 ? 'delivered' : 'upcoming' }, { foodPreference: 'Non-vegetarian', status: index < 2 ? 'delivered' : 'upcoming' }]
      : [{ foodPreference: food, status: index < 2 ? 'delivered' : 'upcoming' }],
  }));
};

function Primary({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const [width, setWidth] = useState(0);
  const shimmer = useRef(new NativeAnimated.Value(-80)).current;
  useEffect(() => { if (!width) return; shimmer.setValue(-80); const animation = NativeAnimated.loop(NativeAnimated.sequence([NativeAnimated.timing(shimmer, { toValue: width + 80, duration: 1500, useNativeDriver: true }), NativeAnimated.delay(1700)])); animation.start(); return () => animation.stop(); }, [shimmer, width]);
  return <Pressable accessibilityRole="button" onPress={onPress} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ alignSelf: 'stretch' }} className="h-14 items-center justify-center overflow-hidden rounded-xl">{width > 0 ? <Svg pointerEvents="none" width={width} height={56} preserveAspectRatio="none" style={StyleSheet.absoluteFill}><Defs><LinearGradient id="primaryButtonGradient" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={dark ? '#FFFFFF' : '#4D4D4D'} /><Stop offset="1" stopColor={dark ? '#888888' : '#000000'} /></LinearGradient></Defs><Rect width={width} height={56} fill="url(#primaryButtonGradient)" /></Svg> : null}<NativeAnimated.View pointerEvents="none" style={{ transform: [{ translateX: shimmer }, { rotate: '18deg' }] }} className={`absolute -top-5 h-24 w-10 ${dark ? 'bg-white/30' : 'bg-white/25'}`} /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76} style={{ zIndex: 1, paddingHorizontal: 16 }} className={`w-full text-center font-bold text-base ${dark ? 'text-black' : 'text-white'}`}>{label}</Text></Pressable>;
}

function BottomToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const translateX = useRef(new NativeAnimated.Value(0)).current;
  const translateY = useRef(new NativeAnimated.Value(24)).current;
  const opacity = useRef(new NativeAnimated.Value(0)).current;
  const dismissing = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = (direction: 'down' | 'left' | 'right' = 'down') => {
    if (dismissing.current) return;
    dismissing.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    NativeAnimated.parallel([
      NativeAnimated.timing(translateX, {
        toValue: direction === 'left' ? -screenWidth : direction === 'right' ? screenWidth : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      NativeAnimated.timing(translateY, {
        toValue: direction === 'down' ? 24 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      NativeAnimated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDismiss();
    });
  };

  useEffect(() => {
    NativeAnimated.parallel([
      NativeAnimated.timing(translateY, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
      NativeAnimated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) timeoutRef.current = setTimeout(() => dismiss('down'), 5000);
    });
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || gesture.dy > 4,
    onPanResponderMove: (_, gesture) => {
      const verticalDistance = Math.max(0, gesture.dy);
      translateX.setValue(gesture.dx);
      translateY.setValue(verticalDistance);
      opacity.setValue(Math.max(0, 1 - Math.max(Math.abs(gesture.dx), verticalDistance) / 140));
    },
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > 50 || Math.abs(gesture.vx) > 0.65) {
        dismiss(gesture.dx < 0 || gesture.vx < -0.65 ? 'left' : 'right');
        return;
      }
      if (gesture.dy > 40 || gesture.vy > 0.65) {
        dismiss('down');
        return;
      }
      NativeAnimated.parallel([
        NativeAnimated.timing(translateX, { toValue: 0, duration: 160, useNativeDriver: true }),
        NativeAnimated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
        NativeAnimated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    },
    onPanResponderTerminate: () => {
      NativeAnimated.parallel([
        NativeAnimated.timing(translateX, { toValue: 0, duration: 160, useNativeDriver: true }),
        NativeAnimated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
        NativeAnimated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    },
  })).current;

  return <NativeAnimated.View
    {...panResponder.panHandlers}
    accessibilityRole="alert"
    style={{ bottom: 48, backgroundColor: '#064E3B', opacity, transform: [{ translateX }, { translateY }] }}
    className="absolute inset-x-5 z-[80] rounded-full px-5 py-4"
  >
    <Text className="font-semibold text-center text-white">{message}</Text>
  </NativeAnimated.View>;
}

function Overlay({ children, onClose, level = 40 }: { children: React.ReactNode; onClose: () => void; level?: number }) {
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0} style={{ zIndex: level }} className="absolute inset-0 justify-end"><BlurView intensity={Platform.OS === 'android' ? 24 : 32} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'} style={StyleSheet.absoluteFill} /><View pointerEvents="none" className="absolute inset-0 bg-black/30" /><Pressable accessibilityRole="button" accessibilityLabel="Close overlay" className="absolute inset-0" onPress={onClose} />{children}</KeyboardAvoidingView>;
}

function SheetFrame({ children, onClose, title = 'Meal details' }: { children: React.ReactNode; onClose: () => void; title?: string }) {
  const insets = useSafeAreaInsets();
  return <Animated.View entering={FadeInUp.duration(260)} style={{ marginTop: insets.top + 16, marginBottom: 16 }} className="mx-4 max-h-[94%] flex-1 overflow-hidden rounded-[20px] bg-canvas">
    <View className="h-16 flex-row items-center px-5"><Animated.Text entering={FadeInUp.delay(30).duration(240)} className="font-semibold text-2xl text-foreground">{title}</Animated.Text><Pressable accessibilityRole="button" accessibilityLabel={`Close ${title.toLowerCase()}`} onPress={onClose} className="absolute right-3 h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={XIcon} size={20} weight="bold" /></Pressable></View>
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
    <NativeAnimated.View style={{ height: headerHeight, paddingTop: headerPaddingTop }} className="flex-row items-center px-5"><Text className="font-semibold text-2xl text-foreground">{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Close ${title.toLowerCase()}`} onPress={onClose} className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={XIcon} size={20} weight="bold" /></Pressable></NativeAnimated.View>
    <View className="flex-1">{children(controls)}</View>
  </NativeAnimated.View>;
}

function StatusBadge({ status }: { status: MealStatus }) {
  const label = status === 'delivery_failed' ? 'Delivery failed' : status[0]!.toUpperCase() + status.slice(1);
  const warning = status === 'upcoming' || status === 'delayed';
  const danger = status === 'delivery_failed' || status === 'issue';
  return <View className={`rounded-full px-3 py-1.5 ${status === 'delivered' ? 'bg-success-soft' : warning ? 'bg-yellow-100 dark:bg-yellow-900/60' : danger ? 'bg-red-100 dark:bg-red-950' : 'bg-surface-raised'}`}><Text className={`font-semibold text-xs ${status === 'delivered' ? 'text-success' : warning ? 'text-yellow-800 dark:text-yellow-300' : danger ? 'text-red-700 dark:text-red-300' : 'text-foreground'}`}>{label}</Text></View>;
}

function UpcomingRipple({ color = 'green' }: { color?: 'green' | 'red' | 'orange' }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const scale = useRef(new NativeAnimated.Value(0.8)).current;
  const opacity = useRef(new NativeAnimated.Value(0.55)).current;
  useEffect(() => { const animation = NativeAnimated.loop(NativeAnimated.parallel([NativeAnimated.timing(scale, { toValue: 1.65, duration: 1400, useNativeDriver: true }), NativeAnimated.timing(opacity, { toValue: 0, duration: 1400, useNativeDriver: true })])); animation.start(); return () => animation.stop(); }, [opacity, scale]);
  return <NativeAnimated.View pointerEvents="none" style={{ opacity, transform: [{ scale }], borderColor: color === 'red' ? '#dc2626' : color === 'orange' ? '#f59e0b' : themePalette[dark ? 'dark' : 'light'].accent, backgroundColor: 'transparent' }} className="absolute h-7 w-7 rounded-full border-2" />;
}

function TrialDayTracker({ meals, selectedId, showBoth, animateUpcoming = true, onSelectDate, onOpenMeal }: { meals: TrialMeal[]; selectedId: string; showBoth: boolean; animateUpcoming?: boolean; onSelectDate: (meal: TrialMeal) => void; onOpenMeal: (meal: TrialMeal) => void }) {
  let upcomingRippleAssigned = false;
  return <View className="w-full flex-row">{meals.map((meal) => { const excluded = meal.isPlanDay === false; const selected = meal.id === selectedId; const markers = meal.mealMarkers?.slice(0, showBoth ? 2 : 1) ?? Array.from({ length: showBoth ? 2 : 1 }, () => ({ foodPreference: meal.foodPreference, status: meal.status })); return <View key={meal.id} className="flex-1 items-center"><Pressable disabled={excluded} accessibilityRole="button" accessibilityLabel={excluded ? `${meal.date}, no meal selected` : `Select ${meal.date}`} accessibilityState={{ selected, disabled: excluded }} onPress={() => onSelectDate(meal)} className={`h-14 w-full max-w-[46px] items-center justify-center rounded-[14px] border ${selected ? 'border-accent/10 bg-accent/10' : excluded ? 'border-surface bg-surface opacity-45' : 'border-surface bg-surface'}`}><Text className={`font-bold text-lg ${selected ? 'text-accent' : excluded ? 'text-muted' : 'text-foreground'}`}>{meal.shortDate}</Text><Text className="mt-0.5 font-medium text-[11px] text-muted">{meal.dayLabel}</Text></Pressable><View className="mt-2 items-center gap-1">{markers.map((marker, markerIndex) => { const nonVeg = marker.foodPreference.toLowerCase().includes('non'); const delayed = marker.status === 'delayed'; const failed = marker.status === 'delivery_failed' || marker.status === 'issue'; const active = animateUpcoming && !excluded && !upcomingRippleAssigned && (marker.status === 'upcoming' || delayed); if (active) upcomingRippleAssigned = true; const delivered = marker.status === 'delivered'; const borderColor = excluded || marker.status === 'inactive' || marker.status === 'paused' ? '#d8d8d8' : failed ? '#dc2626' : delayed ? '#f59e0b' : nonVeg ? '#dc2626' : '#078a4b'; return <Pressable key={`${meal.id}-${markerIndex}`} disabled={excluded} accessibilityRole="button" accessibilityLabel={`${markerIndex === 0 ? 'Lunch' : 'Dinner'}, ${marker.foodPreference}, ${marker.status}`} onPress={() => onOpenMeal(meal)} className={`h-7 w-9 items-center justify-center ${excluded ? 'opacity-45' : ''}`}>{active ? <UpcomingRipple color={delayed ? 'orange' : nonVeg ? 'red' : 'green'} /> : null}<View style={{ borderColor, backgroundColor: delivered || failed ? borderColor : 'transparent' }} className="h-5 w-5 items-center justify-center rounded-full border-[3px]">{delivered && !excluded ? <HomeGlyph icon={CheckIcon} size={16} weight="bold" tone="white" /> : failed && !excluded ? <HomeGlyph icon={XIcon} size={15} weight="bold" tone="white" /> : null}</View></Pressable>; })}</View></View>; })}</View>;
}

function PreferenceSummary({ meal, onEdit }: { meal: TrialMeal; onEdit?: () => void }) { return <View><View className="flex-row items-center justify-between"><Text className="font-semibold text-xl text-foreground">Selected preferences</Text>{onEdit ? <Pressable accessibilityLabel="Edit preferences for this meal" onPress={onEdit} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={PencilSimpleIcon} size={18} /></Pressable> : null}</View><View className="mt-3 gap-2"><Meta label="Food" value={meal.foodPreference} /><Meta label="Meal" value={meal.mealType} /><Meta label="Bread" value={meal.breadPreference} /><Meta label="Rice" value={meal.ricePreference} /></View></View>; }
function Meta({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) { return <View className="flex-row justify-between gap-4"><Text className="font-sans text-[15px] leading-6 text-muted">{label}</Text><Text className={`max-w-[62%] font-medium text-right leading-6 text-foreground ${compact ? 'text-[15px]' : 'text-lg'}`}>{value}</Text></View>; }

function NutritionSection({ meal }: { meal: TrialMeal }) {
  return <View><Text className="font-semibold text-xl text-foreground">Nutrition summary</Text><View className="mt-3 gap-2"><Meta label="Calories" value={meal.nutrition.calories} /><Meta label="Protein" value={meal.nutrition.protein} /><Meta label="Carbohydrates" value={meal.nutrition.carbohydrates} /><Meta label="Fat" value={meal.nutrition.fat} /><Meta label="Fibre" value={meal.nutrition.fibre} /><Meta label="Sodium" value={meal.nutrition.sodium} /></View><Text className="mt-3 font-sans text-xs leading-5 text-muted">Nutritional values are approximate and may vary based on portion size, ingredients and preparation method.</Text></View>;
}

function FloatingNav({ active, onChange }: { active: 'home' | 'profile'; onChange: (tab: 'home' | 'profile') => void }) {
  const noShadow = { elevation: 0, shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } } as const;
  const tabs = [{ id: 'home' as const, icon: HouseIcon, label: 'Home' }, { id: 'profile' as const, icon: UserCircleIcon, label: 'Profile' }];
  const content = <View className={`flex-1 flex-row p-1.5 ${Platform.OS === 'android' ? 'bg-surface-raised/40' : 'bg-surface-raised/55'}`}>{tabs.map(({ id, icon, label }) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: active === id }} accessibilityLabel={label} onPress={() => onChange(id)} className={`flex-1 flex-row items-center justify-center gap-2 rounded-full ${active === id ? 'bg-foreground' : ''}`}><HomeGlyph icon={icon} size={20} weight={active === id ? 'fill' : 'regular'} tone={active === id ? 'canvas' : 'foreground'} /><Text className={`font-semibold text-sm ${active === id ? 'text-canvas' : 'text-foreground'}`}>{label}</Text></Pressable>)}</View>;
  return <View pointerEvents="box-none" style={{ bottom: 20 }} className="absolute inset-x-0 z-30 items-center"><View style={noShadow} className="h-16 w-[220px] overflow-hidden rounded-full">{isLiquidGlassAvailable() ? <GlassView glassEffectStyle="regular" isInteractive style={[StyleSheet.absoluteFill, noShadow]}>{content}</GlassView> : <View style={noShadow} className="flex-1"><BlurView intensity={Platform.OS === 'android' ? 8 : 55} tint="default" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'} style={[StyleSheet.absoluteFill, noShadow]} /><View className={`absolute inset-0 ${Platform.OS === 'android' ? 'bg-surface-raised/15' : 'bg-surface-raised/20'}`} />{content}</View>}</View></View>;
}

const feedbackOptions = ['Tasty', 'Good quantity', 'Fresh', 'Well packed', 'Too spicy', 'Less quantity', 'Packaging issue', 'Arrived cold'];
function Feedback({ meal, onSave, onToast, onFocusTellMore }: { meal: TrialMeal; onSave: (rating: number, tags: string[], note: string) => void; onToast: (text: string) => void; onFocusTellMore: () => void }) {
  const [rating, setRating] = useState(meal.rating ?? 0); const [tags, setTags] = useState(meal.feedbackTags ?? []); const [note, setNote] = useState(meal.feedbackNote ?? ''); const [editing, setEditing] = useState(!meal.rating);
  if (!editing) return <View className="rounded-[16px] bg-success-soft p-4"><Text className="font-semibold text-success">Thanks for your feedback</Text><Text className="mt-1 font-sans text-[15px] leading-6 text-muted">Your meal rating has been saved locally.</Text><Pressable accessibilityRole="button" onPress={() => setEditing(true)} className="mt-2 min-h-11 justify-center"><Text className="font-semibold text-accent">Edit feedback</Text></Pressable></View>;
  return <View><Text className="font-semibold text-xl text-foreground">How was your meal?</Text><View className="mt-3 flex-row">{[1,2,3,4,5].map((star) => <Pressable key={star} accessibilityRole="radio" accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`} accessibilityState={{ checked: rating === star }} onPress={() => setRating(star)} className="h-11 w-11 items-center justify-center"><HomeGlyph icon={StarIcon} size={30} weight={star <= rating ? 'fill' : 'regular'} tone={star <= rating ? 'accent' : 'muted'} /></Pressable>)}</View><View className="mt-3 flex-row flex-wrap gap-2">{feedbackOptions.map((tag) => { const active = tags.includes(tag); return <Pressable key={tag} onPress={() => setTags(active ? tags.filter((item) => item !== tag) : [...tags, tag])} className={`min-h-11 justify-center rounded-full border px-3 ${active ? 'border-accent bg-accent' : 'border-border'}`}><Text className={`font-medium text-xs ${active ? 'text-white dark:text-black' : 'text-foreground'}`}>{tag}</Text></Pressable>; })}</View><TextInput value={note} onChangeText={setNote} onFocus={onFocusTellMore} multiline placeholder="Optional feedback" placeholderTextColor="#8b8a84" className="mt-4 min-h-[92px] rounded-xl border border-border bg-sheet p-4 font-sans text-foreground" /><View className="mt-4"><Primary label="Submit feedback" onPress={() => { if (!rating) { onToast('Choose a rating first'); return; } onSave(rating, tags, note); setEditing(false); onToast('Feedback saved'); }} /></View></View>;
}

const issueCategories = ['Meal missing', 'Wrong meal', 'Bread preference not followed', 'Rice preference not followed', 'Food quality issue', 'Packaging issue', 'Delivery issue', 'Other'];
function IssueSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  const [category, setCategory] = useState(issueCategories[0]!); const [description, setDescription] = useState('');
  return <Overlay onClose={onClose} level={60}><SheetFrame onClose={onClose} title="Report an issue"><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 32 }}><Text className="font-semibold text-2xl leading-8 text-foreground">What went wrong?</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Choose the problem that best describes this meal.</Text><View className="mt-5 flex-row flex-wrap gap-2">{issueCategories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} className={`min-h-11 justify-center rounded-full border px-3 ${category === item ? 'border-accent bg-accent' : 'border-border'}`}><Text className={category === item ? 'font-medium text-xs text-white dark:text-black' : 'font-medium text-xs text-foreground'}>{item}</Text></Pressable>)}</View><TextInput value={description} onChangeText={setDescription} multiline placeholder="Optional description" placeholderTextColor="#8b8a84" className="mt-5 min-h-[100px] rounded-xl border border-border bg-sheet p-4 font-sans text-foreground" /><Pressable accessibilityRole="button" className="mt-4 h-24 items-center justify-center rounded-xl border border-border bg-sheet"><View className="flex-row items-center gap-2"><HomeGlyph icon={PlusIcon} size={18} weight="bold" tone="muted" /><Text className="font-semibold text-muted">Add photo</Text></View><Text className="mt-1 font-sans text-xs text-muted">Local placeholder</Text></Pressable><View className="mt-5"><Primary label="Submit issue" onPress={onSubmit} /></View></ScrollView></KeyboardAvoidingView></SheetFrame></Overlay>;
}

function PauseSheet({ meal, onClose, onConfirm }: { meal: TrialMeal; onClose: () => void; onConfirm: () => void }) {
  return <Overlay onClose={onClose} level={60}><Animated.View entering={FadeInUp.duration(220)} className="mx-4 mb-4 rounded-[20px] bg-canvas p-5"><Text className="font-semibold text-2xl text-foreground">Pause this meal?</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{meal.date} · {meal.mealType}. You can reactivate it later during this preview.</Text><View className="mt-6"><Primary label="Confirm pause" onPress={onConfirm} /></View><Pressable accessibilityRole="button" onPress={onClose} className="mt-2 h-12 items-center justify-center"><Text className="font-semibold text-foreground">Keep meal active</Text></Pressable></Animated.View></Overlay>;
}

const serviceablePins = new Set(['411001', '411007', '411014', '411021', '411027', '411038', '411045', '411057']);

function ChangeAddressSheet({ meal, onClose, onSave, onChangeDate }: { meal: TrialMeal; onClose: () => void; onSave: (address: string) => void; onChangeDate: () => void }) {
  const [pin, setPin] = useState('');
  const [address, setAddress] = useState(meal.address);
  const checked = pin.length === 6;
  const available = checked && serviceablePins.has(pin);
  return <Overlay onClose={onClose} level={65}><Animated.View entering={FadeInUp.duration(220)} className="mx-4 mb-4 rounded-[20px] bg-canvas p-5">
    <View className="flex-row items-center justify-between"><Text className="font-semibold text-2xl text-foreground">Change delivery address</Text><Pressable accessibilityLabel="Close address editor" onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={XIcon} size={20} /></Pressable></View>
    <Text className="mt-2 font-sans text-[15px] leading-6 text-muted">We’ll confirm that the new PIN code is available before changing this meal.</Text>
    <TextInput autoFocus value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="6-digit PIN code" placeholderTextColor="#8b8a84" className="mt-5 h-14 rounded-xl bg-surface px-4 font-semibold text-lg text-foreground" />
    {checked && !available ? <View className="mt-4 rounded-[16px] bg-surface p-4"><Text className="font-semibold text-foreground">Delivery isn’t available at this PIN code.</Text><Text className="mt-1 font-sans text-[15px] leading-6 text-muted">You can move this meal to another available delivery date.</Text><Pressable onPress={onChangeDate} className="mt-3 min-h-11 justify-center"><Text className="font-semibold text-accent">Change delivery date</Text></Pressable></View> : null}
    {available ? <><TextInput value={address} onChangeText={setAddress} placeholder="Full delivery address" placeholderTextColor="#8b8a84" className="mt-4 min-h-14 rounded-xl bg-surface px-4 font-semibold text-lg text-foreground" /><View className="mt-5"><Primary label="Save address" onPress={() => onSave(`${address.trim()} · ${pin}`)} /></View></> : null}
  </Animated.View></Overlay>;
}

function ChangeDateSheet({ meal, hasRemaining, onClose, onSave }: { meal: TrialMeal; hasRemaining: boolean; onClose: () => void; onSave: (date: Date, applyRemaining: boolean) => void }) {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const options = Array.from({ length: 14 }, (_, index) => { const date = new Date(tomorrow); date.setDate(tomorrow.getDate() + index); return date; });
  const [selected, setSelected] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState(false);
  const commit = (applyRemaining: boolean) => selected && onSave(selected, applyRemaining);
  const selectedLabel = selected?.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  return <Overlay onClose={onClose} level={66}><Animated.View entering={FadeInUp.duration(220)} className="mx-4 mb-4 rounded-[20px] bg-canvas p-5">
    <View className="flex-row items-center gap-3"><Text style={{ flexShrink: 1 }} className="flex-1 font-semibold text-xl leading-7 text-foreground">{confirming ? 'Change remaining meals too?' : 'Change delivery date'}</Text><Pressable accessibilityLabel="Close date editor" onPress={onClose} className="h-10 w-10 shrink-0 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={XIcon} size={20} /></Pressable></View>
    {confirming ? <><Text className="mt-3 font-sans text-[15px] leading-6 text-muted">Change this delivery from {meal.date} to {selectedLabel}. Would you like to move the remaining trial meals too?</Text><View className="mt-6"><Primary label="Only this meal" onPress={() => commit(false)} /></View><Pressable onPress={() => commit(true)} className="mt-3 h-14 w-full items-center justify-center rounded-xl border border-border"><Text className="font-semibold text-center text-foreground">Change this and remaining meals</Text></Pressable></> : <><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Change the delivery scheduled for {meal.date} to a new date.</Text><View className="mt-5 flex-row flex-wrap gap-2">{options.map((date) => { const active = selected?.getTime() === date.getTime(); return <Pressable key={date.toISOString()} onPress={() => setSelected(date)} className={`min-w-[88px] rounded-xl border p-3 ${active ? 'border-[3px] border-accent bg-accent/10' : 'border-border bg-surface'}`}><Text className="font-semibold text-center text-foreground">{date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text><Text className="mt-1 text-center text-xs text-muted">{date.toLocaleDateString('en-IN', { weekday: 'short' })}</Text></Pressable>; })}</View><View className="mt-6"><Primary label="Continue" onPress={() => selected && (hasRemaining ? setConfirming(true) : commit(false))} /></View></>}
  </Animated.View></Overlay>;
}

let updateTrialMealDate: ((mealId: string, date: Date, applyRemaining: boolean) => void) | null = null;

function MealPreferencePage({ meal, onClose, onSave }: { meal: TrialMeal; onClose: () => void; onSave: (meal: TrialMeal) => void }) {
  const insets = useSafeAreaInsets();
  const [food, setFood] = useState(meal.foodPreference);
  const [bread, setBread] = useState(meal.breadPreference);
  const [rice, setRice] = useState(meal.ricePreference);
  const group = (title: string, values: string[], value: string, setValue: (value: string) => void) => <View className="mt-7"><Text className="mb-3 font-semibold text-lg text-foreground">{title}</Text><View className="flex-row flex-wrap gap-2">{values.map((option) => <Pressable key={option} onPress={() => setValue(option)} className={`min-h-12 justify-center rounded-xl border px-4 ${value === option ? 'border-[3px] border-accent bg-accent/10' : 'border-border bg-surface'}`}><Text className="font-semibold text-foreground">{option}</Text></Pressable>)}</View></View>;
  return <Animated.View entering={FadeIn.duration(180)} className="absolute inset-0 z-[70] bg-canvas"><View style={{ paddingTop: insets.top + 8 }} className="flex-row items-center justify-between px-5 pb-3"><View><Text className="font-semibold text-[24px] text-foreground">Edit meal preferences</Text><Text className="mt-1 text-sm text-muted">Only for {meal.date}</Text></View><Pressable onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={XIcon} size={20} /></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>{group('Food', ['Vegetarian', 'Non-vegetarian'], food, setFood)}{group('Bread', ['Chapati', 'Bhakri', 'Any'], bread, setBread)}{group('Rice', ['Plain Rice', 'Jeera Rice', 'Any'], rice, setRice)}</ScrollView><View style={{ paddingBottom: Math.max(16, insets.bottom + 8) }} className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-3"><Primary label="Save for this meal" onPress={() => onSave({ ...meal, foodPreference: food, breadPreference: bread, ricePreference: rice })} /></View></Animated.View>;
}

function MealDetailSheet({ meal, hasRemaining = true, onClose, onUpdate, onChangeDate, onToast }: { meal: TrialMeal; hasRemaining?: boolean; onClose: () => void; onUpdate: (meal: TrialMeal) => void; onChangeDate?: (date: Date, applyRemaining: boolean) => void; onToast: (text: string) => void }) {
  const insets = useSafeAreaInsets(); const [issueOpen, setIssueOpen] = useState(false); const [addressOpen, setAddressOpen] = useState(false); const [dateOpen, setDateOpen] = useState(false); const [preferencesOpen, setPreferencesOpen] = useState(false); const contentRef = useRef<ScrollView>(null);
  const mockAction = (label: string) => onToast(`${label} selected`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mealDate = new Date(`${meal.date} ${now.getFullYear()}`);
  const daysUntilMeal = Math.round((mealDate.getTime() - today.getTime()) / 86400000);
  const preferenceLocked = daysUntilMeal < 1 || (daysUntilMeal === 1 && now.getHours() >= 20);
  const deliveryCancelled = meal.status === 'delivery_failed' || meal.status === 'issue';
  return <Animated.View entering={FadeIn.duration(180)} className="absolute inset-0 z-50 bg-canvas"><View style={{ paddingTop: insets.top + 8 }} className="h-auto min-h-16 flex-row items-end justify-between px-5 pb-3"><Text className="font-semibold text-[24px] text-foreground">Meal details</Text><Pressable accessibilityLabel="Close meal details" onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={XIcon} size={20} /></Pressable></View><ScrollView ref={contentRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
    <View className="h-52 items-center justify-center overflow-hidden rounded-[16px] bg-surface"><Image source={mealPhoto} accessibilityLabel="Plate with meal ingredients" resizeMode="contain" className="h-48 w-48" /></View>
    <View className="mt-6 flex-row items-start justify-between gap-3"><View className="flex-1"><Text className="font-semibold text-2xl leading-8 text-foreground">{meal.date}</Text><Text className="mt-1 font-sans text-[15px] leading-6 text-muted">{meal.mealType} · {meal.foodPreference}</Text></View><StatusBadge status={meal.status} /></View>
    <View className="my-7 h-px bg-border" /><Text className="font-semibold text-xl text-foreground">{meal.status === 'delivered' ? `Delivered to ${meal.addressLabel}` : deliveryCancelled ? `Delivery attempted at ${meal.addressLabel}` : `Delivering to ${meal.addressLabel}`}</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{meal.address}</Text>{meal.deliveryNote ? <Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Note · {meal.deliveryNote}</Text> : null}
    {meal.status === 'delivered' ? <><View className="my-7 h-px bg-border" /><Text className="font-semibold text-xl text-foreground">Today’s tiffin</Text><Text className="mt-3 font-sans text-base leading-7 text-muted">{meal.items?.map((item) => item.name).join(", ")}</Text><View className="my-7 h-px bg-border" /><NutritionSection meal={meal} /><View className="my-7 h-px bg-border" /><PreferenceSummary meal={meal} /><View className="my-7 h-px bg-border" /><Feedback meal={meal} onSave={(rating, tags, note) => onUpdate({ ...meal, rating, feedbackTags: tags, feedbackNote: note })} onToast={onToast} onFocusTellMore={() => setTimeout(() => contentRef.current?.scrollToEnd({ animated: true }), 180)} /></> : deliveryCancelled ? <><View className="my-7 h-px bg-border" /><PreferenceSummary meal={meal} /><Text className="mt-4 font-sans text-[15px] leading-6 text-muted">This past delivery was cancelled. Its preferences, delivery date and delivery address can no longer be changed.</Text></> : <><View className="my-7 h-px bg-border" /><PreferenceSummary meal={meal} onEdit={preferenceLocked ? undefined : () => setPreferencesOpen(true)} />{preferenceLocked ? <Text className="mt-3 font-sans text-[13px] leading-5 text-muted">Tomorrow’s meal preferences can be changed only until 8:00 PM. Preferences for later meals remain editable.</Text> : null}<Text className="mt-4 font-sans text-[15px] leading-6 text-muted">Nutrition details will be available after the meal is prepared.</Text><View className="mt-6 gap-3"><Primary label="Change delivery address" onPress={() => setAddressOpen(true)} /><Pressable onPress={() => setDateOpen(true)} className="h-14 items-center justify-center rounded-xl border border-border"><Text className="font-semibold text-foreground">Change delivery date</Text></Pressable></View></>}
    <Pressable accessibilityRole="button" onPress={() => setIssueOpen(true)} className="mt-6 h-12 items-center justify-center rounded-xl border border-border"><Text className="font-semibold text-foreground">Report an issue</Text></Pressable><Pressable accessibilityRole="button" onPress={() => mockAction('Contact support')} className="mt-3 min-h-11 items-center justify-center"><Text className="font-medium text-sm text-muted">Need help with this meal? <Text className="text-accent">Contact support</Text></Text></Pressable>
  </ScrollView>{issueOpen ? <IssueSheet onClose={() => setIssueOpen(false)} onSubmit={() => { setIssueOpen(false); onToast('Issue submitted'); }} /> : null}{addressOpen ? <ChangeAddressSheet meal={meal} onClose={() => setAddressOpen(false)} onSave={(nextAddress) => { onUpdate({ ...meal, address: nextAddress, addressLabel: 'Updated address' }); setAddressOpen(false); onToast('Delivery address updated'); }} onChangeDate={() => { setAddressOpen(false); setDateOpen(true); }} /> : null}{dateOpen ? <ChangeDateSheet meal={meal} hasRemaining={hasRemaining} onClose={() => setDateOpen(false)} onSave={(date, applyRemaining) => { if (onChangeDate) onChangeDate(date, applyRemaining); else updateTrialMealDate?.(meal.id, date, applyRemaining); setDateOpen(false); }} /> : null}{preferencesOpen ? <MealPreferencePage meal={meal} onClose={() => setPreferencesOpen(false)} onSave={(updated) => { onUpdate(updated); setPreferencesOpen(false); onToast('Preferences updated for this meal only'); }} /> : null}</Animated.View>;
}

type PlanId = 'weekly' | 'monthly' | 'quarterly';
const plans = [
  { id: 'weekly' as const, name: 'Weekly', duration: '1 week', meals: 5, price: 1499, discount: 100 },
  { id: 'monthly' as const, name: 'Monthly', duration: '4 weeks', meals: 20, price: 5499, discount: 500, badge: 'Recommended' },
  { id: 'quarterly' as const, name: 'Quarterly', duration: '12 weeks', meals: 60, price: 14999, discount: 2000, badge: 'Best value' },
];
const lockedFeatures = ['Nutrient calculator', 'Personalised diet plan', 'Meal and nutrition history', 'Weekly nutrition insights'];
const standardBenefits = ['Daily home-style meals', 'Nutrition values for every item', 'Complete-meal nutrition totals', 'Pause upcoming meals', 'Change bread or rice preferences', 'Manage delivery addresses', 'Ratings and feedback'];
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
  return <View className="mt-6 rounded-[16px] border border-border bg-sheet p-5"><Text style={{ color: captionColor }} className="mb-2 font-semibold text-sm">{captionText}</Text><Text style={{ flexShrink: 1 }} className="w-full font-semibold text-[22px] leading-7 text-foreground">{title ?? (active ? 'Your nutrition tools are ready' : 'Continue your healthy meal routine')}</Text><Text style={{ flexShrink: 1 }} className="mt-2 w-full font-sans text-[15px] leading-6 text-muted">{description ?? (active ? 'Explore your subscribed meals and personalised nutrition tools.' : 'Subscribe for fresh everyday meals and unlock personalised nutrition tools designed around your goals.')}</Text><View className="mt-3 gap-1">{features.map((feature) => <View key={feature} className="min-h-9 flex-row items-center"><View className="h-8 w-8 shrink-0 items-center justify-center">{active ? <HomeGlyph icon={CheckIcon} size={18} weight="bold" tone="success" /> : <HomeGlyph icon={LockKeyIcon} size={18} weight="regular" tone="muted" />}</View><Text style={{ flexShrink: 1 }} className={`ml-3 flex-1 font-medium text-base ${active ? 'text-foreground' : 'text-muted'}`}>{feature}</Text></View>)}</View><View className="mt-4 overflow-hidden rounded-xl"><Primary label={buttonLabel ?? (active ? 'Explore My Plan' : 'Avail Subscription')} onPress={onPress} /></View></View>;
}

function LockedPreview({ title, description, goals }: { title: string; description?: string; goals?: string[] }) {
  return <View className="rounded-[16px] bg-surface p-4"><Text className="font-semibold text-lg text-foreground">{title}</Text>{description ? <Text className="mt-1 font-sans text-[15px] leading-6 text-muted">{description}</Text> : null}{goals ? <View className="mt-4 flex-row flex-wrap gap-2">{goals.map((goal) => <View key={goal} className="rounded-full bg-surface-raised px-3 py-2"><Text className="font-medium text-sm text-muted">{goal}</Text></View>)}</View> : null}</View>;
}

function LegacySubscriptionSheet({ food, bread, rice, address, initialMeal, onClose, onActivated, onToast }: { food: string; bread: string; rice: string; address: string; initialMeal: string; onClose: () => void; onActivated: (plan: string, meal: string, total: number, startDate: string) => void; onToast: (text: string) => void }) {
  const insets = useSafeAreaInsets(); const [planId, setPlanId] = useState<PlanId>('monthly'); const [mealChoice, setMealChoice] = useState(initialMeal === 'Dinner' ? 'Dinner' : initialMeal === 'Both' ? 'Both' : 'Lunch'); const [success, setSuccess] = useState(false);
  const selectedPlan = plans.find((plan) => plan.id === planId)!; const multiplier = mealChoice === 'Both' ? 2 : 1; const planPrice = selectedPlan.price * multiplier; const discount = selectedPlan.discount * multiplier; const trialCredit = 100; const taxes = Math.round((planPrice - discount) * 0.05); const total = planPrice - discount - trialCredit + taxes; const mealCount = selectedPlan.meals * multiplier; const perMeal = Math.round(total / mealCount);
  if (success) return <Overlay onClose={onClose}><SheetFrame onClose={onClose} title="Subscription active"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}><View className="items-center"><View className="h-20 w-20 items-center justify-center rounded-full bg-success-soft"><HomeGlyph icon={CheckIcon} size={30} weight="bold" tone="success" /></View><Text className="mt-5 font-semibold text-center text-[24px] leading-8 tracking-[-0.5px] text-foreground">Your subscription is active</Text><Text className="mt-2 font-sans text-center text-[15px] leading-6 text-muted">Your meals and nutrition tools are now ready.</Text></View><View className="mt-7 gap-3 rounded-[16px] bg-surface p-5"><Meta label="Duration" value={selectedPlan.duration} /><Meta label="Start date" value="26 July" /><Meta label="Meal preference" value={mealChoice} /><Meta label="Delivery address" value={address} /><Meta label="Next meal" value="26 July · Lunch" /></View><View className="mt-6"><Primary label="Explore My Plan" onPress={() => { onActivated(selectedPlan.name, mealChoice, total, "26 July"); onClose(); }} /></View></ScrollView></SheetFrame></Overlay>;
  return <Overlay onClose={onClose}><AdaptiveSheetFrame onClose={onClose} title="Choose your subscription">{(sheetControls) => <View className="flex-1"><ScrollView showsVerticalScrollIndicator={false} scrollEnabled={sheetControls.scrollEnabled} onScrollBeginDrag={sheetControls.onScrollBeginDrag} onScrollEndDrag={sheetControls.onScrollEndDrag} scrollEventThrottle={16} contentContainerStyle={{ padding: 16, paddingBottom: 112 }}><Text className="font-sans text-[15px] leading-6 text-muted">Continue with home-style meals and unlock tools that help you better understand your nutrition.</Text><Text className="mb-3 mt-6 font-semibold text-xl text-foreground">Meal selection</Text><View className="flex-row gap-2">{['Lunch', 'Dinner', 'Both'].map((choice) => <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ checked: mealChoice === choice }} onPress={() => setMealChoice(choice)} className={`h-12 flex-1 items-center justify-center rounded-full border ${mealChoice === choice ? 'border-accent bg-accent' : 'border-border'}`}><Text className={mealChoice === choice ? 'font-semibold text-sm text-white dark:text-black' : 'font-semibold text-sm text-foreground'}>{choice}</Text></Pressable>)}</View><Text className="mt-3 font-sans text-[15px] leading-6 text-muted">Lunch · 11:00 AM to 1:00 PM{mealChoice === 'Both' ? '\n' : '   '}Dinner · 6:30 PM to 8:30 PM</Text><View className="mt-6 rounded-[16px] bg-surface p-4"><View className="flex-row items-center justify-between"><Text className="font-semibold text-lg text-foreground">Current preferences</Text><Pressable accessibilityRole="button" accessibilityLabel="Edit current preferences" onPress={() => onToast('Preference editor selected')} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={PencilSimpleIcon} size={18} weight="bold" /></Pressable></View><View className="mt-4 gap-3"><Meta compact label="Food preference" value={food} /><Meta compact label="Meal" value={mealChoice} /><Meta compact label="Bread preference" value={bread} /><Meta compact label="Rice preference" value={rice} /><Meta compact label="Primary address" value={address} /></View></View><Text className="mb-3 mt-7 font-semibold text-xl text-foreground">Subscription plans</Text><View className="gap-3">{plans.map((plan) => { const selected = plan.id === planId; const factor = mealChoice === 'Both' ? 2 : 1; const computedTotal = plan.price * factor - plan.discount * factor - trialCredit + Math.round((plan.price * factor - plan.discount * factor) * 0.05); return <Pressable key={plan.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setPlanId(plan.id)} className={`rounded-[16px] border p-4 ${selected ? 'border-[3px] border-accent bg-accent/10' : 'border-border bg-canvas'}`}><View className="flex-row justify-between"><Text className="font-semibold text-lg text-foreground">{plan.name}</Text>{plan.badge ? <Text className="font-semibold text-xs text-accent">{plan.badge}</Text> : null}</View><Text className="mt-1 font-sans text-[15px] leading-6 text-muted">{plan.duration} · {plan.meals * factor} meals</Text><View className="mt-3 flex-row items-end justify-between"><Text className="font-bold text-xl text-foreground">₹{computedTotal}</Text><Text className="font-medium text-xs text-muted">₹{Math.round(computedTotal / (plan.meals * factor))}/meal · save ₹{plan.discount * factor}</Text></View></Pressable>; })}</View><Text className="mb-3 mt-7 font-semibold text-xl text-foreground">Subscription benefits</Text><Text className="font-medium text-sm text-muted">EVERY SUBSCRIPTION</Text><View className="mt-2 gap-2">{standardBenefits.map((item) => <View key={item} className="flex-row items-center gap-2"><HomeGlyph icon={CheckIcon} size={16} weight="bold" /><Text className="flex-1 font-sans text-[15px] leading-6 text-foreground">{item}</Text></View>)}</View><View className="mt-7 gap-3"><LockedPreview title="Understand your daily nutrition" description="Track estimated calories, protein, carbohydrates, fat, fibre and sodium across your subscribed meals." /><LockedPreview title="A meal plan built around your goals" goals={['Balanced meals', 'Increase protein', 'Manage calories', 'Improve meal consistency']} /></View><Text className="mb-3 mt-7 font-semibold text-xl text-foreground">Price breakdown</Text><View className="gap-3 rounded-[16px] bg-surface p-4"><Meta label="Plan price" value={`₹${planPrice}`} /><Meta label="Delivery charges" value="₹0" /><Meta label="Taxes" value={`₹${taxes}`} /><Meta label="Discount" value={`−₹${discount}`} /><Meta label="Trial credit" value={`−₹${trialCredit}`} /><View className="h-px bg-border" /><Meta label="Total payable" value={`₹${total}`} /></View></ScrollView><View style={{ paddingBottom: 16 }} className="absolute inset-x-0 bottom-0 bg-sheet px-4 pt-3"><View className="mb-3 flex-row justify-between"><Text className="font-medium text-sm text-muted">{selectedPlan.name} · ₹{perMeal}/meal</Text><Text className="font-bold text-foreground">₹{total}</Text></View><Primary label="Continue to Payment" onPress={() => setSuccess(true)} /></View></View>}</AdaptiveSheetFrame></Overlay>;
}

function SubscriptionSheet({ food, bread, rice, address, initialMeal, onClose, onActivated, onToast }: { food: string; bread: string; rice: string; address: string; initialMeal: string; onClose: () => void; onActivated: (plan: string, meal: string, total: number, startDate: string) => void; onToast: (text: string) => void }) {
  const insets = useSafeAreaInsets();
  const [planId, setPlanId] = useState<PlanId>('monthly');
  const [mealChoice, setMealChoice] = useState(initialMeal === 'Dinner' ? 'Dinner' : initialMeal === 'Both' ? 'Both' : 'Lunch');
  const [success, setSuccess] = useState(false);
  const selectedPlan = plans.find((plan) => plan.id === planId)!;
  const multiplier = mealChoice === 'Both' ? 2 : 1;
  const planPrice = selectedPlan.price * multiplier;
  const discount = selectedPlan.discount * multiplier;
  const taxes = Math.round((planPrice - discount) * 0.05);
  const total = planPrice - discount - 100 + taxes;
  if (success) return <Overlay onClose={onClose}>
    <Animated.View entering={FadeInUp.duration(240)} style={{ marginBottom: 16 }} className="mx-4 rounded-[20px] bg-canvas p-4">
      <View className="flex-row items-center justify-between"><Text className="font-semibold text-xl text-foreground">Subscription active</Text><Pressable accessibilityRole="button" accessibilityLabel="Close subscription active" onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={XIcon} size={20} weight="bold" /></Pressable></View>
      <Text className="mt-4 font-semibold text-[22px] leading-7 text-foreground">Your subscription is active</Text>
      <Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Your meals and nutrition tools are now ready.</Text>
      <View className="mt-4 gap-3 rounded-[16px] bg-surface p-4"><Meta compact label="Duration" value={selectedPlan.duration} /><Meta compact label="Start date" value="26 July" /><Meta compact label="Meal preference" value={mealChoice} /><Meta compact label="Delivery address" value={address} /><Meta compact label="Next meal" value="26 July · Lunch" /></View>
      <View className="mt-4"><Primary label="Explore My Plan" onPress={() => { onActivated(selectedPlan.name, mealChoice, total, '26 July'); onClose(); }} /></View>
    </Animated.View>
  </Overlay>;

  return <Animated.View entering={FadeIn.duration(180)} className="absolute inset-0 z-50 bg-canvas">
    <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-center gap-3 px-5 pb-3"><Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={onClose} className="h-11 w-11 items-center justify-center rounded-full bg-icon-surface"><Text className="font-semibold text-2xl text-foreground">‹</Text></Pressable><Text className="font-semibold text-[24px] text-foreground">Choose your subscription</Text></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 132 }}>
      <Text className="font-sans text-[15px] leading-6 text-muted">Continue with home-style meals and unlock tools that help you better understand your nutrition.</Text>
      <Text className="mb-3 mt-6 font-semibold text-xl text-foreground">Meal selection</Text>
      <View className="flex-row gap-2">{['Lunch', 'Dinner', 'Both'].map((choice) => <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ checked: mealChoice === choice }} onPress={() => setMealChoice(choice)} className={`h-12 flex-1 items-center justify-center rounded-full border ${mealChoice === choice ? 'border-accent bg-accent' : 'border-border'}`}><Text className={mealChoice === choice ? 'font-semibold text-sm text-white dark:text-black' : 'font-semibold text-sm text-foreground'}>{choice}</Text></Pressable>)}</View>
      <View className="mt-6 border-y border-border py-5"><View className="flex-row items-center justify-between"><Text className="font-semibold text-lg text-foreground">Current preferences</Text><Pressable accessibilityRole="button" accessibilityLabel="Edit current preferences" onPress={() => onToast('Preference editor selected')} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={PencilSimpleIcon} size={18} weight="bold" /></Pressable></View><View className="mt-4 gap-3"><Meta compact label="Food preference" value={food} /><Meta compact label="Meal" value={mealChoice} /><Meta compact label="Bread preference" value={bread} /><Meta compact label="Rice preference" value={rice} /><Meta compact label="Primary address" value={address} /></View></View>
      <Text className="mb-3 mt-7 font-semibold text-xl text-foreground">Subscription plans</Text>
      <View className="gap-3">{plans.map((plan) => { const selected = plan.id === planId; const computedTotal = plan.price * multiplier - plan.discount * multiplier - 100 + Math.round((plan.price * multiplier - plan.discount * multiplier) * 0.05); const inclusion = mealChoice === 'Both' ? 'Lunch & Dinner' : mealChoice; const badgeColor = plan.badge === 'Recommended' ? 'bg-accent' : 'bg-purple-600'; const selectedBorder = plan.id === 'quarterly' ? 'border-[3px] border-purple-600' : 'border-[3px] border-accent'; return <Pressable key={plan.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setPlanId(plan.id)} className={`rounded-[16px] border bg-white p-4 dark:bg-surface ${selected ? selectedBorder : 'border-border'}`}><View className="flex-row items-center justify-between gap-3"><Text className="font-semibold text-lg text-foreground">{plan.name}</Text>{plan.badge ? <View className={`rounded-full px-2.5 py-1 ${badgeColor}`}><Text className="font-semibold text-xs text-white">{plan.badge}</Text></View> : null}</View><Text className="mt-1 font-sans text-[15px] text-muted">{plan.duration} · {plan.meals * multiplier} meals</Text><Text className="mt-1 font-semibold text-sm text-foreground">Includes {inclusion}</Text><Text className="mt-3 font-bold text-xl text-foreground">₹{computedTotal}</Text></Pressable>; })}</View>
      <View className="mt-7 gap-3"><LockedPreview title="Understand your daily nutrition" description="Track estimated calories, protein, carbohydrates, fat, fibre and sodium across your subscribed meals." /><LockedPreview title="A meal plan built around your goals" goals={['Balanced meals', 'Increase protein', 'Manage calories', 'Improve meal consistency']} /></View>
      <Text className="mb-3 mt-7 font-semibold text-xl text-foreground">Price breakdown</Text>
      <View className="gap-3 rounded-[16px] bg-surface p-4"><Meta label="Plan price" value={`₹${planPrice}`} /><Meta label="Delivery charges" value="₹0" /><Meta label="Taxes" value={`₹${taxes}`} /><Meta label="Discount" value={`−₹${discount}`} /><Meta label="Trial credit" value="−₹100" /><View className="h-px bg-border" /><View className="flex-row items-center justify-between gap-4"><Text className="font-sans text-[15px] leading-6 text-muted">Total payable</Text><Text className="font-bold text-lg text-foreground">₹{total}</Text></View></View>
    </ScrollView><View style={{ paddingBottom: Math.max(16, insets.bottom + 8) }} className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-3"><Primary label={`Continue to Payment · ₹${total}`} onPress={() => setSuccess(true)} /></View>
  </Animated.View>;
}

export default function TrialHome({ food, meal, dailyMeals = [], bread, rice, address, openSubscriptionOnLoad = false, lifecycleVariant = 'trial_active', onPaymentStatusPress }: { food: string; meal: string; dailyMeals?: Array<{ lunch: string; dinner: string }>; bread: string; rice: string; address: string; openSubscriptionOnLoad?: boolean; lifecycleVariant?: HomeLifecycleVariant; onPaymentStatusPress?: () => void }) {
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
  const initiallySubscribed = lifecycleVariant === 'trial_subscription_purchased' || isSubscriptionHome;
  const configs: Record<HomeLifecycleVariant, { eyebrow: string; title: string; description: string; caption?: string; selectedLabel: string }> = {
    trial_payment_pending: { eyebrow: 'PAYMENT PENDING', title: 'Your trial payment is being checked', description: 'Your trial dates are saved while the payment confirmation is pending.', caption: 'Payment not confirmed', selectedLabel: 'FIRST TRIAL MEAL' },
    trial_scheduled: { eyebrow: 'TRIAL SCHEDULED', title: 'Your trial starts soon', description: 'Your three selected trial dates are ready. Tap a meal-status circle to review details.', caption: 'Trial starts 27 July', selectedLabel: 'FIRST TRIAL MEAL' },
    trial_active: { eyebrow: 'ACTIVE TRIAL', title: 'Your three-day trial', description: 'Tap a meal-status circle to view that meal’s details.', selectedLabel: 'SELECTED MEAL' },
    trial_subscription_purchased: { eyebrow: 'ACTIVE TRIAL', title: 'Your three-day trial', description: 'Your subscription is ready and will begin after the final trial meal.', caption: 'Subscription starts after trial', selectedLabel: 'SELECTED MEAL' },
    trial_completed: { eyebrow: 'TRIAL COMPLETE', title: 'Your three-day trial is complete', description: 'Review your delivered meals or continue with a subscription.', caption: 'Trial completed', selectedLabel: 'LAST TRIAL MEAL' },
    subscription_scheduled: { eyebrow: 'SUBSCRIPTION SCHEDULED', title: 'Your meals start soon', description: 'Your selected delivery days are ready for the coming week.', caption: 'Starts 26 July', selectedLabel: 'FIRST SELECTED MEAL' },
    subscription_active: { eyebrow: 'ACTIVE SUBSCRIPTION', title: 'Your meals this week', description: 'Tap a selected delivery day to view or update that meal.', caption: 'Monthly subscription', selectedLabel: 'NEXT SELECTED MEAL' },
    subscription_no_meal: { eyebrow: 'ACTIVE SUBSCRIPTION', title: 'Your meals this week', description: 'There is no meal selected today. Your next selected delivery remains available below.', caption: 'No meal today', selectedLabel: 'NEXT SELECTED MEAL' },
    subscription_paused: { eyebrow: 'SUBSCRIPTION PAUSED', title: 'Your meals are paused', description: 'The same weekly schedule is preserved and resumes on 2 August.', caption: 'Resumes 2 August', selectedLabel: 'NEXT MEAL AFTER RESUME' },
    subscription_ending: { eyebrow: 'SUBSCRIPTION ENDING', title: 'Your meals this week', description: 'Your paid deliveries remain active until 20 August.', caption: 'Active until 20 August', selectedLabel: 'NEXT SELECTED MEAL' },
    subscription_expired: { eyebrow: 'SUBSCRIPTION ENDED', title: 'Your saved meal schedule', description: 'Your plan has ended. Previous meals and nutrition history remain available.', caption: 'Plan ended', selectedLabel: 'LAST SCHEDULED MEAL' },
    subscription_renewal_failed: { eyebrow: 'PAYMENT ACTION NEEDED', title: 'Your meals this week', description: 'Paid meals remain confirmed. Update payment to keep future weeks active.', caption: 'Renewal failed', selectedLabel: 'NEXT CONFIRMED MEAL' },
    subscription_delivery_delayed: { eyebrow: 'DELIVERY UPDATE', title: 'Your meals this week', description: 'One selected delivery is delayed. Your weekly schedule has not changed.', caption: 'Delivery delayed', selectedLabel: 'AFFECTED MEAL' },
    subscription_delivery_failed: { eyebrow: 'DELIVERY ISSUE', title: 'Your meals this week', description: 'One delivery needs an address or support resolution.', caption: 'Action required', selectedLabel: 'AFFECTED MEAL' },
    subscription_offline: { eyebrow: 'OFFLINE', title: 'Your saved meals this week', description: 'Showing the latest saved schedule. Changes are unavailable until you reconnect.', caption: 'Last updated 10:42 AM', selectedLabel: 'NEXT SAVED MEAL' },
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
    ? { title: 'Check Payment Status', body: 'Return to payment status to see whether your ₹899 trial payment is confirmed.', tone: 'orange' as const, action: 'Check Payment Status' }
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
  const [detailId, setDetailId] = useState(seed.find((item) => item.isPlanDay !== false && item.status !== 'delivered')?.id ?? seed[seed.length - 1]!.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home');
  const [subscriptionOpen, setSubscriptionOpen] = useState(openSubscriptionOnLoad);
  const [subscription, setSubscription] = useState<{ plan: string; meal: string; total: number; startDate: string } | null>(initiallySubscribed ? { plan: 'Monthly', meal, total: 5299, startDate: '26 July' } : null);
  const eligibleMeals = meals.filter((item) => item.isPlanDay !== false);
  const selectedId = lifecycleVariant === 'subscription_expired' ? (meals[2]?.id ?? eligibleMeals[0]!.id) : eligibleMeals.find((item) => item.status !== 'delivered')?.id ?? eligibleMeals[eligibleMeals.length - 1]!.id;
  const calendarSelectedId = lifecycleVariant === 'subscription_no_meal' ? (meals[2]?.id ?? selectedId) : selectedId;
  const selected = meals.find((item) => item.id === selectedId)!;
  const daysLeft = eligibleMeals.filter((item) => item.status !== 'delivered').length;
  const detailMeal = meals.find((item) => item.id === detailId) ?? selected;
  const updateMeal = (updated: TrialMeal) => setMeals((current) => current.map((item) => item.id === updated.id ? updated : item));
  const showToast = (text: string) => setToast(text);
  const changeMealDate = (mealId: string, nextDate: Date, applyRemaining: boolean) => {
    setMeals((current) => { const index = current.findIndex((item) => item.id === mealId); if (index < 0) return current; const currentDate = new Date(`${current[index]!.date} 2026`); const delta = Math.round((nextDate.getTime() - currentDate.getTime()) / 86400000); return current.map((item, itemIndex) => { if (itemIndex !== index && (!applyRemaining || itemIndex < index)) return item; const date = itemIndex === index ? nextDate : new Date(new Date(`${item.date} 2026`).getTime() + delta * 86400000); return { ...item, date: date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }), dayLabel: date.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase(), shortDate: String(date.getDate()) }; }).sort((a, b) => new Date(`${a.date} 2026`).getTime() - new Date(`${b.date} 2026`).getTime()); });
    showToast(applyRemaining ? 'This and remaining meal dates updated' : 'Meal date updated');
  };
  updateTrialMealDate = changeMealDate;
  const openPlan = () => subscription ? showToast(`${subscription.plan} subscription active`) : setSubscriptionOpen(true);
  return <View className="flex-1 bg-canvas">{activeTab === 'home' ? <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }}><View className="px-5">
    <Animated.Text entering={FadeInUp.delay(20).duration(240)} className="font-medium text-sm text-accent">{config.eyebrow}</Animated.Text>
    <Animated.View entering={FadeInUp.delay(70).duration(260)} className="mt-2 flex-row items-center justify-between gap-3"><Text className="flex-1 font-semibold text-[24px] leading-8 tracking-[-0.5px] text-foreground">{config.title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => { setActiveTab('profile'); setSheetOpen(false); }} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={UserCircleIcon} size={24} weight="bold" /></Pressable></Animated.View>
    <Animated.Text entering={FadeInUp.delay(130).duration(260)} className="mt-2 font-sans text-[15px] leading-6 text-muted">{config.description}</Animated.Text>
    {stateNotice ? <Animated.View entering={FadeInUp.delay(190).duration(260)} style={{ backgroundColor: stateNotice.tone === 'orange' ? (dark ? '#2A1B0C' : '#FFF3E0') : stateNotice.tone === 'red' ? (dark ? '#2B1212' : '#FDECEC') : stateNotice.tone === 'blue' ? (dark ? '#101F33' : '#EAF3FF') : (dark ? '#211A2E' : '#F2ECFF') }} className="mt-5 rounded-[16px] p-4"><Text className="font-semibold text-base text-foreground">{stateNotice.title}</Text><Text className="mt-1 font-sans text-[14px] leading-5 text-muted">{stateNotice.body}</Text>{stateNotice.action ? <View className="mt-4">{lifecycleVariant === 'trial_payment_pending' ? <Pressable accessibilityRole="button" onPress={onPaymentStatusPress} style={{ backgroundColor: dark ? '#1F1409' : '#F2DDBB' }} className="h-12 items-center justify-center rounded-xl px-4"><Text className="font-semibold text-foreground">{stateNotice.action}</Text></Pressable> : lifecycleVariant === 'subscription_ending' ? <Pressable accessibilityRole="button" onPress={() => showToast('Re-subscription selected')} style={{ backgroundColor: dark ? '#171020' : '#DED0F3' }} className="h-12 items-center justify-center rounded-xl px-4"><Text className="font-semibold text-foreground">{stateNotice.action}</Text></Pressable> : <Primary label={stateNotice.action} onPress={() => showToast('Re-subscription selected')} />}</View> : null}</Animated.View> : null}
    <Animated.View entering={FadeInUp.delay(210).duration(280)} className="mt-6"><TrialDayTracker meals={meals} selectedId={calendarSelectedId} showBoth={(subscription?.meal ?? meal) === 'Both'} animateUpcoming={lifecycleVariant !== 'subscription_offline' && lifecycleVariant !== 'subscription_expired'} onSelectDate={() => {}} onOpenMeal={(item) => { setDetailId(item.id); setSheetOpen(true); }} /></Animated.View>
    <Animated.View entering={FadeInUp.delay(290).duration(280)}><SubscriptionCard active={!!subscription} daysLeft={daysLeft} caption={config.caption} title={planCard?.title} description={planCard?.description} buttonLabel={planCard?.buttonLabel} onPress={openPlan} /></Animated.View>
    <Animated.View entering={FadeInUp.delay(370).duration(280)} className="mt-6 rounded-[16px] border border-border bg-sheet p-5"><View className="flex-row items-start justify-between gap-3"><View className="flex-1"><Text className="font-medium text-sm text-muted">{config.selectedLabel}</Text><Text className="mt-2 font-semibold text-xl text-foreground">{selected.date}</Text><Text className="mt-1 font-sans text-[15px] leading-6 text-muted">{selected.mealType} · {selected.addressLabel}</Text></View><StatusBadge status={selected.status} /></View><Pressable accessibilityRole="button" onPress={() => { setDetailId(selected.id); setSheetOpen(true); }} className="mt-5 h-12 items-center justify-center rounded-xl border border-border"><Text className="font-semibold text-foreground">View meal details</Text></Pressable></Animated.View>
  </View></ScrollView> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }}><View className="px-5"><Animated.View entering={FadeInUp.delay(30).duration(260)} className="flex-row items-center justify-between gap-3"><Text className="font-semibold text-[24px] leading-8 tracking-[-0.5px] text-foreground">Profile</Text><Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={() => setActiveTab('home')} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={HouseIcon} size={22} weight="bold" /></Pressable></Animated.View><Animated.Text entering={FadeInUp.delay(100).duration(260)} className="mt-2 font-sans text-[15px] leading-6 text-muted">Your meal preferences and delivery account.</Animated.Text><Animated.View entering={FadeInUp.delay(170).duration(280)} className="mt-6 rounded-[16px] bg-surface p-5"><Meta label="Food" value={food} /><View className="mt-3"><Meta label="Meal" value={meal} /></View><View className="mt-3"><Meta label="Bread" value={bread} /></View><View className="mt-3"><Meta label="Rice" value={rice} /></View><View className="mt-3"><Meta label="Address" value="Home" /></View></Animated.View></View></ScrollView>}
    {sheetOpen ? <MealDetailSheet meal={detailMeal} onClose={() => setSheetOpen(false)} onUpdate={updateMeal} onToast={showToast} /> : null}
    {subscriptionOpen ? <SubscriptionSheet food={food} bread={bread} rice={rice} address={address} initialMeal={meal} onClose={() => setSubscriptionOpen(false)} onToast={showToast} onActivated={(plan, selectedMeal, total, startDate) => { setSubscription({ plan, meal: selectedMeal, total, startDate }); showToast(`${plan} plan activated for ${selectedMeal}`); }} /> : null}
    {toast ? <BottomToast message={toast} onDismiss={() => setToast('')} /> : null}
  </View>;
}
