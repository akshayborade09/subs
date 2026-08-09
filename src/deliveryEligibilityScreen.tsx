import { useEffect, useMemo, useReducer, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { CenteredFieldInput } from './centeredFieldInput';
import { DeliveryCoverageSheet, LabeledFieldInput } from './deliveryAddressComponents';
import { FormPageSection } from './formLayout';
import { MealPreferenceImage } from './MealPreferenceImage';
import { subscriptionMealOptions, type PreferenceOption } from './subscriptionPreferenceOptions';
import { PrimaryShimmerButton, GhostCanvasButton } from './primaryButton';
import { hapticPress } from './haptics';
import { submitCoverageRequest } from './coverageRequestStore';
import {
  eligibilityPincodeMessage,
  getServiceableAreas,
  isValidIndianPincodeFormat,
  type ServiceableArea,
} from './deliveryServiceability';
import {
  canContinueDeliveryEligibility,
  deliveryEligibilityReducer,
  initialDeliveryEligibilityState,
  mealLabelToMealSelection,
  mealSelectionToMealLabel,
  runPincodeServiceabilityCheck,
  type DeliveryEligibilityEvent,
  type DeliveryEligibilityState,
  type MealSelection,
} from './deliveryEligibilityState';
import { Toast, COVERAGE_REQUEST_SUCCESS_TOAST, MEAL_REQUIRES_PINCODE_TOAST } from './toast';
import { useForegroundColor } from './themeColors';

const SERVICEABLE_STICKY_ACTION_HEIGHT = 52;

function MealSelectionCard({
  title,
  image,
  index,
  selected,
  onPress,
}: {
  title: string;
  image: number;
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      onPress={hapticPress(onPress, 'selection')}
      className={`min-w-0 flex-1 overflow-hidden rounded-field border bg-canvas ${selected ? 'border-2 border-accent bg-accent-soft' : 'border-border'}`}
    >
      <View className="h-[88px] w-full items-center overflow-hidden bg-field">
        <MealPreferenceImage source={image} label={`${title} meal`} delayMs={80 + index * 50} width={106} height={88} imageSize={106} />
      </View>
      <View className="items-center px-2 py-2">
        <Text numberOfLines={1} className={`text-center font-mono-semibold text-body-sm ${selected ? 'text-accent' : 'text-foreground'}`}>{title}</Text>
      </View>
    </Pressable>
  );
}

function ServiceableAreaSearch({
  value,
  onChangeText,
  inputRef,
}: {
  value: string;
  onChangeText: (value: string) => void;
  inputRef?: RefObject<TextInput | null>;
}) {
  const foregroundColor = useForegroundColor();
  const update = (next: string) => onChangeText(next.replace(/\D/g, '').slice(0, 6));

  return (
    <CenteredFieldInput
      value={value}
      onChangeText={update}
      placeholder="Search pincode"
      selectionColor={foregroundColor}
      shellClassName="border border-transparent bg-field"
      inputRef={inputRef}
      keyboardType="number-pad"
      maxLength={6}
      returnKeyType="default"
      accessibilityLabel="Search pincode"
      suffix={
        value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search pincode"
            hitSlop={8}
            onPress={hapticPress(() => onChangeText(''), 'light')}
          >
            <XIcon size={18} weight="bold" color={foregroundColor} />
          </Pressable>
        ) : null
      }
    />
  );
}

