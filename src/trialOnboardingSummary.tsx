import { useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { useUniwind } from 'uniwind';
import { FormModalLayout, FormPageSection } from './formLayout';
import { SectionHeading } from './SectionHeading';
import { formatRupee } from './formatCurrency';
import { moneyValueTypography } from './moneyText';
import { foodImages } from './foodImages';
import { MealPreferenceImage } from './MealPreferenceImage';
import { PrimaryShimmerButton } from './primaryButton';
import { SheetBackdrop } from './sheetOverlay';
import { addressLabelDisplay, formatSavedAddressLines, type AddressDetails, type MealDeliverySlot } from './addressTypes';
import { subscriptionFoodOptions, subscriptionPreferenceOptions, type SubscriptionPreferenceKind } from './subscriptionPreferenceOptions';
import { SubscriptionPreferencePickerModal, type PickerAnchor } from './subscriptionPreferencePickerModal';
import { hapticPress } from './haptics';

export type TrialSummaryAddress = Omit<AddressDetails, 'deliveryLocation'>;

export type TrialMealDeliveryState = {
  deliveryLocation: string;
  address: TrialSummaryAddress;
  latitude?: number;
  longitude?: number;
};

export type TrialSummaryData = {
  food: string;
  meal: string;
  bread: string;
  rice: string;
  dailyMeals: Array<{ lunch: string; dinner: string }>;
  lunchDelivery: TrialMealDeliveryState | null;
  dinnerDelivery: TrialMealDeliveryState | null;
  summaryMealTab: MealDeliverySlot;
};

function foodImageForPreference(preference: string) {
  if (preference === 'Non-vegetarian') return foodImages['Non-vegetarian'];
  if (preference === 'Mix of both') return foodImages['Mix of both'];
  return foodImages.Vegetarian;
}

function preferenceImageFor(value: string) {
  return foodImages[value as keyof typeof foodImages] ?? foodImages.Vegetarian;
}

function preferenceCardTitle(kind: SubscriptionPreferenceKind, value: string) {
  return subscriptionPreferenceOptions[kind].find((option) => option.title === value)?.shortLabel ?? value;
}

function foodForMealSlot(data: TrialSummaryData, slot: MealDeliverySlot) {
  if (data.food !== 'Mix of both') return data.food;
  const firstDay = data.dailyMeals[0];
  const choice = slot === 'lunch' ? firstDay?.lunch : firstDay?.dinner;
  return choice === 'Non-vegetarian' ? 'Non-vegetarian' : 'Vegetarian';
}

function activeDelivery(data: TrialSummaryData, slot: MealDeliverySlot) {
  if (data.meal === 'Lunch') return data.lunchDelivery;
  if (data.meal === 'Dinner') return data.dinnerDelivery;
  return slot === 'lunch' ? data.lunchDelivery : data.dinnerDelivery;
}

export function trialPricingBreakup(meal: string) {
  const listPrice = 999;
  const discount = 100;
  const total = listPrice - discount;
  const lunchAmount = meal === 'Dinner' ? 0 : meal === 'Both' ? Math.round(listPrice / 2) : listPrice;
  const dinnerAmount = meal === 'Lunch' ? 0 : meal === 'Both' ? listPrice - lunchAmount : listPrice;
  return { listPrice, discount, total, lunchAmount, dinnerAmount };
}

function SummaryGlyph({ size = 20 }: { size?: number }) {
  const { theme } = useUniwind();
  const color = theme === 'dark' ? '#ffffff' : '#101010';
  return <PencilSimpleIcon size={size} weight="bold" color={color} />;
}

function TrialSummaryMealTabs({ value, onChange }: { value: MealDeliverySlot; onChange: (value: MealDeliverySlot) => void }) {
  const tabs: MealDeliverySlot[] = ['lunch', 'dinner'];
  return (
    <View className="flex-row gap-2">
      {tabs.map((tab) => {
        const selected = value === tab;
        const label = tab === 'lunch' ? 'Lunch' : 'Dinner';
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={hapticPress(() => onChange(tab), 'selection')}
            className={`flex-1 items-center justify-center rounded-full border py-2.5 ${selected ? 'border-2 border-accent-dark bg-accent-soft' : 'border-border bg-canvas'}`}
          >
            <Text className={`font-mono-semibold text-body-sm ${selected ? 'text-foreground' : 'text-muted'}`}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TrialSummaryPreferenceRowCard({ caption, title, image, index, onEdit }: { caption: string; title: string; image: number; index: number; onEdit: (anchor: PickerAnchor) => void }) {
  const cardRef = useRef<View>(null);

  const handleEditPress = () => {
    requestAnimationFrame(() => {
      cardRef.current?.measureInWindow((x, y, width, height) => {
        onEdit({ x, y, width, height });
      });
    });
  };

  return (
    <View ref={cardRef} collapsable={false} className="min-w-0 flex-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${caption.toLowerCase()} preference`}
        onPress={hapticPress(handleEditPress, 'light')}
        className="overflow-hidden rounded-field border border-border bg-canvas"
      >
      <View className="h-[88px] w-full items-center overflow-hidden bg-field">
        <MealPreferenceImage source={image} label={title} delayMs={80 + index * 50} width={106} height={88} imageSize={106} />
      </View>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="font-body text-body-xs text-muted">{caption}</Text>
          <Text numberOfLines={1} className="font-mono-semibold text-body-sm text-foreground">{title}</Text>
        </View>
        <View className="size-4 shrink-0 items-center justify-center">
          <SummaryGlyph size={20} />
        </View>
      </View>
      </Pressable>
    </View>
  );
}

function TrialSummaryPreferencesSection({
  food,
  bread,
  rice,
  onOpenPicker,
}: {
  food: string;
  bread: string;
  rice: string;
  onOpenPicker: (kind: 'food' | 'bread' | 'rice', anchor: PickerAnchor) => void;
}) {
  const cards = [
    { kind: 'food' as const, caption: 'Food', title: preferenceCardTitle('food', food), image: foodImageForPreference(food) },
    { kind: 'bread' as const, caption: 'Bread', title: preferenceCardTitle('bread', bread), image: preferenceImageFor(bread) },
    { kind: 'rice' as const, caption: 'Rice', title: preferenceCardTitle('rice', rice), image: preferenceImageFor(rice) },
  ];
  return (
    <View className="gap-3">
      <SectionHeading>Meal preferences</SectionHeading>
      <View className="flex-row gap-2">
        {cards.map((card, index) => (
          <TrialSummaryPreferenceRowCard
            key={card.kind}
            caption={card.caption}
            title={card.title}
            image={card.image}
            index={index}
            onEdit={(anchor) => onOpenPicker(card.kind, anchor)}
          />
        ))}
      </View>
    </View>
  );
}

function TrialSummaryDeliverySection({ delivery, onEdit }: { delivery: TrialMealDeliveryState; onEdit: () => void }) {
  const details: AddressDetails = { ...delivery.address, deliveryLocation: delivery.deliveryLocation };
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <SectionHeading>Delivery address</SectionHeading>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit delivery address" onPress={onEdit} hitSlop={8}>
          <SummaryGlyph />
        </Pressable>
      </View>
      <View className="self-start rounded-full border border-border bg-field px-2.5 py-1">
        <Text className="font-body-medium text-body-xs text-foreground">{addressLabelDisplay(delivery.address)}</Text>
      </View>
      <Text className="font-body text-body-sm leading-5 tracking-body-sm text-foreground">{formatSavedAddressLines(details)}</Text>
    </View>
  );
}

function BreakupRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  const typography = moneyValueTypography(value, 'text-body-md', 'text-foreground');
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className={`font-body text-body-sm ${bold ? 'font-body-medium text-foreground' : 'text-muted'}`}>{label}</Text>
      <Text className={typography}>{value}</Text>
    </View>
  );
}

function TrialPriceBreakupSheet({ meal, onClose, onContinue }: { meal: string; onClose: () => void; onContinue: () => void }) {
  const { lunchAmount, dinnerAmount, discount, total } = trialPricingBreakup(meal);
  return (
    <View className="absolute inset-0 z-[80]">
      <SheetBackdrop />
      <Pressable accessibilityRole="button" accessibilityLabel="Close price breakup" className="absolute inset-0" onPress={onClose} />
      <View pointerEvents="box-none" className="flex-1 justify-end">
        <Animated.View entering={FadeInUp.duration(220)} className="mx-4 mb-4 overflow-hidden rounded-sheet bg-canvas">
          <View className="p-sheet">
            <FormModalLayout
              title="Price breakup"
              fields={(
                <View className="gap-3">
                  {meal !== 'Dinner' && lunchAmount > 0 ? <BreakupRow label="Lunch trial" value={formatRupee(lunchAmount)} /> : null}
                  {meal !== 'Lunch' && dinnerAmount > 0 ? <BreakupRow label="Dinner trial" value={formatRupee(dinnerAmount)} /> : null}
                  <BreakupRow label="Discount" value={`−${formatRupee(discount)}`} />
                  <View className="my-1 h-px bg-border" />
                  <BreakupRow label="Total" value={formatRupee(total)} bold />
                </View>
              )}
              primaryAction={<PrimaryShimmerButton label="Continue to payment" onPress={onContinue} />}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function TrialProceedButton({ total, onPress, onViewBreakup }: { total: number; onPress: () => void; onViewBreakup: () => void }) {
  return (
    <View className="gap-3">
      <PrimaryShimmerButton label={`Continue to payment · ${formatRupee(total)}`} onPress={onPress} />
      <Pressable accessibilityRole="button" accessibilityLabel="View price breakdown" onPress={onViewBreakup} className="items-center pb-0 pt-1">
        <Text className="font-mono-semibold text-body-sm text-accent">Price breakdown</Text>
      </Pressable>
    </View>
  );
}

export function TrialSummaryScreen({
  data,
  onPreferenceChange,
  onEditAddress,
  onMealTabChange,
  onNext,
  shell,
}: {
  data: TrialSummaryData;
  onPreferenceChange: (kind: 'food' | 'bread' | 'rice', value: string, slot: MealDeliverySlot) => void;
  onEditAddress: (slot: MealDeliverySlot) => void;
  onMealTabChange: (tab: MealDeliverySlot) => void;
  onNext: () => void;
  shell: (content: ReactNode, footer: ReactNode) => ReactNode;
}) {
  const [breakupOpen, setBreakupOpen] = useState(false);
  const [openPreferencePicker, setOpenPreferencePicker] = useState<'food' | 'bread' | 'rice' | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor | null>(null);
  const showMealTabs = data.meal === 'Both';
  const activeSlot: MealDeliverySlot = showMealTabs ? data.summaryMealTab : data.meal === 'Dinner' ? 'dinner' : 'lunch';
  const delivery = activeDelivery(data, activeSlot);
  const { total } = trialPricingBreakup(data.meal);
  const food = foodForMealSlot(data, activeSlot);

  const preferencePickerValue = openPreferencePicker === 'food'
    ? (data.food === 'Mix of both' ? food : data.food)
    : openPreferencePicker === 'bread'
      ? data.bread
      : openPreferencePicker === 'rice'
        ? data.rice
        : '';

  const preferencePickerOptions = openPreferencePicker === 'food' && data.food === 'Mix of both'
    ? subscriptionFoodOptions.filter((option) => option.title !== 'Mix of both')
    : undefined;

  const handlePreferencePickerSelect = (value: string) => {
    if (!openPreferencePicker) return;
    onPreferenceChange(openPreferencePicker, value, activeSlot);
  };

  if (!delivery) return null;

  const content = (
    <FormPageSection subheading="Review your choices before payment.">
      <View className="gap-sheet-gap">
        {showMealTabs ? <TrialSummaryMealTabs value={data.summaryMealTab} onChange={onMealTabChange} /> : null}
        <TrialSummaryDeliverySection delivery={delivery} onEdit={() => onEditAddress(activeSlot)} />
        <TrialSummaryPreferencesSection
          food={food}
          bread={data.bread}
          rice={data.rice}
          onOpenPicker={(kind, anchor) => {
            setOpenPreferencePicker(kind);
            setPickerAnchor(anchor);
          }}
        />
      </View>
    </FormPageSection>
  );

  return (
    <View className="flex-1">
      {shell(content, <TrialProceedButton total={total} onPress={onNext} onViewBreakup={() => setBreakupOpen(true)} />)}
      {breakupOpen ? (
        <TrialPriceBreakupSheet
          meal={data.meal}
          onClose={() => setBreakupOpen(false)}
          onContinue={() => {
            setBreakupOpen(false);
            onNext();
          }}
        />
      ) : null}
      {openPreferencePicker && pickerAnchor ? (
        <SubscriptionPreferencePickerModal
          kind={openPreferencePicker}
          value={preferencePickerValue}
          anchor={pickerAnchor}
          options={preferencePickerOptions}
          onClose={() => {
            setOpenPreferencePicker(null);
            setPickerAnchor(null);
          }}
          onSelect={handlePreferencePickerSelect}
        />
      ) : null}
    </View>
  );
}
