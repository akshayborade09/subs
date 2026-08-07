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
import SelectableMap from './SelectableMap';
import { CenteredFieldInput } from './centeredFieldInput';
import { FormHeader, FormModalLayout } from './formLayout';
import { PrimaryShimmerButton } from './primaryButton';
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
          style={{ maxHeight: height * maxHeightRatio, marginBottom: sheetMarginBottom }}
          className="mx-4 overflow-hidden rounded-sheet bg-canvas"
        >
          <View className="p-sheet">{children}</View>
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
  const palette = themePalette[theme === 'dark' ? 'dark' : 'light'];
  const unavailableColor = theme === 'dark' ? '#f87171' : '#dc2626';

  if (state === 'checking') {
    return <Text className="font-body text-body-sm text-muted">Checking delivery availability…</Text>;
  }

  if (state === 'available') {
    return (
      <View className="flex-row items-center gap-2">
        <MapPinIcon size={18} weight="fill" color={palette.accent} />
        <Text className="flex-1 font-body-medium text-body-sm leading-5 text-accent">{deliveryLocationAvailabilityMessage(state)}</Text>
      </View>
    );
  }

  if (state === 'unavailable') {
    return (
      <Text className="font-body-medium text-body-sm leading-5" style={{ color: unavailableColor }}>
        We're sorry! We don't deliver to this pincode yet.{' '}
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
  const placeholderColor = useFieldPlaceholderColor();
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
          <TextInput
            ref={pincodeRef}
            value={pincode}
            onChangeText={updatePincode}
            onFocus={focusPincodeField}
            placeholder="Enter your pincode"
            placeholderTextColor={placeholderColor}
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="done"
            className="h-field rounded-field border border-border bg-field px-sheet font-body-medium text-body-md text-foreground"
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

export function LocationPanel({
  addressText,
  onAddressChange,
  onOpenSearch,
  availability,
  onOpenCoverage,
}: {
  addressText: string;
  onAddressChange: (value: string) => void;
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
        <Text numberOfLines={1} ellipsizeMode="tail" className="flex-1 font-body-medium text-body-md leading-6 tracking-body-md text-foreground">{query || 'Search area, landmark or address'}</Text>
      </Pressable>
      <DeliveryLocationAvailabilityNotice state={availability} hasLocation={hasLocation} onOpenCoverage={onOpenCoverage} />
      <View className="overflow-hidden rounded-field border border-border">
        <SelectableMap searchQuery={query} onAddressChange={updateFromMap} />
      </View>
      <Text className="font-body text-body-xs leading-[18px] text-muted">Move the map to adjust the pin. The address updates automatically.</Text>
    </View>
  );
}

export function SearchLocationScreen({ initialValue, onBack, onSelect }: { initialValue: string; onBack: () => void; onSelect: (value: string) => void }) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
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
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => { Keyboard.dismiss(); onBack(); }} hitSlop={8} className="mb-5 size-6 items-center justify-center">
            <FlowGlyph icon={CaretLeftIcon} size={24} />
          </Pressable>
          <Text className="font-heading text-heading-md text-foreground">Search location</Text>
          <View className="mt-6 h-field flex-row items-center gap-field-inline rounded-field border border-foreground bg-field px-sheet">
            <FlowGlyph icon={MagnifyingGlassIcon} size={22} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={submitSearch}
              placeholder="Search area, landmark or address"
              placeholderTextColor={theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(16,16,16,0.35)'}
              textAlignVertical="center"
              style={{ paddingVertical: 0 }}
              className="h-field flex-1 font-body-medium text-body-md leading-6 tracking-body-md text-foreground"
            />
            {query.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} className="size-icon-button items-center justify-center rounded-full bg-icon-surface">
                <FlowGlyph icon={XIcon} size={20} />
              </Pressable>
            ) : null}
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

function AddressFormField({ label, value, onChangeText, placeholder, multiline = false, inputRef, returnKeyType = 'next', onSubmitEditing, autoFocus = false }: { label: string; value: string; onChangeText: (v: string) => void; placeholder: string; multiline?: boolean; inputRef?: React.RefObject<TextInput | null>; returnKeyType?: 'next' | 'done'; onSubmitEditing?: () => void; autoFocus?: boolean }) {
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
  return <View className="gap-2"><Text className="font-body text-body-sm tracking-body-sm text-foreground">{label}</Text>{content}</View>;
}