function ServiceableAreasPage({
  onClose,
  onSelectPincode,
  onCoverageRequested,
}: {
  onClose: () => void;
  onSelectPincode: (pincode: string) => void;
  onCoverageRequested: () => void;
}) {
  const insets = useSafeAreaInsets();
  const foregroundColor = useForegroundColor();
  const searchRef = useRef<TextInput>(null);
  const [serviceableAreaSearchQuery, setServiceableAreaSearchQuery] = useState('');
  const [areas, setAreas] = useState<ServiceableArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [coverageRequestPincode, setCoverageRequestPincode] = useState('');
  const [coverageRequestState, setCoverageRequestState] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void getServiceableAreas()
      .then((items) => {
        if (!cancelled) setAreas(items);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAreas = useMemo(() => {
    const normalized = serviceableAreaSearchQuery.replace(/\D/g, '').trim();
    if (!normalized) return areas;
    return areas.filter((area) => area.pincode.includes(normalized));
  }, [areas, serviceableAreaSearchQuery]);

  const dismissSearchKeyboard = () => {
    searchRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleSelectPincode = (pincode: string) => {
    dismissSearchKeyboard();
    onSelectPincode(pincode);
  };

  const openCoverageRequest = () => {
    dismissSearchKeyboard();
    setCoverageRequestPincode(serviceableAreaSearchQuery.replace(/\D/g, '').slice(0, 6));
    setCoverageRequestState('idle');
    setTimeout(() => setCoverageOpen(true), 100);
  };

  const submitCoverage = () => {
    if (coverageRequestPincode.length !== 6 || coverageRequestState === 'submitting') return;
    setCoverageRequestState('submitting');
    void submitCoverageRequest(coverageRequestPincode)
      .then(() => {
        setCoverageRequestState('submitted');
        setCoverageOpen(false);
        dismissSearchKeyboard();
        onCoverageRequested();
      })
      .catch(() => {
        setCoverageRequestState('error');
      });
  };

  const stickyBottom = insets.bottom + SERVICEABLE_STICKY_ACTION_HEIGHT;

  return (
    <View className="absolute inset-0 z-[95] bg-canvas">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View style={{ paddingTop: insets.top + 12 }} className="flex-1 px-5">
          <View className="flex-row items-center gap-3">
            <Text className="flex-1 font-heading text-heading-md text-foreground">Serviceable areas</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close serviceable areas"
              onPress={hapticPress(() => {
                dismissSearchKeyboard();
                onClose();
              }, 'light')}
              hitSlop={8}
              className="size-icon-button items-center justify-center rounded-full bg-icon-surface"
            >
              <XIcon size={20} weight="bold" color={foregroundColor} />
            </Pressable>
          </View>

          <View className="mt-4">
            <ServiceableAreaSearch
              value={serviceableAreaSearchQuery}
              onChangeText={setServiceableAreaSearchQuery}
              inputRef={searchRef}
            />
          </View>

          <ScrollView
            className="mt-2 flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            contentContainerStyle={{ paddingBottom: stickyBottom + 24 }}
          >
            {loading ? (
              <View className="items-center py-8">
                <ActivityIndicator />
              </View>
            ) : null}
            {loadError ? (
              <Text className="py-4 font-body text-body-sm text-muted">Unable to load serviceable areas right now.</Text>
            ) : null}
            {!loading && !loadError && filteredAreas.length === 0 ? (
              <Text className="py-4 font-body text-body-sm text-muted">No serviceable area found.</Text>
            ) : null}
            {!loading && !loadError
              ? filteredAreas.map((area, index) => (
                <View key={`${area.pincode}-${area.areaName}`}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Select pincode ${area.pincode}, ${area.areaName}`}
                    onPress={hapticPress(() => handleSelectPincode(area.pincode), 'light')}
                    className="py-4"
                  >
                    <Text className="font-mono-semibold text-body-md text-foreground">{area.pincode}</Text>
                    <Text className="mt-1 font-body text-body-sm text-muted">{area.areaName}</Text>
                  </Pressable>
                  {index < filteredAreas.length - 1 ? <View className="h-px bg-border" /> : null}
                </View>
              ))
              : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <View
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-2"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request in your pincode"
          onPress={hapticPress(openCoverageRequest, 'light')}
          className="min-h-11 items-center justify-center"
        >
          <Text className="font-body-medium text-body-md text-accent">Request in your pincode</Text>
        </Pressable>
      </View>

      {coverageOpen ? (
        <DeliveryCoverageSheet
          initialPincode={coverageRequestPincode}
          requestState={coverageRequestState}
          onClose={() => setCoverageOpen(false)}
          onPincodeChange={(value) => {
            setCoverageRequestPincode(value);
            if (coverageRequestState === 'error') setCoverageRequestState('idle');
          }}
          onSubmit={submitCoverage}
        />
      ) : null}
    </View>
  );
}

export type DeliveryEligibilityResult = {
  pincode: string;
  meal: MealSelection;
};

export function DeliveryEligibilityFields({
  state,
  dispatch,
  pincodeRef,
  onMealBlocked,
}: {
  state: DeliveryEligibilityState;
  dispatch: (event: DeliveryEligibilityEvent) => void;
  pincodeRef: RefObject<TextInput | null>;
  onMealBlocked?: () => void;
}) {
  const statusMessage = eligibilityPincodeMessage(state.serviceability);
  const mealsEnabled = state.serviceability === 'serviceable';
  const [pincodeInvalid, setPincodeInvalid] = useState(false);
  const shakeOffset = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeOffset.value }] }));
  const mealOptions: Array<{ id: MealSelection; option: PreferenceOption }> = [
    { id: 'lunch', option: subscriptionMealOptions[0]! },
    { id: 'dinner', option: subscriptionMealOptions[1]! },
    { id: 'both', option: subscriptionMealOptions[2]! },
  ];

  useEffect(() => {
    const timer = setTimeout(() => pincodeRef.current?.focus(), 360);
    return () => clearTimeout(timer);
  }, [pincodeRef]);

  useEffect(() => {
    if (mealsEnabled) setPincodeInvalid(false);
  }, [mealsEnabled]);

  const rejectMealSelection = () => {
    setPincodeInvalid(true);
    shakeOffset.value = withSequence(
      withTiming(-9, { duration: 55 }),
      withTiming(9, { duration: 55 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 45 }),
    );
    pincodeRef.current?.focus();
    onMealBlocked?.();
  };

  const selectMeal = (meal: MealSelection) => {
    if (!mealsEnabled) {
      rejectMealSelection();
      return;
    }
    dispatch({ type: 'SELECT_MEAL', meal });
  };

  return (
    <View className="gap-sheet-gap">
      <Animated.View style={shakeStyle} className="gap-2">
        <LabeledFieldInput
          label="Enter your pincode"
          value={state.pincode}
          onChangeText={(value) => {
            setPincodeInvalid(false);
            dispatch({ type: 'SET_PINCODE', pincode: value });
          }}
          placeholder="6-digit pincode"
          inputRef={pincodeRef}
          autoFocus
          keyboardType="number-pad"
          maxLength={6}
          returnKeyType="default"
          invalid={pincodeInvalid}
        />
        {state.serviceability === 'checking' ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" />
            <Text className="font-body text-body-sm text-muted">{statusMessage}</Text>
          </View>
        ) : statusMessage ? (
          <Text className={`font-body text-body-sm ${state.serviceability === 'serviceable' ? 'text-accent' : state.serviceability === 'error' ? 'text-muted' : 'text-destructive'}`}>
            {statusMessage}
          </Text>
        ) : null}
      </Animated.View>

      <View className="gap-3">
        <Text className="font-body text-body-md tracking-body-sm text-foreground">Order at this location</Text>
        <View className="flex-row items-stretch gap-3">
          {mealOptions.map((option, index) => (
            <MealSelectionCard
              key={option.id}
              title={option.option.title}
              image={option.option.image}
              index={index}
              selected={state.mealSelection === option.id}
              onPress={() => selectMeal(option.id)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export function useDeliveryEligibilityState(initialPincode = '', initialMealLabel = '', initialTrusted = false) {
  const [state, dispatch] = useReducer(
    deliveryEligibilityReducer,
    initialDeliveryEligibilityState(
      initialPincode,
      mealLabelToMealSelection(initialMealLabel),
      initialTrusted,
    ),
  );

  useEffect(() => {
    if (state.pincode.length !== 6 || !isValidIndianPincodeFormat(state.pincode)) return;
    if (state.serviceability === 'checking') {
      let cancelled = false;
      void runPincodeServiceabilityCheck(state.pincode).then((result) => {
        if (!cancelled) dispatch(result);
      });
      return () => {
        cancelled = true;
      };
    }
    if (state.serviceability === 'idle') {
      dispatch({ type: 'CHECK_PINCODE' });
    }
  }, [state.pincode, state.serviceability]);

  const handleSelectServiceableArea = (pincode: string) => {
    dispatch({ type: 'SELECT_SERVICEABLE_AREA', pincode });
  };

  return {
    state,
    dispatch,
    canContinue: canContinueDeliveryEligibility(state),
    result: state.mealSelection
      ? { pincode: state.pincode, meal: state.mealSelection } satisfies DeliveryEligibilityResult
      : null,
    handleSelectServiceableArea,
  };
}

export function DeliveryEligibilityScreen({
  shell,
  initialPincode = '',
  initialMealLabel = '',
  initialTrusted = false,
  onContinue,
}: {
  shell: (content: React.ReactNode, footer: React.ReactNode) => React.ReactNode;
  initialPincode?: string;
  initialMealLabel?: string;
  initialTrusted?: boolean;
  onContinue: (result: DeliveryEligibilityResult) => void;
}) {
  const pincodeRef = useRef<TextInput>(null);
  const [toastMessage, setToastMessage] = useState('');
  const {
    state,
    dispatch,
    canContinue,
    result,
    handleSelectServiceableArea,
  } = useDeliveryEligibilityState(initialPincode, initialMealLabel, initialTrusted);

  const openServiceableAreas = () => {
    pincodeRef.current?.blur();
    Keyboard.dismiss();
    setTimeout(() => dispatch({ type: 'OPEN_SERVICEABLE_AREAS' }), 100);
  };

  return (
    <>
      {shell(
        <FormPageSection>
          <DeliveryEligibilityFields
            state={state}
            dispatch={dispatch}
            pincodeRef={pincodeRef}
            onMealBlocked={() => setToastMessage(MEAL_REQUIRES_PINCODE_TOAST)}
          />
        </FormPageSection>,
        <View className="gap-2">
          <PrimaryShimmerButton label="Next" enabled={canContinue} onPress={() => result && onContinue(result)} />
          <GhostCanvasButton
            label="Check here for serviceable areas"
            onPress={openServiceableAreas}
          />
        </View>,
      )}
      {state.serviceableAreasOpen ? (
        <ServiceableAreasPage
          onClose={() => dispatch({ type: 'CLOSE_SERVICEABLE_AREAS' })}
          onSelectPincode={handleSelectServiceableArea}
          onCoverageRequested={() => {
            dispatch({ type: 'CLOSE_SERVICEABLE_AREAS' });
            setToastMessage(COVERAGE_REQUEST_SUCCESS_TOAST);
            setTimeout(() => pincodeRef.current?.focus(), 250);
          }}
        />
      ) : null}
      {toastMessage ? <Toast message={toastMessage} onDismiss={() => setToastMessage('')} /> : null}
    </>
  );
}

export { mealSelectionToMealLabel, mealLabelToMealSelection };
