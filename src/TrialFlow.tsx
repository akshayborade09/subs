import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import Animated, { Easing, FadeIn, FadeInUp, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { type Icon, type IconWeight } from 'phosphor-react-native';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { GenderFemaleIcon } from 'phosphor-react-native/src/icons/GenderFemale';
import { GenderMaleIcon } from 'phosphor-react-native/src/icons/GenderMale';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import SelectableMap from './SelectableMap';
import TrialHome, { AdaptiveSheetFrame, TRIAL_DAY_COUNT } from './TrialHome';
import { CenteredFieldInput, fieldValueTextClass } from './centeredFieldInput';
import { FormChromeSheetLayout, FormFieldStack, FormHeader, FormModalLayout, FormPageSection, FormSheetLayout, FormValidationText } from './formLayout';
import { headingDescriptionClass } from './typographyClasses';
import { themePalette, useFieldPlaceholderColor, useForegroundColor } from './themeColors';
import { PrimaryShimmerButton } from './primaryButton';

const confirmationMeal = require('../assets/food-thali.png');
const foodImages = {
  Vegetarian: require('../assets/onboarding/veg.png'),
  'Non-vegetarian': require('../assets/onboarding/nonveg.png'),
  'Mix of both': require('../assets/onboarding/veg-nonveg.png'),
} as const;
const genderOptions = [
  { label: 'Male', icon: GenderMaleIcon },
  { label: 'Female', icon: GenderFemaleIcon },
  { label: 'Others', icon: StarIcon },
] as const;

function TrialIconButton({ icon: Glyph, variant, onPress, accessibilityLabel }: { icon: Icon; variant: 'inverse' | 'surface'; onPress: () => void; accessibilityLabel: string }) {
  const { theme } = useUniwind();
  const iconColor = variant === 'inverse'
    ? (theme === 'dark' ? '#101010' : '#ffffff')
    : (theme === 'dark' ? '#ffffff' : '#101010');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      className={`size-icon-button shrink-0 items-center justify-center rounded-full p-2 ${variant === 'inverse' ? 'bg-foreground' : 'bg-surface'}`}
    >
      <Glyph size={20} weight="regular" color={iconColor} />
    </Pressable>
  );
}

function TrialAuthButton({ label, onPress, enabled = true }: { label: string; onPress: () => void; enabled?: boolean }) {
  return <PrimaryShimmerButton label={label} onPress={onPress} enabled={enabled} />;
}

function TrialBottomSheet({ onClose, closeLabel, children }: { onClose: () => void; closeLabel: string; children: ReactNode }) {
  return (
    <View className="absolute inset-0 z-50">
      <BlurView intensity={Platform.OS === 'android' ? 24 : 32} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'} style={StyleSheet.absoluteFill} />
      <Animated.View entering={FadeIn.duration(220)} className="absolute inset-0 bg-black/25" />
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} className="absolute inset-0" onPress={onClose} />
      <View pointerEvents="box-none" className="flex-1 justify-end">
        <Animated.View className="mx-4 mb-4 overflow-hidden rounded-sheet bg-canvas">
          <Animated.View entering={FadeInUp.duration(220)} className="p-sheet">
            {children}
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

function PersonalFormField({ label, value, onChangeText, placeholder, autoFocus, onSubmitEditing, inputRef }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; autoFocus?: boolean; onSubmitEditing?: () => void; inputRef?: React.RefObject<TextInput | null> }) {
  const [focused, setFocused] = useState(false);
  const { theme } = useUniwind();
  const foregroundColor = theme === 'dark' ? '#ffffff' : '#101010';
  const scrollFocusedField = useContext(FocusScrollContext);
  const localRef = useRef<TextInput>(null);
  const fieldClass = focused ? 'border border-foreground bg-canvas' : 'border border-transparent bg-field';
  return (
    <View className="gap-2">
      <Text className="font-body text-body-sm tracking-body-sm text-foreground">{label}</Text>
      <CenteredFieldInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        selectionColor={foregroundColor}
        shellClassName={fieldClass}
        inputRef={inputRef ?? localRef}
        autoFocus={autoFocus}
        returnKeyType="next"
        onSubmitEditing={onSubmitEditing}
        autoCapitalize="words"
        onFocus={() => { setFocused(true); scrollFocusedField?.((inputRef ?? localRef).current); }}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

function PersonalDateField({ value, onPress }: { value: string; onPress: () => void }) {
  const { theme } = useUniwind();
  const placeholderColor = useFieldPlaceholderColor();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  return (
    <View className="gap-2">
      <Text className="font-body text-body-sm tracking-body-sm text-foreground">Date of birth</Text>
      <Pressable accessibilityRole="button" onPress={onPress} className="h-field flex-row items-center gap-field-inline rounded-field border border-transparent bg-field px-sheet">
        <Text className={`flex-1 ${fieldValueTextClass} ${value ? 'text-foreground' : ''}`} style={value ? undefined : { color: placeholderColor }}>{value || 'DD-MM-YYYY'}</Text>
        <CalendarBlankIcon size={24} weight="regular" color={iconColor} />
      </Pressable>
    </View>
  );
}

function PersonalGenderCard({ label, icon: Glyph, selected, onPress }: { label: string; icon: Icon; selected: boolean; onPress: () => void }) {
  const { theme } = useUniwind();
  const palette = themePalette[theme === 'dark' ? 'dark' : 'light'];
  const iconColor = selected ? palette.accentForeground : (theme === 'dark' ? '#ffffff' : '#101010');
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`min-h-[86px] flex-1 justify-between rounded-field px-sheet py-3.5 ${selected ? 'bg-accent' : 'bg-field'}`}
    >
      <Text className={`font-body text-body-md tracking-body-md ${selected ? 'text-accent-foreground' : 'text-foreground'}`}>{label}</Text>
      <View className="items-end">
        <Glyph size={24} weight="regular" color={iconColor} />
      </View>
    </Pressable>
  );
}

function FlowGlyph({ icon: Glyph, size = 20, weight = 'regular', tone = 'foreground' }: { icon: Icon; size?: number; weight?: IconWeight; tone?: 'foreground' | 'accent' | 'accentForeground' }) {
  const { theme } = useUniwind();
  const palette = themePalette[theme === 'dark' ? 'dark' : 'light'];
  const color = tone === 'accent' ? palette.accent : tone === 'accentForeground' ? palette.accentForeground : (theme === 'dark' ? '#ffffff' : '#101010');
  return <Glyph size={Math.max(8, size - 4)} weight="bold" color={color} />;
}

type Step = 'personal' | 'intro' | 'food' | 'meal' | 'mixMeals' | 'bread' | 'rice' | 'locate' | 'address' | 'summary' | 'payment' | 'success' | 'tracker';
type Choice = { title: string; description: string };
type FoodChoice = Choice & { image: number };
type Address = { type: string; number: string; society: string; landmark: string; instructions: string; label: string };
type MealKind = 'Vegetarian' | 'Non-vegetarian' | '';
type DailyMealChoice = { lunch: MealKind; dinner: MealKind };
type WeekendDelivery = 'primary' | 'different' | 'skip';
type AddressMode = 'weekday' | 'weekend';
type State = { name: string; dob: string; gender: string; food: string; meal: string; dailyMeals: DailyMealChoice[]; bread: string; rice: string; trialDays: string[]; deliveryLocation: string; weekendDelivery: WeekendDelivery; weekendLocation: string; weekendAddress: string; address: Address; weekendAddressDetails: Address; payment: string };

// Future-scope plug: switch to true to restore the separate weekend location and address journey.
const ENABLE_WEEKEND_ADDRESS_FLOW = false;

const order: Step[] = ['personal', 'intro', 'food', 'meal', 'mixMeals', 'bread', 'rice', 'locate', 'address', 'summary', 'payment', 'success', 'tracker'];
const emptyAddress = (label = 'Home'): Address => ({ type: 'Apartment', number: '', society: '', landmark: '', instructions: '', label });
const initialState: State = { name: '', dob: '', gender: '', food: '', meal: '', dailyMeals: Array.from({ length: TRIAL_DAY_COUNT }, () => ({ lunch: '', dinner: '' })), bread: '', rice: '', trialDays: [], deliveryLocation: 'B-704, Green View Apartments, Baner Road, Pune 411045', weekendDelivery: 'primary', weekendLocation: '', weekendAddress: '', payment: '', address: emptyAddress(), weekendAddressDetails: emptyAddress() };
const food: FoodChoice[] = [
  { title: 'Vegetarian', description: 'Seasonal vegetables, paneer and home-style dals.', image: foodImages.Vegetarian },
  { title: 'Non-vegetarian', description: 'Home-style chicken, mutton and egg preparations.', image: foodImages['Non-vegetarian'] },
  { title: 'Mix of both', description: 'Enjoy vegetarian and non-vegetarian meals during your trial.', image: foodImages['Mix of both'] },
];
const meal: Choice[] = [
  { title: 'Lunch', description: 'Delivery between 11:00 AM and 1:00 PM' },
  { title: 'Dinner', description: 'Delivery between 6:30 PM and 8:30 PM' },
  { title: 'Both', description: 'Lunch and dinner every day' },
];
const bread: Choice[] = [
  { title: 'Chapati', description: 'Soft whole-wheat chapatis.' },
  { title: 'Bhakri', description: 'Traditional Maharashtrian bhakri.' },
  { title: 'Any', description: 'Let us serve chapati or bhakri based on the day’s meal.' },
];
const rice: Choice[] = [
  { title: 'Plain Rice', description: 'Simple steamed rice.' },
  { title: 'Jeera Rice', description: 'Rice lightly tempered with cumin.' },
  { title: 'Any', description: 'Let us serve plain or jeera rice based on the day’s meal.' },
];

