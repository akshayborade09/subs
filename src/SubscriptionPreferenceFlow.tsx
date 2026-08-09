import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { DeliveryEligibilityScreen, mealSelectionToMealLabel } from './deliveryEligibilityScreen';
import { FocusScrollContext, useFocusScrollField } from './deliveryAddressComponents';
import { FormPageSection } from './formLayout';
import { PrimaryShimmerButton } from './primaryButton';
import { hapticPress } from './haptics';
import { MealPreferenceImage } from './MealPreferenceImage';
import {
  subscriptionBreadOptions,
  subscriptionFoodOptions,
  subscriptionMealOptions,
  subscriptionRiceOptions,
  type PreferenceOption,
} from './subscriptionPreferenceOptions';

const PREF_DAY_COUNT = 3;

type DailyMealChoice = { lunch: string; dinner: string };

export type SubscriptionPreferences = {
  deliveryPincode: string;
  food: string;
  meal: string;
  bread: string;
  rice: string;
  dailyMeals: DailyMealChoice[];
};

export type PreferenceCompletionSource = 'choose-subscription' | 'onboarding';

export type PreferenceCompletionMeta = {
  source: PreferenceCompletionSource;
  completed: true;
};

type PrefStep = 'deliveryEligibility' | 'food' | 'meal' | 'mixMeals' | 'bread' | 'rice';

function selectionCardClass(selected: boolean) {
  return `overflow-hidden rounded-field border bg-canvas ${selected ? 'border-2 border-accent bg-accent-soft' : 'border-border'}`;
}

function PreferenceCardImage({ source, label, delayMs }: { source: number; label: string; delayMs: number }) {
  return (
    <View className="w-[161px] shrink-0 self-stretch justify-end overflow-hidden">
      <MealPreferenceImage source={source} label={label} delayMs={delayMs} />
    </View>
  );
}

