import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { SheetBackdrop } from './sheetOverlay';
import { hapticPress } from './haptics';
import { useHeroScrollSheetMotion } from './heroScrollSheetMotion';
import * as Location from 'expo-location';
import Animated, { Easing, Extrapolation, FadeIn, FadeInUp, interpolate, interpolateColor, LinearTransition, scrollTo, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
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
import { CenteredFieldInput, centeredFieldInputStyle, fieldValueTextClass } from './centeredFieldInput';
import { FormChromeSheetLayout, FormFieldStack, FormHeader, FormModalLayout, FormPageSection, FormSheetLayout, FormValidationText } from './formLayout';
import { headingDescriptionClass } from './typographyClasses';
import { formatRupee } from './formatCurrency';
import { MoneyText, moneyValueTypography } from './moneyText';
import { themePalette, useFieldPlaceholderColor, useForegroundColor } from './themeColors';
import { PrimaryShimmerButton, GhostFieldButton } from './primaryButton';

import { foodImages } from './foodImages';
import { MealPreferenceImage } from './MealPreferenceImage';
import {
  AddressDetailsForm,
  DeliveryCoverageSheet,
  FocusScrollContext,
  LabeledFieldInput,
  SearchLocationScreen,
  useFocusScrollField,
  usePincodeAvailability,
} from './deliveryAddressComponents';
import {
  addressLabelDisplay,
  emptyAddressDetails,
  extractPincodeFromText,
  formatSavedAddressLines,
  type AddressDetails,
} from './addressTypes';
import { extractPincode } from './deliveryServiceability';
import { submitCoverageRequest } from './coverageRequestStore';
import { Toast, COVERAGE_REQUEST_SUCCESS_TOAST } from './toast';
import { useSavedAddresses } from './savedAddressesStore';
import { DeliveryAddressFlow } from './DeliveryAddressFlow';
import { DeliveryEligibilityScreen, mealSelectionToMealLabel } from './deliveryEligibilityScreen';
import { backendEnabled, completeOnboardingStep, isSignedIn } from './api/client';
import { purchaseTrialOnServer } from './api/trialPurchase';
import { detailsFromSavedAddress, savedAddressFromDetails, type MealDeliverySlot, type SavedAddress } from './addressTypes';
import { TrialSummaryScreen, trialPricingBreakup, type TrialMealDeliveryState } from './trialOnboardingSummary';
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
      <SheetBackdrop />
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
  return (
    <LabeledFieldInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      inputRef={inputRef}
      autoFocus={autoFocus}
      returnKeyType="next"
      onSubmitEditing={onSubmitEditing}
      autoCapitalize="words"
    />
  );
}

function PersonalDateField({ value, onPress }: { value: string; onPress: () => void }) {
  const { theme } = useUniwind();
  const placeholderColor = useFieldPlaceholderColor();
  const foregroundColor = useForegroundColor();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  return (
    <View className="gap-2">
      <Text className="font-body text-body-sm tracking-body-sm text-foreground">Date of birth</Text>
      <Pressable accessibilityRole="button" onPress={onPress} className="h-field flex-row items-center gap-field-inline rounded-field border border-transparent bg-field px-sheet">
        <Text className="flex-1" style={[centeredFieldInputStyle, { color: value ? foregroundColor : placeholderColor }]}>{value || 'DD-MM-YYYY'}</Text>
        <CalendarBlankIcon size={24} weight="regular" color={iconColor} />
      </Pressable>
    </View>
  );
}

function PersonalGenderCard({ label, icon: Glyph, selected, onPress }: { label: string; icon: Icon; selected: boolean; onPress: () => void }) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={hapticPress(onPress, 'selection')}
      className={`min-h-[86px] flex-1 overflow-hidden rounded-field border px-sheet py-3.5 ${selected ? 'border-2 border-accent' : 'border-border bg-canvas'}`}
    >
      {selected ? (
        <>
          <BlurView intensity={Platform.OS === 'android' ? 12 : 28} tint="light" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'} style={StyleSheet.absoluteFill} />
          <View className="absolute inset-0 bg-accent-soft/85" />
        </>
      ) : null}
      <View className="relative flex-1 justify-between">
        <Text className="font-mono-semibold text-body-sm text-foreground">{label}</Text>
        <View className="items-end">
          <Glyph size={24} weight="regular" color={iconColor} />
        </View>
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

type Step = 'deliveryEligibility' | 'personal' | 'intro' | 'food' | 'meal' | 'mixMeals' | 'bread' | 'rice' | 'addressFlow' | 'summary' | 'payment' | 'success' | 'tracker';
type Choice = { title: string; description: string };
type FoodChoice = Choice & { image: number };
type Address = Omit<AddressDetails, 'deliveryLocation'>;
type MealKind = 'Vegetarian' | 'Non-vegetarian' | '';
type DailyMealChoice = { lunch: MealKind; dinner: MealKind };
type WeekendDelivery = 'primary' | 'different' | 'skip';
type AddressMode = 'weekday' | 'weekend';
type State = { deliveryPincode: string; name: string; dob: string; gender: string; food: string; meal: string; dailyMeals: DailyMealChoice[]; bread: string; rice: string; trialDays: string[]; deliveryLocation: string; weekendDelivery: WeekendDelivery; weekendLocation: string; weekendAddress: string; address: Address; weekendAddressDetails: Address; lunchDelivery: TrialMealDeliveryState | null; dinnerDelivery: TrialMealDeliveryState | null; summaryMealTab: MealDeliverySlot; payment: string };

// Future-scope plug: switch to true to restore the separate weekend location and address journey.
const ENABLE_WEEKEND_ADDRESS_FLOW = false;

const order: Step[] = ['deliveryEligibility', 'personal', 'intro', 'food', 'meal', 'mixMeals', 'bread', 'rice', 'addressFlow', 'summary', 'payment', 'success', 'tracker'];
const emptyAddress = (): Address => { const { deliveryLocation, ...rest } = emptyAddressDetails(); return rest; };
const addressDetailsFromState = (location: string, address: Address, preferredPincode = ''): AddressDetails => ({ ...address, deliveryLocation: location, pincode: address.pincode || extractPincodeFromText(location) || preferredPincode.replace(/\D/g, '').slice(0, 6) });
const addressSlotsForMeal = (meal: string): MealDeliverySlot[] => {
  if (meal === 'Lunch') return ['lunch'];
  if (meal === 'Dinner') return ['dinner'];
  return ['lunch', 'dinner'];
};
const nextPendingAddressSlot = (meal: string, data: State): MealDeliverySlot | null => {
  for (const slot of addressSlotsForMeal(meal)) {
    if (slot === 'lunch' && !data.lunchDelivery) return 'lunch';
    if (slot === 'dinner' && !data.dinnerDelivery) return 'dinner';
  }
  return null;
};
const mealDeliveryFromSaved = (saved: SavedAddress): TrialMealDeliveryState => {
  const details = detailsFromSavedAddress(saved);
  const { deliveryLocation, ...address } = details;
  return {
    deliveryLocation,
    address,
    latitude: saved.latitude,
    longitude: saved.longitude,
  };
};
const savedAddressFromMealDelivery = (delivery: TrialMealDeliveryState): SavedAddress =>
  savedAddressFromDetails(addressDetailsFromState(delivery.deliveryLocation, delivery.address));
