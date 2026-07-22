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

const mealPhoto = require('../assets/food-thali.png');

type GlyphTone = 'foreground' | 'muted' | 'accent' | 'success' | 'canvas' | 'border' | 'white';
function HomeGlyph({ icon: Glyph, size = 20, weight = 'regular', tone = 'foreground' }: { icon: Icon; size?: number; weight?: IconWeight; tone?: GlyphTone }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const colors: Record<GlyphTone, string> = { foreground: dark ? '#ffffff' : '#101010', muted: dark ? '#ababab' : '#5e5e5e', accent: dark ? '#55c986' : '#078a4b', success: dark ? '#55c986' : '#078a4b', canvas: dark ? '#0e0e0e' : '#ffffff', border: dark ? '#242424' : '#eeeeee', white: '#ffffff' };
  return <Glyph size={Math.max(8, size - 4)} weight={weight === 'fill' ? 'fill' : 'bold'} color={colors[tone]} />;
}

export type MealStatus = 'delivered' | 'upcoming' | 'paused' | 'issue';
type Nutrition = { calories: string; protein: string; carbohydrates: string; fat: string; fibre: string; sodium: string };
type MealItem = { name: string; serving: string; calories: string; protein: string };
type TrialMeal = {
  id: string; date: string; dayLabel: string; shortDate: string; mealType: 'Lunch' | 'Dinner'; status: MealStatus;
  foodPreference: string; breadPreference: string; ricePreference: string; addressLabel: string; address: string;
  deliveryNote?: string; items?: MealItem[]; nutrition: Nutrition; rating?: number; feedbackTags?: string[]; feedbackNote?: string;
};

const nutrition: Nutrition = { calories: '720 kcal', protein: '28 g', carbohydrates: '92 g', fat: '24 g', fibre: '11 g', sodium: '680 mg' };
const menu: MealItem[] = [
  { name: 'Paneer masala', serving: '180 g', calories: '260 kcal', protein: '13 g' },
  { name: 'Dal tadka', serving: '150 g', calories: '150 kcal', protein: '8 g' },
  { name: 'Bhakri', serving: '2 pieces', calories: '130 kcal', protein: '3 g' },
  { name: 'Jeera rice', serving: '160 g', calories: '150 kcal', protein: '3 g' },
  { name: 'Salad', serving: '80 g', calories: '20 kcal', protein: '1 g' },
  { name: 'Pickle', serving: '15 g', calories: '10 kcal', protein: '0 g' },
];

const initialMeals = (food: string, bread: string, rice: string, meal: string, address: string, dailyMeals: Array<{ lunch: string; dinner: string }> = []): TrialMeal[] => [
  { id: '21', date: 'Monday, 21 July', dayLabel: 'MON', shortDate: '21', mealType: 'Lunch', status: 'delivered', foodPreference: dailyMeals[0]?.lunch || food, breadPreference: bread, ricePreference: rice, addressLabel: 'Home', address, deliveryNote: 'Leave with security if unavailable.', items: menu, nutrition },
  { id: '22', date: 'Tuesday, 22 July', dayLabel: 'TUE', shortDate: '22', mealType: 'Lunch', status: 'delivered', foodPreference: dailyMeals[1]?.lunch || food, breadPreference: bread, ricePreference: rice, addressLabel: 'Home', address, items: menu, nutrition },
  { id: '23', date: 'Wednesday, 23 July', dayLabel: 'WED', shortDate: '23', mealType: meal === 'Dinner' ? 'Dinner' : 'Lunch', status: 'upcoming', foodPreference: food, breadPreference: bread, ricePreference: rice, addressLabel: 'Home', address, nutrition },
  { id: '24', date: 'Thursday, 24 July', dayLabel: 'THU', shortDate: '24', mealType: 'Dinner', status: 'paused', foodPreference: food, breadPreference: bread, ricePreference: rice, addressLabel: 'Home', address, nutrition },
  { id: '25', date: 'Friday, 25 July', dayLabel: 'FRI', shortDate: '25', mealType: 'Lunch', status: 'upcoming', foodPreference: food, breadPreference: bread, ricePreference: rice, addressLabel: 'Home', address, nutrition },
];