export function AddressLabelSection({ labelType, customLabel, onSelectLabel, onCustomLabelChange }: { labelType: AddressLabelType; customLabel: string; onSelectLabel: (label: AddressLabelType) => void; onCustomLabelChange: (value: string) => void }) {
  return (
    <View className="gap-3">
      <Text className="font-body text-body-sm tracking-body-sm text-foreground">Save address as</Text>
      <View className="flex-row flex-wrap gap-2">
        {ADDRESS_LABEL_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: labelType === option.id }}
            onPress={hapticPress(() => onSelectLabel(option.id), 'selection')}
            className={`h-9 justify-center rounded-full border px-4 ${labelType === option.id ? 'border-2 border-accent bg-accent-soft' : 'border-border bg-canvas'}`}
          >
            <Text className={`font-mono-semibold text-body-sm ${labelType === option.id ? 'text-foreground' : 'text-muted'}`}>{option.label}</Text>
          </Pressable>
        ))}
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
}: {
  details: AddressDetails;
  onChange: (patch: Partial<AddressDetails>) => void;
  refs: { number: React.RefObject<TextInput | null>; society: React.RefObject<TextInput | null>; landmark: React.RefObject<TextInput | null>; instructions: React.RefObject<TextInput | null> };
  topMargin?: boolean;
}) {
  return (
    <View className={`${topMargin ? 'mt-5' : ''} gap-sheet-gap`}>
      <AddressFormField label="Flat, house or office number" value={details.number} onChangeText={(v) => onChange({ number: v })} placeholder="B-704" inputRef={refs.number} onSubmitEditing={() => refs.society.current?.focus()} />
      <AddressFormField label="Building or society name" value={details.society} onChangeText={(v) => onChange({ society: v })} placeholder="Green View Apartments" inputRef={refs.society} onSubmitEditing={() => refs.landmark.current?.focus()} />
      <AddressFormField label="Nearby landmark (optional)" value={details.landmark} onChangeText={(v) => onChange({ landmark: v })} placeholder="Near Baner Road" inputRef={refs.landmark} onSubmitEditing={() => refs.instructions.current?.focus()} />
      <AddressFormField label="Delivery instructions (optional)" value={details.instructions} onChangeText={(v) => onChange({ instructions: v })} placeholder="Gate, floor or delivery notes" multiline inputRef={refs.instructions} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
      <AddressLabelSection labelType={details.labelType} customLabel={details.customLabel} onSelectLabel={(labelType) => onChange({ labelType, customLabel: labelType === 'custom' ? details.customLabel : '' })} onCustomLabelChange={(customLabel) => onChange({ customLabel, labelType: 'custom' })} />
    </View>
  );
}

export function SavedAddressesSheet({
  addresses,
  onClose,
  onSelect,
  onEdit,
  onDelete,
  defaultAddressId,
}: {
  addresses: SavedAddress[];
  onClose: () => void;
  onSelect: (address: SavedAddress) => void;
  onEdit?: (address: SavedAddress) => void;
  onDelete?: (address: SavedAddress) => void;
  defaultAddressId?: string | null;
}) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const destructiveColor = theme === 'dark' ? '#f87171' : '#dc2626';

  return (
    <AddressBottomSheet onClose={onClose} closeLabel="Close saved addresses" maxHeightRatio={0.6}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <FormHeader title="Saved address" size="sheet" />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close saved addresses" onPress={onClose} hitSlop={8} className="size-icon-button shrink-0 items-center justify-center">
          <XIcon size={24} weight="regular" color={iconColor} />
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
        {addresses.map((address, index) => (
          <View
            key={address.id}
            className={`flex-row items-start gap-3 py-4 ${index < addresses.length - 1 ? 'border-b border-border' : ''}`}
          >
            <Pressable
              accessibilityRole="button"
              onPress={hapticPress(() => onSelect(address), 'selection')}
              className="min-w-0 flex-1"
            >
              <Text className="font-mono-semibold text-body-md text-foreground">{addressLabelDisplay(address)}</Text>
              <Text className="mt-2 font-body text-body-sm leading-5 text-muted">{formatSavedAddressUserLines(address)}</Text>
              {address.instructions ? <Text className="mt-1 font-body text-body-xs leading-5 text-muted">Delivery instructions · {address.instructions}</Text> : null}
            </Pressable>
            <View className="shrink-0 flex-row items-center gap-1 pt-0.5">
              {onEdit ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${addressLabelDisplay(address)}`} onPress={hapticPress(() => onEdit(address), 'light')} hitSlop={8} className="size-icon-button items-center justify-center">
                  <PencilSimpleIcon size={20} weight="regular" color={iconColor} />
                </Pressable>
              ) : null}
              {onDelete && address.id !== defaultAddressId ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${addressLabelDisplay(address)}`} onPress={hapticPress(() => onDelete(address), 'warning')} hitSlop={8} className="size-icon-button items-center justify-center">
                  <TrashSimpleIcon size={20} weight="regular" color={destructiveColor} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </AddressBottomSheet>
  );
}

export function ConfirmDeliveryAddressSheet({ address, onClose, onConfirm, onEdit }: { address: SavedAddress; onClose: () => void; onConfirm: () => void; onEdit: () => void }) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  return (
    <AddressBottomSheet onClose={onClose} closeLabel="Close address confirmation">
      <FormModalLayout
        title="Confirm delivery address"
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
        primaryAction={<PrimaryShimmerButton label="Confirm delivery address" onPress={onConfirm} />}
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

export function useFocusScrollField(scrollRef: React.RefObject<ScrollView | null>) {
  const scrollOffset = useRef(0);
  const positionFocusedField = useCallback((input: TextInput | null) => {
    const scroll = scrollRef.current;
    if (!scroll || !input) return;
    const keyboardTop = Keyboard.metrics()?.screenY;
    if (!keyboardTop) return;
    input.measureInWindow((_x, inputY, _w, inputHeight) => {
      const fieldBottom = inputY + Math.max(inputHeight, 52);
      const overlap = fieldBottom + 20 - keyboardTop;
      if (overlap > 0) scroll.scrollTo({ y: Math.max(0, scrollOffset.current + overlap), animated: true });
    });
  }, [scrollRef]);
  return { scrollOffset, positionFocusedField };
}