const syncLegacyDeliveryFields = (data: State): Pick<State, 'deliveryLocation' | 'address'> => {
  const primary = data.lunchDelivery ?? data.dinnerDelivery;
  if (!primary) return { deliveryLocation: data.deliveryLocation, address: data.address };
  return { deliveryLocation: primary.deliveryLocation, address: primary.address };
};
const initialState: State = { deliveryPincode: '', name: '', dob: '', gender: '', food: '', meal: '', dailyMeals: Array.from({ length: TRIAL_DAY_COUNT }, () => ({ lunch: '', dinner: '' })), bread: '', rice: '', trialDays: [], deliveryLocation: 'B-704, Green View Apartments, Baner Road, Pune 411045', weekendDelivery: 'primary', weekendLocation: '', weekendAddress: '', payment: '', address: emptyAddress(), weekendAddressDetails: emptyAddress(), lunchDelivery: null, dinnerDelivery: null, summaryMealTab: 'lunch' };
const food: FoodChoice[] = [
  { title: 'Vegetarian', description: 'Seasonal vegetables, paneer and home-style dals.', image: foodImages.Vegetarian },
  { title: 'Non-vegetarian', description: 'Home-style chicken, mutton and egg preparations.', image: foodImages['Non-vegetarian'] },
  { title: 'Mix of both', description: 'Enjoy vegetarian and non-vegetarian meals during your trial.', image: foodImages['Mix of both'] },
];
const meal: FoodChoice[] = [
  { title: 'Lunch', description: 'Delivery between 11:00 AM and 1:00 PM', image: foodImages.Lunch },
  { title: 'Dinner', description: 'Delivery between 6:30 PM and 8:30 PM', image: foodImages.Dinner },
  { title: 'Both', description: 'Lunch and dinner every day', image: foodImages.Both },
];
const bread: FoodChoice[] = [
  { title: 'Chapati', description: 'Soft whole-wheat chapatis.', image: foodImages.Chapati },
  { title: 'Bhakri', description: 'Traditional Maharashtrian bhakri.', image: foodImages.Bhakri },
  { title: 'Any', description: 'Let us serve chapati or bhakri based on the day’s meal.', image: foodImages.Any },
];
const rice: FoodChoice[] = [
  { title: 'Plain Rice', description: 'Simple steamed rice.', image: foodImages['Plain Rice'] },
  { title: 'Jeera Rice', description: 'Rice lightly tempered with cumin.', image: foodImages['Jeera Rice'] },
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
          <Text className="font-mono-semibold text-body-md text-canvas">Pay {formatRupee(total)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Primary({ label, onPress, enabled = true }: { label: string; onPress: () => void; enabled?: boolean }) {
  return <TrialAuthButton label={label} onPress={onPress} enabled={enabled} />;
}

let trialSummaryScrollOffset = 0;

function Shell({ title, onBack, children, footer, footerDelay = 280, fixedHeader = true, initialScrollOffset = title === 'Your trial, at a glance' ? trialSummaryScrollOffset : 0, onScrollOffsetChange = title === 'Your trial, at a glance' ? (offset) => { trialSummaryScrollOffset = offset; } : undefined, animateContent = title !== 'Your trial, at a glance', suppressKeyboard = false }: { title: string; onBack?: () => void; children: React.ReactNode; footer?: React.ReactNode; footerDelay?: number; fixedHeader?: boolean; initialScrollOffset?: number; onScrollOffsetChange?: (offset: number) => void; animateContent?: boolean; suppressKeyboard?: boolean }) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const scrollRef = useRef<ScrollView>(null);
  const fixedHeaderHeight = insets.top + 12 + 33 + 4;
  const { scrollOffset, positionFocusedField } = useFocusScrollField(scrollRef, {
    visibleTopOffset: fixedHeader ? fixedHeaderHeight : insets.top + 12,
  });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (suppressKeyboard) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, [suppressKeyboard]);
  const footerBottomInset = keyboardHeight > 0 ? 8 : (Platform.OS === 'ios' ? insets.bottom : Math.max(12, insets.bottom + 8));
  const header = <View style={fixedHeader ? { paddingTop: insets.top + 12 } : undefined} className="bg-canvas px-5 pb-1">
    {onBack ? <View className="flex-row items-center gap-3">
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={8} className="size-6 items-center justify-center">
        <CaretLeftIcon size={24} weight="regular" color={iconColor} />
      </Pressable>
      <Animated.Text key={`${title}-title`} entering={animateContent ? FadeInUp.delay(30).duration(260) : undefined} className="flex-1 font-heading text-heading-md text-foreground">{title}</Animated.Text>
    </View> : <Animated.Text key={`${title}-title`} entering={animateContent ? FadeInUp.delay(30).duration(260) : undefined} className="font-heading text-heading-md text-foreground">{title}</Animated.Text>}
  </View>;
  return (
    <FocusScrollContext.Provider value={positionFocusedField}>
    <View className="absolute inset-0 bg-canvas">
    {fixedHeader ? header : null}
    <View className="flex-1 bg-canvas">
      <ScrollView ref={scrollRef} contentOffset={{ x: 0, y: initialScrollOffset }} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" onScroll={(event) => { const offset = event.nativeEvent.contentOffset.y; scrollOffset.current = offset; onScrollOffsetChange?.(offset); }} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingTop: fixedHeader ? 0 : insets.top + 12, paddingBottom: (footer ? 124 : 24) + (keyboardHeight > 0 ? keyboardHeight : insets.bottom) }}>
        {!fixedHeader ? header : null}
        <Animated.View key={`${title}-content`} entering={animateContent ? FadeInUp.delay(170).duration(280) : undefined} className="mx-5 mt-4">{children}</Animated.View>
      </ScrollView>
    </View>
      {footer ? <Animated.View key={`${title}-footer`} entering={animateContent ? FadeInUp.delay(footerDelay).duration(280) : undefined} style={{ bottom: keyboardHeight, paddingBottom: footerBottomInset }} className="absolute inset-x-0 bg-canvas px-5">{footer}</Animated.View> : null}
    </View>
    </FocusScrollContext.Provider>
  );
}

function selectionCardClass(selected: boolean) {
  return `overflow-hidden rounded-field border bg-canvas ${selected ? 'border-2 border-accent bg-accent-soft' : 'border-border'}`;
}

