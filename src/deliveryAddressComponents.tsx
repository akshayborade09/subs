import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetBackdrop } from './sheetOverlay';
import { hapticPress } from './haptics';
import {
  geocodeLocationQuery,
  searchLocationSuggestions,
} from './locationGeocoding';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { TrashSimpleIcon } from 'phosphor-react-native/src/icons/TrashSimple';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { BriefcaseIcon } from 'phosphor-react-native/src/icons/Briefcase';
import { UsersIcon } from 'phosphor-react-native/src/icons/Users';
import { UsersThreeIcon } from 'phosphor-react-native/src/icons/UsersThree';
import { BookmarkSimpleIcon } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { DotsThreeVerticalIcon } from 'phosphor-react-native/src/icons/DotsThreeVertical';
import SelectableMap from './SelectableMap';
import { CenteredFieldInput, multilineFieldInputStyle } from './centeredFieldInput';
import { FormHeader, FormModalLayout } from './formLayout';
import { PrimaryShimmerButton, GhostFieldButton } from './primaryButton';
import { themePalette, useFieldPlaceholderColor, useForegroundColor } from './themeColors';
import {
  ADDRESS_LABEL_OPTIONS,
  addressLabelDisplay,
  formatSavedAddressLines,
  formatSavedAddressUserLines,
  type AddressDetails,
  type AddressLabelType,
  type SavedAddress,
} from './addressTypes';
import {
  checkDeliveryAvailability,
  deliveryLocationAvailabilityMessage,
  extractPincode,
  supportedDeliveryPincodes,
  type DeliveryAvailabilityState,
} from './deliveryServiceability';

export const FocusScrollContext = createContext<((input: TextInput | null) => void) | null>(null);

function FlowGlyph({ icon: Glyph, size = 20 }: { icon: typeof MapPinIcon; size?: number }) {
  const { theme } = useUniwind();
  const color = theme === 'dark' ? '#ffffff' : '#101010';
  return <Glyph size={size} weight="bold" color={color} />;
}

