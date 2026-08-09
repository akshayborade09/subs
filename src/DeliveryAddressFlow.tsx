import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { geocodeLocationQuery, geocodePincodeLocation } from './locationGeocoding';
import { isSameLocationText, isWithinProximity, type MapCoordinate } from './locationProximity';
import { submitCoverageRequest } from './coverageRequestStore';
import type { TrialMealDeliveryState } from './trialOnboardingSummary';
import {
  addressDetailLine,
  canSaveDeliveryAddress,
  deliveryAddressHeaderTitle,
  detailsFromSavedAddress,
  editAddressHeaderTitle,
  emptyAddressDetails,
  extractPincodeFromText,
  mealOverrideFromSavedAddress,
  savedAddressFromDetails,
  type AddressDetails,
  type AddressFlowMode,
  type MealDeliverySlot,
  type SavedAddress,
} from './addressTypes';
import { extractPincode } from './deliveryServiceability';
import { useDeliveryAddressMachine } from './deliveryAddressState';
import {
  AddressDetailsForm,
  AddressLabelSection,
  CurrentLocationSection,
  DeliveryAddressMap,
  DeliveryCoverageSheet,
  DeliveryLocationAvailabilityNotice,
  FocusScrollContext,
  LocationSearchBar,
  SavedAddressesSheet,
  SameAsReferenceMealSheet,
  SearchLocationScreen,
  useFocusScrollField,
  usePincodeAvailability,
} from './deliveryAddressComponents';
import { useSavedAddresses } from './savedAddressesStore';
import { PrimaryShimmerButton } from './primaryButton';
import { Toast, COVERAGE_REQUEST_SUCCESS_TOAST } from './toast';