function ChoiceCards({ options, value, onChange }: { options: Choice[]; value: string; onChange: (value: string) => void }) {
  return (
    <View className="gap-4">
      {options.map((option) => {
        const selected = value === option.title;
        return (
          <Pressable
            key={option.title}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={hapticPress(() => onChange(option.title), 'selection')}
            className={`gap-2 p-sheet ${selectionCardClass(selected)}`}
          >
            <Text className="font-mono-semibold text-body-md text-foreground">{option.title}</Text>
            <Text className="font-body text-body-xs leading-5 text-muted">{option.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PreferenceCards({ options, value, onChange }: { options: FoodChoice[]; value: string; onChange: (value: string) => void }) {
  return (
    <View className="gap-4">
      {options.map((option, index) => {
        const selected = value === option.title;
        return (
          <Pressable
            key={option.title}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={hapticPress(() => onChange(option.title), 'selection')}
            className={`flex-row items-stretch ${selectionCardClass(selected)}`}
          >
            <View className="min-w-0 flex-1 justify-center gap-2 p-sheet">
              <Text className="font-mono-semibold text-body-md text-foreground">{option.title}</Text>
              <Text className="font-body text-body-xs leading-5 text-muted">{option.description}</Text>
            </View>
            <PreferenceCardImage source={option.image} label={`${option.title} meal`} delayMs={360 + index * 120} />
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
    <Animated.View key={`day-${dayIndex + 1}`} entering={FadeInUp.delay(190 + dayIndex * 55).duration(220)} className="rounded-field border border-border bg-canvas p-sheet">
      <Text className="font-mono-semibold text-body-md text-foreground">Day {dayIndex + 1}{dates[dayIndex] ? <Text className="font-body text-body-sm text-muted"> · {ordinalDateLabel(dates[dayIndex]!)} · {dateFromKey(dates[dayIndex]!).toLocaleDateString('en-IN', { weekday: 'short' })}</Text> : null}</Text>
      <View className="mt-3 gap-3">{mealRows.map((mealKey) =>
        <View key={mealKey} className="flex-row items-center gap-3">
          <Text className="w-14 font-body-medium text-body-sm capitalize text-foreground">{mealKey}</Text>
          <View className="flex-1 flex-row gap-2">{(['Vegetarian', 'Non-vegetarian'] as const).map((choice) => {
            const selected = day[mealKey] === choice;
            const selectedClass = choice === 'Vegetarian' ? 'border-2 border-success bg-success-soft' : 'border-2 border-destructive bg-destructive-soft';
            return <Pressable key={choice} accessibilityRole="radio" accessibilityLabel={`Day ${dayIndex + 1} ${mealKey} ${choice}`} accessibilityState={{ checked: selected }} onPress={() => update(dayIndex, mealKey, choice)} className={`h-9 flex-1 items-center justify-center rounded-full border ${selected ? selectedClass : 'border-border bg-canvas'}`}><Text className={`font-mono-semibold text-body-sm ${selected ? 'text-foreground' : 'text-muted'}`}>{choice === 'Vegetarian' ? 'Veg' : 'Non-veg'}</Text></Pressable>;
          })}</View>
        </View>
      )}</View>
    </Animated.View>
  )}</View>;
}

function AddressTabs({ value, onChange }: { value: AddressMode; onChange: (value: AddressMode) => void }) {
  return <View accessibilityRole="tablist" className="flex-row gap-2">{(['weekday', 'weekend'] as const).map((mode) => { const active = value === mode; return <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(mode)} className={`h-field flex-1 items-center justify-center rounded-field border bg-canvas ${active ? 'border-2 border-accent' : 'border-border'}`}><Text className={`font-mono-semibold text-body-sm capitalize ${active ? 'text-foreground' : 'text-muted'}`}>{mode}</Text></Pressable>; })}</View>;
}

function AddressLead({ mode, value }: { mode: AddressMode; value: string }) {
  return <View className="mt-4 flex-row items-start rounded-field border border-border bg-canvas p-sheet"><View className="mr-3 mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-icon-surface"><FlowGlyph icon={MapPinIcon} size={20} weight="bold" /></View><View className="min-w-0 flex-1"><Text className="font-body text-body-xs capitalize text-muted">{mode} address</Text><Text className="mt-1 font-body-medium text-body-md leading-6 text-foreground">{value}</Text></View></View>;
}

function EditStrokeButton({ onPress }: { onPress: () => void }) {
  const { theme } = useUniwind();
  const fillClass = theme === 'dark' ? 'bg-ghost-on-field' : 'bg-icon-surface';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Edit"
      hitSlop={8}
      onPress={onPress}
      className={`self-start rounded-full px-3 py-1.5 ${fillClass}`}
    >
      <Text className="font-mono-semibold text-body-sm text-foreground">Edit</Text>
    </Pressable>
  );
}

function EditAction({ onPress }: { onPress: () => void }) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  return <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={onPress} hitSlop={8} className="size-5 items-center justify-center"><PencilSimpleIcon size={20} weight="regular" color={iconColor} /></Pressable>;
}

function PreferenceCardImage({ source, label, delayMs }: { source: number; label: string; delayMs: number }) {
  return (
    <View className="w-[161px] shrink-0 self-stretch justify-end overflow-hidden">
      <MealPreferenceImage source={source} label={label} delayMs={delayMs} />
    </View>
  );
}

function SummaryPreferenceCard({ caption, title, image, onEdit, animationDelay }: { caption: string; title: string; image: number; onEdit: () => void; animationDelay: number }) {
  return (
    <View className={`flex-row items-stretch ${selectionCardClass(false)}`}>
      <View className="min-w-0 flex-1 justify-center gap-2 p-sheet">
        <Text className="font-body text-body-sm tracking-body-sm text-muted">{caption}</Text>
        <Text className="font-mono-semibold text-body-md text-foreground">{title}</Text>
        <EditStrokeButton onPress={onEdit} />
      </View>
      <PreferenceCardImage source={image} label={title} delayMs={animationDelay} />
    </View>
  );
}

function DeliverySummary({ data, onEdit }: { data: State; onEdit: () => void }) {
  const different = ENABLE_WEEKEND_ADDRESS_FLOW && data.weekendDelivery === 'different';
  const weekdayLine = formatSavedAddressLines(addressDetailsFromState(data.deliveryLocation, data.address));
  const items = [
    { label: 'Weekday', address: weekdayLine, location: data.deliveryLocation },
    { label: 'Weekend', address: formatSavedAddressLines(addressDetailsFromState(data.weekendLocation, data.weekendAddressDetails)), location: data.weekendLocation },
  ];
  return (
    <View className="rounded-field border border-border bg-canvas p-sheet">
      <View className="flex-row items-center justify-between">
        <Text className="font-heading text-body-md text-foreground">Delivery address</Text>
        <EditAction onPress={onEdit} />
      </View>
      {different ? (
        <View className="mt-4 gap-5">
          {items.map((item) => (
            <View key={item.label}>
              <View className="mb-2 flex-row items-center">
                <View className="mr-2 h-7 w-7 items-center justify-center rounded-full bg-icon-surface"><FlowGlyph icon={MapPinIcon} size={18} weight="bold" /></View>
                <Text className="font-mono-semibold text-body-md text-foreground">{item.label} address</Text>
              </View>
              <View className="overflow-hidden rounded-field border border-border"><SelectableMap compact searchQuery={item.location} /></View>
              <Text className="mt-3 font-body text-body-sm leading-5 text-muted">{item.address}</Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          <View className="mt-3 overflow-hidden rounded-field border border-border"><SelectableMap compact searchQuery={data.deliveryLocation} /></View>
          <Text className="mt-3 font-body-medium text-body-sm leading-5 text-foreground">{weekdayLine}</Text>
        </>
      )}
    </View>
  );
}

function ConfirmAddressSheet({ data, onClose, onConfirm, onEdit, usesDifferentWeekendAddress, sections }: { data: State; onClose: () => void; onConfirm: () => void; onEdit: () => void; usesDifferentWeekendAddress: boolean; sections: Array<{ mode: string; value: Address; text: string }> }) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const renderAddressCard = (address: Address, text: string, editHandler: () => void) => (
    <View className="rounded-sheet bg-accent-soft p-sheet">
      <View className="flex-row items-center justify-between">
        <Text className="font-heading text-body-md text-foreground">{addressLabelDisplay(address)}</Text>
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
        fields={<><View className="h-[109px] overflow-hidden rounded-sheet bg-field"><SelectableMap compact searchQuery={data.deliveryLocation} /></View>{usesDifferentWeekendAddress ? sections.map((section) => <View key={section.mode}>{renderAddressCard(section.value, section.text, onEdit)}</View>) : renderAddressCard(data.address, formatSavedAddressLines(addressDetailsFromState(data.deliveryLocation, data.address)), onEdit)}</>}
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
          <Image source={foodImages['Mix of both']} accessibilityLabel="Home-style tiffin meal" resizeMode="cover" className="size-full" />
        </View>
      </View>

      <View className="flex-1 rounded-t-sheet bg-canvas px-5 pt-5">
        <View className="flex-1 gap-auth-block">
          <Animated.View entering={FadeInUp.delay(30).duration(260)}>
            <FormHeader size="page" title="Let's start your 3 day trial" />
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(100).duration(260)}>
            <FormPageSection subheading="Your three-day trial comes at a discounted price.">
              <View className="gap-4 rounded-field bg-accent-soft p-sheet">
                <Text className="font-mono-semibold text-body-sm text-accent">Trial benefit</Text>
                <Text className="font-body text-body-sm leading-5 tracking-body-sm text-foreground">
                  Choose your food, meals and delivery days next. You can review everything before payment.
                </Text>
              </View>
            </FormPageSection>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(170).duration(260)} style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(16, insets.bottom + 8) }} className="gap-4 pt-6">
          <TrialAuthButton label={ready ? 'Choose my trial' : 'Preparing your trial…'} enabled={ready} onPress={onProceed} />
          <GhostFieldButton label="Skip to subscribe" onPress={onSkipToSubscribe} />
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
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="absolute inset-0 z-[80] justify-end"><SheetBackdrop /><Pressable className="absolute inset-0" onPress={() => { Keyboard.dismiss(); onClose(); }} /><Animated.View entering={FadeInUp.duration(240)} style={{ height: searchMode ? '100%' : '80%', marginBottom: searchMode ? 0 : 16 }} className={`${searchMode ? 'mx-0 rounded-none' : 'mx-4 rounded-[20px]'} overflow-hidden bg-sheet`}><View style={{ height: 64 + (searchMode ? insets.top : 0), paddingTop: searchMode ? insets.top : 0 }} className="flex-row items-center px-4"><View className="flex-1 pr-12"><FormHeader title="Choose weekend location" size="sheet" /></View><Pressable accessibilityRole="button" accessibilityLabel="Close weekend location" onPress={onClose} className="absolute bottom-3 right-3 h-10 w-10 items-center justify-center rounded-full bg-icon-surface"><FlowGlyph icon={XIcon} size={20} weight="bold" /></Pressable></View><View className="flex-1 px-4 pb-4"><TextInput value={query} onFocus={() => setSearchMode(true)} onChangeText={setQuery} returnKeyType="search" placeholder="Search area, landmark or address" placeholderTextColor="#8b8a84" className="h-14 rounded-xl border border-control-border bg-surface px-4 font-body text-base text-foreground" />{searchMode ? <View className="flex-1"><View className="mt-5"><FormHeader title="Type a location to find it" subtitle="Choose a result to return to the map and adjust the pin." size="sheet" /></View>{searching ? <Text className="mt-6 font-body-medium text-muted">Searching locations…</Text> : null}<ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="mt-4">{suggestions.map((location) => <Pressable key={location} onPress={() => selectLocation(location)} className="min-h-16 flex-row items-center border-b border-border py-3"><View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-icon-surface"><FlowGlyph icon={MapPinIcon} size={20} weight="bold" /></View><Text className="flex-1 font-body-medium text-base leading-6 text-foreground">{location}</Text></Pressable>)}{!searching && query.trim().length >= 3 && suggestions.length === 0 ? <Text className="mt-4 font-body text-[15px] text-muted">No locations found. Try an area, landmark or complete address.</Text> : null}</ScrollView></View> : <><View className="mt-4 min-h-[180px] flex-1"><SelectableMap fill searchQuery={query} onAddressChange={setQuery} /></View><Text className="mt-3 font-body text-body-xs leading-5 text-muted">Pan or zoom the map to position the pin. The address above updates from the map location.</Text><View className="mt-sheet-gap"><Primary label="Save location" enabled={query.trim().length > 2} onPress={() => { Keyboard.dismiss(); onSave(query.trim()); }} /></View></>}</View></Animated.View></KeyboardAvoidingView>;
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
  return <><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="absolute inset-0 z-50 justify-end"><SheetBackdrop /><Pressable className="absolute inset-0" onPress={onClose} /><AdaptiveSheetFrame onClose={onClose} title="Choose your three days">{(sheetControls) => <ScrollView ref={calendarScrollRef} onContentSizeChange={(_width, height) => sheetControls.setContentHeight(height)} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled={sheetControls.scrollEnabled} onScrollBeginDrag={sheetControls.onScrollBeginDrag} onScrollEndDrag={sheetControls.onScrollEndDrag} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' && weekendDelivery === 'different' ? iosKeyboardHeight + 24 : 24 }}><FormChromeSheetLayout subtitle="Tap a start date to build three delivery days. Saturday and Sunday use the same delivery address." fields={<><View className="flex-row">{['S','M','T','W','T','F','S'].map((day, index) => <Text key={`${day}-${index}`} className="w-[14.285%] text-center font-body-medium text-sm text-muted">{day}</Text>)}</View><View className="mt-2 flex-row flex-wrap">{Array.from({ length: calendarDays[0]!.getDay() }, (_, index) => <View key={`empty-${index}`} className="w-[14.285%]" />)}{calendarDays.map((date, index) => { const selected = selectedKeys.has(dateKey(date)); const weekend = isWeekend(date); return <View key={dateKey(date)} className="w-[14.285%] items-center py-1"><Pressable accessibilityRole="radio" accessibilityState={{ checked: index === startIndex }} accessibilityLabel={`Start trial on ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`} onPress={() => { if (weekend && index > startIndex && index <= startIndex + 7) { const key = dateKey(date); setSkippedWeekendKeys((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; }); } else { setStartIndex(index); setSkippedWeekendKeys(new Set()); } }} className={`h-7 w-7 items-center justify-center rounded-full ${selected ? 'bg-accent ring-2 ring-accent ring-offset-[3px] ring-offset-sheet' : weekend ? 'bg-surface' : ''}`}><Text className={`font-body-medium text-sm ${selected ? 'text-accent-foreground' : weekend ? 'text-muted' : 'text-foreground'}`}>{date.getDate()}</Text></Pressable></View>; })}</View>{ENABLE_WEEKEND_ADDRESS_FLOW ? <><Text className="mb-3 mt-6 font-mono-semibold text-xl text-foreground">Weekend delivery</Text><View className="gap-3">{options.map((option) => { const selected = weekendDelivery === option.id; return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { setWeekendDelivery(option.id); if (option.id === 'different') { sheetControls.expand(); Keyboard.dismiss(); setLocationPickerOpen(true); } }} className={`rounded-[16px] border p-4 ${selected ? 'border-[3px] border-accent bg-accent/10' : 'border-control-border'}`}><View className="flex-row items-start"><View className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-accent' : 'border-control-border'}`}>{selected ? <View className="h-3 w-3 rounded-full bg-accent" /> : null}</View><View className="ml-3 flex-1"><Text className="font-body-medium text-lg text-foreground">{option.title}</Text><Text className="mt-1 font-body text-[15px] leading-6 text-muted">{option.body}</Text></View></View></Pressable>; })}</View>{weekendDelivery === 'different' && includesWeekend ? <View className="mt-4"><View className="rounded-[14px] bg-surface p-3"><View className="flex-row items-center"><View className="flex-1 pr-3"><Text className="font-body-medium text-sm text-muted">WEEKEND LOCATION</Text><Text className="mt-1 font-body-medium text-base leading-5 text-foreground">{weekendLocation || 'Choose a location on the map'}</Text></View><View className="h-12 w-12 overflow-hidden rounded-xl"><SelectableMap compact searchQuery={weekendLocation} /></View></View><Pressable accessibilityRole="button" onPress={() => { Keyboard.dismiss(); setLocationPickerOpen(true); }} className="mt-3 min-h-9 flex-row items-center border-t border-border pt-2"><FlowGlyph icon={PencilSimpleIcon} size={18} weight="bold" tone="accent" /><Text className="ml-1.5 font-mono-semibold text-sm text-accent">Edit pin</Text></Pressable></View><Text className="mb-2 mt-4 font-body-medium text-sm text-muted">WEEKEND ADDRESS</Text><TextInput ref={weekendAddressRef} value={weekendAddress} onChangeText={setWeekendAddress} placeholder="Flat, building, street and area" placeholderTextColor="#8b8a84" returnKeyType="done" onFocus={() => setTimeout(() => calendarScrollRef.current?.scrollToEnd({ animated: true }), 100)} className="h-14 rounded-xl border border-control-border bg-sheet px-4 font-body text-base text-foreground" /></View> : null}</> : null}</>} primaryAction={<Primary label="Confirm three days" enabled={canConfirm} onPress={() => onConfirm(selectedDates.map(dateKey), ENABLE_WEEKEND_ADDRESS_FLOW ? weekendDelivery : 'primary', ENABLE_WEEKEND_ADDRESS_FLOW ? weekendLocation.trim() : '', ENABLE_WEEKEND_ADDRESS_FLOW ? weekendAddress.trim() : '')} />} /></ScrollView>}</AdaptiveSheetFrame></KeyboardAvoidingView>{ENABLE_WEEKEND_ADDRESS_FLOW && locationPickerOpen ? <WeekendLocationSheet value={weekendLocation} onClose={() => setLocationPickerOpen(false)} onSave={(value) => { setWeekendLocation(value); setLocationPickerOpen(false); setTimeout(() => calendarScrollRef.current?.scrollToEnd({ animated: true }), 180); }} /> : null}</>;
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

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="absolute inset-0 z-50 justify-end"><SheetBackdrop /><Pressable className="absolute inset-0" onPress={onClose} /><AdaptiveSheetFrame onClose={onClose} title="Choose your three days">{(sheetControls) => <ScrollView ref={calendarScrollRef} onContentSizeChange={(_width, height) => sheetControls.setContentHeight(height)} showsVerticalScrollIndicator={false} scrollEnabled={sheetControls.scrollEnabled} onScrollBeginDrag={sheetControls.onScrollBeginDrag} onScrollEndDrag={sheetControls.onScrollEndDrag} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}><FormChromeSheetLayout subtitle="Choose three delivery days. The calendar keeps two context days before and two after your three-day selection frame." fields={<><View className="flex-row">{['S','M','T','W','T','F','S'].map((day, index) => <Text key={`${day}-${index}`} className="w-[14.285%] text-center font-body-medium text-sm text-muted">{day}</Text>)}</View><View className="mt-2 flex-row flex-wrap">{Array.from({ length: calendarDays[0]!.getDay() }, (_, index) => <View key={`empty-${index}`} className="w-[14.285%]" />)}{calendarDays.map((date, index) => { const key = dateKey(date); const selected = selectedKeys.has(key); const inWindow = !hasWindow || (index >= startIndex && index <= windowEnd); const inFrame = !hasWindow || (index >= frameStart && index <= frameEnd); return <View key={key} className={`w-[14.285%] items-center py-1 ${inFrame ? '' : 'opacity-55'}`}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${inWindow ? '' : ', starts a new selection frame'}`} onPress={() => chooseDate(index)} className={`h-7 w-7 items-center justify-center rounded-full ${selected ? 'bg-accent ring-2 ring-accent ring-offset-[3px] ring-offset-sheet' : inFrame ? 'bg-surface-raised' : 'bg-surface'}`}><Text className={`font-body-medium text-sm ${selected ? 'text-accent-foreground' : 'text-foreground'}`}>{date.getDate()}</Text></Pressable></View>; })}</View></>} primaryAction={<Primary label="Confirm three days" enabled={selectedDates.length === TRIAL_DAY_COUNT} onPress={() => onConfirm(selectedDates.map(dateKey), initialWeekendDelivery, initialWeekendLocation, initialWeekendAddress)} />} /></ScrollView>}</AdaptiveSheetFrame></KeyboardAvoidingView>;
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
  // First pick anchors a 7-day window (inclusive). Any 3 days inside that window are allowed.
  const minDate = anchor ?? today;
  const maxDate = anchor ? addCalendarDays(anchor, 6) : addCalendarDays(today, 180);
  const canConfirm = selectedDates.length === TRIAL_DAY_COUNT;
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
        return <View key={key} className="w-[14.285%] items-center py-1.5"><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => toggleDate(date)} className={`h-8 w-8 items-center justify-center rounded-full border ${selected ? 'border-2 border-accent bg-accent ring-2 ring-accent ring-offset-[3px] ring-offset-sheet' : 'border-border bg-canvas'} ${disabled ? 'opacity-30' : ''}`}><Text className={`font-mono-semibold text-body-sm ${selected ? 'text-accent-foreground' : 'text-foreground'}`}>{date.getDate()}</Text></Pressable></View>;
      })}</View>
    </View>;
  };
  return (
    <TrialBottomSheet onClose={onClose} closeLabel="Close calendar">
      <FormModalLayout
        title="Choose your three days"
        subtitle="Pick a start date, then choose any three days within the following seven days."
        headerAction={<TrialIconButton icon={XIcon} variant="surface" onPress={onClose} accessibilityLabel="Close calendar" />}
        fields={<Animated.ScrollView ref={calendarPagerRef} horizontal pagingEnabled snapToInterval={pageWidth} decelerationRate="fast" showsHorizontalScrollIndicator={false} style={{ width: pageWidth, alignSelf: 'center', overflow: 'hidden' }} layout={LinearTransition.duration(180).easing(Easing.inOut(Easing.quad))} contentOffset={{ x: initialMonthIndex * pageWidth, y: 0 }} onMomentumScrollEnd={(event) => { visibleMonthIndex.current = Math.round(event.nativeEvent.contentOffset.x / pageWidth); }}>{months.map(renderMonth)}</Animated.ScrollView>}
        primaryAction={<TrialAuthButton label="Confirm three days" enabled={canConfirm} onPress={() => onConfirm(selectedDates.map(dateKey), initialWeekendDelivery, initialWeekendLocation, initialWeekendAddress)} />}
      />
    </TrialBottomSheet>
  );
}