function TrialPaymentButton({ total, enabled, onPress }: { total: number; enabled: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Start trial, pay ${total} rupees`}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 20, stiffness: 360 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 300 }); }}
        className={`w-full rounded-button-outer border border-foreground p-button-wrap ${enabled ? 'opacity-100' : 'opacity-40'}`}
      >
        <View className="h-field flex-row items-center justify-between rounded-button-inner bg-foreground px-5">
          <Text className="font-mono-semibold text-body-md text-canvas">Start trial</Text>
          <Text className="font-mono-semibold text-body-md text-canvas">Pay ₹{total}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Primary({ label, onPress, enabled = true }: { label: string; onPress: () => void; enabled?: boolean }) {
  return <TrialAuthButton label={label} onPress={onPress} enabled={enabled} />;
}

const FocusScrollContext = createContext<((input: TextInput | null) => void) | null>(null);
let trialSummaryScrollOffset = 0;

function Shell({ title, onBack, children, footer, footerDelay = 280, fixedHeader = true, initialScrollOffset = title === 'Your trial, at a glance' ? trialSummaryScrollOffset : 0, onScrollOffsetChange = title === 'Your trial, at a glance' ? (offset) => { trialSummaryScrollOffset = offset; } : undefined, animateContent = title !== 'Your trial, at a glance' }: { title: string; onBack?: () => void; children: React.ReactNode; footer?: React.ReactNode; footerDelay?: number; fixedHeader?: boolean; initialScrollOffset?: number; onScrollOffsetChange?: (offset: number) => void; animateContent?: boolean }) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const lastFocusedInput = useRef<TextInput | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const positionFocusedField = useCallback((input: TextInput | null, keyboardTop?: number) => {
    const scroll = scrollRef.current;
    if (!scroll || !input) return;
    const resolvedKeyboardTop = keyboardTop ?? Keyboard.metrics()?.screenY;
    if (!resolvedKeyboardTop) return;
    input.measureInWindow((_inputX, inputY, _inputWidth, inputHeight) => {
      const fieldBottom = inputY + Math.max(inputHeight, 52);
      const overlap = fieldBottom + 20 - resolvedKeyboardTop;
      if (overlap > 0) scroll.scrollTo({ y: Math.max(0, scrollOffset.current + overlap), animated: true });
    });
  }, []);
  const scrollFocusedField = useCallback((input: TextInput | null) => {
    lastFocusedInput.current = input;
    positionFocusedField(input);
    setTimeout(() => positionFocusedField(input), 80);
    setTimeout(() => positionFocusedField(input), Platform.OS === 'android' ? 380 : 280);
  }, [positionFocusedField]);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      positionFocusedField(lastFocusedInput.current, event.endCoordinates.screenY);
      setTimeout(() => positionFocusedField(lastFocusedInput.current, event.endCoordinates.screenY), 100);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, [positionFocusedField]);
  const header = <View style={fixedHeader ? { paddingTop: insets.top + 12 } : undefined} className="bg-canvas px-5 pb-1">
    {onBack ? <View className="flex-row items-center gap-3">
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={8} className="size-6 items-center justify-center">
        <CaretLeftIcon size={24} weight="regular" color={iconColor} />
      </Pressable>
      <Animated.Text key={`${title}-title`} entering={animateContent ? FadeInUp.delay(30).duration(260) : undefined} className="flex-1 font-heading text-heading-md text-foreground">{title}</Animated.Text>
    </View> : <Animated.Text key={`${title}-title`} entering={animateContent ? FadeInUp.delay(30).duration(260) : undefined} className="font-heading text-heading-md text-foreground">{title}</Animated.Text>}
  </View>;
  return (
    <FocusScrollContext.Provider value={scrollFocusedField}>
    <View className="flex-1 bg-canvas">
    {fixedHeader ? header : null}
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-canvas">
      <ScrollView ref={scrollRef} contentOffset={{ x: 0, y: initialScrollOffset }} automaticallyAdjustKeyboardInsets keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" onScroll={(event) => { const offset = event.nativeEvent.contentOffset.y; scrollOffset.current = offset; onScrollOffsetChange?.(offset); }} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingTop: fixedHeader ? 0 : insets.top + 12, paddingBottom: insets.bottom + (footer ? 92 : 24) + keyboardHeight }}>
        {!fixedHeader ? header : null}
        <Animated.View key={`${title}-content`} entering={animateContent ? FadeInUp.delay(170).duration(280) : undefined} className="mx-5 mt-4">{children}</Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
      {footer ? <Animated.View key={`${title}-footer`} entering={animateContent ? FadeInUp.delay(footerDelay).duration(280) : undefined} style={{ paddingBottom: insets.bottom + 14 }} className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-3">{footer}</Animated.View> : null}
    </View>
    </FocusScrollContext.Provider>
  );
}

function ChoiceCards({ options, value, onChange }: { options: Choice[]; value: string; onChange: (value: string) => void }) {
  return <View className="gap-4">{options.map((option) => { const selected = value === option.title; return <Pressable key={option.title} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => onChange(option.title)} className={`flex-row gap-3 overflow-hidden rounded-field p-3 ${selected ? 'bg-accent' : 'bg-field'}`}><View className="min-w-0 flex-1 gap-2"><Text className={`font-mono-semibold text-body-md ${selected ? 'text-accent-foreground' : 'text-foreground'}`}>{option.title}</Text><Text className={`font-body text-body-xs leading-[18px] ${selected ? 'text-accent-foreground' : 'text-foreground'}`}>{option.description}</Text></View><View className={`size-20 shrink-0 rounded-button-inner ${selected ? 'bg-canvas/25' : 'bg-canvas'}`} /></Pressable>; })}</View>;
}

function FoodPreferenceCards({ options, value, onChange }: { options: FoodChoice[]; value: string; onChange: (value: string) => void }) {
  return (
    <View className="gap-4">
      {options.map((option, index) => {
        const selected = value === option.title;
        return (
          <Pressable
            key={option.title}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.title)}
            className={`flex-row items-stretch overflow-hidden rounded-card ${selected ? 'bg-accent' : 'bg-field'}`}
          >
            <View className="min-w-0 flex-1 justify-start gap-2 p-3">
              <Text className={`font-mono-semibold text-body-md ${selected ? 'text-accent-foreground' : 'text-foreground'}`}>{option.title}</Text>
              <Text className={`font-body text-body-xs leading-5 ${selected ? 'text-accent-foreground' : 'text-foreground'}`}>{option.description}</Text>
            </View>
            <View className="h-[116px] w-[161px] shrink-0 overflow-hidden pt-2">
              <View className="relative h-full w-full overflow-hidden">
                <Animated.View
                  entering={FadeInUp.delay(360 + index * 120).duration(560).withInitialValues({
                    opacity: 0,
                    transform: [{ translateY: 72 }],
                  })}
                  style={{ position: 'absolute', top: 0, left: 0, width: 181, height: 181 }}
                >
                  <Image
                    source={option.image}
                    accessibilityLabel={`${option.title} meal`}
                    resizeMode="cover"
                    style={{ width: 181, height: 181 }}
                  />
                </Animated.View>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function DailyMealPlan({ meal, dates, value, onChange }: { meal: string; dates: string[]; value: DailyMealChoice[]; onChange: (value: DailyMealChoice[]) => void }) {
  const mealRows = meal === 'Both' ? (['lunch', 'dinner'] as const) : meal === 'Dinner' ? (['dinner'] as const) : (['lunch'] as const);
  const update = (dayIndex: number, mealKey: 'lunch' | 'dinner', choice: Exclude<MealKind, ''>) => {
    onChange(value.map((day, index) => index === dayIndex ? { ...day, [mealKey]: choice } : day));
  };
  return <View className="gap-4">{value.map((day, dayIndex) =>
    <Animated.View key={`day-${dayIndex + 1}`} entering={FadeInUp.delay(190 + dayIndex * 55).duration(220)} className="rounded-field bg-field p-sheet">
      <Text className="font-mono-semibold text-body-md text-foreground">Day {dayIndex + 1}{dates[dayIndex] ? <Text className="font-body text-body-sm text-muted"> · {ordinalDateLabel(dates[dayIndex]!)} · {dateFromKey(dates[dayIndex]!).toLocaleDateString('en-IN', { weekday: 'short' })}</Text> : null}</Text>
      <View className="mt-3 gap-3">{mealRows.map((mealKey) =>
        <View key={mealKey} className="flex-row items-center gap-3">
          <Text className="w-14 font-body-medium text-body-sm capitalize text-foreground">{mealKey}</Text>
          <View className="flex-1 flex-row gap-2">{(['Vegetarian', 'Non-vegetarian'] as const).map((choice) => {
            const selected = day[mealKey] === choice;
            return <Pressable key={choice} accessibilityRole="radio" accessibilityLabel={`Day ${dayIndex + 1} ${mealKey} ${choice}`} accessibilityState={{ checked: selected }} onPress={() => update(dayIndex, mealKey, choice)} className={`h-9 flex-1 items-center justify-center rounded-field ${selected ? 'bg-accent' : 'bg-canvas'}`}><Text className={`font-mono-semibold text-body-sm ${selected ? 'text-accent-foreground' : 'text-muted'}`}>{choice === 'Vegetarian' ? 'Veg' : 'Non-veg'}</Text></Pressable>;
          })}</View>
        </View>
      )}</View>
    </Animated.View>
  )}</View>;
}

function AddressFormField({ label, value, onChangeText, placeholder, multiline = false, inputRef, returnKeyType = 'next', onSubmitEditing, autoFocus = false, animationDelay }: { label: string; value: string; onChangeText: (v: string) => void; placeholder: string; multiline?: boolean; inputRef?: React.RefObject<TextInput | null>; returnKeyType?: 'next' | 'done'; onSubmitEditing?: () => void; autoFocus?: boolean; animationDelay?: number }) {
  const [focused, setFocused] = useState(false);
  const placeholderColor = useFieldPlaceholderColor();
  const foregroundColor = useForegroundColor();
  const localRef = useRef<TextInput>(null);
  const scrollFocusedField = useContext(FocusScrollContext);
  const fieldClass = focused ? 'border border-foreground bg-canvas' : 'border border-transparent bg-field';
  const content = multiline ? (
    <TextInput ref={(node) => { localRef.current = node; if (inputRef) inputRef.current = node; }} autoFocus={autoFocus} value={value} onChangeText={onChangeText} onFocus={() => { setFocused(true); scrollFocusedField?.(localRef.current); }} onBlur={() => setFocused(false)} onSubmitEditing={onSubmitEditing} returnKeyType={returnKeyType} blurOnSubmit={returnKeyType === 'done'} submitBehavior="blurAndSubmit" placeholder={placeholder} placeholderTextColor={placeholderColor} multiline textAlignVertical="top" className={`min-h-[92px] rounded-field px-sheet py-4 font-body-medium text-body-md leading-6 tracking-body-md text-foreground ${fieldClass}`} />
  ) : (
    <CenteredFieldInput value={value} onChangeText={onChangeText} placeholder={placeholder} selectionColor={foregroundColor} shellClassName={fieldClass} inputRef={inputRef ?? localRef} autoFocus={autoFocus} returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing} onFocus={() => { setFocused(true); scrollFocusedField?.((inputRef ?? localRef).current); }} onBlur={() => setFocused(false)} />
  );
  return <Animated.View entering={animationDelay === undefined ? undefined : FadeInUp.delay(animationDelay).duration(240)} className="gap-2"><Text className="font-body text-body-sm tracking-body-sm text-foreground">{label}</Text>{content}</Animated.View>;
}

function AddressTabs({ value, onChange }: { value: AddressMode; onChange: (value: AddressMode) => void }) {
  return <View accessibilityRole="tablist" className="flex-row rounded-field bg-field p-1">{(['weekday', 'weekend'] as const).map((mode) => { const active = value === mode; return <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(mode)} className={`h-field flex-1 items-center justify-center rounded-field ${active ? 'bg-canvas' : ''}`}><Text className={`font-mono-semibold text-body-sm capitalize ${active ? 'text-foreground' : 'text-muted'}`}>{mode}</Text></Pressable>; })}</View>;
}

function AddressLead({ mode, value }: { mode: AddressMode; value: string }) {
  return <View className="mt-4 flex-row items-start rounded-field bg-field p-sheet"><View className="mr-3 mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-icon-surface"><FlowGlyph icon={MapPinIcon} size={20} weight="bold" /></View><View className="flex-1"><Text className="font-body text-body-xs capitalize text-muted">{mode} address</Text><Text className="mt-1 font-body-medium text-body-md leading-6 text-foreground">{value}</Text></View></View>;
}

function LocationPanel({ addressText, onAddressChange, onOpenSearch }: { addressText: string; onAddressChange: (value: string) => void; onOpenSearch: () => void }) {
  const [query, setQuery] = useState(addressText);
  useEffect(() => setQuery(addressText), [addressText]);
  const updateFromMap = (value: string) => { setQuery(value); onAddressChange(value); };
  return <><Pressable accessibilityRole="button" accessibilityLabel="Search location" onPress={onOpenSearch} className="h-field flex-row items-center gap-field-inline rounded-field bg-field px-sheet"><FlowGlyph icon={MagnifyingGlassIcon} size={22} weight="bold" /><Text numberOfLines={1} ellipsizeMode="tail" className="flex-1 font-body-medium text-body-md leading-6 tracking-body-md text-foreground">{query || 'Search area, landmark or address'}</Text></Pressable><View className="overflow-hidden rounded-field"><SelectableMap searchQuery={query} onAddressChange={updateFromMap} /></View><Text className="mt-2 font-body text-body-xs leading-[18px] text-muted">Move the map to adjust the pin. The address updates automatically.</Text></>;
}

function SearchLocationScreen({ initialValue, onBack, onSelect }: { initialValue: string; onBack: () => void; onSelect: (value: string) => void }) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const [query, setQuery] = useState(initialValue);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    if (query.trim().length < 3) { setSuggestions([]); setSearching(false); return; }
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      void Location.geocodeAsync(query.trim()).then(async (matches) => {
        const labels = await Promise.all(matches.slice(0, 5).map(async (match) => {
          const places = await Location.reverseGeocodeAsync({ latitude: match.latitude, longitude: match.longitude });
          const place = places[0];
          if (!place) return query.trim();
          return [place.name, place.street, place.district, place.city, place.region, place.postalCode]
            .filter((part, index, all) => part && all.indexOf(part) === index)
            .join(', ');
        }));
        if (active) setSuggestions(Array.from(new Set(labels.filter(Boolean))));
      }).catch(() => { if (active) setSuggestions([]); }).finally(() => { if (active) setSearching(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  const selectSuggestion = (value: string) => {
    Keyboard.dismiss();
    onSelect(value);
  };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-canvas"><View style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }} className="flex-1 px-5"><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => { Keyboard.dismiss(); onBack(); }} hitSlop={8} className="mb-5 size-6 items-center justify-center"><FlowGlyph icon={CaretLeftIcon} size={24} weight="regular" /></Pressable><Text className="font-heading text-heading-md text-foreground">Search location</Text><View className="mt-6 h-field flex-row items-center gap-field-inline rounded-field border border-foreground bg-field px-sheet"><FlowGlyph icon={MagnifyingGlassIcon} size={22} weight="bold" /><TextInput autoFocus value={query} onChangeText={setQuery} returnKeyType="search" placeholder="Search area, landmark or address" placeholderTextColor={theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(16,16,16,0.35)'} textAlignVertical="center" style={{ paddingVertical: 0 }} className="h-field flex-1 font-body-medium text-body-md leading-6 tracking-body-md text-foreground" />{query.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} className="size-icon-button items-center justify-center rounded-full bg-icon-surface"><FlowGlyph icon={XIcon} size={20} weight="bold" /></Pressable> : null}</View><View className="mt-3 flex-1">{query.trim().length < 3 ? <View className="flex-1 items-center justify-center px-8"><FlowGlyph icon={MagnifyingGlassIcon} size={28} weight="bold" /><Text className="mt-3 text-center font-mono-semibold text-body-md text-foreground">Search for an area, landmark or address</Text><Text className="mt-1 text-center font-body text-body-sm leading-5 text-muted">Enter at least three characters to see matching locations.</Text></View> : searching ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#078a4b" /><Text className="mt-3 font-body text-body-sm text-muted">Searching locations…</Text></View> : <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{suggestions.map((location) => <Pressable key={location} onPress={() => selectSuggestion(location)} className="min-h-16 flex-row items-center border-b border-border py-3"><View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-icon-surface"><FlowGlyph icon={MapPinIcon} size={20} weight="bold" /></View><Text numberOfLines={2} ellipsizeMode="tail" className="flex-1 font-body-medium text-body-md leading-6 text-foreground">{location}</Text></Pressable>)}{suggestions.length === 0 ? <Text className="py-6 text-center font-body text-body-sm leading-5 text-muted">No matching locations found. Try a nearby landmark or a more complete address.</Text> : null}</ScrollView>}</View></View></KeyboardAvoidingView>;
}

function AddressForm({ address, setAddress, refs, topMargin = true }: { address: Address; setAddress: (key: keyof Address, value: string) => void; refs: { number: React.RefObject<TextInput | null>; society: React.RefObject<TextInput | null>; landmark: React.RefObject<TextInput | null>; instructions: React.RefObject<TextInput | null> }; topMargin?: boolean }) {
  return <View className={`${topMargin ? 'mt-5' : ''} gap-sheet-gap`}><Animated.View entering={FadeInUp.delay(190).duration(240)} className="gap-2"><Text className="font-body text-body-sm tracking-body-sm text-foreground">Building type</Text><View className="flex-row flex-wrap gap-2">{['Apartment', 'House', 'Office', 'Other'].map((type) => <Pressable key={type} onPress={() => setAddress('type', type)} className={`h-field justify-center rounded-field px-4 ${address.type === type ? 'bg-accent' : 'bg-field'}`}><Text className={`font-mono-semibold text-body-sm ${address.type === type ? 'text-accent-foreground' : 'text-foreground'}`}>{type}</Text></Pressable>)}</View></Animated.View><AddressFormField animationDelay={260} label="Flat, house or office number" value={address.number} onChangeText={(v) => setAddress('number', v)} placeholder="B-704" inputRef={refs.number} onSubmitEditing={() => refs.society.current?.focus()} /><AddressFormField animationDelay={330} label="Building or society name" value={address.society} onChangeText={(v) => setAddress('society', v)} placeholder="Green View Apartments" inputRef={refs.society} onSubmitEditing={() => refs.landmark.current?.focus()} /><AddressFormField animationDelay={400} label="Nearby landmark (optional)" value={address.landmark} onChangeText={(v) => setAddress('landmark', v)} placeholder="Near Baner Road" inputRef={refs.landmark} onSubmitEditing={() => refs.instructions.current?.focus()} /><AddressFormField animationDelay={470} label="Delivery instructions (optional)" value={address.instructions} onChangeText={(v) => setAddress('instructions', v)} placeholder="Gate, floor or delivery notes" multiline inputRef={refs.instructions} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} /></View>;
}

function EditAction({ onPress }: { onPress: () => void }) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  return <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={onPress} hitSlop={8} className="size-5 items-center justify-center"><PencilSimpleIcon size={20} weight="regular" color={iconColor} /></Pressable>;
}

function DeliverySummary({ data, onEdit }: { data: State; onEdit: () => void }) {
  const different = ENABLE_WEEKEND_ADDRESS_FLOW && data.weekendDelivery === 'different';
  const items = [{ label: 'Weekday', address: `${data.address.number}, ${data.address.society}, Pune 411045` }, { label: 'Weekend', address: `${data.weekendAddressDetails.number}, ${data.weekendAddressDetails.society}, ${data.weekendLocation}` }];
  return <View className="rounded-field bg-field p-sheet"><View className="flex-row items-center justify-between"><Text className="font-heading text-body-md text-foreground">Delivery address</Text><EditAction onPress={onEdit} /></View>{different ? <View className="mt-4 gap-5">{items.map((item) => <View key={item.label}><View className="mb-2 flex-row items-center"><View className="mr-2 h-7 w-7 items-center justify-center rounded-full bg-icon-surface"><FlowGlyph icon={MapPinIcon} size={18} weight="bold" /></View><Text className="font-mono-semibold text-body-md text-foreground">{item.label} address</Text></View><View className="overflow-hidden rounded-field"><SelectableMap compact /></View><Text className="mt-3 font-body text-body-sm leading-5 text-muted">{item.address}</Text></View>)}</View> : <><View className="mt-3 overflow-hidden rounded-field"><SelectableMap compact /></View><Text className="mt-3 font-body-medium text-body-sm leading-5 text-foreground">{data.address.number}, {data.address.society}, Pune 411045</Text></>}</View>;
}

function ConfirmAddressSheet({ data, onClose, onConfirm, onEdit, usesDifferentWeekendAddress, sections }: { data: State; onClose: () => void; onConfirm: () => void; onEdit: () => void; usesDifferentWeekendAddress: boolean; sections: Array<{ mode: string; value: Address; text: string }> }) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const renderAddressCard = (address: Address, text: string, editHandler: () => void) => (
    <View className="rounded-sheet bg-accent-soft p-sheet">
      <View className="flex-row items-center justify-between">
        <Text className="font-heading text-body-md text-foreground">{address.label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit address" onPress={editHandler} hitSlop={8}><PencilSimpleIcon size={20} weight="regular" color={iconColor} /></Pressable>
      </View>
      <Text className="mt-2.5 font-body-medium text-body-sm leading-5 text-foreground">{text}</Text>
      {address.landmark || address.instructions ? <Text className="mt-1 font-body-medium text-body-sm leading-5 text-foreground">{[address.landmark ? `Landmark · ${address.landmark}` : null, address.instructions ? `Note · ${address.instructions}` : null].filter(Boolean).join('\n')}</Text> : null}
    </View>
  );
  return (
    <TrialBottomSheet onClose={onClose} closeLabel="Close address confirmation">
      <FormModalLayout
        title="Confirm delivery address"
        subtitle="Make sure everything looks right before continuing."
        headerAction={<TrialIconButton icon={XIcon} variant="surface" onPress={onClose} accessibilityLabel="Close address confirmation" />}
        fields={<><View className="h-[109px] overflow-hidden rounded-sheet bg-field"><SelectableMap compact searchQuery={data.deliveryLocation} /></View>{usesDifferentWeekendAddress ? sections.map((section) => <View key={section.mode}>{renderAddressCard(section.value, section.text, onEdit)}</View>) : renderAddressCard(data.address, `${data.address.number}, ${data.address.society}, Baner Road, Pune 411045`, onEdit)}</>}
        primaryAction={<TrialAuthButton label="Confirm" onPress={onConfirm} />}
      />
    </TrialBottomSheet>
  );
}

const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function DateWheelColumn({ items, selected, onSelect, dayColumn = false }: { items: (string | number)[]; selected: string | number; onSelect: (index: number) => void; dayColumn?: boolean }) {
  const ref = useRef<FlatList<string | number>>(null);
  const selectedIndex = Math.max(0, items.findIndex((item) => item === selected));
  const initialSelectedIndex = useRef(selectedIndex);
  useEffect(() => {
    requestAnimationFrame(() => ref.current?.scrollToOffset({ offset: initialSelectedIndex.current * 44, animated: false }));
  }, []);
  const selectFromOffset = (offset: number) => onSelect(Math.max(0, Math.min(items.length - 1, Math.round(offset / 44))));
  return (
    <FlatList
      ref={ref}
      data={items}
      getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
      keyExtractor={(item) => String(item)}
      className="h-56 flex-1"
      showsVerticalScrollIndicator={false}
      snapToInterval={44}
      decelerationRate="fast"
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingVertical: 90 }}
      onScroll={(event) => selectFromOffset(event.nativeEvent.contentOffset.y)}
      onMomentumScrollEnd={(event) => selectFromOffset(event.nativeEvent.contentOffset.y)}
      renderItem={({ item, index }) => {
        const active = item === selected;
        return (
          <Pressable
            onPress={() => { onSelect(index); ref.current?.scrollToOffset({ offset: index * 44, animated: true }); }}
            className="h-11 items-center justify-center"
          >
            <Text className={`font-body text-body-md tracking-body-md ${active ? 'text-canvas' : 'text-muted'}`}>
              {dayColumn ? String(item).padStart(2, '0') : item}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

function DateSheet({ value, onClose, onConfirm }: { value: string; onClose: () => void; onConfirm: (value: string) => void }) {
  const now = new Date();
  const saved = value.split(' ');
  const [day, setDay] = useState(Number(saved[0]) || 18);
  const [month, setMonth] = useState(Math.max(0, months.indexOf(saved[1] ?? 'JUL')));
  const [year, setYear] = useState(Number(saved[2]) || Math.min(now.getFullYear(), 1992));
  const years = Array.from({ length: 100 }, (_, index) => now.getFullYear() - index);
  const candidate = new Date(year, month, day);
  const valid = candidate.getFullYear() === year && candidate.getMonth() === month && candidate <= now;
  const confirm = () => onConfirm(`${String(day).padStart(2, '0')} ${months[month]} ${year}`);
  return (
    <TrialBottomSheet onClose={onClose} closeLabel="Close date picker">
      <FormModalLayout
        title="Select date of birth"
        subtitle="Choose a date in the past."
        headerAction={<TrialIconButton icon={XIcon} variant="surface" onPress={onClose} accessibilityLabel="Close date picker" />}
        fields={<><View className="relative h-56"><View pointerEvents="none" className="absolute inset-x-0 top-[90px] h-11 rounded-field bg-foreground" /><View className="flex-1 flex-row"><DateWheelColumn items={Array.from({ length: 31 }, (_, index) => index + 1)} selected={day} onSelect={(index) => setDay(index + 1)} dayColumn /><DateWheelColumn items={months} selected={months[month]!} onSelect={setMonth} /><DateWheelColumn items={years} selected={year} onSelect={(index) => setYear(years[index]!)} /></View></View>{!valid ? <FormValidationText>Choose a valid date in the past.</FormValidationText> : null}</>}
        primaryAction={<TrialAuthButton label="Confirm date" enabled={valid} onPress={confirm} />}
      />
    </TrialBottomSheet>
  );
}

function TrialIntro({ onBack, onProceed, onSkipToSubscribe }: { onBack: () => void; onProceed: () => void; onSkipToSubscribe: () => void }) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 bg-surface">
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-center justify-between px-5 pb-4">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={8} className="size-icon-button items-center justify-center">
          <CaretLeftIcon size={24} weight="regular" color={iconColor} />
        </Pressable>
        <Text className="font-body text-body-sm tracking-body-sm text-foreground">sora kitchen</Text>
      </View>

      <View className="h-[186px] w-full items-center overflow-hidden">
        <View className="size-[314px] overflow-hidden rounded-full">
          <Image source={confirmationMeal} accessibilityLabel="Home-style tiffin meal" resizeMode="cover" className="size-full" />
        </View>
      </View>

      <View className="flex-1 rounded-t-sheet bg-canvas px-5 pt-5">
        <View className="flex-1  gap-auth-block">
          <Animated.View entering={FadeInUp.delay(30).duration(260)}>
            <FormHeader size="page" title="Let's start your 3 day trial" />
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(100).duration(260)}>
            <FormPageSection subheading="Your three-day trial comes at a discounted price.">
              <View className="gap-4 rounded-field bg-accent-soft p-sheet">
            <Text className="font-body text-body-sm text-accent">Trial benefit</Text>
            <Text className="font-body text-body-sm leading-5 tracking-body-sm text-foreground">
              Your three-day trial comes at a discounted price.{'\n\n'}Choose your food, meals and delivery days next. You can review everything before payment.
            </Text>
              </View>
            </FormPageSection>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(170).duration(260)} style={{ paddingBottom: Math.max(16, insets.bottom + 8) }} className="gap-4 pt-6">
          <TrialAuthButton label={ready ? 'Choose my trial' : 'Preparing your trial…'} enabled={ready} onPress={onProceed} />
          <Pressable accessibilityRole="button" onPress={onSkipToSubscribe} className="h-field items-center justify-center rounded-button-inner bg-surface">
            <Text className="font-mono-semibold text-body-md text-foreground">Skip to subscribe</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateFromKey = (value: string) => { const [year, month, day] = value.split('-').map(Number); return new Date(year!, month! - 1, day!); };
const trialDateLabel = (value: string) => dateFromKey(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
const ordinalDateLabel = (value: string) => {
  const date = dateFromKey(value);
  const day = date.getDate();
  const suffix = day % 10 === 1 && day % 100 !== 11 ? 'st' : day % 10 === 2 && day % 100 !== 12 ? 'nd' : day % 10 === 3 && day % 100 !== 13 ? 'rd' : 'th';
  return `${day}${suffix} ${date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
};
const trialRangeLabel = (days: string[]) => days.length ? `${trialDateLabel(days[0]!)} – ${trialDateLabel(days[days.length - 1]!)}` : 'Dates selected after preferences';
const addCalendarDays = (date: Date, amount: number) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };
const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;
function createTrialRun(start: Date, weekendDelivery: WeekendDelivery, skippedWeekendKeys: Set<string> = new Set()) {
  const selected: Date[] = [];
  let cursor = new Date(start);
  let daysInWindow = 0;
  while (selected.length < TRIAL_DAY_COUNT && daysInWindow < 7) {
    if ((weekendDelivery !== 'skip' || !isWeekend(cursor)) && !skippedWeekendKeys.has(dateKey(cursor))) selected.push(new Date(cursor));
    cursor = addCalendarDays(cursor, 1);
    daysInWindow += 1;
  }
  return selected;
}

function WeekendLocationSheet({ value, onClose, onSave }: { value: string; onClose: () => void; onSave: (value: string) => void }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(value);
  const [searchMode, setSearchMode] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!searchMode || query.trim().length < 3) { setSuggestions([]); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      void Location.geocodeAsync(query.trim()).then(async (results) => {
        const labels = await Promise.all(results.slice(0, 5).map(async (result) => {
          const places = await Location.reverseGeocodeAsync({ latitude: result.latitude, longitude: result.longitude });
          const place = places[0];
          return place ? [place.name, place.street, place.district, place.city, place.region, place.postalCode].filter((part, index, all) => part && all.indexOf(part) === index).join(', ') : '';
        }));
        setSuggestions(labels.filter(Boolean));
      }).catch(() => setSuggestions([])).finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query, searchMode]);
  const selectLocation = (location: string) => { setQuery(location); Keyboard.dismiss(); setSearchMode(false); };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="absolute inset-0 z-[80] justify-end"><BlurView intensity={Platform.OS === 'android' ? 24 : 32} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'} style={StyleSheet.absoluteFill} /><View pointerEvents="none" className="absolute inset-0 bg-black/30" /><Pressable className="absolute inset-0" onPress={() => { Keyboard.dismiss(); onClose(); }} /><Animated.View entering={FadeInUp.duration(240)} style={{ height: searchMode ? '100%' : '80%', marginBottom: searchMode ? 0 : 16 }} className={`${searchMode ? 'mx-0 rounded-none' : 'mx-4 rounded-[20px]'} overflow-hidden bg-sheet`}><View style={{ height: 64 + (searchMode ? insets.top : 0), paddingTop: searchMode ? insets.top : 0 }} className="flex-row items-center px-4"><View className="flex-1 pr-12"><FormHeader title="Choose weekend location" size="sheet" /></View><Pressable accessibilityRole="button" accessibilityLabel="Close weekend location" onPress={onClose} className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><FlowGlyph icon={XIcon} size={20} weight="bold" /></Pressable></View><View className="flex-1 px-4 pb-4"><TextInput value={query} onFocus={() => setSearchMode(true)} onChangeText={setQuery} returnKeyType="search" placeholder="Search area, landmark or address" placeholderTextColor="#8b8a84" className="h-14 rounded-xl border border-control-border bg-surface px-4 font-sans text-base text-foreground" />{searchMode ? <View className="flex-1"><View className="mt-5"><FormHeader title="Type a location to find it" subtitle="Choose a result to return to the map and adjust the pin." size="sheet" /></View>{searching ? <Text className="mt-6 font-medium text-muted">Searching locations…</Text> : null}<ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="mt-4">{suggestions.map((location) => <Pressable key={location} onPress={() => selectLocation(location)} className="min-h-16 flex-row items-center border-b border-border py-3"><View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-icon-surface"><FlowGlyph icon={MapPinIcon} size={20} weight="bold" /></View><Text className="flex-1 font-medium text-base leading-6 text-foreground">{location}</Text></Pressable>)}{!searching && query.trim().length >= 3 && suggestions.length === 0 ? <Text className="mt-4 font-sans text-[15px] text-muted">No locations found. Try an area, landmark or complete address.</Text> : null}</ScrollView></View> : <><View className="mt-4 min-h-[180px] flex-1"><SelectableMap fill searchQuery={query} onAddressChange={setQuery} /></View><Text className="mt-3 font-body text-body-xs leading-5 text-muted">Pan or zoom the map to position the pin. The address above updates from the map location.</Text><View className="mt-sheet-gap"><Primary label="Save location" enabled={query.trim().length > 2} onPress={() => { Keyboard.dismiss(); onSave(query.trim()); }} /></View></>}</View></Animated.View></KeyboardAvoidingView>;
}