function AddressBottomSheet({ onClose, closeLabel, children, maxHeightRatio = 0.6 }: { onClose: () => void; closeLabel: string; children: ReactNode; maxHeightRatio?: number }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const sheetMaxHeight = height * maxHeightRatio;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const sheetMarginBottom = keyboardHeight > 0
    ? Math.max(8, keyboardHeight - insets.bottom)
    : Math.max(16, insets.bottom > 0 ? 0 : 16);

  return (
    <View className="absolute inset-0 z-[90]">
      <SheetBackdrop />
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} className="absolute inset-0" onPress={onClose} />
      <View pointerEvents="box-none" className="absolute inset-0 justify-end">
        <Animated.View
          entering={FadeInUp.duration(220)}
          style={{ maxHeight: sheetMaxHeight, marginBottom: sheetMarginBottom }}
          className="mx-4 overflow-hidden rounded-sheet bg-canvas"
        >
          <View className="p-sheet" style={{ maxHeight: sheetMaxHeight }}>
            {children}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

export function DeliveryAvailabilityNotice({ state, message }: { state: DeliveryAvailabilityState; message: string }) {
  const { theme } = useUniwind();
  const palette = themePalette[theme === 'dark' ? 'dark' : 'light'];
  const unavailableColor = theme === 'dark' ? '#f87171' : '#dc2626';
  const toneColor = state === 'available' ? palette.accent : unavailableColor;
  return (
    <View className="flex-row items-center gap-2">
      <MapPinIcon size={18} weight="fill" color={toneColor} />
      <Text className={`flex-1 font-body-medium text-body-sm leading-5 ${state === 'available' ? 'text-accent' : ''}`} style={state === 'available' ? undefined : { color: unavailableColor }}>
        {message}
      </Text>
    </View>
  );
}

export function DeliveryLocationAvailabilityNotice({
  state,
  hasLocation,
  onOpenCoverage,
}: {
  state: DeliveryAvailabilityState;
  hasLocation: boolean;
  onOpenCoverage: () => void;
}) {
  const { theme } = useUniwind();
  const unavailableColor = theme === 'dark' ? '#f87171' : '#dc2626';

  if (state === 'checking') {
    return <Text className="font-body text-body-sm text-muted">Checking delivery availability…</Text>;
  }

  if (state === 'available') {
    return (
      <Text className="font-body-medium text-body-sm leading-5 text-accent">{deliveryLocationAvailabilityMessage(state)}</Text>
    );
  }

  if (state === 'unavailable') {
    return (
      <Text className="font-body-medium text-body-sm leading-5" style={{ color: unavailableColor }}>
        We're sorry! We don't deliver here yet.{' '}
        <Text accessibilityRole="link" onPress={onOpenCoverage} className="font-body-medium text-body-sm text-accent underline">
          Check delivery coverage
        </Text>
      </Text>
    );
  }

  if (state === 'error') {
    return <Text className="font-body-medium text-body-sm leading-5 text-muted">{deliveryLocationAvailabilityMessage(state)}</Text>;
  }

  if (hasLocation) {
    return <Text className="font-body text-body-sm leading-5 text-muted">Select a location with a valid 6-digit pincode to check delivery.</Text>;
  }

  return null;
}

export function DeliveryCoverageSheet({
  initialPincode,
  requestState,
  onClose,
  onPincodeChange,
  onSubmit,
}: {
  initialPincode: string;
  requestState: 'idle' | 'submitting' | 'submitted' | 'error';
  onClose: () => void;
  onPincodeChange: (pincode: string) => void;
  onSubmit: () => void;
}) {
  const foregroundColor = useForegroundColor();
  const scrollRef = useRef<ScrollView>(null);
  const pincodeRef = useRef<TextInput>(null);
  const [pincode, setPincode] = useState(initialPincode.replace(/\D/g, '').slice(0, 6));

  useEffect(() => {
    setPincode(initialPincode.replace(/\D/g, '').slice(0, 6));
  }, [initialPincode]);

  const updatePincode = (value: string) => {
    const next = value.replace(/\D/g, '').slice(0, 6);
    setPincode(next);
    onPincodeChange(next);
  };

  const focusPincodeField = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), Platform.OS === 'android' ? 320 : 220);
  };

  return (
    <AddressBottomSheet onClose={onClose} closeLabel="Close delivery coverage" maxHeightRatio={0.85}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <FormHeader title="Delivery coverage" size="sheet" />
        <Text className="mt-4 font-body-medium text-body-md leading-6 text-foreground">We're not in your area just yet.</Text>
        <Text className="mt-3 font-body text-body-sm leading-5 text-muted">
          We currently deliver to selected areas covered by these pincodes:
        </Text>
        <View className="mt-2 gap-1">
          {supportedDeliveryPincodes.map((code) => (
            <Text key={code} className="font-mono-semibold text-body-sm text-foreground">{code}</Text>
          ))}
        </View>
        <Text className="mt-4 font-body text-body-sm leading-5 text-muted">
          We're actively expanding our delivery network, and we'd love to reach your area soon.
        </Text>
        <Text className="mt-4 font-body text-body-sm leading-5 text-muted">
          Share your pincode below and we'll use it to help prioritise where we expand next.
        </Text>
        <View className="mt-5 gap-2">
          <Text className="font-body text-body-sm tracking-body-sm text-foreground">Request delivery in your area</Text>
          <CenteredFieldInput
            value={pincode}
            onChangeText={updatePincode}
            onFocus={focusPincodeField}
            placeholder="Enter your pincode"
            selectionColor={foregroundColor}
            shellClassName="border border-border bg-field"
            inputRef={pincodeRef}
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="done"
          />
          {requestState === 'error' ? (
            <Text className="font-body text-body-xs text-muted">Unable to save your request right now. Please try again.</Text>
          ) : null}
        </View>
        <View className="mt-6 pb-2">
          <PrimaryShimmerButton
            label={requestState === 'submitting' ? 'Saving…' : 'Done'}
            enabled={pincode.length === 6 && requestState !== 'submitting'}
            onPress={onSubmit}
          />
        </View>
      </ScrollView>
    </AddressBottomSheet>
  );
}