export function DeliveryAddressFlow({
  mode,
  mealSlot,
  initialLocation = '',
  initialDetails,
  preferredPincode = '',
  editingAddressId,
  headerTitleOverride,
  referenceMealDelivery,
  onClose,
  onConfirmed,
  onUseSameAsReference,
}: {
  mode: AddressFlowMode;
  mealSlot?: MealDeliverySlot;
  initialLocation?: string;
  initialDetails?: AddressDetails;
  /** Pincode from delivery availability — used when location text has none yet. */
  preferredPincode?: string;
  editingAddressId?: string;
  headerTitleOverride?: string;
  referenceMealDelivery?: TrialMealDeliveryState | null;
  onClose: () => void;
  onConfirmed: (address: SavedAddress, mealOverride: ReturnType<typeof mealOverrideFromSavedAddress>) => void;
  onUseSameAsReference?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const { savedAddresses, upsertAddress, setDefaultAddress, removeAddress, defaultAddressId } = useSavedAddresses();
  const normalizedPreferredPincode = preferredPincode.replace(/\D/g, '').slice(0, 6);
  const seededDetails = (() => {
    const base = initialDetails ?? emptyAddressDetails(initialLocation);
    if (base.pincode || !normalizedPreferredPincode) return base;
    return { ...base, pincode: normalizedPreferredPincode };
  })();
  const {
    phase,
    deliveryLocation,
    details,
    coverageOpen,
    coverageRequestPincode,
    coverageRequestState,
    selectedSavedAddressId,
    send,
  } = useDeliveryAddressMachine(mode, initialLocation, seededDetails);
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [sameLocationSheetOpen, setSameLocationSheetOpen] = useState(false);
  const [mapCoordinate, setMapCoordinate] = useState<MapCoordinate | null>(null);
  const [referenceCoordinate, setReferenceCoordinate] = useState<MapCoordinate | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [activeEditId, setActiveEditId] = useState<string | undefined>(editingAddressId);
  const seededPincodeRef = useRef('');
  const addressRef = useRef<TextInput>(null);
  const societyRef = useRef<TextInput>(null);
  const landmarkRef = useRef<TextInput>(null);
  const instructionsRef = useRef<TextInput>(null);
  const pincode = details.pincode || extractPincode(deliveryLocation) || extractPincodeFromText(deliveryLocation) || normalizedPreferredPincode;
  const availability = usePincodeAvailability(pincode);
  const footerHeight = 88 + insets.bottom;
  const fixedHeaderHeight = insets.top + 12 + 33 + 8 + 68 + 8;
  const scrollRef = useRef<ScrollView>(null);
  const { scrollOffset, positionFocusedField } = useFocusScrollField(scrollRef, { visibleTopOffset: fixedHeaderHeight });

  useEffect(() => {
    send({ type: 'SET_PINCODE_AVAILABILITY', availability });
  }, [availability, send]);

  // Seed the search field from the delivery-availability pincode. The ref guard keeps
  // a manual clear cleared, and the deliveryLocation dep drops a stale resolve if the
  // user picks a location while the lookup is in flight.
  useEffect(() => {
    if (!normalizedPreferredPincode || deliveryLocation.trim().length > 0) return;
    if (seededPincodeRef.current === normalizedPreferredPincode) return;
    seededPincodeRef.current = normalizedPreferredPincode;
    let active = true;
    void geocodePincodeLocation(normalizedPreferredPincode)
      .then((resolved) => {
        if (!active || !resolved) return;
        send({ type: 'LOCATION_SELECTED', location: resolved.label });
        setMapCoordinate({ latitude: resolved.latitude, longitude: resolved.longitude });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [deliveryLocation, normalizedPreferredPincode, send]);

  useEffect(() => {
    if (!referenceMealDelivery) {
      setReferenceCoordinate(null);
      return;
    }
    if (referenceMealDelivery.latitude != null && referenceMealDelivery.longitude != null) {
      setReferenceCoordinate({ latitude: referenceMealDelivery.latitude, longitude: referenceMealDelivery.longitude });
      return;
    }
    let active = true;
    void geocodeLocationQuery(referenceMealDelivery.deliveryLocation).then((resolved) => {
      if (!active || !resolved) return;
      setReferenceCoordinate({ latitude: resolved.latitude, longitude: resolved.longitude });
    }).catch(() => {});
    return () => { active = false; };
  }, [referenceMealDelivery]);

  const syncMapCoordinate = (address: SavedAddress) => {
    if (address.latitude != null && address.longitude != null) {
      setMapCoordinate({ latitude: address.latitude, longitude: address.longitude });
      return;
    }
    void geocodeLocationQuery(address.deliveryLocation).then((resolved) => {
      if (!resolved) return;
      setMapCoordinate({ latitude: resolved.latitude, longitude: resolved.longitude });
    }).catch(() => {});
  };

  const handleSelectSavedAddress = (address: SavedAddress) => {
    const line = addressDetailLine(address);
    send({
      type: 'SELECT_SAVED_ADDRESS',
      address: {
        ...address,
        number: line,
        society: '',
        landmark: '',
      },
    });
    syncMapCoordinate(address);
  };

  const handleEditSavedAddress = (address: SavedAddress) => {
    send({ type: 'CLOSE_SAVED_ADDRESSES' });
    setActiveEditId(address.id);
    handleSelectSavedAddress(address);
  };

  const handleAddNewAddress = () => {
    send({ type: 'CLOSE_SAVED_ADDRESSES' });
    setActiveEditId(undefined);
    send({ type: 'LOCATION_SELECTED', location: '' });
    send({
      type: 'UPDATE_ADDRESS_DETAILS',
      details: {
        ...emptyAddressDetails(''),
        number: '',
        society: '',
        landmark: '',
        instructions: '',
      },
    });
    setMapCoordinate(null);
  };

  const matchesReferenceLocation = () => {
    if (!referenceMealDelivery) return false;
    if (isWithinProximity(mapCoordinate, referenceCoordinate)) return true;
    return isSameLocationText(deliveryLocation, referenceMealDelivery.deliveryLocation);
  };

  const finishSave = (address: SavedAddress) => {
    const saved = upsertAddress(
      {
        deliveryLocation: address.deliveryLocation,
        number: address.number,
        society: address.society,
        landmark: address.landmark,
        instructions: address.instructions,
        labelType: address.labelType,
        customLabel: address.customLabel ?? '',
        pincode: address.pincode,
      },
      address.id,
    );
    if (mode === 'onboarding') setDefaultAddress(saved.id);
    send({ type: 'ADDRESS_CONFIRMED' });
    onConfirmed(saved, mealOverrideFromSavedAddress(saved));
  };

  const handleSaveContinue = () => {
    const resolvedEditId = editingAddressId ?? activeEditId ?? selectedSavedAddressId;
    const draft = savedAddressFromDetails({ ...details, deliveryLocation, pincode }, resolvedEditId);
    const pendingAddress: SavedAddress = {
      ...draft,
      latitude: mapCoordinate?.latitude,
      longitude: mapCoordinate?.longitude,
    };
    if (!canSaveDeliveryAddress(deliveryLocation, { ...details, pincode }, availability)) return;

    if (mealSlot === 'dinner' && referenceMealDelivery && onUseSameAsReference && matchesReferenceLocation()) {
      setSameLocationSheetOpen(true);
      return;
    }

    Keyboard.dismiss();
    finishSave(pendingAddress);
  };

  const submitCoverage = () => {
    send({ type: 'SUBMIT_COVERAGE_REQUEST' });
    void submitCoverageRequest(coverageRequestPincode)
      .then(() => {
        send({ type: 'COVERAGE_REQUEST_SUBMITTED' });
        setToastMessage(COVERAGE_REQUEST_SUCCESS_TOAST);
      })
      .catch(() => send({ type: 'COVERAGE_REQUEST_FAILED' }));
  };

  const canSave = canSaveDeliveryAddress(deliveryLocation, { ...details, pincode }, availability);
  const hasLocation = deliveryLocation.trim().length > 2;
  const resolvedEditId = editingAddressId ?? activeEditId;
  const headerTitle = headerTitleOverride ?? (resolvedEditId ? editAddressHeaderTitle() : deliveryAddressHeaderTitle(mealSlot));

  if (locationSearchOpen) {
    return (
      <View className="absolute inset-0 z-[95]">
        <SearchLocationScreen
          initialValue={deliveryLocation}
          onBack={() => setLocationSearchOpen(false)}
          onSelect={(value) => {
            send({ type: 'LOCATION_SELECTED', location: value });
            setLocationSearchOpen(false);
          }}
        />
      </View>
    );
  }

  return (
    <View className="absolute inset-0 z-[80] bg-canvas">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled={!coverageOpen && !sameLocationSheetOpen} className="flex-1">
        <View style={{ paddingTop: insets.top + 12 }} className="bg-canvas px-5 gap-2 pb-2">
          <View className="flex-row items-center gap-2">
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} hitSlop={8} className="size-6 items-center justify-center">
              <CaretLeftIcon size={24} weight="regular" color={iconColor} />
            </Pressable>
            <Text numberOfLines={1} className="min-w-0 flex-1 font-heading text-heading-md text-foreground">{headerTitle}</Text>
          </View>
          <View style={{ paddingTop: 8, paddingBottom: 8 }}>
            <LocationSearchBar
              value={deliveryLocation}
              onPress={() => setLocationSearchOpen(true)}
              onClear={() => {
                send({ type: 'LOCATION_SELECTED', location: '' });
                setMapCoordinate(null);
              }}
            />
          </View>
        </View>

        <FocusScrollContext.Provider value={positionFocusedField}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: footerHeight + 8 }}
          >
            <DeliveryAddressMap
              searchQuery={deliveryLocation}
              preferredPincode={normalizedPreferredPincode || pincode}
              onAddressChange={(value) => send({ type: 'LOCATION_SELECTED', location: value })}
              onCoordinateChange={setMapCoordinate}
            />

            <View className="mt-4 gap-5 px-5">
              <View className="gap-1.5">
                <CurrentLocationSection location={deliveryLocation} />
                <DeliveryLocationAvailabilityNotice
                  state={availability}
                  hasLocation={hasLocation}
                  onOpenCoverage={() => send({ type: 'OPEN_COVERAGE' })}
                />
              </View>
              <AddressDetailsForm
                details={{ ...details, pincode }}
                onChange={(patch) => send({ type: 'UPDATE_ADDRESS_DETAILS', details: patch })}
                refs={{ number: addressRef, society: societyRef, landmark: landmarkRef, instructions: instructionsRef }}
                topMargin={false}
                singleField
              />
              <AddressLabelSection
                labelType={details.labelType}
                customLabel={details.customLabel}
                onSelectLabel={(labelType) => send({ type: 'SELECT_ADDRESS_LABEL', labelType })}
                onCustomLabelChange={(label) => send({ type: 'SET_CUSTOM_ADDRESS_LABEL', label })}
              />
            </View>
          </ScrollView>
        </FocusScrollContext.Provider>

        <Animated.View
          entering={FadeInUp.duration(220)}
          style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(16, insets.bottom + 8) }}
          className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-2"
        >
          <PrimaryShimmerButton
            label="Save address - Continue"
            enabled={canSave}
            onPress={handleSaveContinue}
          />
        </Animated.View>
      </KeyboardAvoidingView>

      {phase === 'selectingSavedAddress' ? (
        <SavedAddressesSheet
          addresses={savedAddresses}
          defaultAddressId={defaultAddressId}
          onClose={() => send({ type: 'CLOSE_SAVED_ADDRESSES' })}
          onAddNew={handleAddNewAddress}
          onSelect={handleSelectSavedAddress}
          onEdit={handleEditSavedAddress}
          onDelete={(address) => {
            removeAddress(address.id);
            if (savedAddresses.length <= 1) send({ type: 'CLOSE_SAVED_ADDRESSES' });
          }}
        />
      ) : null}

      {coverageOpen ? (
        <DeliveryCoverageSheet
          initialPincode={coverageRequestPincode}
          requestState={coverageRequestState}
          onClose={() => send({ type: 'CLOSE_COVERAGE' })}
          onPincodeChange={(value) => send({ type: 'UPDATE_COVERAGE_REQUEST_PINCODE', pincode: value })}
          onSubmit={submitCoverage}
        />
      ) : null}

      {sameLocationSheetOpen ? (
        <SameAsReferenceMealSheet
          mealSlot="dinner"
          onClose={() => setSameLocationSheetOpen(false)}
          onConfirmSame={() => {
            setSameLocationSheetOpen(false);
            onUseSameAsReference?.();
          }}
          onUseDifferent={() => {
            setSameLocationSheetOpen(false);
            const draft = savedAddressFromDetails({ ...details, deliveryLocation, pincode }, editingAddressId ?? activeEditId ?? selectedSavedAddressId);
            finishSave({
              ...draft,
              latitude: mapCoordinate?.latitude,
              longitude: mapCoordinate?.longitude,
            });
          }}
        />
      ) : null}

      {toastMessage ? <Toast message={toastMessage} onDismiss={() => setToastMessage('')} /> : null}
    </View>
  );
}