function LegacyTrialCalendarSheet({ initialDays, initialWeekendDelivery, initialWeekendLocation, initialWeekendAddress, onClose, onConfirm }: { initialDays: string[]; initialWeekendDelivery: WeekendDelivery; initialWeekendLocation: string; initialWeekendAddress: string; onClose: () => void; onConfirm: (days: string[], weekendDelivery: WeekendDelivery, weekendLocation: string, weekendAddress: string) => void }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const calendarDays = Array.from({ length: 9 }, (_, index) => addCalendarDays(today, index - 2));
  const initialIndex = Math.max(0, calendarDays.findIndex((date) => dateKey(date) === initialDays[0]));
  const [startIndex, setStartIndex] = useState(initialIndex);
  const [weekendDelivery, setWeekendDelivery] = useState<WeekendDelivery>(initialWeekendDelivery === 'skip' ? 'primary' : initialWeekendDelivery);
  const [weekendLocation, setWeekendLocation] = useState(initialWeekendLocation);
  const [weekendAddress, setWeekendAddress] = useState(initialWeekendAddress);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [iosKeyboardHeight, setIosKeyboardHeight] = useState(0);
  const [skippedWeekendKeys, setSkippedWeekendKeys] = useState<Set<string>>(new Set());
  const calendarScrollRef = useRef<ScrollView>(null);
  const weekendAddressRef = useRef<TextInput>(null);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (event) => {
      setIosKeyboardHeight(event.endCoordinates.height);
      setTimeout(() => calendarScrollRef.current?.scrollToEnd({ animated: true }), 120);
      setTimeout(() => calendarScrollRef.current?.scrollToEnd({ animated: true }), 320);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setIosKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const selectedDates = createTrialRun(calendarDays[startIndex]!, weekendDelivery, skippedWeekendKeys);
  const selectedKeys = new Set(selectedDates.map(dateKey));
  const includesWeekend = selectedDates.some(isWeekend);
  const canConfirm = !ENABLE_WEEKEND_ADDRESS_FLOW || weekendDelivery !== 'different' || !includesWeekend || (weekendLocation.trim().length > 2 && weekendAddress.trim().length > 5);
  const options: { id: WeekendDelivery; title: string; body: string }[] = [
    { id: 'primary', title: 'Use my primary address', body: 'Weekend meals will use the address you add later.' },
    { id: 'different', title: 'Use a different weekend address', body: 'Add a separate location for Saturday or Sunday.' },
  ];
  return <><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="absolute inset-0 z-50 justify-end"><BlurView intensity={Platform.OS === 'android' ? 24 : 32} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'} style={StyleSheet.absoluteFill} /><View pointerEvents="none" className="absolute inset-0 bg-black/30" /><Pressable className="absolute inset-0" onPress={onClose} /><AdaptiveSheetFrame onClose={onClose} title="Choose your three days">{(sheetControls) => <ScrollView ref={calendarScrollRef} onContentSizeChange={(_width, height) => sheetControls.setContentHeight(height)} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled={sheetControls.scrollEnabled} onScrollBeginDrag={sheetControls.onScrollBeginDrag} onScrollEndDrag={sheetControls.onScrollEndDrag} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' && weekendDelivery === 'different' ? iosKeyboardHeight + 24 : 24 }}><FormChromeSheetLayout subtitle="Tap a start date to build three delivery days. Saturday and Sunday use the same delivery address." fields={<><View className="flex-row">{['S','M','T','W','T','F','S'].map((day, index) => <Text key={`${day}-${index}`} className="w-[14.285%] text-center font-medium text-sm text-muted">{day}</Text>)}</View><View className="mt-2 flex-row flex-wrap">{Array.from({ length: calendarDays[0]!.getDay() }, (_, index) => <View key={`empty-${index}`} className="w-[14.285%]" />)}{calendarDays.map((date, index) => { const selected = selectedKeys.has(dateKey(date)); const weekend = isWeekend(date); return <View key={dateKey(date)} className="w-[14.285%] items-center py-1"><Pressable accessibilityRole="radio" accessibilityState={{ checked: index === startIndex }} accessibilityLabel={`Start trial on ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`} onPress={() => { if (weekend && index > startIndex && index <= startIndex + 7) { const key = dateKey(date); setSkippedWeekendKeys((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; }); } else { setStartIndex(index); setSkippedWeekendKeys(new Set()); } }} className={`h-7 w-7 items-center justify-center rounded-full ${selected ? 'bg-accent ring-2 ring-accent ring-offset-[3px] ring-offset-sheet' : weekend ? 'bg-surface' : ''}`}><Text className={`font-medium text-sm ${selected ? 'text-accent-foreground' : weekend ? 'text-muted' : 'text-foreground'}`}>{date.getDate()}</Text></Pressable></View>; })}</View>{ENABLE_WEEKEND_ADDRESS_FLOW ? <><Text className="mb-3 mt-6 font-semibold text-xl text-foreground">Weekend delivery</Text><View className="gap-3">{options.map((option) => { const selected = weekendDelivery === option.id; return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { setWeekendDelivery(option.id); if (option.id === 'different') { sheetControls.expand(); Keyboard.dismiss(); setLocationPickerOpen(true); } }} className={`rounded-[16px] border p-4 ${selected ? 'border-[3px] border-accent bg-accent/10' : 'border-control-border'}`}><View className="flex-row items-start"><View className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-accent' : 'border-control-border'}`}>{selected ? <View className="h-3 w-3 rounded-full bg-accent" /> : null}</View><View className="ml-3 flex-1"><Text className="font-medium text-lg text-foreground">{option.title}</Text><Text className="mt-1 font-sans text-[15px] leading-6 text-muted">{option.body}</Text></View></View></Pressable>; })}</View>{weekendDelivery === 'different' && includesWeekend ? <View className="mt-4"><View className="rounded-[14px] bg-surface p-3"><View className="flex-row items-center"><View className="flex-1 pr-3"><Text className="font-medium text-sm text-muted">WEEKEND LOCATION</Text><Text className="mt-1 font-medium text-base leading-5 text-foreground">{weekendLocation || 'Choose a location on the map'}</Text></View><View className="h-12 w-12 overflow-hidden rounded-xl"><SelectableMap compact searchQuery={weekendLocation} /></View></View><Pressable accessibilityRole="button" onPress={() => { Keyboard.dismiss(); setLocationPickerOpen(true); }} className="mt-3 min-h-9 flex-row items-center border-t border-border pt-2"><FlowGlyph icon={PencilSimpleIcon} size={18} weight="bold" tone="accent" /><Text className="ml-1.5 font-semibold text-sm text-accent">Edit pin</Text></Pressable></View><Text className="mb-2 mt-4 font-medium text-sm text-muted">WEEKEND ADDRESS</Text><TextInput ref={weekendAddressRef} value={weekendAddress} onChangeText={setWeekendAddress} placeholder="Flat, building, street and area" placeholderTextColor="#8b8a84" returnKeyType="done" onFocus={() => setTimeout(() => calendarScrollRef.current?.scrollToEnd({ animated: true }), 100)} className="h-14 rounded-xl border border-control-border bg-sheet px-4 font-sans text-base text-foreground" /></View> : null}</> : null}</>} primaryAction={<Primary label="Confirm three days" enabled={canConfirm} onPress={() => onConfirm(selectedDates.map(dateKey), ENABLE_WEEKEND_ADDRESS_FLOW ? weekendDelivery : 'primary', ENABLE_WEEKEND_ADDRESS_FLOW ? weekendLocation.trim() : '', ENABLE_WEEKEND_ADDRESS_FLOW ? weekendAddress.trim() : '')} />} /></ScrollView>}</AdaptiveSheetFrame></KeyboardAvoidingView>{ENABLE_WEEKEND_ADDRESS_FLOW && locationPickerOpen ? <WeekendLocationSheet value={weekendLocation} onClose={() => setLocationPickerOpen(false)} onSave={(value) => { setWeekendLocation(value); setLocationPickerOpen(false); setTimeout(() => calendarScrollRef.current?.scrollToEnd({ animated: true }), 180); }} /> : null}</>;
}

function LegacyWindowCalendarSheet({ initialDays, initialWeekendDelivery, initialWeekendLocation, initialWeekendAddress, onClose, onConfirm }: { initialDays: string[]; initialWeekendDelivery: WeekendDelivery; initialWeekendLocation: string; initialWeekendAddress: string; onClose: () => void; onConfirm: (days: string[], weekendDelivery: WeekendDelivery, weekendLocation: string, weekendAddress: string) => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const calendarDays = Array.from({ length: 9 }, (_, index) => addCalendarDays(today, index - 2));
  const savedDays = initialDays.filter((key) => calendarDays.some((date) => dateKey(date) === key)).slice(0, TRIAL_DAY_COUNT);
  const savedStart = savedDays.length ? calendarDays.findIndex((date) => dateKey(date) === savedDays[0]) : -1;
  const [startIndex, setStartIndex] = useState(savedStart);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(savedDays));
  const calendarScrollRef = useRef<ScrollView>(null);
  const selectedDates = calendarDays.filter((date) => selectedKeys.has(dateKey(date)));
  const selectedIndexes = calendarDays.map((date, index) => selectedKeys.has(dateKey(date)) ? index : -1).filter((index) => index >= 0);
  const hasWindow = startIndex >= 0;
  const windowEnd = hasWindow ? startIndex + 6 : -1;
  const frameStart = selectedIndexes.length ? Math.max(0, Math.min(...selectedIndexes) - 2) : 0;
  const frameEnd = selectedIndexes.length ? Math.min(calendarDays.length - 1, Math.max(...selectedIndexes) + 2) : calendarDays.length - 1;

  const chooseDate = (index: number) => {
    const key = dateKey(calendarDays[index]!);
    if (!hasWindow || index < startIndex || index > windowEnd) {
      setStartIndex(index);
      setSelectedKeys(new Set([key]));
      return;
    }
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else if (next.size < TRIAL_DAY_COUNT) next.add(key);
      return next;
    });
  };

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="absolute inset-0 z-50 justify-end"><BlurView intensity={Platform.OS === 'android' ? 24 : 32} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'} style={StyleSheet.absoluteFill} /><View pointerEvents="none" className="absolute inset-0 bg-black/30" /><Pressable className="absolute inset-0" onPress={onClose} /><AdaptiveSheetFrame onClose={onClose} title="Choose your three days">{(sheetControls) => <ScrollView ref={calendarScrollRef} onContentSizeChange={(_width, height) => sheetControls.setContentHeight(height)} showsVerticalScrollIndicator={false} scrollEnabled={sheetControls.scrollEnabled} onScrollBeginDrag={sheetControls.onScrollBeginDrag} onScrollEndDrag={sheetControls.onScrollEndDrag} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}><FormChromeSheetLayout subtitle="Choose three delivery days. The calendar keeps two context days before and two after your three-day selection frame." fields={<><View className="flex-row">{['S','M','T','W','T','F','S'].map((day, index) => <Text key={`${day}-${index}`} className="w-[14.285%] text-center font-medium text-sm text-muted">{day}</Text>)}</View><View className="mt-2 flex-row flex-wrap">{Array.from({ length: calendarDays[0]!.getDay() }, (_, index) => <View key={`empty-${index}`} className="w-[14.285%]" />)}{calendarDays.map((date, index) => { const key = dateKey(date); const selected = selectedKeys.has(key); const inWindow = !hasWindow || (index >= startIndex && index <= windowEnd); const inFrame = !hasWindow || (index >= frameStart && index <= frameEnd); return <View key={key} className={`w-[14.285%] items-center py-1 ${inFrame ? '' : 'opacity-55'}`}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${inWindow ? '' : ', starts a new selection frame'}`} onPress={() => chooseDate(index)} className={`h-7 w-7 items-center justify-center rounded-full ${selected ? 'bg-accent ring-2 ring-accent ring-offset-[3px] ring-offset-sheet' : inFrame ? 'bg-surface-raised' : 'bg-surface'}`}><Text className={`font-medium text-sm ${selected ? 'text-accent-foreground' : 'text-foreground'}`}>{date.getDate()}</Text></Pressable></View>; })}</View></>} primaryAction={<Primary label="Confirm three days" enabled={selectedDates.length === TRIAL_DAY_COUNT} onPress={() => onConfirm(selectedDates.map(dateKey), initialWeekendDelivery, initialWeekendLocation, initialWeekendAddress)} />} /></ScrollView>}</AdaptiveSheetFrame></KeyboardAvoidingView>;
}

function TrialCalendarSheet({ initialDays, initialWeekendDelivery, initialWeekendLocation, initialWeekendAddress, onClose, onConfirm }: { initialDays: string[]; initialWeekendDelivery: WeekendDelivery; initialWeekendLocation: string; initialWeekendAddress: string; onClose: () => void; onConfirm: (days: string[], weekendDelivery: WeekendDelivery, weekendLocation: string, weekendAddress: string) => void }) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(240, width - 64);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsedInitial = initialDays.map((key) => new Date(`${key}T00:00:00`)).filter((date) => !Number.isNaN(date.getTime()));
  const [anchor, setAnchor] = useState<Date | null>(parsedInitial[0] ?? null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(initialDays.slice(0, TRIAL_DAY_COUNT)));
  const months = Array.from({ length: 6 }, (_, index) => new Date(today.getFullYear(), today.getMonth() + index, 1));
  const initialMonthIndex = parsedInitial.length
    ? Math.max(0, Math.min(months.length - 1, (parsedInitial[0]!.getFullYear() - today.getFullYear()) * 12 + parsedInitial[0]!.getMonth() - today.getMonth()))
    : 0;
  const calendarPagerRef = useRef<any>(null);
  const visibleMonthIndex = useRef(initialMonthIndex);
  useEffect(() => {
    const timer = setTimeout(() => calendarPagerRef.current?.scrollTo({ x: visibleMonthIndex.current * pageWidth, animated: false }), 0);
    return () => clearTimeout(timer);
  }, [pageWidth]);
  const selectedDates = Array.from(selectedKeys).map((key) => new Date(`${key}T00:00:00`)).sort((a, b) => a.getTime() - b.getTime());
  const dayDifference = (left: Date, right: Date) => Math.round((right.getTime() - left.getTime()) / 86400000);
  const minDate = anchor ? addCalendarDays(anchor, -6) : today;
  const maxDate = anchor ? addCalendarDays(anchor, 6) : addCalendarDays(today, 180);
  const isContinuous = selectedDates.length === TRIAL_DAY_COUNT && selectedDates.every((date, index) => {
    if (index === 0) return true;
    let cursor = addCalendarDays(selectedDates[index - 1]!, 1);
    while (cursor < date) {
      if (!isWeekend(cursor)) return false;
      cursor = addCalendarDays(cursor, 1);
    }
    return true;
  });
  const toggleDate = (date: Date) => {
    if (date < today) return;
    if (!anchor) {
      setAnchor(date);
      setSelectedKeys(new Set([dateKey(date)]));
      return;
    }
    if (date < minDate || date > maxDate) return;
    const key = dateKey(date);
    if (selectedKeys.has(key) && selectedKeys.size === 1) {
      setSelectedKeys(new Set());
      setAnchor(null);
      return;
    }
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else if (next.size < TRIAL_DAY_COUNT) next.add(key);
      return next;
    });
  };
  const renderMonth = (month: Date) => {
    const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const dates = Array.from({ length: totalDays }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1));
    return <View key={`${month.getFullYear()}-${month.getMonth()}`} style={{ width: pageWidth, overflow: 'hidden' }}>
      <Text className="mb-4 px-5 font-heading text-body-md text-foreground">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
      <View className="flex-row">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} className="w-[14.285%] text-center font-body text-body-xs text-muted">{day}</Text>)}</View>
      <View className="mt-2 flex-row flex-wrap">{Array.from({ length: month.getDay() }, (_, index) => <View key={`blank-${index}`} className="w-[14.285%]" />)}{dates.map((date) => {
        const key = dateKey(date);
        const selected = selectedKeys.has(key);
        const disabled = date < today || (!!anchor && (date < minDate || date > maxDate));
        return <View key={key} className="w-[14.285%] items-center py-1.5"><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => toggleDate(date)} className={`h-8 w-8 items-center justify-center rounded-full ${selected ? 'bg-accent ring-2 ring-accent ring-offset-[3px] ring-offset-sheet' : 'bg-field'} ${disabled ? 'opacity-30' : ''}`}><Text className={`font-mono-semibold text-body-sm ${selected ? 'text-accent-foreground' : 'text-foreground'}`}>{date.getDate()}</Text></Pressable></View>;
      })}</View>
    </View>;
  };
  return (
    <TrialBottomSheet onClose={onClose} closeLabel="Close calendar">
      <FormModalLayout
        title="Choose your three days"
        subtitle="Choose three continuous delivery days. Saturday and Sunday may be skipped."
        headerAction={<TrialIconButton icon={XIcon} variant="surface" onPress={onClose} accessibilityLabel="Close calendar" />}
        fields={<><Animated.ScrollView ref={calendarPagerRef} horizontal pagingEnabled snapToInterval={pageWidth} decelerationRate="fast" showsHorizontalScrollIndicator={false} style={{ width: pageWidth, alignSelf: 'center', overflow: 'hidden' }} layout={LinearTransition.duration(180).easing(Easing.inOut(Easing.quad))} contentOffset={{ x: initialMonthIndex * pageWidth, y: 0 }} onMomentumScrollEnd={(event) => { visibleMonthIndex.current = Math.round(event.nativeEvent.contentOffset.x / pageWidth); }}>{months.map(renderMonth)}</Animated.ScrollView>{selectedDates.length === TRIAL_DAY_COUNT && !isContinuous ? <FormValidationText>Keep weekdays continuous; only Saturday and Sunday can be skipped.</FormValidationText> : null}</>}
        primaryAction={<TrialAuthButton label="Confirm three days" enabled={isContinuous} onPress={() => onConfirm(selectedDates.map(dateKey), initialWeekendDelivery, initialWeekendLocation, initialWeekendAddress)} />}
      />
    </TrialBottomSheet>
  );
}

