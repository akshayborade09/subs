import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { FormPageSection } from './formLayout';
import { PrimaryShimmerButton, GhostFieldButton } from './primaryButton';
import { submitCoverageRequest } from './coverageRequestStore';
import {
  addressDetailsValid,
  emptyAddressDetails,
  extractPincodeFromText,
  mealOverrideFromSavedAddress,
  savedAddressFromDetails,
  type AddressFlowMode,
  type SavedAddress,
} from './addressTypes';
import { canContinueFromMapSelection, extractPincode } from './deliveryServiceability';
import { useDeliveryAddressMachine } from './deliveryAddressState';
import {
  AddressDetailsForm,
  AddressLocationSummary,
  ConfirmDeliveryAddressSheet,
  DeliveryCoverageSheet,
  FocusScrollContext,
  LocationPanel,
  SavedAddressesSheet,
  SearchLocationScreen,
  useFocusScrollField,
  usePincodeAvailability,
} from './deliveryAddressComponents';
import { useSavedAddresses } from './savedAddressesStore';
import { Toast, COVERAGE_REQUEST_SUCCESS_TOAST } from './toast';

export function DeliveryAddressFlow({
  mode,
  initialLocation = '',
  onClose,
  onConfirmed,
}: {
  mode: AddressFlowMode;
  initialLocation?: string;
  onClose: () => void;
  onConfirmed: (address: SavedAddress, mealOverride: ReturnType<typeof mealOverrideFromSavedAddress>) => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const { savedAddresses, upsertAddress, setDefaultAddress, removeAddress, defaultAddressId } = useSavedAddresses();
  const {
    phase,
    deliveryLocation,
    details,
    coverageOpen,
    coverageRequestPincode,
    coverageRequestState,
    send,
  } = useDeliveryAddressMachine(mode, initialLocation, emptyAddressDetails(initialLocation));
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<SavedAddress | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const { scrollOffset, positionFocusedField } = useFocusScrollField(scrollRef);
  const numberRef = useRef<TextInput>(null);
  const societyRef = useRef<TextInput>(null);
  const landmarkRef = useRef<TextInput>(null);
  const instructionsRef = useRef<TextInput>(null);
  const mapPincode = extractPincode(deliveryLocation);
  const mapAvailability = usePincodeAvailability(mapPincode);
  const detailsPincode = details.pincode || extractPincodeFromText(details.deliveryLocation);
  const detailsAvailability = usePincodeAvailability(phase === 'addressDetails' ? detailsPincode : '');

  useEffect(() => {
    if (phase === 'mapSelection') {
      send({ type: 'SET_PINCODE_AVAILABILITY', availability: mapAvailability });
    }
  }, [deliveryLocation, mapAvailability, phase, send]);

  useEffect(() => {
    if (phase === 'addressDetails') {
      send({ type: 'SET_PINCODE_AVAILABILITY', availability: detailsAvailability });
    }
  }, [detailsAvailability, phase, send]);

  const availability = phase === 'mapSelection' ? mapAvailability : detailsAvailability;
  const pincode = phase === 'mapSelection' ? mapPincode : detailsPincode;
  const canContinueMap = canContinueFromMapSelection(deliveryLocation, mapAvailability);
  const canContinueDetails = addressDetailsValid({ ...details, pincode }, detailsAvailability);
  const showSavedPicker = mode !== 'onboarding' && savedAddresses.length > 0;

  const finishConfirm = (address: SavedAddress) => {
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

  const submitCoverage = () => {
    send({ type: 'SUBMIT_COVERAGE_REQUEST' });
    void submitCoverageRequest(coverageRequestPincode)
      .then(() => {
        send({ type: 'COVERAGE_REQUEST_SUBMITTED' });
        setToastMessage(COVERAGE_REQUEST_SUCCESS_TOAST);
      })
      .catch(() => send({ type: 'COVERAGE_REQUEST_FAILED' }));
  };

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

  if (phase === 'confirmingAddress' && pendingAddress) {
    return (
      <View className="absolute inset-0 z-[80] bg-canvas">
        <ConfirmDeliveryAddressSheet
          address={pendingAddress}
          onClose={() => send({ type: 'EDIT_ADDRESS' })}
          onEdit={() => send({ type: 'EDIT_ADDRESS' })}
          onConfirm={() => finishConfirm(pendingAddress)}
        />
      </View>
    );
  }

  const title = phase === 'mapSelection' ? 'Where should we deliver?' : 'Add address details';
  const mapSubtitle = 'Search for a location, then adjust the pin on the map.';
  const footerExtraActions = phase === 'mapSelection' && showSavedPicker;

  return (
    <View className="absolute inset-0 z-[80] bg-canvas">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled={!coverageOpen} className="flex-1">
        <FocusScrollContext.Provider value={positionFocusedField}>
          <ScrollView
            ref={scrollRef}
            automaticallyAdjustKeyboardInsets={!coverageOpen}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + (footerExtraActions ? 160 : 96) }}
          >
            <View className="px-5">
              <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => { if (phase === 'addressDetails') send({ type: 'BACK_TO_MAP' }); else onClose(); }} hitSlop={8} className="mb-6 size-6 items-center justify-center">
                <CaretLeftIcon size={24} weight="regular" color={iconColor} />
              </Pressable>
              <FormPageSection>
                {phase !== 'mapSelection' ? (
                  <Text className="font-heading text-heading-md text-foreground">{title}</Text>
                ) : null}
                {phase === 'mapSelection' ? (
                  <View className="gap-auth-block">
                    <Text className="font-heading text-heading-md text-foreground">{title}</Text>
                    <Text className="font-body text-body-sm leading-5 text-muted">{mapSubtitle}</Text>
                    <LocationPanel
                      addressText={deliveryLocation}
                      onAddressChange={(value) => send({ type: 'LOCATION_SELECTED', location: value })}
                      onOpenSearch={() => setLocationSearchOpen(true)}
                      availability={mapAvailability}
                      onOpenCoverage={() => send({ type: 'OPEN_COVERAGE' })}
                    />
                  </View>
                ) : (
                  <>
                    <AddressLocationSummary
                      location={deliveryLocation}
                      onPressMap={() => send({ type: 'BACK_TO_MAP' })}
                      availability={detailsAvailability}
                      onOpenCoverage={() => send({ type: 'OPEN_COVERAGE' })}
                    />
                    <AddressDetailsForm
                      details={{ ...details, pincode }}
                      onChange={(patch) => send({ type: 'UPDATE_ADDRESS_DETAILS', details: patch })}
                      refs={{ number: numberRef, society: societyRef, landmark: landmarkRef, instructions: instructionsRef }}
                      topMargin={false}
                    />
                  </>
                )}
              </FormPageSection>
            </View>
          </ScrollView>
        </FocusScrollContext.Provider>
        <Animated.View entering={FadeInUp.duration(220)} style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(16, insets.bottom + 8) }} className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-2">
          {phase === 'mapSelection' ? (
            <View className="gap-2">
              <PrimaryShimmerButton
                label="Next"
                enabled={canContinueMap}
                onPress={() => {
                  if (!canContinueMap) return;
                  send({ type: 'NEXT_FROM_MAP' });
                }}
              />
              {showSavedPicker ? (
                <GhostFieldButton label="Select address from list" onPress={() => send({ type: 'OPEN_SAVED_ADDRESSES' })} />
              ) : null}
            </View>
          ) : (
            <PrimaryShimmerButton
              label="Continue"
              enabled={canContinueDetails}
              onPress={() => {
                Keyboard.dismiss();
                const draft = savedAddressFromDetails({ ...details, deliveryLocation, pincode });
                setPendingAddress(draft);
                send({ type: 'CONTINUE_TO_CONFIRM' });
              }}
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
      {phase === 'selectingSavedAddress' ? (
        <SavedAddressesSheet
          addresses={savedAddresses}
          defaultAddressId={defaultAddressId}
          onClose={() => send({ type: 'CLOSE_SAVED_ADDRESSES' })}
          onSelect={(address) => send({ type: 'SELECT_SAVED_ADDRESS', address })}
          onEdit={(address) => send({ type: 'SELECT_SAVED_ADDRESS', address })}
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
      {toastMessage ? <Toast message={toastMessage} onDismiss={() => setToastMessage('')} /> : null}
    </View>
  );
}