export function LocationSearchBar({
  value,
  onPress,
  onClear,
  editable = false,
  onChangeText,
  onSubmitEditing,
  autoFocus = false,
}: {
  value: string;
  onPress?: () => void;
  onClear?: () => void;
  editable?: boolean;
  onChangeText?: (value: string) => void;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const foregroundColor = useForegroundColor();

  const handleClear = () => {
    onClear?.();
    if (editable) {
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    onPress?.();
  };

  const clearButton =
    value.trim().length > 0 && onClear ? (
      <Pressable accessibilityRole="button" accessibilityLabel="Clear location" onPress={hapticPress(handleClear, 'light')} hitSlop={8} className="size-6 shrink-0 items-center justify-center">
        <FlowGlyph icon={XIcon} size={20} />
      </Pressable>
    ) : null;

  if (editable) {
    return (
      <CenteredFieldInput
        value={value}
        onChangeText={onChangeText ?? (() => {})}
        placeholder="Search location"
        accessibilityLabel="Search location"
        selectionColor={foregroundColor}
        shellClassName="border border-border bg-canvas"
        inputRef={inputRef}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        prefix={<FlowGlyph icon={MagnifyingGlassIcon} size={22} />}
        suffix={clearButton}
      />
    );
  }

  return (
    <View className="h-field flex-row items-center gap-field-inline rounded-field border border-border bg-canvas px-sheet">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search location"
        onPress={onPress}
        className="min-w-0 flex-1 flex-row items-center gap-field-inline"
      >
        <FlowGlyph icon={MagnifyingGlassIcon} size={22} />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className={`min-w-0 flex-1 font-body-medium text-body-md leading-6 tracking-body-md ${value ? 'text-foreground' : 'text-muted'}`}
        >
          {value || 'Search location'}
        </Text>
      </Pressable>
      {clearButton}
    </View>
  );
}

export function DeliveryAddressMap({
  searchQuery,
  onAddressChange,
  onCoordinateChange,
}: {
  searchQuery: string;
  onAddressChange: (value: string) => void;
  onCoordinateChange?: (coordinate: { latitude: number; longitude: number }) => void;
}) {
  return (
    <View className="-mx-5 overflow-hidden">
      <SelectableMap fullWidth searchQuery={searchQuery} onAddressChange={onAddressChange} onCoordinateChange={onCoordinateChange} />
    </View>
  );
}

export function CurrentLocationSection({ location }: { location: string }) {
  return (
    <View className="gap-0.5">
      <Text className="font-body text-body-sm tracking-body-sm text-muted">Current location</Text>
      <Text className="font-body-medium text-body-md leading-5 text-foreground">{location.trim() || 'Move the map or search to select a location'}</Text>
    </View>
  );
}

/** @deprecated Use LocationSearchBar + DeliveryAddressMap + CurrentLocationSection */
export function LocationPanel({
  addressText,
  onAddressChange,
  onCoordinateChange,
  onOpenSearch,
  availability,
  onOpenCoverage,
}: {
  addressText: string;
  onAddressChange: (value: string) => void;
  onCoordinateChange?: (coordinate: { latitude: number; longitude: number }) => void;
  onOpenSearch: () => void;
  availability: DeliveryAvailabilityState;
  onOpenCoverage: () => void;
}) {
  const [query, setQuery] = useState(addressText);
  useEffect(() => {
    setQuery(addressText);
  }, [addressText]);
  const updateFromMap = (value: string) => {
    setQuery(value);
    onAddressChange(value);
  };
  const hasLocation = addressText.trim().length > 2;
  return (
    <View className="gap-auth-block">
      <Pressable accessibilityRole="button" accessibilityLabel="Search location" onPress={onOpenSearch} className="h-field flex-row items-center gap-field-inline rounded-field border border-border bg-canvas px-sheet">
        <FlowGlyph icon={MagnifyingGlassIcon} size={22} />
        <Text numberOfLines={1} ellipsizeMode="tail" className="flex-1 font-body-medium text-body-md leading-6 tracking-body-md text-foreground">{query || 'Search location'}</Text>
      </Pressable>
      <DeliveryLocationAvailabilityNotice state={availability} hasLocation={hasLocation} onOpenCoverage={onOpenCoverage} />
      <View className="overflow-hidden rounded-field border border-border">
        <SelectableMap searchQuery={query} onAddressChange={updateFromMap} onCoordinateChange={onCoordinateChange} />
      </View>
      <Text className="font-body text-body-xs leading-[18px] text-muted">Move the map to adjust the pin. The address updates automatically.</Text>
    </View>
  );
}

export function SearchLocationScreen({ initialValue, onBack, onSelect }: { initialValue: string; onBack: () => void; onSelect: (value: string) => void }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(initialValue);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      void searchLocationSuggestions(trimmed)
        .then((labels) => {
          if (active) setSuggestions(labels);
        })
        .catch(() => {
          if (active) setSuggestions([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const submitSearch = () => {
    const trimmed = query.trim();
    if (trimmed.length < 3) return;
    if (suggestions.length > 0) {
      const first = suggestions[0];
      if (first) selectSuggestion(first);
      return;
    }
    void geocodeLocationQuery(trimmed).then((resolved) => {
      if (resolved) selectSuggestion(resolved.label);
    });
  };

  const selectSuggestion = (value: string) => {
    Keyboard.dismiss();
    onSelect(value);
  };

  return (
    <View className="absolute inset-0 z-[95] bg-canvas">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }} className="flex-1 px-5">
          <View className="flex-row items-center gap-2">
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => { Keyboard.dismiss(); onBack(); }} hitSlop={8} className="size-6 items-center justify-center">
              <FlowGlyph icon={CaretLeftIcon} size={24} />
            </Pressable>
            <Text numberOfLines={1} className="min-w-0 flex-1 font-heading text-heading-md text-foreground">Search location</Text>
          </View>
          <View className="mt-4">
            <LocationSearchBar
              editable
              autoFocus
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submitSearch}
              onClear={() => setQuery('')}
            />
          </View>
          <View className="mt-3 flex-1">
            {query.trim().length < 3 ? (
              <View className="flex-1 items-center justify-center px-8">
                <FlowGlyph icon={MagnifyingGlassIcon} size={28} />
                <Text className="mt-3 text-center font-mono-semibold text-body-md text-foreground">Search for an area, landmark or address</Text>
                <Text className="mt-1 text-center font-body text-body-sm leading-5 text-muted">Enter at least three characters to see matching locations.</Text>
              </View>
            ) : searching ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color="#078a4b" />
                <Text className="mt-3 font-body text-body-sm text-muted">Searching locations…</Text>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {suggestions.map((location, index) => (
                  <Pressable key={`${index}-${location}`} onPress={hapticPress(() => selectSuggestion(location), 'selection')} className="min-h-16 flex-row items-center border-b border-border py-3">
                    <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-icon-surface">
                      <FlowGlyph icon={MapPinIcon} size={20} />
                    </View>
                    <Text numberOfLines={2} ellipsizeMode="tail" className="flex-1 font-body-medium text-body-md leading-6 text-foreground">{location}</Text>
                  </Pressable>
                ))}
                {suggestions.length === 0 ? (
                  <Text className="py-6 text-center font-body text-body-sm leading-5 text-muted">No matching locations found. Try a nearby landmark or a more complete address.</Text>
                ) : null}
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function AddressFormField({ label, value, onChangeText, placeholder, multiline = false, inputRef, returnKeyType = 'next', onSubmitEditing, autoFocus = false }: { label?: string; value: string; onChangeText: (v: string) => void; placeholder: string; multiline?: boolean; inputRef?: React.RefObject<TextInput | null>; returnKeyType?: 'next' | 'done'; onSubmitEditing?: () => void; autoFocus?: boolean }) {
  const [focused, setFocused] = useState(false);
  const placeholderColor = useFieldPlaceholderColor();
  const foregroundColor = useForegroundColor();
  const localRef = useRef<TextInput>(null);
  const scrollFocusedField = useContext(FocusScrollContext);
  const fieldClass = focused ? 'border border-foreground bg-canvas' : 'border border-transparent bg-field';
  const content = multiline ? (
    <TextInput ref={(node) => { localRef.current = node; if (inputRef) inputRef.current = node; }} autoFocus={autoFocus} value={value} onChangeText={onChangeText} onFocus={() => { setFocused(true); scrollFocusedField?.(localRef.current); }} onBlur={() => setFocused(false)} onSubmitEditing={onSubmitEditing} returnKeyType={returnKeyType} blurOnSubmit={returnKeyType === 'done'} submitBehavior="blurAndSubmit" placeholder={placeholder} placeholderTextColor={placeholderColor} multiline textAlignVertical="top" className={`rounded-field px-sheet ${fieldClass}`} style={[multilineFieldInputStyle, { color: foregroundColor }]} />
  ) : (
    <CenteredFieldInput value={value} onChangeText={onChangeText} placeholder={placeholder} selectionColor={foregroundColor} shellClassName={fieldClass} inputRef={inputRef ?? localRef} autoFocus={autoFocus} returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing} onFocus={() => { setFocused(true); scrollFocusedField?.((inputRef ?? localRef).current); }} onBlur={() => setFocused(false)} />
  );
  return <View className={label ? 'gap-2' : undefined}>{label ? <Text className="font-body text-body-sm tracking-body-sm text-foreground">{label}</Text> : null}{content}</View>;
}

const ADDRESS_LABEL_ICONS: Record<AddressLabelType, typeof HouseIcon> = {
  home: HouseIcon,
  office: BriefcaseIcon,
  friends: UsersIcon,
  relatives: UsersThreeIcon,
  custom: BookmarkSimpleIcon,
};

export function AddressLabelIcon({ labelType, size = 20 }: { labelType: AddressLabelType; size?: number }) {
  const { theme } = useUniwind();
  const color = theme === 'dark' ? '#ffffff' : '#101010';
  const Glyph = ADDRESS_LABEL_ICONS[labelType];
  return <Glyph size={size} weight="bold" color={color} />;
}

export function DeleteAddressConfirmSheet({
  addressLabel,
  onClose,
  onConfirmDelete,
}: {
  addressLabel: string;
  onClose: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <View className="absolute inset-0 z-[100]">
      <SheetBackdrop />
      <Pressable accessibilityRole="button" accessibilityLabel="Close delete confirmation" className="absolute inset-0" onPress={onClose} />
      <View pointerEvents="box-none" className="absolute inset-0 justify-end">
        <Animated.View entering={FadeInUp.duration(220)} className="mx-4 mb-4 overflow-hidden rounded-sheet bg-canvas p-sheet">
          <FormHeader title={`Delete ${addressLabel}?`} size="sheet" />
          <Text className="mt-3 font-body text-body-sm leading-5 text-muted">
            This address will be removed from your saved addresses.
          </Text>
          <View className="mt-5 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete address"
              onPress={hapticPress(onConfirmDelete, 'warning')}
              className="h-field flex-1 items-center justify-center rounded-button-inner bg-red-50 dark:bg-red-950/40"
            >
              <Text className="font-mono-semibold text-body-md text-destructive">Delete</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep address"
              onPress={hapticPress(onClose, 'light')}
              className="h-field flex-1 items-center justify-center rounded-button-inner bg-foreground"
            >
              <Text className="font-mono-semibold text-body-md text-canvas">Keep</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function SavedAddressRowMenu({
  onEdit,
  onDelete,
  canDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { theme } = useUniwind();
  const destructiveColor = theme === 'dark' ? '#f87171' : '#dc2626';

  return (
    <View
      style={{ elevation: 24, shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 }}
      className="min-w-[148px] overflow-hidden rounded-field border border-border bg-canvas"
    >
      <Pressable
        accessibilityRole="menuitem"
        onPress={hapticPress(onEdit, 'light')}
        className="border-b border-border px-4 py-3"
      >
        <Text className="font-body-medium text-body-md text-foreground">Edit</Text>
      </Pressable>
      <Pressable
        accessibilityRole="menuitem"
        disabled={!canDelete}
        onPress={canDelete ? hapticPress(onDelete, 'warning') : undefined}
        className={`px-4 py-3 ${canDelete ? '' : 'opacity-40'}`}
      >
        <Text className="font-body-medium text-body-md" style={{ color: destructiveColor }}>Delete</Text>
      </Pressable>
    </View>
  );
}

const SAVED_ADDRESS_MENU_WIDTH = 148;
const SAVED_ADDRESS_MENU_HEIGHT = 96;

export function AddressLabelSection({ labelType, customLabel, onSelectLabel, onCustomLabelChange }: { labelType: AddressLabelType; customLabel: string; onSelectLabel: (label: AddressLabelType) => void; onCustomLabelChange: (value: string) => void }) {
  const { theme } = useUniwind();
  const selectedColor = theme === 'dark' ? '#ffffff' : '#101010';
  const mutedColor = theme === 'dark' ? '#a3a3a3' : '#737373';

  return (
    <View className="gap-3">
      <Text className="font-heading text-body-md text-foreground">Save address as</Text>
      <View className="flex-row flex-wrap gap-2">
        {ADDRESS_LABEL_OPTIONS.map((option) => {
          const selected = labelType === option.id;
          const Glyph = ADDRESS_LABEL_ICONS[option.id];
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={hapticPress(() => onSelectLabel(option.id), 'selection')}
              className={`h-10 flex-row items-center gap-2 rounded-full border px-3 ${selected ? 'border-2 border-accent bg-accent-soft' : 'border-border bg-canvas'}`}
            >
              <Glyph size={18} weight="bold" color={selected ? selectedColor : mutedColor} />
              <Text className={`font-mono-semibold text-body-sm ${selected ? 'text-foreground' : 'text-muted'}`}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {labelType === 'custom' ? (
        <AddressFormField label="Address label" value={customLabel} onChangeText={onCustomLabelChange} placeholder="e.g. Gym, Parents' house" returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
      ) : null}
    </View>
  );
}

export function AddressLocationSummary({
  location,
  onPressMap,
  availability,
  onOpenCoverage,
}: {
  location: string;
  onPressMap: () => void;
  availability: DeliveryAvailabilityState;
  onOpenCoverage?: () => void;
}) {
  const hasLocation = location.trim().length > 2;

  return (
    <View className="gap-auth-block">
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit delivery location on map"
          onPress={onPressMap}
          className="size-16 shrink-0 overflow-hidden rounded-field border border-border bg-field"
        >
          <SelectableMap thumbnail searchQuery={location} />
        </Pressable>
        <Text className="min-w-0 flex-1 font-body text-body-sm leading-5 text-foreground">{location}</Text>
      </View>
      <DeliveryLocationAvailabilityNotice
        state={availability}
        hasLocation={hasLocation}
        onOpenCoverage={onOpenCoverage ?? (() => {})}
      />
    </View>
  );
}

export function AddressDetailsForm({
  details,
  onChange,
  refs,
  topMargin = true,
  includeLabels = false,
  singleField = false,
}: {
  details: AddressDetails;
  onChange: (patch: Partial<AddressDetails>) => void;
  refs: { number: React.RefObject<TextInput | null>; society: React.RefObject<TextInput | null>; landmark: React.RefObject<TextInput | null>; instructions: React.RefObject<TextInput | null> };
  topMargin?: boolean;
  includeLabels?: boolean;
  singleField?: boolean;
}) {
  if (singleField) {
    return (
      <View className={`${topMargin ? 'mt-5' : ''} gap-2`}>
        <Text className="font-heading text-body-md text-foreground">Address details</Text>
        <AddressFormField
          label={includeLabels ? 'Address' : ''}
          value={details.number}
          onChangeText={(v) => onChange({ number: v, society: '', landmark: '', instructions: '' })}
          placeholder="Flat, house or office number, building name"
          inputRef={refs.number}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />
      </View>
    );
  }

  return (
    <View className={`${topMargin ? 'mt-5' : ''} gap-sheet-gap`}>
      <Text className="font-heading text-body-md text-foreground">Address details</Text>
      <AddressFormField label={includeLabels ? 'Flat, house or office number' : ''} value={details.number} onChangeText={(v) => onChange({ number: v })} placeholder="Flat, house or office number" inputRef={refs.number} onSubmitEditing={() => refs.society.current?.focus()} />
      <AddressFormField label={includeLabels ? 'Building or society name' : ''} value={details.society} onChangeText={(v) => onChange({ society: v })} placeholder="Building or society name" inputRef={refs.society} onSubmitEditing={() => refs.landmark.current?.focus()} />
      <AddressFormField label={includeLabels ? 'Nearby landmark (optional)' : ''} value={details.landmark} onChangeText={(v) => onChange({ landmark: v })} placeholder="Nearby landmark (optional)" inputRef={refs.landmark} onSubmitEditing={() => refs.instructions.current?.focus()} />
      <AddressFormField label={includeLabels ? 'Delivery instructions (optional)' : ''} value={details.instructions} onChangeText={(v) => onChange({ instructions: v })} placeholder="Delivery instructions (optional)" multiline inputRef={refs.instructions} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
    </View>
  );
}

export function SavedAddressesSheet({
  addresses,
  onClose,
  onSelect,
  onEdit,
  onDelete,
  onAddNew,
  defaultAddressId,
}: {
  addresses: SavedAddress[];
  onClose: () => void;
  onSelect: (address: SavedAddress) => void;
  onEdit?: (address: SavedAddress) => void;
  onDelete?: (address: SavedAddress) => void;
  onAddNew?: () => void;
  defaultAddressId?: string | null;
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const scrollMaxHeight = Math.max(160, windowHeight * 0.55 - 180);
  const [menuAddressId, setMenuAddressId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; width: number; height: number; openUpward: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedAddress | null>(null);
  const menuTriggerRefs = useRef<Record<string, View | null>>({});

  const closeMenu = () => {
    setMenuAddressId(null);
    setMenuAnchor(null);
  };

  const openMenu = (address: SavedAddress, index: number) => {
    if (menuAddressId === address.id) {
      closeMenu();
      return;
    }
    const node = menuTriggerRefs.current[address.id];
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      const spaceBelow = windowHeight - (y + height);
      const openUpward = index === addresses.length - 1 || spaceBelow < SAVED_ADDRESS_MENU_HEIGHT + 16;
      setMenuAddressId(address.id);
      setMenuAnchor({ x, y, width, height, openUpward });
    });
  };

  const menuLeft = menuAnchor
    ? Math.min(Math.max(8, menuAnchor.x + menuAnchor.width - SAVED_ADDRESS_MENU_WIDTH), windowWidth - SAVED_ADDRESS_MENU_WIDTH - 8)
    : 0;
  const menuTop = menuAnchor
    ? (menuAnchor.openUpward
      ? menuAnchor.y - SAVED_ADDRESS_MENU_HEIGHT - 8
      : menuAnchor.y + menuAnchor.height + 4)
    : 0;

  const activeMenuAddress = menuAddressId ? addresses.find((item) => item.id === menuAddressId) : undefined;

  return (
    <>
      <AddressBottomSheet onClose={onClose} closeLabel="Close saved addresses" maxHeightRatio={0.65}>
        <View style={{ maxHeight: windowHeight * 0.65 - 32 }}>
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <FormHeader title="Saved addresses" size="sheet" />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close saved addresses" onPress={onClose} hitSlop={8} className="size-icon-button shrink-0 items-center justify-center">
              <XIcon size={24} weight="regular" color={iconColor} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: scrollMaxHeight }}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {addresses.map((address, index) => (
              <View
                key={address.id}
                className={`relative flex-row items-start gap-3 py-4 ${index < addresses.length - 1 ? 'border-b border-border' : ''}`}
              >
                <View className="size-10 shrink-0 items-center justify-center rounded-full bg-icon-surface">
                  <AddressLabelIcon labelType={address.labelType} size={20} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={hapticPress(() => onSelect(address), 'selection')}
                  className="min-w-0 flex-1 pr-2"
                >
                  <Text className="font-mono-semibold text-body-md text-foreground">{addressLabelDisplay(address)}</Text>
                  <Text numberOfLines={3} ellipsizeMode="tail" className="mt-1.5 font-body text-body-sm leading-5 text-muted">
                    {formatSavedAddressLines(address)}
                  </Text>
                </Pressable>
                {(onEdit || onDelete) ? (
                  <View
                    ref={(node) => { menuTriggerRefs.current[address.id] = node; }}
                    collapsable={false}
                    className="relative shrink-0"
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Actions for ${addressLabelDisplay(address)}`}
                      onPress={hapticPress(() => openMenu(address, index), 'light')}
                      hitSlop={8}
                      className="size-icon-button items-center justify-center"
                    >
                      <DotsThreeVerticalIcon size={20} weight="bold" color={iconColor} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>

          {onAddNew ? (
            <View className="mt-3">
              <PrimaryShimmerButton label="Add address" onPress={onAddNew} />
            </View>
          ) : null}
        </View>
      </AddressBottomSheet>

      {menuAnchor && activeMenuAddress ? (
        <View pointerEvents="box-none" className="absolute inset-0 z-[9999]">
          <Pressable accessibilityRole="button" accessibilityLabel="Close address actions" className="absolute inset-0" onPress={closeMenu} />
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: menuTop,
              left: menuLeft,
              width: SAVED_ADDRESS_MENU_WIDTH,
              zIndex: 10000,
              elevation: 100,
            }}
          >
            <SavedAddressRowMenu
              canDelete={!!onDelete && activeMenuAddress.id !== defaultAddressId}
              onEdit={() => { closeMenu(); onEdit?.(activeMenuAddress); }}
              onDelete={() => { closeMenu(); setPendingDelete(activeMenuAddress); }}
            />
          </View>
        </View>
      ) : null}

      {pendingDelete ? (
        <DeleteAddressConfirmSheet
          addressLabel={addressLabelDisplay(pendingDelete)}
          onClose={() => setPendingDelete(null)}
          onConfirmDelete={() => {
            onDelete?.(pendingDelete);
            setPendingDelete(null);
            closeMenu();
          }}
        />
      ) : null}
    </>
  );
}

export function SameAsReferenceMealSheet({
  mealSlot,
  onClose,
  onConfirmSame,
  onUseDifferent,
}: {
  mealSlot: 'dinner';
  onClose: () => void;
  onConfirmSame: () => void;
  onUseDifferent: () => void;
}) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const mealLabel = mealSlot === 'dinner' ? 'Dinner' : 'Lunch';
  return (
    <AddressBottomSheet onClose={onClose} closeLabel="Close same location prompt">
      <FormModalLayout
        title={`Is your ${mealLabel} location same as lunch?`}
        subtitle="Your pin is close to the lunch delivery spot."
        headerAction={
          <Pressable accessibilityRole="button" accessibilityLabel="Close same location prompt" onPress={onClose} hitSlop={8} className="size-icon-button items-center justify-center">
            <XIcon size={24} weight="regular" color={iconColor} />
          </Pressable>
        }
        fields={null}
        primaryAction={<PrimaryShimmerButton label="Yes - it's same" onPress={onConfirmSame} />}
        secondaryAction={<GhostFieldButton label="No - write another" onPress={onUseDifferent} />}
      />
    </AddressBottomSheet>
  );
}

export function ConfirmDeliveryAddressSheet({ address, onClose, onConfirm, onEdit, title = 'Confirm delivery address', confirmLabel = 'Confirm delivery address' }: { address: SavedAddress; onClose: () => void; onConfirm: () => void; onEdit: () => void; title?: string; confirmLabel?: string }) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  return (
    <AddressBottomSheet onClose={onClose} closeLabel="Close address confirmation">
      <FormModalLayout
        title={title}
        subtitle="Make sure everything looks right before continuing."
        headerAction={
          <Pressable accessibilityRole="button" accessibilityLabel="Close address confirmation" onPress={onClose} hitSlop={8} className="size-icon-button items-center justify-center">
            <XIcon size={24} weight="regular" color={iconColor} />
          </Pressable>
        }
        fields={(
          <>
            <View className="h-[109px] overflow-hidden rounded-sheet bg-field">
              <SelectableMap compact searchQuery={address.deliveryLocation} />
            </View>
            <View className="rounded-sheet bg-accent-soft p-sheet">
              <View className="flex-row items-center justify-between">
                <Text className="font-heading text-body-md text-foreground">{addressLabelDisplay(address)}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Edit address" onPress={onEdit} hitSlop={8}>
                  <PencilSimpleIcon size={20} weight="regular" color={iconColor} />
                </Pressable>
              </View>
              <Text className="mt-2.5 font-body-medium text-body-sm leading-5 text-foreground">{formatSavedAddressLines(address)}</Text>
              {address.instructions ? <Text className="mt-2 font-body text-body-sm leading-5 text-muted">Delivery instructions · {address.instructions}</Text> : null}
            </View>
          </>
        )}
        primaryAction={<PrimaryShimmerButton label={confirmLabel} onPress={onConfirm} />}
      />
    </AddressBottomSheet>
  );
}

export function usePincodeAvailability(pincode: string) {
  const [availability, setAvailability] = useState<DeliveryAvailabilityState>('idle');
  useEffect(() => {
    if (pincode.length !== 6) {
      setAvailability('idle');
      return;
    }
    let active = true;
    setAvailability('checking');
    void checkDeliveryAvailability(pincode).then((state) => {
      if (active) setAvailability(state);
    }).catch(() => {
      if (active) setAvailability('error');
    });
    return () => { active = false; };
  }, [pincode]);
  return availability;
}

export function useFocusScrollField(
  scrollRef: React.RefObject<ScrollView | null>,
  options?: { visibleTopOffset?: number },
) {
  const scrollOffset = useRef(0);
  const lastFocusedInput = useRef<TextInput | null>(null);
  const visibleTopOffset = options?.visibleTopOffset ?? 0;

  const positionFocusedField = useCallback((input: TextInput | null, keyboardTop?: number) => {
    const scroll = scrollRef.current;
    if (!scroll || !input) return;
    const resolvedKeyboardTop = keyboardTop ?? Keyboard.metrics()?.screenY;
    if (!resolvedKeyboardTop) return;

    input.measureInWindow((_x, inputY, _w, inputHeight) => {
      const fieldTop = inputY;
      const fieldBottom = inputY + Math.max(inputHeight, 52);
      const visibleTop = visibleTopOffset + 8;
      const visibleBottom = resolvedKeyboardTop - 16;
      let scrollDelta = 0;

      if (fieldBottom > visibleBottom) {
        scrollDelta = fieldBottom - visibleBottom + 12;
      } else if (fieldTop < visibleTop) {
        scrollDelta = fieldTop - visibleTop - 12;
      }

      if (Math.abs(scrollDelta) > 1) {
        scroll.scrollTo({ y: Math.max(0, scrollOffset.current + scrollDelta), animated: true });
      }
    });
  }, [scrollRef, visibleTopOffset]);

  const scrollFocusedField = useCallback((input: TextInput | null) => {
    lastFocusedInput.current = input;
    positionFocusedField(input);
    setTimeout(() => positionFocusedField(input), 80);
    setTimeout(() => positionFocusedField(input), Platform.OS === 'ios' ? 280 : 380);
  }, [positionFocusedField]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const show = Keyboard.addListener(showEvent, (event) => {
      positionFocusedField(lastFocusedInput.current, event.endCoordinates.screenY);
      setTimeout(() => positionFocusedField(lastFocusedInput.current, event.endCoordinates.screenY), 100);
    });
    return () => show.remove();
  }, [positionFocusedField]);

  return { scrollOffset, positionFocusedField: scrollFocusedField };
}