export default function TrialFlow() {
  const [step, setStep] = useState<Step>('personal'); const [data, setData] = useState<State>(initialState); const [dateOpen, setDateOpen] = useState(false); const [calendarOpen, setCalendarOpen] = useState(false); const [paused, setPaused] = useState(false); const [pauseOpen, setPauseOpen] = useState(false); const [toast, setToast] = useState(false); const [returnToSummary, setReturnToSummary] = useState(false); const [openSubscriptionOnHome, setOpenSubscriptionOnHome] = useState(false);
  const [addressMode, setAddressMode] = useState<AddressMode>('weekday');
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [confirmAddressOpen, setConfirmAddressOpen] = useState(false);
  const addressNumberRef = useRef<TextInput>(null); const societyRef = useRef<TextInput>(null); const landmarkRef = useRef<TextInput>(null); const instructionsRef = useRef<TextInput>(null);
  const set = <K extends keyof State>(key: K, value: State[K]) => setData((current) => ({ ...current, [key]: value }));
  const setAddress = (key: keyof Address, value: string) => setData((current) => ({ ...current, address: { ...current.address, [key]: value } }));
  const setWeekendAddressDetails = (key: keyof Address, value: string) => setData((current) => ({ ...current, weekendAddressDetails: { ...current.weekendAddressDetails, [key]: value } }));
  const index = order.indexOf(step); const next = () => { if (returnToSummary && ['food', 'meal', 'mixMeals', 'bread', 'rice', 'address'].includes(step)) { setReturnToSummary(false); setStep('summary'); return; } setStep(order[Math.min(order.length - 1, index + 1)]!); }; const back = () => { if (returnToSummary) { setReturnToSummary(false); setStep('summary'); return; } setStep(order[Math.max(0, index - 1)]!); };
  const confirmSections = [{ mode: 'Weekday', value: data.address, text: `${data.address.number}, ${data.address.society}, Baner Road, Pune 411045` }, { mode: 'Weekend', value: data.weekendAddressDetails, text: `${data.weekendAddressDetails.number}, ${data.weekendAddressDetails.society}, ${data.weekendLocation}` }];
  const openConfirmAddress = () => { Keyboard.dismiss(); setConfirmAddressOpen(true); };
  const finishAddress = () => { setConfirmAddressOpen(false); if (returnToSummary) { setReturnToSummary(false); setStep('summary'); return; } setStep('summary'); };
  const meals = data.meal === 'Both' ? TRIAL_DAY_COUNT * 2 : TRIAL_DAY_COUNT;
  const dailyMealsComplete = data.dailyMeals.every((day) => (data.meal === 'Dinner' || !!day.lunch) && (data.meal === 'Lunch' || !!day.dinner));
  const total = 899;
  const usesDifferentWeekendAddress = ENABLE_WEEKEND_ADDRESS_FLOW && data.weekendDelivery === 'different';
  const activeAddress = addressMode === 'weekday' ? data.address : data.weekendAddressDetails;
  const activeAddressText = addressMode === 'weekday' ? data.deliveryLocation : (data.weekendLocation || 'Choose your weekend delivery location');
  const updateActiveLocation = (value: string) => addressMode === 'weekday' ? set('deliveryLocation', value) : set('weekendLocation', value);

  if (locationSearchOpen) return <SearchLocationScreen initialValue={activeAddressText} onBack={() => setLocationSearchOpen(false)} onSelect={(value) => { updateActiveLocation(value); setLocationSearchOpen(false); }} />;
  const addressRefs = { number: addressNumberRef, society: societyRef, landmark: landmarkRef, instructions: instructionsRef };

  if (step === 'personal') return <><Shell title="Tell us about you" onBack={undefined} footer={<TrialAuthButton label="Continue" enabled={data.name.trim().length > 1 && !!data.dob && !!data.gender} onPress={next} />}><FormPageSection subheading="A few details help us personalise your trial."><View className="gap-sheet-gap"><PersonalFormField label="Full name" autoFocus value={data.name} onChangeText={(value) => set('name', value)} placeholder="Your full name" onSubmitEditing={() => { Keyboard.dismiss(); setTimeout(() => setDateOpen(true), 120); }} /><PersonalDateField value={data.dob} onPress={() => { Keyboard.dismiss(); setTimeout(() => setDateOpen(true), 120); }} /><View className="gap-2"><Text className="font-body text-body-sm tracking-body-sm text-foreground">Gender</Text><View className="flex-row gap-otp">{genderOptions.map((option) => <PersonalGenderCard key={option.label} label={option.label} icon={option.icon} selected={data.gender === option.label} onPress={() => set('gender', option.label)} />)}</View></View></View></FormPageSection></Shell>{dateOpen ? <DateSheet value={data.dob} onClose={() => setDateOpen(false)} onConfirm={(value) => { set('dob', value); setDateOpen(false); }} /> : null}</>;
  if (step === 'intro') return <TrialIntro onBack={back} onProceed={next} onSkipToSubscribe={() => { setData((current) => ({ ...current, food: current.food || 'Vegetarian', meal: current.meal || 'Lunch', bread: current.bread || 'Chapati', rice: current.rice || 'Plain Rice' })); setOpenSubscriptionOnHome(true); setStep('tracker'); }} />;
  if (step === 'food') return <><Shell title="What do you enjoy eating?" onBack={back}><FormPageSection subheading="Choose one preference for your trial."><FoodPreferenceCards options={food} value={data.food} onChange={(value) => { set('food', value); setCalendarOpen(true); }} /></FormPageSection></Shell>{calendarOpen ? <TrialCalendarSheet initialDays={data.trialDays} initialWeekendDelivery={data.weekendDelivery} initialWeekendLocation={data.weekendLocation} initialWeekendAddress={data.weekendAddress} onClose={() => setCalendarOpen(false)} onConfirm={(trialDays, weekendDelivery, weekendLocation, weekendAddress) => { setData((current) => ({ ...current, trialDays, weekendDelivery, weekendLocation, weekendAddress, dailyMeals: Array.from({ length: TRIAL_DAY_COUNT }, (_, index) => current.dailyMeals[index] ?? { lunch: '', dinner: '' }) })); setCalendarOpen(false); setTimeout(next, 160); }} /> : null}</>
  if (step === 'meal') return <Shell title="Choose your meals" onBack={back}><FormPageSection subheading="Delivery windows are fixed so every day stays predictable."><ChoiceCards options={meal} value={data.meal} onChange={(v) => { set('meal', v); setTimeout(() => { if (data.food === 'Mix of both') setStep('mixMeals'); else if (returnToSummary) { setReturnToSummary(false); setStep('summary'); } else setStep('bread'); }, 160); }} /></FormPageSection></Shell>;
  if (step === 'mixMeals') return <Shell title="Plan your three days" onBack={back} footer={<TrialAuthButton label="Continue" enabled={dailyMealsComplete} onPress={next} />}><FormPageSection subheading="Choose vegetarian or non-vegetarian food for each selected meal."><DailyMealPlan meal={data.meal} dates={data.trialDays} value={data.dailyMeals} onChange={(value) => set('dailyMeals', value)} /></FormPageSection></Shell>;
  if (step === 'bread') return <Shell title="Choose your bread" onBack={() => { if (returnToSummary) back(); else setStep(data.food === 'Mix of both' ? 'mixMeals' : 'meal'); }}><FormPageSection subheading="Pick what feels most familiar at home."><ChoiceCards options={bread} value={data.bread} onChange={(v) => { set('bread', v); setTimeout(next, 160); }} /></FormPageSection></Shell>;
  if (step === 'rice') return <Shell title="Choose your rice" onBack={back}><FormPageSection subheading="You can change this later for upcoming meals."><ChoiceCards options={rice} value={data.rice} onChange={(v) => { set('rice', v); setTimeout(next, 160); }} /></FormPageSection></Shell>;
  if (step === 'locate') return <Shell title="Where should we deliver?" onBack={back} footerDelay={390} footer={<TrialAuthButton label="Next" onPress={() => { if (usesDifferentWeekendAddress && addressMode === 'weekday') { setAddressMode('weekend'); } else { setAddressMode('weekday'); next(); } }} />}><FormPageSection subheading="Search for a location, then adjust the pin on the map."><View className="gap-sheet-gap">{usesDifferentWeekendAddress ? <AddressTabs value={addressMode} onChange={setAddressMode} /> : null}<LocationPanel addressText={activeAddressText} onAddressChange={updateActiveLocation} onOpenSearch={() => setLocationSearchOpen(true)} /></View></FormPageSection></Shell>;
  if (step === 'address') { const validAddress = !!activeAddress.type && !!activeAddress.number && !!activeAddress.society; const weekdayValid = !!data.address.type && !!data.address.number && !!data.address.society; return <><Shell title="Add address details" onBack={back} footerDelay={540} footer={<TrialAuthButton label={usesDifferentWeekendAddress ? `Save ${addressMode} address` : 'Save address'} enabled={validAddress && (!usesDifferentWeekendAddress || addressMode === 'weekday' || weekdayValid)} onPress={() => { if (usesDifferentWeekendAddress && addressMode === 'weekday') setAddressMode('weekend'); else { setAddressMode('weekday'); openConfirmAddress(); } }} />}><FormPageSection subheading={usesDifferentWeekendAddress ? undefined : data.deliveryLocation}>{usesDifferentWeekendAddress ? <><AddressTabs value={addressMode} onChange={setAddressMode} /><AddressLead mode={addressMode} value={activeAddressText} /><AddressForm address={activeAddress} setAddress={addressMode === 'weekday' ? setAddress : setWeekendAddressDetails} refs={addressRefs} /></> : <AddressForm address={data.address} setAddress={setAddress} refs={addressRefs} topMargin={false} />}</FormPageSection></Shell>{confirmAddressOpen ? <ConfirmAddressSheet data={data} onClose={() => setConfirmAddressOpen(false)} onConfirm={finishAddress} onEdit={() => setConfirmAddressOpen(false)} usesDifferentWeekendAddress={usesDifferentWeekendAddress} sections={confirmSections} /> : null}</>; }
  if (step === 'summary') return <Summary data={data} meals={meals} total={total} onBack={back} onEdit={(target) => { setReturnToSummary(true); setStep(target); }} onNext={next} />;
  if (step === 'payment') return <Shell title="Complete payment" onBack={back} footer={<TrialPaymentButton total={total} enabled={!!data.payment} onPress={next} />}><FormPageSection subheading="Choose a secure payment method for your three-day trial."><ChoiceCards options={['UPI', 'Credit or debit card', 'Net banking', 'Digital wallet'].map((title) => ({ title, description: title === 'UPI' ? 'Pay with any UPI app.' : `Pay securely using ${title.toLowerCase()}.` }))} value={data.payment} onChange={(v) => set('payment', v)} /><Text className="mt-4 text-center font-body text-body-xs text-muted">Your payment is protected by secure, encrypted processing.</Text></FormPageSection></Shell>;
  if (step === 'success') return <TrialConfirmation data={data} total={total} onContinue={next} />;
  return <TrialHome food={data.food} meal={data.meal} dailyMeals={data.dailyMeals} bread={data.bread} rice={data.rice} address={`${data.address.number || 'B-704'}, ${data.address.society || 'Green View Apartments'}, Baner Road, Pune 411045`} openSubscriptionOnLoad={openSubscriptionOnHome} />;
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) { return <View className="flex-row justify-between gap-4"><Text className="font-body text-body-sm text-muted">{label}</Text><Text className={`max-w-[60%] text-right font-body-medium text-body-md leading-6 text-foreground ${bold ? 'font-mono-semibold' : ''}`}>{value}</Text></View>; }