export default function TrialFlow({ onPurchaseComplete }: { onPurchaseComplete?: () => void } = {}) {
  const { upsertAddress, setDefaultAddress } = useSavedAddresses();
  const [step, setStep] = useState<Step>('deliveryEligibility'); const [data, setData] = useState<State>(initialState); const [dateOpen, setDateOpen] = useState(false); const [calendarOpen, setCalendarOpen] = useState(false); const [paused, setPaused] = useState(false); const [pauseOpen, setPauseOpen] = useState(false); const [toast, setToast] = useState(false); const [returnToSummary, setReturnToSummary] = useState(false); const [openSubscriptionOnHome, setOpenSubscriptionOnHome] = useState(false);
  const [addressMode, setAddressMode] = useState<AddressMode>('weekday');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  // In backend mode "Pay" runs the real purchase: draft, preferences, dates,
  // addresses, checkout, mock pay and the webhook poll. Mock mode keeps the
  // instant fake success it always had.
  const confirmPayment = () => {
    if (!backendEnabled || !isSignedIn()) { next(); return; }
    setPurchasing(true);
    setPurchaseError(null);
    purchaseTrialOnServer({
      food: data.food,
      meal: data.meal,
      bread: data.bread,
      rice: data.rice,
      dailyMeals: data.dailyMeals,
      trialDays: data.trialDays,
      lunchDelivery: data.lunchDelivery,
      dinnerDelivery: data.dinnerDelivery,
      paymentLabel: data.payment,
    })
      .then(() => { setPurchasing(false); next(); })
      .catch((error: Error) => { setPurchasing(false); setPurchaseError(error.message); });
  };
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [coverageRequestPincode, setCoverageRequestPincode] = useState('');
  const [coverageRequestState, setCoverageRequestState] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [coverageToast, setCoverageToast] = useState('');
  const [confirmAddressOpen, setConfirmAddressOpen] = useState(false);
  const [addressFlowSlot, setAddressFlowSlot] = useState<MealDeliverySlot | null>(null);
  const addressNumberRef = useRef<TextInput>(null); const societyRef = useRef<TextInput>(null); const landmarkRef = useRef<TextInput>(null); const instructionsRef = useRef<TextInput>(null);
  const set = <K extends keyof State>(key: K, value: State[K]) => setData((current) => ({ ...current, [key]: value }));
  const patchWeekdayAddress = (patch: Partial<AddressDetails>) => setData((current) => ({ ...current, address: { ...current.address, ...patch } }));
  const patchWeekendAddress = (patch: Partial<AddressDetails>) => setData((current) => ({ ...current, weekendAddressDetails: { ...current.weekendAddressDetails, ...patch } }));
  const patchActiveAddress = (patch: Partial<AddressDetails>) => { if (addressMode === 'weekday') patchWeekdayAddress(patch); else patchWeekendAddress(patch); };
const index = order.indexOf(step); const next = () => { if (returnToSummary && ['food', 'meal', 'mixMeals', 'bread', 'rice', 'addressFlow'].includes(step)) { setReturnToSummary(false); setStep('summary'); return; } let nextIndex = Math.min(order.length - 1, index + 1); if (step === 'food' && data.meal && order[nextIndex] === 'meal') nextIndex = Math.min(order.length - 1, nextIndex + 1); setStep(order[nextIndex]!); }; const back = () => {
    if (returnToSummary) {
      setReturnToSummary(false);
      setStep('summary');
      return;
    }
    if (step === 'summary') {
      const slots = addressSlotsForMeal(data.meal);
      const lastSlot = slots[slots.length - 1];
      if (lastSlot === 'lunch' && data.lunchDelivery) {
        setAddressFlowSlot('lunch');
        setStep('addressFlow');
        return;
      }
      if (lastSlot === 'dinner' && data.dinnerDelivery) {
        setAddressFlowSlot('dinner');
        setStep('addressFlow');
        return;
      }
      setAddressFlowSlot(null);
      setStep('rice');
      return;
    }
    setStep(order[Math.max(0, index - 1)]!);
  };
  const meals = data.meal === 'Both' ? TRIAL_DAY_COUNT * 2 : TRIAL_DAY_COUNT;
  const dailyMealsComplete = data.dailyMeals.every((day) => (data.meal === 'Dinner' || !!day.lunch) && (data.meal === 'Lunch' || !!day.dinner));
  const total = trialPricingBreakup(data.meal).total;
  const usesDifferentWeekendAddress = ENABLE_WEEKEND_ADDRESS_FLOW && data.weekendDelivery === 'different';
  const activeAddress = addressMode === 'weekday' ? data.address : data.weekendAddressDetails;
  const activeAddressText = addressMode === 'weekday' ? data.deliveryLocation : (data.weekendLocation || 'Choose your weekend delivery location');
  const activePincode = extractPincode(activeAddressText);
  const submitCoverage = () => {
    setCoverageRequestState('submitting');
    void submitCoverageRequest(coverageRequestPincode)
      .then(() => {
        setCoverageRequestState('submitted');
        setCoverageOpen(false);
        setCoverageToast(COVERAGE_REQUEST_SUCCESS_TOAST);
      })
      .catch(() => setCoverageRequestState('error'));
  };

  const startAddressFlow = (slot?: MealDeliverySlot) => {
    const target = slot ?? nextPendingAddressSlot(data.meal, data);
    if (!target) {
      setStep('summary');
      return;
    }
    setAddressFlowSlot(target);
    setStep('addressFlow');
  };

  const handleAddressConfirmed = (saved: SavedAddress) => {
    const mealState = mealDeliveryFromSaved(saved);
    upsertAddress(detailsFromSavedAddress(saved), saved.id);
    setDefaultAddress(saved.id);
    const slot = addressFlowSlot!;
    const merged: State = {
      ...data,
      ...(slot === 'lunch' ? { lunchDelivery: mealState } : { dinnerDelivery: mealState }),
    };
    const withLegacy = { ...merged, ...syncLegacyDeliveryFields(merged) };
    setData(withLegacy);
    const pending = nextPendingAddressSlot(data.meal, withLegacy);
    if (pending && !returnToSummary) {
      setAddressFlowSlot(pending);
      return;
    }
    setAddressFlowSlot(null);
    if (returnToSummary) setReturnToSummary(false);
    setStep('summary');
  };

  const handleUseSameAsReference = () => {
    if (!data.lunchDelivery) return;
    handleAddressConfirmed(savedAddressFromMealDelivery(data.lunchDelivery));
  };

  const addressRefs = { number: addressNumberRef, society: societyRef, landmark: landmarkRef, instructions: instructionsRef };

  useEffect(() => {
    if (step === 'meal' && data.meal && !returnToSummary) {
      if (data.food === 'Mix of both') setStep('mixMeals');
      else setStep('bread');
    }
  }, [step, data.meal, data.food, returnToSummary]);

  useEffect(() => {
    if (step !== 'addressFlow' || addressFlowSlot) return;
    const pending = nextPendingAddressSlot(data.meal, data);
    if (pending) {
      setAddressFlowSlot(pending);
      return;
    }
    setStep('summary');
  }, [step, addressFlowSlot, data]);

  if (step === 'deliveryEligibility') return <View className="absolute inset-0 bg-canvas"><DeliveryEligibilityScreen shell={(content, footer) => <Shell title="Delivery availability" onBack={undefined} footer={footer}>{content}</Shell>} initialPincode={data.deliveryPincode} initialMealLabel={data.meal} initialTrusted={!!data.deliveryPincode && !!data.meal} onContinue={({ pincode, meal }) => { setData((current) => ({ ...current, deliveryPincode: pincode, meal: mealSelectionToMealLabel(meal) })); if (backendEnabled && isSignedIn()) { void completeOnboardingStep('deliveryEligibility', { deliveryPincode: pincode, mealPreference: meal }).catch(() => {}); } next(); }} /></View>;
  if (step === 'personal') return <><Shell title="Tell us about you" onBack={back} footer={<TrialAuthButton label="Continue" enabled={data.name.trim().length > 1 && !!data.dob && !!data.gender} onPress={next} />}><FormPageSection subheading="A few details help us personalise your trial."><View className="gap-sheet-gap"><PersonalFormField label="Full name" autoFocus value={data.name} onChangeText={(value) => set('name', value)} placeholder="Your full name" onSubmitEditing={() => { Keyboard.dismiss(); setTimeout(() => setDateOpen(true), 120); }} /><PersonalDateField value={data.dob} onPress={() => { Keyboard.dismiss(); setTimeout(() => setDateOpen(true), 120); }} /><View className="gap-2"><Text className="font-body text-body-sm tracking-body-sm text-foreground">Gender</Text><View className="flex-row gap-otp">{genderOptions.map((option) => <PersonalGenderCard key={option.label} label={option.label} icon={option.icon} selected={data.gender === option.label} onPress={() => set('gender', option.label)} />)}</View></View></View></FormPageSection></Shell>{dateOpen ? <DateSheet value={data.dob} onClose={() => setDateOpen(false)} onConfirm={(value) => { set('dob', value); setDateOpen(false); }} /> : null}</>;
  if (step === 'intro') return <TrialIntro onBack={back} onProceed={next} onSkipToSubscribe={() => { if (!data.deliveryPincode || !data.meal) { setStep('deliveryEligibility'); return; } setData((current) => ({ ...current, food: current.food || 'Vegetarian', bread: current.bread || 'Chapati', rice: current.rice || 'Plain Rice' })); setOpenSubscriptionOnHome(true); setStep('tracker'); }} />;
  if (step === 'food') return <><Shell title="What do you enjoy eating?" onBack={back}><FormPageSection subheading="Choose one preference for your trial."><PreferenceCards options={food} value={data.food} onChange={(value) => { set('food', value); setCalendarOpen(true); }} /></FormPageSection></Shell>{calendarOpen ? <TrialCalendarSheet initialDays={data.trialDays} initialWeekendDelivery={data.weekendDelivery} initialWeekendLocation={data.weekendLocation} initialWeekendAddress={data.weekendAddress} onClose={() => setCalendarOpen(false)} onConfirm={(trialDays, weekendDelivery, weekendLocation, weekendAddress) => { setData((current) => ({ ...current, trialDays, weekendDelivery, weekendLocation, weekendAddress, dailyMeals: Array.from({ length: TRIAL_DAY_COUNT }, (_, index) => current.dailyMeals[index] ?? { lunch: '', dinner: '' }) })); setCalendarOpen(false); setTimeout(next, 160); }} /> : null}</>
  if (step === 'meal') return <Shell title="Choose your meals" onBack={back}><FormPageSection subheading="Delivery windows are fixed so every day stays predictable."><PreferenceCards options={meal} value={data.meal} onChange={(v) => { set('meal', v); setTimeout(() => { if (data.food === 'Mix of both') setStep('mixMeals'); else if (returnToSummary) { setReturnToSummary(false); setStep('summary'); } else setStep('bread'); }, 160); }} /></FormPageSection></Shell>;
  if (step === 'mixMeals') return <Shell title="Plan your three days" onBack={back} footer={<TrialAuthButton label="Continue" enabled={dailyMealsComplete} onPress={next} />}><FormPageSection subheading="Choose vegetarian or non-vegetarian food for each selected meal."><DailyMealPlan meal={data.meal} dates={data.trialDays} value={data.dailyMeals} onChange={(value) => set('dailyMeals', value)} /></FormPageSection></Shell>;
  if (step === 'bread') return <Shell title="Choose your bread" onBack={() => { if (returnToSummary) back(); else if (data.meal) setStep('food'); else setStep('meal'); }}><FormPageSection subheading="Pick what feels most familiar at home."><PreferenceCards options={bread} value={data.bread} onChange={(v) => { set('bread', v); setTimeout(next, 160); }} /></FormPageSection></Shell>;
  if (step === 'rice') return <Shell title="Choose your rice" onBack={back}><FormPageSection subheading="You can change this later for upcoming meals."><PreferenceCards options={rice} value={data.rice} onChange={(v) => { set('rice', v); setTimeout(() => { if (returnToSummary) { setReturnToSummary(false); setStep('summary'); } else startAddressFlow(); }, 160); }} /></FormPageSection></Shell>;
  if (step === 'addressFlow' && addressFlowSlot) {
    const existing = addressFlowSlot === 'lunch' ? data.lunchDelivery : data.dinnerDelivery;
    const initialLocation = existing?.deliveryLocation ?? '';
    const initialDetails = existing
      ? addressDetailsFromState(existing.deliveryLocation, existing.address, data.deliveryPincode)
      : { ...emptyAddressDetails(''), pincode: data.deliveryPincode };
    return (
      <DeliveryAddressFlow
        key={addressFlowSlot}
        mode="onboarding"
        mealSlot={addressFlowSlot}
        initialLocation={initialLocation}
        initialDetails={initialDetails}
        preferredPincode={data.deliveryPincode}
        referenceMealDelivery={addressFlowSlot === 'dinner' ? data.lunchDelivery : null}
        onUseSameAsReference={addressFlowSlot === 'dinner' && data.lunchDelivery ? handleUseSameAsReference : undefined}
        onClose={() => {
          if (returnToSummary) {
            setReturnToSummary(false);
            setStep('summary');
            setAddressFlowSlot(null);
            return;
          }
          setAddressFlowSlot(null);
          setStep('rice');
        }}
        onConfirmed={(saved) => handleAddressConfirmed(saved)}
      />
    );
  }
  if (step === 'summary') return (
    <TrialSummaryScreen
      data={data}
      onPreferenceChange={(kind, value, slot) => {
        if (kind === 'food') {
          if (data.food === 'Mix of both') {
            setData((current) => ({
              ...current,
              dailyMeals: current.dailyMeals.map((day, index) =>
                index === 0 ? { ...day, [slot]: value } : day
              ),
            }));
          } else {
            set('food', value);
          }
        } else if (kind === 'bread') {
          set('bread', value);
        } else {
          set('rice', value);
        }
      }}
      onEditAddress={(slot) => { setReturnToSummary(true); setAddressFlowSlot(slot); setStep('addressFlow'); }}
      onMealTabChange={(tab) => set('summaryMealTab', tab)}
      onNext={next}
      shell={(content, footer) => (
        <Shell title="Your trial, at a glance" onBack={back} footer={footer}>
          {content}
        </Shell>
      )}
    />
  );
  if (step === 'payment') return <Shell title="Complete payment" onBack={back} footer={<TrialPaymentButton total={total} enabled={!!data.payment && !purchasing} onPress={confirmPayment} />}><FormPageSection subheading="Choose a secure payment method for your three-day trial."><ChoiceCards options={['UPI', 'Credit or debit card', 'Net banking', 'Digital wallet'].map((title) => ({ title, description: title === 'UPI' ? 'Pay with any UPI app.' : `Pay securely using ${title.toLowerCase()}.` }))} value={data.payment} onChange={(v) => { set('payment', v); setPurchaseError(null); }} />{purchasing ? <Text className="mt-4 text-center font-body text-body-xs text-muted">Confirming your payment…</Text> : null}{purchaseError ? <View className="mt-4"><FormValidationText>{purchaseError}</FormValidationText></View> : null}<Text className="mt-4 text-center font-body text-body-xs text-muted">Your payment is protected by secure, encrypted processing.</Text></FormPageSection></Shell>;
  if (step === 'success') return <TrialConfirmation data={data} total={total} onContinue={() => { if (backendEnabled && onPurchaseComplete) { onPurchaseComplete(); return; } next(); }} />;
  return <TrialHome food={data.food} meal={data.meal} dailyMeals={data.dailyMeals} bread={data.bread} rice={data.rice} address={`${data.address.number || 'B-704'}, ${data.address.society || 'Green View Apartments'}, Baner Road, Pune 411045`} lunchDelivery={data.lunchDelivery} dinnerDelivery={data.dinnerDelivery} openSubscriptionOnLoad={openSubscriptionOnHome} />;
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  const tone = 'text-foreground';
  const typography = moneyValueTypography(value, 'text-body-md', tone);
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="max-w-[40%] shrink-0 font-body text-body-sm text-muted">{label}</Text>
      <View className="min-w-0 flex-1">
        <Text className={`${typography}${bold && !value.includes('₹') ? ' font-mono-semibold' : ''}`}>{value}</Text>
      </View>
    </View>
  );
}