function PreferenceCards({ options, value, onChange }: { options: PreferenceOption[]; value: string; onChange: (value: string) => void }) {
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

function DailyMealPlan({ meal, value, onChange }: { meal: string; value: DailyMealChoice[]; onChange: (value: DailyMealChoice[]) => void }) {
  const mealRows = meal === 'Both' ? (['lunch', 'dinner'] as const) : meal === 'Dinner' ? (['dinner'] as const) : (['lunch'] as const);
  const update = (dayIndex: number, mealKey: 'lunch' | 'dinner', choice: 'Vegetarian' | 'Non-vegetarian') => {
    onChange(value.map((day, index) => (index === dayIndex ? { ...day, [mealKey]: choice } : day)));
  };
  return (
    <View className="gap-4">
      {value.map((day, dayIndex) => (
        <Animated.View key={`day-${dayIndex + 1}`} entering={FadeInUp.delay(190 + dayIndex * 55).duration(220)} className="rounded-field border border-border bg-canvas p-sheet">
          <Text className="font-mono-semibold text-body-md text-foreground">Day {dayIndex + 1}</Text>
          <View className="mt-3 gap-3">
            {mealRows.map((mealKey) => (
              <View key={mealKey} className="flex-row items-center gap-3">
                <Text className="w-14 font-body-medium text-body-sm capitalize text-foreground">{mealKey}</Text>
                <View className="flex-1 flex-row gap-2">
                  {(['Vegetarian', 'Non-vegetarian'] as const).map((choice) => {
                    const selected = day[mealKey] === choice;
                    const selectedClass = choice === 'Vegetarian'
                      ? 'border-2 border-success bg-success-soft'
                      : 'border-2 border-destructive bg-destructive-soft';
                    return (
                      <Pressable
                        key={choice}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        onPress={hapticPress(() => update(dayIndex, mealKey, choice), 'selection')}
                        className={`h-9 flex-1 items-center justify-center rounded-full border ${selected ? selectedClass : 'border-border bg-canvas'}`}
                      >
                        <Text className={`font-mono-semibold text-body-sm ${selected ? 'text-foreground' : 'text-muted'}`}>{choice === 'Vegetarian' ? 'Veg' : 'Non-veg'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const stepOrder: PrefStep[] = ['deliveryEligibility', 'food', 'meal', 'mixMeals', 'bread', 'rice'];

const stepCopy: Record<PrefStep, { title: string; subheading: string }> = {
  deliveryEligibility: { title: 'Delivery availability', subheading: '' },
  food: { title: 'What do you enjoy eating?', subheading: 'Choose one preference for your meals.' },
  meal: { title: 'Choose your meals', subheading: 'Delivery windows are fixed so every day stays predictable.' },
  mixMeals: { title: 'Plan your meal mix', subheading: 'Choose vegetarian or non-vegetarian food for each selected meal.' },
  bread: { title: 'Choose your bread', subheading: 'Pick what feels most familiar at home.' },
  rice: { title: 'Choose your rice', subheading: 'You can change this later for upcoming meals.' },
};

function emptyDailyMeals(): DailyMealChoice[] {
  return Array.from({ length: PREF_DAY_COUNT }, () => ({ lunch: '', dinner: '' }));
}

function dailyMealsComplete(meal: string, dailyMeals: DailyMealChoice[]): boolean {
  return dailyMeals.every((day) => (meal === 'Dinner' || !!day.lunch) && (meal === 'Lunch' || !!day.dinner));
}

export function SubscriptionPreferenceFlow({
  initial,
  completionSource = 'choose-subscription',
  onComplete,
  onClose,
}: {
  initial: SubscriptionPreferences;
  completionSource?: PreferenceCompletionSource;
  onComplete: (preferences: SubscriptionPreferences, meta: PreferenceCompletionMeta) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  const deliveryScrollRef = useRef<ScrollView>(null);
  const deliveryHeaderOffset = insets.top + 12;
  const { scrollOffset: deliveryScrollOffset, positionFocusedField: positionDeliveryField } = useFocusScrollField(deliveryScrollRef, { visibleTopOffset: deliveryHeaderOffset });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [step, setStep] = useState<PrefStep>('deliveryEligibility');
  const [deliveryPincode, setDeliveryPincode] = useState(initial.deliveryPincode);
  const [food, setFood] = useState(initial.food);
  const [meal, setMeal] = useState(initial.meal);
  const [bread, setBread] = useState(initial.bread);
  const [rice, setRice] = useState(initial.rice);
  const [dailyMeals, setDailyMeals] = useState<DailyMealChoice[]>(
    initial.dailyMeals.length ? initial.dailyMeals : emptyDailyMeals(),
  );

  const visibleSteps = stepOrder.filter((item) => {
    if (item === 'mixMeals') return food === 'Mix of both';
    if (item === 'meal') return !meal;
    return true;
  });
  const stepIndex = visibleSteps.indexOf(step);
  const back = () => {
    if (stepIndex <= 0) {
      onClose();
      return;
    }
    setStep(visibleSteps[stepIndex - 1]!);
  };

  const finish = () => {
    onComplete({ deliveryPincode, food, meal, bread, rice, dailyMeals }, { source: completionSource, completed: true });
  };

  const goNext = (nextStep?: PrefStep) => {
    if (nextStep) {
      setStep(nextStep);
      return;
    }
    if (stepIndex >= visibleSteps.length - 1) {
      finish();
      return;
    }
    setStep(visibleSteps[stepIndex + 1]!);
  };

  const copy = stepCopy[step];
  const mixComplete = dailyMealsComplete(meal, dailyMeals);

  if (step === 'deliveryEligibility') {
    return (
      <DeliveryEligibilityScreen
        shell={(content, footer) => (
          <Animated.View entering={FadeInUp.duration(220)} className="absolute inset-0 z-[60] bg-canvas">
            <FocusScrollContext.Provider value={positionDeliveryField}>
              <View className="flex-1">
                <ScrollView
                  ref={deliveryScrollRef}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={(event) => { deliveryScrollOffset.current = event.nativeEvent.contentOffset.y; }}
                  contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 124 + (keyboardHeight > 0 ? keyboardHeight : insets.bottom) }}
                >
                  <View className="px-5">
                    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={hapticPress(onClose, 'light')} hitSlop={8} className="mb-6 size-6 items-center justify-center">
                      <CaretLeftIcon size={24} weight="regular" color={iconColor} />
                    </Pressable>
                    <Text className="font-heading text-heading-md text-foreground">Delivery availability</Text>
                    <View className="mt-6">{content}</View>
                  </View>
                </ScrollView>
                <Animated.View
                  style={{
                    bottom: keyboardHeight,
                    paddingBottom: keyboardHeight > 0 ? 8 : (Platform.OS === 'ios' ? insets.bottom : Math.max(12, insets.bottom + 8)),
                  }}
                  className="absolute inset-x-0 bg-canvas px-5"
                >
                  {footer}
                </Animated.View>
              </View>
            </FocusScrollContext.Provider>
          </Animated.View>
        )}
        initialPincode={deliveryPincode}
        initialMealLabel={meal}
        initialTrusted={!!deliveryPincode && !!meal}
        onContinue={({ pincode, meal: selectedMeal }) => {
          setDeliveryPincode(pincode);
          setMeal(mealSelectionToMealLabel(selectedMeal));
          goNext('food');
        }}
      />
    );
  }

  return (
    <Animated.View entering={FadeInUp.duration(220)} className="absolute inset-0 z-[60] bg-canvas">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 96 }}>
          <View className="px-5">
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={hapticPress(back, 'light')} hitSlop={8} className="mb-6 size-6 items-center justify-center">
              <CaretLeftIcon size={24} weight="regular" color={iconColor} />
            </Pressable>
            <FormPageSection subheading={copy.subheading}>
              <Text className="font-heading text-heading-md text-foreground">{copy.title}</Text>
              <View className="mt-6">
                {step === 'food' ? (
                  <PreferenceCards options={subscriptionFoodOptions} value={food} onChange={(value) => { setFood(value); setTimeout(() => { if (meal) { if (value === 'Mix of both') goNext('mixMeals'); else goNext('bread'); } else goNext('meal'); }, 160); }} />
                ) : null}
                {step === 'meal' ? (
                  <PreferenceCards
                    options={subscriptionMealOptions}
                    value={meal}
                    onChange={(value) => {
                      setMeal(value);
                      setTimeout(() => {
                        if (food === 'Mix of both') goNext('mixMeals');
                        else goNext('bread');
                      }, 160);
                    }}
                  />
                ) : null}
                {step === 'mixMeals' ? (
                  <DailyMealPlan meal={meal} value={dailyMeals} onChange={setDailyMeals} />
                ) : null}
                {step === 'bread' ? (
                  <PreferenceCards options={subscriptionBreadOptions} value={bread} onChange={(value) => { setBread(value); setTimeout(() => goNext('rice'), 160); }} />
                ) : null}
                {step === 'rice' ? (
                  <PreferenceCards options={subscriptionRiceOptions} value={rice} onChange={(value) => { setRice(value); setTimeout(finish, 160); }} />
                ) : null}
              </View>
            </FormPageSection>
          </View>
        </ScrollView>
        {step === 'mixMeals' ? (
          <Animated.View style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(16, insets.bottom + 8) }} className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-2">
            <PrimaryShimmerButton label="Continue" enabled={mixComplete} onPress={() => goNext('bread')} />
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