function TrialConfirmation({ data, total, onContinue }: { data: State; total: number; onContinue: () => void }) {
  const insets = useSafeAreaInsets();
  const address = `${data.address.number}, ${data.address.society}, Baner Road, Pune 411045`;
  return <View className="flex-1 bg-canvas"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 108 }}><Animated.View entering={FadeInUp.duration(360)}><View className="mx-5 h-[250px] items-center justify-center overflow-hidden rounded-sheet bg-success-soft"><Image source={confirmationMeal} accessibilityLabel="Confirmed home-style tiffin meal" resizeMode="contain" className="h-[220px] w-[220px]" /></View><View className="mt-7 px-5 gap-sheet-gap"><FormHeader title="Your trial is confirmed" subtitle="Your payment is complete. Confirmation and important meal updates will be sent on WhatsApp." size="page" /><View><Text className="font-body text-body-sm text-muted">Confirmation number</Text><Text selectable className="mt-1 font-mono-semibold text-[24px] tracking-[0.8px] text-foreground">ST3P27JUL</Text></View><View className="h-px bg-border" /><View><Text className="font-body text-body-sm text-muted">Payment amount</Text><Text className="mt-1 font-heading text-[34px] text-foreground">₹{total}</Text></View><View className="gap-5"><View><Text className="font-body text-body-sm text-muted">Trial starts</Text><Text className="mt-1 font-body-medium text-body-md text-foreground">{data.trialDays[0] ? trialDateLabel(data.trialDays[0]) : '27 July'}</Text></View><View><Text className="font-body text-body-sm text-muted">Meal preference</Text><Text className="mt-1 font-body-medium text-body-md text-foreground">{data.meal} · {data.food}</Text></View><View><Text className="font-body text-body-sm text-muted">Bread and rice</Text><Text className="mt-1 font-body-medium text-body-md text-foreground">{data.bread} · {data.rice}</Text></View><View><Text className="font-body text-body-sm text-muted">Delivering to {data.address.label}</Text><Text className="mt-1 font-body-medium text-body-md leading-6 text-foreground">{address}</Text></View></View></View></Animated.View></ScrollView><Animated.View entering={FadeInUp.delay(360).duration(280)} style={{ paddingBottom: insets.bottom + 14 }} className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-3"><TrialAuthButton label="View trial tracker" onPress={onContinue} /></Animated.View></View>;
}
function LegacySummary({ data, meals, total, onBack, onEdit, onNext }: { data: State; meals: number; total: number; onBack: () => void; onEdit: (s: Step) => void; onNext: () => void }) {
  const cards = [{ label: 'Food preference', value: data.food, step: 'food' }, { label: 'Meal preference', value: `${data.meal} · ${data.meal === 'Dinner' ? '6:30–8:30 PM' : '11:00 AM–1:00 PM'}`, step: 'meal' }, { label: 'Bread preference', value: data.bread, step: 'bread' }, { label: 'Rice preference', value: data.rice, step: 'rice' }] as const;
  return <Shell title="Your trial, at a glance" onBack={onBack} footer={<Primary label="Proceed to payment" onPress={onNext} />}><FormPageSection subheading="Review your choices before payment."><View className="gap-3">{cards.map((card) => <View key={card.label} className="rounded-[16px] bg-surface p-5"><View className="flex-row items-center justify-between"><Text className="font-medium text-sm tracking-[0.4px] text-muted">{card.label.toUpperCase()}</Text><EditAction onPress={() => onEdit(card.step)} /></View><Text className="mt-3 font-semibold text-lg text-foreground">{card.value}</Text><View className="mt-4 h-24 items-center justify-center rounded-xl bg-surface-raised"><Text className="font-medium text-xs text-muted">IMAGE PLACEHOLDER</Text></View></View>)}<DeliverySummary data={data} onEdit={() => onEdit('address')} /><View className="rounded-[16px] bg-surface p-5"><Text className="font-semibold text-lg text-foreground">Nutrition with every meal</Text><Text className={`mt-2 ${headingDescriptionClass}`}>View estimated calories, protein, carbohydrates, fat, fibre and sodium for every dish.</Text><View className="mt-4 flex-row flex-wrap gap-2">{['720 kcal', '28 g protein', '92 g carbs', '24 g fat', '11 g fibre'].map((chip) => <View key={chip} className="rounded-full bg-surface-raised px-3 py-2"><Text className="font-medium text-xs text-foreground">{chip}</Text></View>)}</View></View><View className="rounded-[16px] bg-surface p-5"><Text className="font-semibold text-lg text-foreground">Three-day trial</Text><Text className="mt-2 font-sans text-[15px] text-muted">{trialRangeLabel(data.trialDays)} · {meals} meals</Text>{ENABLE_WEEKEND_ADDRESS_FLOW && data.food === 'Mix of both' ? <Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Weekend plan · {data.weekendDelivery === 'different' ? `Different address · ${data.weekendLocation}` : 'Primary delivery address'}</Text> : null}</View><View className="rounded-[16px] bg-surface p-5"><Row label="Trial price" value="₹999" /><View className="mt-3"><Row label="Delivery charges" value="₹0" /></View><View className="mt-3"><Row label="Taxes" value="₹0" /></View><View className="mt-3"><Row label="Discount" value="−₹100" /></View><View className="my-4 h-px bg-border" /><Row label="Total payable" value={`₹${total}`} bold /></View></View></FormPageSection></Shell>;
}