function Primary({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const [width, setWidth] = useState(0);
  return <Pressable accessibilityRole="button" onPress={onPress} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ alignSelf: 'stretch' }} className="h-14 items-center justify-center overflow-hidden rounded-xl">{width > 0 ? <Svg pointerEvents="none" width={width} height={56} preserveAspectRatio="none" style={StyleSheet.absoluteFill}><Defs><LinearGradient id="primaryButtonGradient" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={dark ? '#FFFFFF' : '#4D4D4D'} /><Stop offset="1" stopColor={dark ? '#888888' : '#000000'} /></LinearGradient></Defs><Rect width={width} height={56} fill="url(#primaryButtonGradient)" /></Svg> : null}<Text style={{ zIndex: 1 }} className={`font-bold text-base ${dark ? 'text-black' : 'text-white'}`}>{label}</Text></Pressable>;
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
  const label = status[0]!.toUpperCase() + status.slice(1);
  return <View className={`rounded-full px-3 py-1.5 ${status === 'delivered' ? 'bg-success-soft' : 'bg-surface-raised'}`}><Text className={`font-semibold text-xs ${status === 'delivered' ? 'text-success' : 'text-foreground'}`}>{label}</Text></View>;
}

function TrialDayTracker({ meals, selectedId, showBoth, onSelectDate, onOpenMeal }: { meals: TrialMeal[]; selectedId: string; showBoth: boolean; onSelectDate: (meal: TrialMeal) => void; onOpenMeal: (meal: TrialMeal) => void }) {
  return <View className="w-full flex-row">
    {meals.map((meal) => { const selected = meal.id === selectedId; const nonVeg = meal.foodPreference.toLowerCase().includes('non'); const deliveredColor = nonVeg ? 'border-red-600 bg-red-600' : 'border-accent bg-accent'; return <View key={meal.id} className="flex-1 items-center"><Pressable accessibilityRole="button" accessibilityLabel={`Select ${meal.date}`} accessibilityState={{ selected }} onPress={() => onSelectDate(meal)} className={`h-14 w-full max-w-[46px] items-center justify-center rounded-[14px] border ${selected ? 'border-accent/10 bg-accent/10' : 'border-surface bg-surface'}`}><Text className={`font-bold text-lg ${selected ? 'text-accent' : 'text-foreground'}`}>{meal.shortDate}</Text><Text className="mt-0.5 font-medium text-[11px] text-muted">{meal.dayLabel}</Text></Pressable><View className="mt-2 items-center gap-1"><Pressable accessibilityRole="button" accessibilityLabel={`Open ${meal.mealType} details, ${meal.status}, ${meal.foodPreference}`} onPress={() => onOpenMeal(meal)} className="h-11 w-11 items-center justify-center"><View className={`h-5 w-5 items-center justify-center rounded-full border-[3px] ${meal.status === 'delivered' ? deliveredColor : selected ? 'border-accent bg-canvas' : 'border-border bg-canvas'}`}>{meal.status === 'delivered' ? <HomeGlyph icon={CheckIcon} size={16} weight="bold" tone="white" /> : meal.status === 'paused' ? <HomeGlyph icon={PauseIcon} size={11} weight="bold" tone="muted" /> : meal.status === 'issue' ? <HomeGlyph icon={WarningCircleIcon} size={11} weight="bold" tone="muted" /> : null}</View></Pressable>{showBoth ? <View accessibilityElementsHidden className="h-7 w-7 items-center justify-center"><View className="h-4 w-4 rounded-full border-2 border-border bg-canvas" /></View> : null}</View></View>; })}
  </View>;
}