function TrialConfirmation({ data, total, onContinue }: { data: State; total: number; onContinue: () => void }) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const address = `${data.address.number}, ${data.address.society}, Baner Road, Pune 411045`;
  const dishImage = foodImages[data.food as keyof typeof foodImages] ?? foodImages.Vegetarian;

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
  const footerHeight = 88 + (Platform.OS === 'ios' ? insets.bottom : Math.max(16, insets.bottom + 8));

  const contentRef = useAnimatedRef<Animated.ScrollView>();
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
    <Animated.View entering={FadeIn.duration(180)} style={[rootBgStyle, { overflow: rootOverflow }]} className="flex-1">
      <View style={{ paddingTop: headerTop }} className="absolute inset-x-0 top-0 z-20 flex-row items-center justify-between px-5 pb-4">
        <View className="size-icon-button" />
        <Text className="font-body text-body-sm tracking-body-sm text-foreground">sora kitchen</Text>
      </View>

      <View style={{ top: headerTop + headerRowHeight, height: heroHeight, overflow: heroOverflow }} pointerEvents="none" className="absolute inset-x-0 z-0 items-center">
        <Animated.View style={heroAnimatedStyle} className="size-[314px] overflow-hidden rounded-full">
          <Image source={dishImage} accessibilityLabel={`${data.food || 'Preferred'} meal`} resizeMode="cover" className="size-full" />
        </Animated.View>
      </View>

      <Animated.View style={[{ bottom: footerHeight, left: 0, right: 0, position: 'absolute', overflow: 'hidden' }, sheetPositionStyle]} className="z-10 bg-canvas">
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
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 }}
        >
          <View style={{ height: collapseRange }} />
          <Animated.View style={contentLiftStyle} className="gap-sheet-gap">
            <FormHeader title="Your trial is confirmed" subtitle="Your payment is complete. Confirmation and important meal updates will be sent on WhatsApp." size="page" />
            <View>
              <Text className="font-body text-body-sm text-muted">Payment amount</Text>
              <MoneyText amount={total} className="mt-1 text-[34px] text-foreground" />
            </View>
            <View className="h-px bg-border" />
            <View className="gap-5">
              <View>
                <Text className="font-body text-body-sm text-muted">Confirmation number</Text>
                <Text selectable className="mt-1 font-body-medium text-body-md text-foreground">ST3P27JUL</Text>
              </View>
              <View>
                <Text className="font-body text-body-sm text-muted">Trial starts</Text>
                <Text className="mt-1 font-body-medium text-body-md text-foreground">{data.trialDays[0] ? trialDateLabel(data.trialDays[0]) : '27 July'}</Text>
              </View>
              <View>
                <Text className="font-body text-body-sm text-muted">Meal preference</Text>
                <Text className="mt-1 font-body-medium text-body-md text-foreground">{data.meal} · {data.food}</Text>
              </View>
              <View>
                <Text className="font-body text-body-sm text-muted">Bread and rice</Text>
                <Text className="mt-1 font-body-medium text-body-md text-foreground">{data.bread} · {data.rice}</Text>
              </View>
              <View>
                <Text className="font-body text-body-sm text-muted">Delivering to {addressLabelDisplay(data.address)}</Text>
                <Text className="mt-1 font-body-medium text-body-md leading-6 text-foreground">{address}</Text>
              </View>
            </View>
          </Animated.View>
        </Animated.ScrollView>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(360).duration(280)} style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(16, insets.bottom + 8) }} className="absolute inset-x-0 bottom-0 z-20 bg-canvas px-5 pt-2">
        <TrialAuthButton label="View trial tracker" onPress={onContinue} />
      </Animated.View>
    </Animated.View>
  );
}
function Tracker({ data, paused, setPauseOpen, toast, pauseOpen, confirmPause }: { data: State; paused: boolean; setPauseOpen: (v: boolean) => void; toast: boolean; pauseOpen: boolean; confirmPause: () => void }) {
  const insets = useSafeAreaInsets();
  return <View className="flex-1 bg-canvas"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }}><View className="px-5"><Text className="font-body-medium text-sm text-accent">ACTIVE TRIAL</Text><Text className="mt-2 font-mono-semibold text-[24px] leading-8 text-foreground">Day 2 of {TRIAL_DAY_COUNT}</Text><View className="mt-4 h-2 overflow-hidden rounded-full bg-border"><View className="h-full w-2/3 rounded-full bg-accent" /></View><View className="mt-5 flex-row gap-3"><View className="flex-1 rounded-[14px] bg-surface p-4"><Text className="font-mono-semibold text-2xl text-foreground">2</Text><Text className="mt-1 text-sm text-muted">Completed</Text></View><View className="flex-1 rounded-[14px] bg-surface p-4"><Text className="font-mono-semibold text-2xl text-foreground">1</Text><Text className="mt-1 text-sm text-muted">Remaining</Text></View></View><View className="mt-3 rounded-[14px] bg-surface p-4"><Row label="Trial dates" value="27–29 July" /><View className="mt-2"><Row label="Meals" value={data.meal} /></View></View><Text className="mb-3 mt-8 font-mono-semibold text-xl text-foreground">Upcoming meals</Text><View className="rounded-[18px] border border-border bg-surface p-5"><View className="flex-row justify-between"><View><Text className="font-body-medium text-sm text-muted">29 JULY · LUNCH</Text><Text className="mt-2 font-mono-semibold text-xl text-foreground">{data.food} meal</Text></View>{paused ? <View className="h-8 justify-center rounded-full bg-surface-raised px-3"><Text className="font-mono-semibold text-sm text-muted">Paused</Text></View> : null}</View><Text className="mt-3 font-body text-[15px] text-muted">{addressLabelDisplay(data.address)} · {data.address.society}</Text><Text className="mt-3 font-body-medium text-sm text-foreground">720 kcal · 28 g protein · 92 g carbs</Text><View className="mt-4 rounded-xl bg-surface-raised p-4"><Row label="Calories" value="720 kcal" /><View className="mt-2"><Row label="Protein" value="28 g" /></View><View className="mt-2"><Row label="Carbohydrates" value="92 g" /></View><View className="mt-2"><Row label="Fat · Fibre · Sodium" value="24 g · 11 g · 680 mg" /></View></View><Text className="mt-3 font-body text-xs leading-5 text-muted">Nutritional values are approximate and may vary based on portion size, ingredients and preparation method.</Text>{!paused ? <View className="mt-5"><Primary label="Pause meal" onPress={() => setPauseOpen(true)} /></View> : null}<View className="mt-3 flex-row flex-wrap gap-2">{['Change address', 'Change bread', 'Change rice', 'Contact support', 'Report an issue', 'Rate meal'].map((action) => <Pressable key={action} className="min-h-11 justify-center rounded-full border border-border px-3"><Text className="font-body-medium text-xs text-foreground">{action}</Text></Pressable>)}</View></View></View></ScrollView>{toast ? <Animated.View entering={FadeInUp.springify().damping(18).stiffness(220)} style={{ bottom: insets.bottom + 20 }} className="absolute inset-x-5 rounded-full bg-success px-5 py-4"><Text className="font-mono-semibold text-center text-white">Meal paused successfully</Text></Animated.View> : null}{pauseOpen ? <View className="absolute inset-0 justify-end"><SheetBackdrop /><Pressable className="absolute inset-0" onPress={() => setPauseOpen(false)} /><Animated.View entering={FadeInUp.duration(240)} className="mx-4 mb-4 rounded-[20px] bg-sheet p-sheet"><FormModalLayout title="Pause this meal?" subtitle="This meal will be marked as paused for 29 July." primaryAction={<Primary label="Confirm pause" onPress={confirmPause} />} secondaryAction={<Pressable onPress={() => setPauseOpen(false)} className="h-12 items-center justify-center"><Text className="font-mono-semibold text-foreground">Keep meal</Text></Pressable>} /></Animated.View></View> : null}</View>;
}