function Summary({ data, meals, total, onBack, onEdit, onNext }: { data: State; meals: number; total: number; onBack: () => void; onEdit: (step: Step) => void; onNext: () => void }) {
  const cards = [
    { label: 'Food preference', value: data.food, step: 'food' as const },
    { label: 'Meal preference', value: `${data.meal} · ${data.meal === 'Dinner' ? '6:30–8:30 PM' : '11:00 AM–1:00 PM'}`, step: 'meal' as const },
    { label: 'Bread preference', value: data.bread, step: 'bread' as const },
    { label: 'Rice preference', value: data.rice, step: 'rice' as const },
  ];
  return <Shell title="Your trial, at a glance" onBack={onBack} footer={<TrialAuthButton label="Proceed to payment" onPress={onNext} />}><FormPageSection subheading="Review your choices before payment."><View className="gap-4">{cards.map((card) => <View key={card.label} className="rounded-field bg-field p-sheet"><View className="flex-row items-center justify-between"><Text className="font-body text-body-xs uppercase tracking-body-sm text-muted">{card.label}</Text><EditAction onPress={() => onEdit(card.step)} /></View><Text className="mt-3 font-mono-semibold text-body-md text-foreground">{card.value}</Text><View className="mt-4 h-20 rounded-button-inner bg-canvas" /></View>)}{data.food === 'Mix of both' ? <View className="rounded-field bg-field p-sheet"><View className="flex-row items-center justify-between"><Text className="font-heading text-body-md text-foreground">Three-day food plan</Text><EditAction onPress={() => onEdit('mixMeals')} /></View><View className="mt-3 gap-2">{data.dailyMeals.map((day, index) => <View key={`summary-day-${index + 1}`} className="flex-row justify-between gap-4"><Text className="font-body text-body-sm text-muted">Day {index + 1}</Text><Text className="flex-1 text-right font-body-medium text-body-sm text-foreground">{data.meal !== 'Dinner' ? `Lunch ${day.lunch === 'Vegetarian' ? 'Veg' : 'Non-veg'}` : ''}{data.meal === 'Both' ? ' · ' : ''}{data.meal !== 'Lunch' ? `Dinner ${day.dinner === 'Vegetarian' ? 'Veg' : 'Non-veg'}` : ''}</Text></View>)}</View></View> : null}<DeliverySummary data={data} onEdit={() => onEdit('address')} /><View className="rounded-field bg-field p-sheet"><Text className="font-heading text-body-md text-foreground">Nutrition with every meal</Text><Text className="mt-2 font-body text-body-sm leading-5 text-muted">View estimated calories, protein, carbohydrates, fat, fibre and sodium for every dish.</Text><View className="mt-4 flex-row flex-wrap gap-2">{['720 kcal', '28 g protein', '92 g carbs', '24 g fat', '11 g fibre'].map((chip) => <View key={chip} className="rounded-full bg-canvas px-3 py-2"><Text className="font-body-medium text-body-xs text-foreground">{chip}</Text></View>)}</View></View><View className="rounded-field bg-field p-sheet"><Text className="font-heading text-body-md text-foreground">Three-day trial</Text><Text className="mt-2 font-body text-body-sm text-muted">{trialRangeLabel(data.trialDays)} · {meals} meals</Text></View><View className="rounded-field bg-field p-sheet"><Row label="Trial price" value="₹999" /><View className="mt-3"><Row label="Delivery charges" value="₹0" /></View><View className="mt-3"><Row label="Taxes" value="₹0" /></View><View className="mt-3"><Row label="Discount" value="−₹100" /></View><View className="my-4 h-px bg-border" /><Row label="Total payable" value={`₹${total}`} bold /></View></View></FormPageSection></Shell>;
}