function PreferenceSummary({ meal }: { meal: TrialMeal }) { return <View><Text className="font-semibold text-xl text-foreground">Selected preferences</Text><View className="mt-3 gap-2"><Meta label="Food" value={meal.foodPreference} /><Meta label="Meal" value={meal.mealType} /><Meta label="Bread" value={meal.breadPreference} /><Meta label="Rice" value={meal.ricePreference} /></View></View>; }
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
  return <View><Text className="font-semibold text-xl text-foreground">How was your meal?</Text><View className="mt-3 flex-row">{[1,2,3,4,5].map((star) => <Pressable key={star} accessibilityRole="radio" accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`} accessibilityState={{ checked: rating === star }} onPress={() => setRating(star)} className="h-11 w-11 items-center justify-center"><HomeGlyph icon={StarIcon} size={30} weight={star <= rating ? 'fill' : 'regular'} tone={star <= rating ? 'accent' : 'muted'} /></Pressable>)}</View><View className="mt-3 flex-row flex-wrap gap-2">{feedbackOptions.map((tag) => { const active = tags.includes(tag); return <Pressable key={tag} onPress={() => setTags(active ? tags.filter((item) => item !== tag) : [...tags, tag])} className={`min-h-11 justify-center rounded-full border px-3 ${active ? 'border-accent bg-accent' : 'border-border'}`}><Text className={`font-medium text-xs ${active ? 'text-white dark:text-black' : 'text-foreground'}`}>{tag}</Text></Pressable>; })}</View><TextInput value={note} onChangeText={setNote} onFocus={onFocusTellMore} multiline placeholder="Optional feedback" placeholderTextColor="#8b8a84" className="mt-4 min-h-[92px] rounded-xl border border-border bg-sheet p-4 font-sans text-foreground outline-none" /><View className="mt-4"><Primary label="Submit feedback" onPress={() => { if (!rating) { onToast('Choose a rating first'); return; } onSave(rating, tags, note); setEditing(false); onToast('Feedback saved'); }} /></View></View>;
}

const issueCategories = ['Meal missing', 'Wrong meal', 'Bread preference not followed', 'Rice preference not followed', 'Food quality issue', 'Packaging issue', 'Delivery issue', 'Other'];
function IssueSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  const [category, setCategory] = useState(issueCategories[0]!); const [description, setDescription] = useState('');
  return <Overlay onClose={onClose} level={60}><SheetFrame onClose={onClose} title="Report an issue"><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 32 }}><Text className="font-semibold text-2xl leading-8 text-foreground">What went wrong?</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Choose the problem that best describes this meal.</Text><View className="mt-5 flex-row flex-wrap gap-2">{issueCategories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} className={`min-h-11 justify-center rounded-full border px-3 ${category === item ? 'border-accent bg-accent' : 'border-border'}`}><Text className={category === item ? 'font-medium text-xs text-white dark:text-black' : 'font-medium text-xs text-foreground'}>{item}</Text></Pressable>)}</View><TextInput value={description} onChangeText={setDescription} multiline placeholder="Optional description" placeholderTextColor="#8b8a84" className="mt-5 min-h-[100px] rounded-xl border border-border bg-sheet p-4 font-sans text-foreground outline-none" /><Pressable accessibilityRole="button" className="mt-4 h-24 items-center justify-center rounded-xl border border-border bg-sheet"><View className="flex-row items-center gap-2"><HomeGlyph icon={PlusIcon} size={18} weight="bold" tone="muted" /><Text className="font-semibold text-muted">Add photo</Text></View><Text className="mt-1 font-sans text-xs text-muted">Local placeholder</Text></Pressable><View className="mt-5"><Primary label="Submit issue" onPress={onSubmit} /></View></ScrollView></KeyboardAvoidingView></SheetFrame></Overlay>;
}

function PauseSheet({ meal, onClose, onConfirm }: { meal: TrialMeal; onClose: () => void; onConfirm: () => void }) {
  return <Overlay onClose={onClose} level={60}><Animated.View entering={FadeInUp.duration(220)} className="mx-4 mb-4 rounded-[20px] bg-canvas p-5"><Text className="font-semibold text-2xl text-foreground">Pause this meal?</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{meal.date} · {meal.mealType}. You can reactivate it later during this preview.</Text><View className="mt-6"><Primary label="Confirm pause" onPress={onConfirm} /></View><Pressable accessibilityRole="button" onPress={onClose} className="mt-2 h-12 items-center justify-center"><Text className="font-semibold text-foreground">Keep meal active</Text></Pressable></Animated.View></Overlay>;
}

function MealDetailSheet({ meal, onClose, onUpdate, onToast }: { meal: TrialMeal; onClose: () => void; onUpdate: (meal: TrialMeal) => void; onToast: (text: string) => void }) {
  const [issueOpen, setIssueOpen] = useState(false); const [pauseOpen, setPauseOpen] = useState(false); const contentRef = useRef<ScrollView>(null);
  const mockAction = (label: string) => onToast(`${label} selected`);
  return <Overlay onClose={onClose}><AdaptiveSheetFrame onClose={onClose} title="Meal details">{(sheetControls) => <ScrollView ref={contentRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled={sheetControls.scrollEnabled} onScrollBeginDrag={sheetControls.onScrollBeginDrag} onScrollEndDrag={sheetControls.onScrollEndDrag} scrollEventThrottle={16} contentContainerStyle={{ padding: 20, paddingBottom: 180 }}>
    <View className="h-52 items-center justify-center overflow-hidden rounded-[16px] bg-surface"><Image source={mealPhoto} accessibilityLabel="Plate with meal ingredients" resizeMode="contain" className="h-48 w-48" /></View>
    <View className="mt-6 flex-row items-start justify-between gap-3"><View className="flex-1"><Text className="font-semibold text-2xl leading-8 text-foreground">{meal.date}</Text><Text className="mt-1 font-sans text-[15px] leading-6 text-muted">{meal.mealType} · {meal.foodPreference}</Text></View><StatusBadge status={meal.status} /></View>
    <View className="my-7 h-px bg-border" /><Text className="font-semibold text-xl text-foreground">{meal.status === 'delivered' ? `Delivered to ${meal.addressLabel}` : `Delivering to ${meal.addressLabel}`}</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{meal.address}</Text>{meal.deliveryNote ? <Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Note · {meal.deliveryNote}</Text> : null}
    {meal.status === 'delivered' ? <><View className="my-7 h-px bg-border" /><Text className="font-semibold text-xl text-foreground">Today’s tiffin</Text><Text className="mt-3 font-sans text-base leading-7 text-muted">{meal.items?.map((item) => item.name).join(", ")}</Text><View className="my-7 h-px bg-border" /><NutritionSection meal={meal} /><View className="my-7 h-px bg-border" /><PreferenceSummary meal={meal} /><View className="my-7 h-px bg-border" /><Feedback meal={meal} onSave={(rating, tags, note) => onUpdate({ ...meal, rating, feedbackTags: tags, feedbackNote: note })} onToast={onToast} onFocusTellMore={() => setTimeout(() => contentRef.current?.scrollToEnd({ animated: true }), 180)} /></> : <><View className="my-7 h-px bg-border" /><PreferenceSummary meal={meal} /><Text className="mt-4 font-sans text-[15px] leading-6 text-muted">Nutrition details will be available after the meal is prepared.</Text>{meal.status === 'paused' ? <View className="mt-5 rounded-[16px] bg-surface p-4"><Text className="font-medium leading-6 text-foreground">This meal is paused. Any applicable credit or rescheduling will be confirmed according to the trial policy.</Text><View className="mt-4"><Primary label="Reactivate meal" onPress={() => { onUpdate({ ...meal, status: 'upcoming' }); onToast('Meal reactivated'); }} /></View></View> : <View className="mt-5"><Primary label="Pause meal" onPress={() => setPauseOpen(true)} /></View>}<View className="mt-3 flex-row flex-wrap gap-2">{['Change delivery address', 'Change bread', 'Change rice', 'Contact support'].map((action) => <Pressable key={action} onPress={() => mockAction(action)} className="min-h-11 justify-center rounded-full border border-border px-3"><Text className="font-medium text-xs text-foreground">{action}</Text></Pressable>)}</View></>}
    <Pressable accessibilityRole="button" onPress={() => setIssueOpen(true)} className="mt-6 h-12 items-center justify-center rounded-xl border border-border"><Text className="font-semibold text-foreground">Report an issue</Text></Pressable><Pressable accessibilityRole="button" onPress={() => mockAction('Contact support')} className="mt-3 min-h-11 items-center justify-center"><Text className="font-medium text-sm text-muted">Need help with this meal? <Text className="text-accent">Contact support</Text></Text></Pressable>
  </ScrollView>}</AdaptiveSheetFrame>{issueOpen ? <IssueSheet onClose={() => setIssueOpen(false)} onSubmit={() => { setIssueOpen(false); onToast('Issue submitted'); }} /> : null}{pauseOpen ? <PauseSheet meal={meal} onClose={() => setPauseOpen(false)} onConfirm={() => { setPauseOpen(false); onUpdate({ ...meal, status: 'paused' }); onToast('Meal paused successfully'); }} /> : null}</Overlay>;
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

function SubscriptionCard({ active, daysLeft, onPress }: { active: boolean; daysLeft: number; onPress: () => void }) {
  const features = active ? ['Nutrient Calculator', 'My Diet Plan', 'Nutrition History', 'Weekly Insights'] : lockedFeatures;
  return <View className="mt-6 rounded-[16px] border border-border bg-sheet p-5"><Text className="mb-2 font-semibold text-sm text-accent">{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left of trial</Text><Text className="font-semibold text-[22px] leading-7 text-foreground">{active ? 'Your nutrition tools are ready' : 'Continue your healthy meal routine'}</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{active ? 'Explore your subscribed meals and personalised nutrition tools.' : 'Subscribe for fresh everyday meals and unlock personalised nutrition tools designed around your goals.'}</Text><View className="mt-3 gap-1">{features.map((feature) => <View key={feature} className="min-h-9 flex-row items-center"><View className="h-8 w-8 items-center justify-center">{active ? <HomeGlyph icon={CheckIcon} size={18} weight="bold" tone="success" /> : <HomeGlyph icon={LockKeyIcon} size={18} weight="regular" tone="muted" />}</View><Text className={`ml-3 flex-1 font-medium text-base ${active ? 'text-foreground' : 'text-muted'}`}>{feature}</Text></View>)}</View><View className="mt-4"><Primary label={active ? 'Explore My Plan' : 'Avail Subscription'} onPress={onPress} /></View></View>;
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
    <Animated.View entering={FadeInUp.duration(240)} style={{ marginBottom: 16, paddingBottom: insets.bottom + 16 }} className="mx-4 rounded-[20px] bg-canvas p-4">
      <View className="flex-row items-center justify-between"><Text className="font-semibold text-2xl text-foreground">Subscription active</Text><Pressable accessibilityRole="button" accessibilityLabel="Close subscription active" onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={XIcon} size={20} weight="bold" /></Pressable></View>
      <Text className="mt-5 font-semibold text-[28px] leading-[34px] text-foreground">Your subscription is active</Text>
      <Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Your meals and nutrition tools are now ready.</Text>
      <View className="mt-5 gap-3 rounded-[16px] bg-surface p-4"><Meta label="Duration" value={selectedPlan.duration} /><Meta label="Start date" value="26 July" /><Meta label="Meal preference" value={mealChoice} /><Meta label="Delivery address" value={address} /><Meta label="Next meal" value="26 July · Lunch" /></View>
      <View className="mt-5"><Primary label="Explore My Plan" onPress={() => { onActivated(selectedPlan.name, mealChoice, total, '26 July'); onClose(); }} /></View>
    </Animated.View>
  </Overlay>;

  return <Overlay onClose={onClose}><AdaptiveSheetFrame onClose={onClose} title="Choose your subscription">{(sheetControls) =>
    <View className="flex-1"><ScrollView showsVerticalScrollIndicator={false} scrollEnabled={sheetControls.scrollEnabled} onContentSizeChange={(_width, height) => sheetControls.setContentHeight(height)} onScrollBeginDrag={sheetControls.onScrollBeginDrag} onScrollEndDrag={sheetControls.onScrollEndDrag} scrollEventThrottle={16} contentContainerStyle={{ padding: 16, paddingBottom: 128 }}>
      <Text className="font-sans text-[15px] leading-6 text-muted">Continue with home-style meals and unlock tools that help you better understand your nutrition.</Text>
      <Text className="mb-3 mt-6 font-semibold text-xl text-foreground">Meal selection</Text>
      <View className="flex-row gap-2">{['Lunch', 'Dinner', 'Both'].map((choice) => <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ checked: mealChoice === choice }} onPress={() => setMealChoice(choice)} className={`h-12 flex-1 items-center justify-center rounded-full border ${mealChoice === choice ? 'border-accent bg-accent' : 'border-border'}`}><Text className={mealChoice === choice ? 'font-semibold text-sm text-white dark:text-black' : 'font-semibold text-sm text-foreground'}>{choice}</Text></Pressable>)}</View>
      <View className="mt-6 border-y border-border py-5"><View className="flex-row items-center justify-between"><Text className="font-semibold text-lg text-foreground">Current preferences</Text><Pressable accessibilityRole="button" accessibilityLabel="Edit current preferences" onPress={() => onToast('Preference editor selected')} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={PencilSimpleIcon} size={18} weight="bold" /></Pressable></View><View className="mt-4 gap-3"><Meta compact label="Food preference" value={food} /><Meta compact label="Meal" value={mealChoice} /><Meta compact label="Bread preference" value={bread} /><Meta compact label="Rice preference" value={rice} /><Meta compact label="Primary address" value={address} /></View></View>
      <Text className="mb-3 mt-7 font-semibold text-xl text-foreground">Subscription plans</Text>
      <View className="gap-3">{plans.map((plan) => { const selected = plan.id === planId; const computedTotal = plan.price * multiplier - plan.discount * multiplier - 100 + Math.round((plan.price * multiplier - plan.discount * multiplier) * 0.05); const inclusion = mealChoice === 'Both' ? 'Lunch & Dinner' : mealChoice; const badgeColor = plan.badge === 'Recommended' ? 'bg-accent' : 'bg-purple-600'; return <Pressable key={plan.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setPlanId(plan.id)} className={`rounded-[16px] border bg-white p-4 dark:bg-surface ${selected ? 'border-[3px] border-accent' : 'border-border'}`}><View className="flex-row items-center justify-between gap-3"><Text className="font-semibold text-lg text-foreground">{plan.name}</Text>{plan.badge ? <View className={`rounded-full px-2.5 py-1 ${badgeColor}`}><Text className="font-semibold text-xs text-white">{plan.badge}</Text></View> : null}</View><Text className="mt-1 font-sans text-[15px] text-muted">{plan.duration} · {plan.meals * multiplier} meals</Text><Text className="mt-1 font-semibold text-sm text-foreground">Includes {inclusion}</Text><Text className="mt-3 font-bold text-xl text-foreground">₹{computedTotal}</Text></Pressable>; })}</View>
      <View className="mt-7 gap-3"><LockedPreview title="Understand your daily nutrition" description="Track estimated calories, protein, carbohydrates, fat, fibre and sodium across your subscribed meals." /><LockedPreview title="A meal plan built around your goals" goals={['Balanced meals', 'Increase protein', 'Manage calories', 'Improve meal consistency']} /></View>
      <Text className="mb-3 mt-7 font-semibold text-xl text-foreground">Price breakdown</Text>
      <View className="gap-3 rounded-[16px] bg-surface p-4"><Meta label="Plan price" value={`₹${planPrice}`} /><Meta label="Delivery charges" value="₹0" /><Meta label="Taxes" value={`₹${taxes}`} /><Meta label="Discount" value={`−₹${discount}`} /><Meta label="Trial credit" value="−₹100" /><View className="h-px bg-border" /><View className="flex-row items-center justify-between gap-4"><Text className="font-sans text-[15px] leading-6 text-muted">Total payable</Text><Text className="font-bold text-lg text-foreground">₹{total}</Text></View></View>
    </ScrollView><View style={{ paddingBottom: Math.max(16, insets.bottom + 8) }} className="absolute inset-x-0 bottom-0 bg-sheet px-4 pt-3"><Primary label={`Continue to Payment · ₹${total}`} onPress={() => setSuccess(true)} /></View></View>}
  </AdaptiveSheetFrame></Overlay>;
}

export default function TrialHome({ food, meal, dailyMeals = [], bread, rice, address, openSubscriptionOnLoad = false }: { food: string; meal: string; dailyMeals?: Array<{ lunch: string; dinner: string }>; bread: string; rice: string; address: string; openSubscriptionOnLoad?: boolean }) {
  const insets = useSafeAreaInsets(); const seed = useMemo(() => initialMeals(food || 'Vegetarian', bread || 'Bhakri', rice || 'Jeera rice', meal || 'Lunch', address, dailyMeals), [address, bread, dailyMeals, food, meal]);
  const [meals, setMeals] = useState(seed); const [selectedId] = useState(seed[2]!.id); const [detailId, setDetailId] = useState(seed[2]!.id); const [sheetOpen, setSheetOpen] = useState(false); const [toast, setToast] = useState(''); const [activeTab, setActiveTab] = useState<'home' | 'profile'>('home'); const [subscriptionOpen, setSubscriptionOpen] = useState(openSubscriptionOnLoad); const [subscription, setSubscription] = useState<{ plan: string; meal: string; total: number; startDate: string } | null>(null);
  const selected = meals.find((item) => item.id === selectedId)!;
  const daysLeft = meals.filter((item) => item.status !== 'delivered').length;
  const detailMeal = meals.find((item) => item.id === detailId) ?? selected;
  const updateMeal = (updated: TrialMeal) => setMeals((current) => current.map((item) => item.id === updated.id ? updated : item));
  const showToast = (text: string) => { setToast(text); setTimeout(() => setToast(''), 2200); };
  return <View className="flex-1 bg-canvas">{activeTab === 'home' ? <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }}><View className="px-5"><Animated.Text entering={FadeInUp.delay(20).duration(240)} className="font-medium text-sm text-accent">ACTIVE TRIAL</Animated.Text><Animated.View entering={FadeInUp.delay(70).duration(260)} className="mt-2 flex-row items-center justify-between gap-3"><Text className="flex-1 font-semibold text-[24px] leading-8 tracking-[-0.5px] text-foreground">Your five-day trial</Text><Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => { setActiveTab('profile'); setSheetOpen(false); }} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={UserCircleIcon} size={24} weight="bold" /></Pressable></Animated.View><Animated.Text entering={FadeInUp.delay(130).duration(260)} className="mt-2 font-sans text-[15px] leading-6 text-muted">Tap a meal-status circle to view that meal’s details.</Animated.Text><Animated.View entering={FadeInUp.delay(210).duration(280)} className="mt-6"><TrialDayTracker meals={meals} selectedId={selectedId} showBoth={(subscription?.meal ?? meal) === 'Both'} onSelectDate={() => {}} onOpenMeal={(item) => { setDetailId(item.id); setSheetOpen(true); }} /></Animated.View><Animated.View entering={FadeInUp.delay(290).duration(280)}><SubscriptionCard active={!!subscription} daysLeft={daysLeft} onPress={() => subscription ? showToast(subscription.plan + " subscription active") : setSubscriptionOpen(true)} /></Animated.View><Animated.View entering={FadeInUp.delay(370).duration(280)} className="mt-6 rounded-[16px] border border-border bg-sheet p-5"><View className="flex-row items-start justify-between"><View><Text className="font-medium text-sm text-muted">SELECTED MEAL</Text><Text className="mt-2 font-semibold text-xl text-foreground">{selected.date}</Text><Text className="mt-1 font-sans text-[15px] leading-6 text-muted">{selected.mealType} · {selected.addressLabel}</Text></View><StatusBadge status={selected.status} /></View><Pressable accessibilityRole="button" onPress={() => { setDetailId(selected.id); setSheetOpen(true); }} className="mt-5 h-12 items-center justify-center rounded-xl border border-border"><Text className="font-semibold text-foreground">View meal details</Text></Pressable></Animated.View></View></ScrollView> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }}><View className="px-5"><Animated.View entering={FadeInUp.delay(30).duration(260)} className="flex-row items-center justify-between gap-3"><Text className="font-semibold text-[24px] leading-8 tracking-[-0.5px] text-foreground">Profile</Text><Pressable accessibilityRole="button" accessibilityLabel="Back to trial" onPress={() => setActiveTab('home')} className="h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><HomeGlyph icon={HouseIcon} size={22} weight="bold" /></Pressable></Animated.View><Animated.Text entering={FadeInUp.delay(100).duration(260)} className="mt-2 font-sans text-[15px] leading-6 text-muted">Your meal preferences and delivery account.</Animated.Text><Animated.View entering={FadeInUp.delay(170).duration(280)} className="mt-6 rounded-[16px] bg-surface p-5"><Meta label="Food" value={food} /><View className="mt-3"><Meta label="Meal" value={meal} /></View><View className="mt-3"><Meta label="Bread" value={bread} /></View><View className="mt-3"><Meta label="Rice" value={rice} /></View><View className="mt-3"><Meta label="Address" value="Home" /></View></Animated.View></View></ScrollView>}{sheetOpen ? <MealDetailSheet meal={detailMeal} onClose={() => setSheetOpen(false)} onUpdate={updateMeal} onToast={showToast} /> : null}{subscriptionOpen ? <SubscriptionSheet food={food} bread={bread} rice={rice} address={address} initialMeal={meal} onClose={() => setSubscriptionOpen(false)} onToast={showToast} onActivated={(plan, selectedMeal, total, startDate) => { setSubscription({ plan, meal: selectedMeal, total, startDate }); showToast(plan + " plan activated for " + selectedMeal); }} /> : null}{toast ? <Animated.View entering={FadeIn.duration(180)} style={{ bottom: insets.bottom + 20 }} className="absolute inset-x-5 z-[80] rounded-xl bg-success p-4"><Text className="font-semibold text-center text-white">{toast}</Text></Animated.View> : null}</View>;
}