function Tracker({ data, paused, setPauseOpen, toast, pauseOpen, confirmPause }: { data: State; paused: boolean; setPauseOpen: (v: boolean) => void; toast: boolean; pauseOpen: boolean; confirmPause: () => void }) {
  const insets = useSafeAreaInsets();
  return <View className="flex-1 bg-canvas"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }}><View className="px-5"><Text className="font-medium text-sm text-accent">ACTIVE TRIAL</Text><Text className="mt-2 font-semibold text-[24px] leading-8 text-foreground">Day 2 of {TRIAL_DAY_COUNT}</Text><View className="mt-4 h-2 overflow-hidden rounded-full bg-border"><View className="h-full w-2/3 rounded-full bg-accent" /></View><View className="mt-5 flex-row gap-3"><View className="flex-1 rounded-[14px] bg-surface p-4"><Text className="font-semibold text-2xl text-foreground">2</Text><Text className="mt-1 text-sm text-muted">Completed</Text></View><View className="flex-1 rounded-[14px] bg-surface p-4"><Text className="font-semibold text-2xl text-foreground">1</Text><Text className="mt-1 text-sm text-muted">Remaining</Text></View></View><View className="mt-3 rounded-[14px] bg-surface p-4"><Row label="Trial dates" value="27–29 July" /><View className="mt-2"><Row label="Meals" value={data.meal} /></View></View><Text className="mb-3 mt-8 font-semibold text-xl text-foreground">Upcoming meals</Text><View className="rounded-[18px] border border-border bg-surface p-5"><View className="flex-row justify-between"><View><Text className="font-medium text-sm text-muted">29 JULY · LUNCH</Text><Text className="mt-2 font-semibold text-xl text-foreground">{data.food} meal</Text></View>{paused ? <View className="h-8 justify-center rounded-full bg-surface-raised px-3"><Text className="font-semibold text-sm text-muted">Paused</Text></View> : null}</View><Text className="mt-3 font-sans text-[15px] text-muted">{data.address.label} · {data.address.society}</Text><Text className="mt-3 font-medium text-sm text-foreground">720 kcal · 28 g protein · 92 g carbs</Text><View className="mt-4 rounded-xl bg-surface-raised p-4"><Row label="Calories" value="720 kcal" /><View className="mt-2"><Row label="Protein" value="28 g" /></View><View className="mt-2"><Row label="Carbohydrates" value="92 g" /></View><View className="mt-2"><Row label="Fat · Fibre · Sodium" value="24 g · 11 g · 680 mg" /></View></View><Text className="mt-3 font-sans text-xs leading-5 text-muted">Nutritional values are approximate and may vary based on portion size, ingredients and preparation method.</Text>{!paused ? <View className="mt-5"><Primary label="Pause meal" onPress={() => setPauseOpen(true)} /></View> : null}<View className="mt-3 flex-row flex-wrap gap-2">{['Change address', 'Change bread', 'Change rice', 'Contact support', 'Report an issue', 'Rate meal'].map((action) => <Pressable key={action} className="min-h-11 justify-center rounded-full border border-border px-3"><Text className="font-medium text-xs text-foreground">{action}</Text></Pressable>)}</View></View></View></ScrollView>{toast ? <Animated.View entering={FadeInUp.springify().damping(18).stiffness(220)} style={{ bottom: insets.bottom + 20 }} className="absolute inset-x-5 rounded-full bg-success px-5 py-4"><Text className="font-semibold text-center text-white">Meal paused successfully</Text></Animated.View> : null}{pauseOpen ? <View className="absolute inset-0 justify-end"><BlurView intensity={Platform.OS === 'android' ? 24 : 32} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'} style={StyleSheet.absoluteFill} /><View pointerEvents="none" className="absolute inset-0 bg-black/30" /><Pressable className="absolute inset-0" onPress={() => setPauseOpen(false)} /><Animated.View entering={FadeInUp.duration(240)} className="mx-4 mb-4 rounded-[20px] bg-sheet p-sheet"><FormModalLayout title="Pause this meal?" subtitle="This meal will be marked as paused for 29 July." primaryAction={<Primary label="Confirm pause" onPress={confirmPause} />} secondaryAction={<Pressable onPress={() => setPauseOpen(false)} className="h-12 items-center justify-center"><Text className="font-semibold text-foreground">Keep meal</Text></Pressable>} /></Animated.View></View> : null}</View>;
}
