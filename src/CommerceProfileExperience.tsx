import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import type { Icon } from 'phosphor-react-native';
import { headingDescriptionClass } from './typographyClasses';
import { formatRupee } from './formatCurrency';
import { MoneyInline, moneyValueTypography } from './moneyText';
import { FormHeader, FormModalLayout, FormPageSection, SectionHeading } from './formLayout';
import { GhostCanvasButton, GhostFieldButton, PrimaryShimmerButton, AccentSwitch } from './primaryButton';
import { SheetBackdrop } from './sheetOverlay';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { CalendarIcon } from 'phosphor-react-native/src/icons/Calendar';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CopyIcon } from 'phosphor-react-native/src/icons/Copy';
import { CreditCardIcon } from 'phosphor-react-native/src/icons/CreditCard';
import { GearIcon } from 'phosphor-react-native/src/icons/Gear';
import { GiftIcon } from 'phosphor-react-native/src/icons/Gift';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { ReceiptIcon } from 'phosphor-react-native/src/icons/Receipt';
import { ShareNetworkIcon } from 'phosphor-react-native/src/icons/ShareNetwork';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';
import { TagIcon } from 'phosphor-react-native/src/icons/Tag';
import { TrophyIcon } from 'phosphor-react-native/src/icons/Trophy';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import { WalletIcon } from 'phosphor-react-native/src/icons/Wallet';
import type { LifecycleStateId } from './lifecycleStateMachine';
import { themePalette, useFieldPlaceholderColor } from './themeColors';
import { Toast as AppToast } from './toast';
import { addressLabelDisplay, formatSavedAddressLines } from './addressTypes';
import { useSavedAddresses } from './savedAddressesStore';
import { foodImages } from './foodImages';
import { MealPreferenceImage } from './MealPreferenceImage';
import { hapticPress } from './haptics';
import { SubscriptionPreferencePickerModal, type PickerAnchor } from './subscriptionPreferencePickerModal';
import type { SubscriptionPreferenceKind } from './subscriptionPreferenceOptions';

const userFoodPreference = 'Mix of both';
const foodPreferenceOptions = ['Vegetarian', 'Non-vegetarian', 'Mix of both'] as const;
type FoodPreference = typeof foodPreferenceOptions[number];

function foodImageForPreference(preference: string) {
  if (preference === 'Non-vegetarian') return foodImages['Non-vegetarian'];
  if (preference === 'Mix of both') return foodImages['Mix of both'];
  return foodImages.Vegetarian;
}

function foodPreferenceLabel(preference: string) {
  if (preference === 'Non-vegetarian') return 'Non-veg';
  if (preference === 'Mix of both') return 'Mix of both';
  return 'Veg';
}

function preferenceImageFor(value: string) {
  return foodImages[value as keyof typeof foodImages] ?? foodImages.Vegetarian;
}

function preferenceCardTitle(kind: SubscriptionPreferenceKind, value: string) {
  if (kind === 'food') return foodPreferenceLabel(value);
  if (kind === 'rice' && value === 'Jeera Rice') return 'Jeera rice';
  if (kind === 'rice' && value === 'Plain Rice') return 'Plain rice';
  return value;
}

function MyPlanPreferenceCard({ caption, title, image, onEdit }: { caption: string; title: string; image: number; onEdit: (anchor: PickerAnchor) => void }) {
  const cardRef = useRef<View>(null);
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';

  const handlePress = () => {
    cardRef.current?.measureInWindow((x, y, width, height) => {
      onEdit({ x, y, width, height });
    });
  };

  return (
    <Pressable
      ref={cardRef}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${caption.toLowerCase()} preference`}
      onPress={hapticPress(handlePress, 'light')}
      className="min-w-0 flex-1 overflow-hidden rounded-field border border-border bg-canvas"
    >
      <View className="h-[88px] w-full items-center overflow-hidden bg-field">
        <MealPreferenceImage source={image} label={title} delayMs={0} width={106} height={88} imageSize={106} />
      </View>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="font-body text-body-xs text-muted">{caption}</Text>
          <Text numberOfLines={1} className="font-mono-semibold text-body-sm text-foreground">{title}</Text>
        </View>
        <View className="size-4 shrink-0 items-center justify-center">
          <PencilSimpleIcon size={16} weight="bold" color={iconColor} />
        </View>
      </View>
    </Pressable>
  );
}

function FoodPreferenceTabs({ value, onChange }: { value: FoodPreference; onChange: (value: FoodPreference) => void }) {
  const tabs: { id: FoodPreference; label: string }[] = [
    { id: 'Vegetarian', label: 'Veg' },
    { id: 'Non-vegetarian', label: 'Non-veg' },
    { id: 'Mix of both', label: 'Mix of both' },
  ];
  return (
    <View className="flex-row gap-2">
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === tab.id }}
          onPress={() => onChange(tab.id)}
          className={`min-h-field flex-1 items-center justify-center rounded-full border bg-canvas px-2 ${value === tab.id ? 'border-2 border-accent bg-accent-soft' : 'border-border'}`}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit className={`font-mono-semibold text-body-sm ${value === tab.id ? 'text-foreground' : 'text-muted'}`}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

type Route = 'checkout' | 'coupon' | 'profile' | 'my_plan' | 'edit_profile' | 'addresses' | 'transactions' | 'settings' | 'notifications' | 'permissions' | 'referral' | 'loyalty' | 'leaderboard' | 'reward' | 'redeem';

const stateRoute: Partial<Record<LifecycleStateId, Route>> = {
  V: 'checkout', W: 'coupon', X: 'checkout', AB: 'profile', AC: 'edit_profile', AD: 'addresses', AE: 'transactions', AF: 'settings', AG: 'notifications', AH: 'permissions', AI: 'referral', AJ: 'loyalty', AN: 'loyalty', AK: 'leaderboard', AL: 'reward', AM: 'redeem',
};

const trialOnlyStates: LifecycleStateId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'T', 'U'];

function isSubscribedState(stateId: LifecycleStateId) {
  return !trialOnlyStates.includes(stateId);
}

function selectionClass(selected: boolean) {
  return `rounded-field border bg-canvas ${selected ? 'border-2 border-accent bg-accent-soft' : 'border-border'}`;
}

function Glyph({ icon: GlyphIcon, color, tone }: { icon: Icon; color?: string; tone?: 'accent' | 'success' | 'foreground' | 'muted' }) {
  const { theme } = useUniwind();
  const palette = themePalette[theme === 'dark' ? 'dark' : 'light'];
  const resolved = color ?? (tone === 'success' ? palette.success : tone === 'accent' ? palette.accent : tone === 'muted' ? palette.muted : (theme === 'dark' ? '#ffffff' : '#101010'));
  return <GlyphIcon size={18} weight="bold" color={resolved} />;
}

function Header({ title, description, onBack, eyebrow }: { title: string; description?: string; onBack: () => void; eyebrow?: string }) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={8} className="mb-6 size-icon-button items-center justify-center">
        <CaretLeftIcon size={24} weight="regular" color={iconColor} />
      </Pressable>
      {eyebrow ? <Text className="mb-2 font-body-medium text-body-sm uppercase tracking-body-sm text-accent">{eyebrow}</Text> : null}
      <FormHeader title={title} subtitle={description} size="page" />
    </View>
  );
}

function Section({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View className="mt-7">
      {title ? (
        <View className="mb-3 flex-row items-center justify-between gap-3">
          <SectionHeading>{title}</SectionHeading>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

type SurfaceTone = 'default' | 'success' | 'accent';

function surfaceToneClass(tone: SurfaceTone, borderless = false) {
  const bg = tone === 'success' ? 'bg-accent-soft' : tone === 'accent' ? 'bg-accent-soft' : 'bg-canvas';
  if (borderless) return bg;
  return tone === 'accent' ? `border-2 border-accent ${bg}` : `border border-border ${bg}`;
}

function Card({ children, tone = 'default', compact = false, borderless = false }: { children: ReactNode; tone?: SurfaceTone; compact?: boolean; borderless?: boolean }) {
  return <View className={`overflow-hidden rounded-field ${compact ? 'p-3' : 'p-sheet'} ${surfaceToneClass(tone, borderless)}`}>{children}</View>;
}

function ListContainer({ children, tone = 'default' }: { children: ReactNode; tone?: SurfaceTone }) {
  return <View className={`overflow-hidden rounded-field ${surfaceToneClass(tone)}`}>{children}</View>;
}

function IconText({ icon, title, description, tone, color, trailing, titleClassName = 'font-body-medium text-body-md text-foreground' }: { icon: Icon; title: string; description?: ReactNode; tone?: 'accent' | 'success' | 'foreground'; color?: string; trailing?: ReactNode; titleClassName?: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <View className="h-6 w-6 shrink-0 items-center justify-center">
        <Glyph icon={icon} tone={tone} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className={`${titleClassName} leading-6`}>{title}</Text>
        {description ? <View className="mt-1">{typeof description === 'string' ? <Text className="font-body text-body-sm leading-5 text-muted">{description}</Text> : description}</View> : null}
      </View>
      {trailing ? <View className="shrink-0 self-start">{trailing}</View> : null}
    </View>
  );
}

function ListMetaRow({ label, value, valueTone, showDivider = true }: { label: string; value: string; valueTone?: string; showDivider?: boolean }) {
  return (
    <View className={`flex-row items-start justify-between gap-4 px-sheet py-3 ${showDivider ? 'border-b border-border' : ''}`}>
      <Text className="max-w-[40%] shrink-0 font-body text-body-sm text-muted">{label}</Text>
      <View className="min-w-0 flex-1">
        <Text className={moneyValueTypography(value, 'text-body-md', valueTone ?? 'text-foreground')}>{value}</Text>
      </View>
    </View>
  );
}

function MetaRow({ label, value, valueTone, compact = false }: { label: string; value: string; valueTone?: string; compact?: boolean }) {
  return (
    <View className={`flex-row items-start justify-between gap-4 ${compact ? 'py-1' : 'py-2'}`}>
      <Text className="max-w-[40%] shrink-0 font-body text-body-sm text-muted">{label}</Text>
      <View className="min-w-0 flex-1">
        <Text className={moneyValueTypography(value, 'text-body-md', valueTone ?? 'text-foreground')}>{value}</Text>
      </View>
    </View>
  );
}

function MenuRow({ icon, title, detail, onPress, danger = false, showDivider = true }: { icon: Icon; title: string; detail?: string; onPress: () => void; danger?: boolean; showDivider?: boolean }) {
  const { theme } = useUniwind();
  const dangerColor = theme === 'dark' ? '#f87171' : '#dc2626';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className={`px-sheet py-4 ${showDivider ? 'border-b border-border' : ''}`}>
      <IconText
        icon={icon}
        title={title}
        description={detail}
        color={danger ? dangerColor : undefined}
        tone={danger ? undefined : 'foreground'}
        titleClassName={`font-body-medium text-body-md ${danger ? 'text-destructive' : 'text-foreground'}`}
        trailing={<Glyph icon={CaretRightIcon} tone="muted" />}
      />
    </Pressable>
  );
}

function SolidBadge({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'success' | 'neutral' }) {
  const bg = tone === 'success' ? 'bg-success' : tone === 'neutral' ? 'bg-[#6b7280]' : 'bg-accent';
  return (
    <View className={`rounded-full px-3 py-1.5 ${bg}`}>
      <Text className="font-body-medium text-body-xs text-white">{label}</Text>
    </View>
  );
}

function ToggleRow({ title, description, value, onChange, locked = false, showDivider = true }: { title: string; description?: string; value: boolean; onChange: (value: boolean) => void; locked?: boolean; showDivider?: boolean }) {
  return (
    <View className={`flex-row items-center gap-4 px-sheet py-3 ${showDivider ? 'border-b border-border' : ''}`}>
      <View className="min-w-0 flex-1">
        <Text className="font-body-medium text-body-md text-foreground">{title}</Text>
        {description ? <Text className="mt-1 font-body text-body-sm leading-5 text-muted">{description}</Text> : null}
      </View>
      <AccentSwitch value={value} disabled={locked} onValueChange={onChange} />
    </View>
  );
}

function ActionChip({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className={`h-9 justify-center rounded-full border px-4 ${danger ? 'border-destructive bg-destructive' : 'border-border bg-canvas'}`}>
      <Text className={`font-mono-semibold text-body-sm ${danger ? 'text-white' : 'text-foreground'}`}>{label}</Text>
    </Pressable>
  );
}

const priceBefore = 2799;
const discountValue = 300;

function BottomSheetOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ zIndex: 100 }} className="absolute inset-0 justify-end">
      <SheetBackdrop />
      <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" className="absolute inset-0" onPress={onClose} />
      <Animated.View entering={FadeInUp.duration(240)} style={{ marginBottom: Math.max(16, insets.bottom + 8) }} className="mx-4 rounded-sheet bg-canvas p-sheet">
        {children}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function CancelSubscriptionSheet({ onPause, onCancel }: { onPause: () => void; onCancel: () => void }) {
  return (
    <FormModalLayout
      title="Confirm cancel subscription"
      subtitle="A cancellation fee of 20% of your remaining plan value will be charged. Consider pausing instead to keep your plan and preferences saved."
      extra={(
        <View className="rounded-field bg-field p-sheet">
          <Text className="font-body text-body-sm leading-5 text-muted">Pausing stops upcoming deliveries without losing your meal preferences, address or nutrition history.</Text>
        </View>
      )}
      primaryAction={<PrimaryShimmerButton label="Pause subscription" onPress={onPause} />}
      secondaryAction={(
        <Pressable accessibilityRole="button" onPress={onCancel} className="h-12 items-center justify-center">
          <Text className="font-mono-semibold text-body-sm text-destructive">Cancel subscription</Text>
        </Pressable>
      )}
    />
  );
}

function CheckoutPage({ onBack, go, couponApplied, setCouponApplied }: { onBack: () => void; go: (route: Route) => void; couponApplied: boolean; setCouponApplied: (value: boolean) => void }) {
  return <>
    <Header onBack={onBack} title="Review your subscription" description="Confirm your plan, meals, delivery and payment before subscribing." />
    <Section title="Plan">
      <Card compact>
        <Text className="font-mono-semibold text-body-md text-foreground">Monthly</Text>
        <Text className="mt-1 font-body text-body-sm text-muted">4 weeks · 40 meals</Text>
        <View className="my-3 h-px bg-border" />
        <MetaRow label="Meals" value="Lunch & dinner" />
        <MetaRow label="Starts" value="26 July 2026" compact />
      </Card>
    </Section>
    <Section title="Current preferences" right={<Pressable accessibilityRole="button"><Text className="font-mono-semibold text-body-sm text-accent">Edit</Text></Pressable>}>
      <Card compact>
        <MetaRow label="Food" value={userFoodPreference} />
        <MetaRow label="Bread" value="Chapati" />
        <MetaRow label="Rice" value="Jeera rice" compact />
      </Card>
    </Section>
    <Section title="Delivery address" right={<Pressable accessibilityRole="button" onPress={() => go('addresses')}><Text className="font-mono-semibold text-body-sm text-accent">Edit</Text></Pressable>}>
      <Card compact><IconText icon={MapPinIcon} tone="accent" title="Home · B-704, Green View Apartments, Baner Road, Pune 411045" titleClassName="font-body-medium text-body-sm text-foreground" /></Card>
    </Section>
    <Section title="Coupon and rewards">
      <Pressable accessibilityRole="button" onPress={() => go('coupon')}>
        <Card compact borderless tone={couponApplied ? 'success' : 'default'}>
          <IconText icon={TagIcon} tone="accent" title={couponApplied ? 'HEALTHY300 applied' : 'Apply coupon'} description={couponApplied ? <MoneyInline className="font-body text-body-sm leading-5 text-muted">You save ₹300 on this subscription.</MoneyInline> : 'View eligible offers and rewards.'} trailing={<Text className="font-mono-semibold text-body-sm text-accent">{couponApplied ? 'Change' : 'View'}</Text>} />
        </Card>
      </Pressable>
      {couponApplied ? <Pressable onPress={() => setCouponApplied(false)} className="mt-2 self-end"><Text className="font-body-medium text-body-sm text-destructive">Remove coupon</Text></Pressable> : null}
    </Section>
    <Section title="Price breakdown">
      <ListContainer>
        <ListMetaRow label="Plan price" value={formatRupee(2799)} />
        <ListMetaRow label="Delivery charges" value="Included" />
        <ListMetaRow label="Taxes" value="Included" />
        {couponApplied ? <ListMetaRow label="Coupon discount" value={`− ${formatRupee(300)}`} valueTone="text-accent" /> : null}
        <ListMetaRow label="Total payable" value={formatRupee(priceBefore - (couponApplied ? discountValue : 0))} showDivider={false} />
      </ListContainer>
    </Section>
    <Section title="Payment method">
      <Pressable accessibilityRole="button">
        <Card compact><IconText icon={CreditCardIcon} title="UPI" description="Pay using any UPI app" trailing={<Text className="font-mono-semibold text-body-sm text-accent">Change</Text>} /></Card>
      </Pressable>
    </Section>
    <Text className="mt-6 font-body text-body-xs leading-5 text-muted">By continuing, you agree to the subscription, cancellation and refund terms.</Text>
  </>;
}

function MyPlanPage({ onBack, go, toast }: { onBack: () => void; go: (route: Route) => void; toast: (message: string) => void }) {
  const [food, setFood] = useState(userFoodPreference);
  const [bread, setBread] = useState('Chapati');
  const [rice, setRice] = useState('Jeera Rice');
  const [openPicker, setOpenPicker] = useState<SubscriptionPreferenceKind | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor | null>(null);

  const openPreferencePicker = (kind: SubscriptionPreferenceKind, anchor: PickerAnchor) => {
    setOpenPicker(kind);
    setPickerAnchor(anchor);
  };

  const closePreferencePicker = () => {
    setOpenPicker(null);
    setPickerAnchor(null);
  };

  const handlePreferenceSelect = (value: string) => {
    if (openPicker === 'food') setFood(value);
    if (openPicker === 'bread') setBread(value);
    if (openPicker === 'rice') setRice(value);
    toast('Preference updated');
  };

  const pickerValue = openPicker === 'food'
    ? food
    : openPicker === 'bread'
      ? bread
      : openPicker === 'rice'
        ? rice
        : '';

  return <>
    <Header onBack={onBack} title="My plan" description="Review your active subscription, preferences and delivery settings." />
    <Section title="Plan">
      <Card compact>
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-mono-semibold text-body-md text-foreground">Monthly</Text>
            <Text className="mt-1 font-body text-body-sm text-muted">4 weeks · 40 meals</Text>
          </View>
          <SolidBadge label="Active" tone="success" />
        </View>
        <View className="my-3 h-px bg-border" />
        <MetaRow label="Meals" value="Lunch & dinner" />
        <MetaRow label="Started" value="26 July 2026" />
        <MetaRow label="Renews" value="26 August 2026" compact />
      </Card>
    </Section>
    <Section title="Current preferences">
      <View className="flex-row gap-2">
        <MyPlanPreferenceCard caption="Food" title={preferenceCardTitle('food', food)} image={foodImageForPreference(food)} onEdit={(anchor) => openPreferencePicker('food', anchor)} />
        <MyPlanPreferenceCard caption="Bread" title={preferenceCardTitle('bread', bread)} image={preferenceImageFor(bread)} onEdit={(anchor) => openPreferencePicker('bread', anchor)} />
        <MyPlanPreferenceCard caption="Rice" title={preferenceCardTitle('rice', rice)} image={preferenceImageFor(rice)} onEdit={(anchor) => openPreferencePicker('rice', anchor)} />
      </View>
    </Section>
    <Section title="Delivery address" right={<Pressable accessibilityRole="button" onPress={() => go('addresses')}><Text className="font-mono-semibold text-body-sm text-accent">Edit</Text></Pressable>}>
      <Card compact><IconText icon={MapPinIcon} tone="accent" title="Home · B-704, Green View Apartments, Baner Road, Pune 411045" titleClassName="font-body-medium text-body-sm text-foreground" /></Card>
    </Section>
    <Section title="Payment method">
      <Pressable accessibilityRole="button">
        <Card compact><IconText icon={CreditCardIcon} title="UPI" description="Pay using any UPI app" trailing={<Text className="font-mono-semibold text-body-sm text-accent">Change</Text>} /></Card>
      </Pressable>
    </Section>
    <View className="h-10" />
    {openPicker && pickerAnchor ? (
      <SubscriptionPreferencePickerModal
        kind={openPicker}
        value={pickerValue}
        anchor={pickerAnchor}
        onClose={closePreferencePicker}
        onSelect={handlePreferenceSelect}
      />
    ) : null}
  </>;
}

function CouponPage({ onBack, apply }: { onBack: () => void; apply: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const placeholderColor = useFieldPlaceholderColor();
  const submit = () => { if (code.trim().toUpperCase() === 'HEALTHY300') apply(); else setError('This coupon does not exist or is not eligible for this plan.'); };
  return <>
    <Header onBack={onBack} title="Apply coupon" description="Choose an eligible offer or enter a coupon code." />
    <View className="mt-6 flex-row items-center gap-2">
      <TextInput value={code} onChangeText={(value) => { setCode(value.toUpperCase()); setError(''); }} placeholder="Enter coupon code" placeholderTextColor={placeholderColor} autoCapitalize="characters" style={{ paddingVertical: 0, textAlignVertical: 'center' }} className="h-field flex-1 rounded-field border border-border bg-field px-sheet font-body-medium text-body-md text-foreground" />
      <Pressable accessibilityRole="button" accessibilityLabel="Apply" onPress={submit} disabled={code.trim().length === 0} className={`h-field w-[100px] items-center justify-center rounded-button-inner bg-foreground ${code.trim().length > 0 ? 'opacity-100' : 'opacity-40'}`}>
        <Text className="font-mono-semibold text-body-md text-canvas">Apply</Text>
      </Pressable>
    </View>
    {error ? <Text className="mt-2 font-body text-body-sm text-destructive">{error}</Text> : null}
    <Section title="Available for you">
      <View className="gap-3">
        {[{ code: 'HEALTHY300', title: 'Save ₹300', detail: 'Valid on your first monthly subscription.' }, { code: 'WELCOME10', title: 'Save 10%', detail: 'Up to ₹200 on eligible weekly plans.' }].map((coupon) => (
          <Card key={coupon.code}>
            <View className="flex-row items-center gap-3">
              <Glyph icon={TagIcon} tone="accent" />
              <View className="min-w-0 flex-1">
                <MoneyInline className="font-body-medium text-body-md text-foreground">{coupon.title}</MoneyInline>
                <MoneyInline className="mt-1 font-body text-body-sm leading-5 text-muted">{coupon.detail}</MoneyInline>
                <Text className="mt-2 font-mono-semibold text-body-sm text-foreground">{coupon.code}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => { if (coupon.code === 'HEALTHY300') apply(); else { setCode(coupon.code); setError('This coupon is valid only on weekly plans.'); } }}>
                <Text className="font-mono-semibold text-body-sm text-accent">Apply</Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </View>
    </Section>
  </>;
}

const profileMenu: { icon: Icon; title: string; detail?: string; route: Route }[] = [
  { icon: WalletIcon, title: 'My plan', detail: 'Monthly · Active', route: 'my_plan' },
  { icon: GiftIcon, title: 'Loyalty & rewards', detail: '18 of 28 days completed', route: 'loyalty' },
  { icon: MapPinIcon, title: 'Saved addresses', detail: '2 addresses', route: 'addresses' },
  { icon: ReceiptIcon, title: 'Transactions', route: 'transactions' },
  { icon: ShareNetworkIcon, title: 'Refer & earn', route: 'referral' },
  { icon: BellIcon, title: 'Notifications', route: 'notifications' },
  { icon: GearIcon, title: 'Settings', route: 'settings' },
];

function ProfilePage({ onBack, go }: { onBack: () => void; go: (route: Route) => void }) {
  return <>
    <Header onBack={onBack} eyebrow="ACTIVE SUBSCRIPTION" title="Profile" />
    <View className="mt-6 flex-row items-center gap-4">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-icon-surface">
        <Text className="font-heading text-heading-sm text-foreground">AB</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-heading text-heading-sm text-foreground">Akshay Borade</Text>
        <Text className="mt-1 font-body text-body-sm text-muted">+91 ••••••9919</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => go('edit_profile')} className="size-icon-button items-center justify-center rounded-full bg-icon-surface">
        <Glyph icon={PencilSimpleIcon} />
      </Pressable>
    </View>
    <Section><ListContainer>{profileMenu.map((item, index) => <MenuRow key={item.title} {...item} showDivider={index < profileMenu.length - 1} onPress={() => go(item.route)} />)}</ListContainer></Section>
    <Text className="mt-7 text-center font-body text-body-xs text-muted">Healthy Tiffins · Version 1.0.0</Text>
  </>;
}

function EditProfilePage({ onBack, toast }: { onBack: () => void; toast: (message: string) => void }) {
  const [name, setName] = useState('Akshay Borade');
  const [gender, setGender] = useState('Man');
  const placeholderColor = useFieldPlaceholderColor();
  return <>
    <Header onBack={onBack} title="Personal information" description="Keep your profile details accurate for a more personalised experience." />
    <Section title="Full name">
      <TextInput value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor={placeholderColor} style={{ paddingVertical: 0, textAlignVertical: 'center' }} className="h-field rounded-field border border-border bg-field px-sheet font-body-medium text-body-md text-foreground" />
    </Section>
    <Section title="Date of birth">
      <Pressable className="h-field justify-center rounded-field border border-border bg-field px-sheet">
        <Text className="font-body-medium text-body-md text-foreground">18 Jul 1992</Text>
      </Pressable>
    </Section>
    <Section title="Gender">
      <View className="flex-row gap-2">
        {['Woman', 'Man', 'Non-binary'].map((item) => (
          <Pressable key={item} onPress={() => setGender(item)} className={`min-h-field flex-1 items-center justify-center px-2 ${selectionClass(gender === item)}`}>
            <Text numberOfLines={1} adjustsFontSizeToFit className="font-mono-semibold text-body-sm text-foreground">{item}</Text>
          </Pressable>
        ))}
      </View>
    </Section>
    <Section title="WhatsApp number">
      <View className="h-field flex-row items-center justify-between rounded-field border border-border bg-field px-sheet">
        <Text className="font-body-medium text-body-md text-foreground">+91 ••••••9919</Text>
        <SolidBadge label="Verified" tone="success" />
      </View>
    </Section>
  </>;
}

function AddressesPage({ onBack, toast }: { onBack: () => void; toast: (message: string) => void }) {
  const { savedAddresses, defaultAddressId, setDefaultAddress, removeAddress } = useSavedAddresses();
  return <>
    <Header onBack={onBack} title="Saved addresses" description="Manage delivery locations and choose your default address." />
    <Section>
      <View className="gap-3">
        {savedAddresses.length === 0 ? (
          <Text className="font-body text-body-sm leading-5 text-muted">No saved addresses yet. Add one during checkout or from a meal delivery update.</Text>
        ) : savedAddresses.map((address) => (
          <Card compact key={address.id}>
            <IconText icon={MapPinIcon} tone="accent" title={addressLabelDisplay(address)} description={formatSavedAddressLines(address)} titleClassName="font-mono-semibold text-body-md text-foreground" trailing={address.id === defaultAddressId ? <SolidBadge label="Default" tone="accent" /> : undefined} />
            <View className="ml-9 mt-4 flex-row flex-wrap gap-2">
              <ActionChip label="Edit" onPress={() => toast('Address editing opened')} />
              {address.id !== defaultAddressId ? <ActionChip label="Set as default" onPress={() => { setDefaultAddress(address.id); toast('Default address updated'); }} /> : null}
              {address.id !== defaultAddressId ? <ActionChip label="Delete" danger onPress={() => { removeAddress(address.id); toast('Address removed'); }} /> : null}
            </View>
          </Card>
        ))}
      </View>
    </Section>
    <View className="mt-6"><PrimaryShimmerButton label="Add address" onPress={() => toast('Add address from delivery setup')} /></View>
  </>;
}

function TransactionsPage({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState(0);
  const transactions = [
    { title: 'Monthly subscription', date: '22 Jul 2026 · 10:42 AM', amount: '₹2,499', status: 'Succeeded' },
    { title: 'Healthy Streak reward', date: '01 Jul 2026 · 9:10 AM', amount: 'Free meal day', status: 'Credited' },
    { title: 'Three-day trial', date: '21 Jun 2026 · 4:18 PM', amount: '₹899', status: 'Succeeded' },
  ];
  return <>
    <Header onBack={onBack} title="Transactions" description="Payments, refunds, credits and rewards in one place." />
    <View className="mt-6 flex-row gap-2">
      {['All', 'Payments', 'Rewards'].map((item, index) => (
        <Pressable key={item} onPress={() => setFilter(index)} className={`rounded-full px-4 py-2 ${index === filter ? 'bg-accent' : 'border border-border bg-canvas'}`}>
          <Text className={`font-mono-semibold text-body-sm ${index === filter ? 'text-white' : 'text-foreground'}`}>{item}</Text>
        </Pressable>
      ))}
    </View>
    <Section title="July 2026">
      <ListContainer>
        {transactions.map((item, index) => (
          <Pressable key={item.title} className={`px-sheet py-3 ${index < transactions.length - 1 ? 'border-b border-border' : ''}`}>
            <IconText icon={ReceiptIcon} title={item.title} description={`${item.date} · ${item.status}`} titleClassName="font-body-medium text-body-sm text-foreground" trailing={<Text className={moneyValueTypography(item.amount, 'text-body-sm')}>{item.amount}</Text>} />
          </Pressable>
        ))}
      </ListContainer>
    </Section>
  </>;
}

function SettingsPage({ onBack, go, toast }: { onBack: () => void; go: (route: Route) => void; toast: (message: string) => void }) {
  return <>
    <Header onBack={onBack} title="Settings" description="Manage your account, app preferences, privacy and support." />
    <Section title="Account"><ListContainer><MenuRow icon={UserIcon} title="Personal information" onPress={() => go('edit_profile')} /><MenuRow icon={ShieldCheckIcon} title="Privacy and data" onPress={() => toast('Privacy and data opened')} /><MenuRow icon={MapPinIcon} title="Saved addresses" showDivider={false} onPress={() => go('addresses')} /></ListContainer></Section>
    <Section title="App"><ListContainer><MenuRow icon={BellIcon} title="Notifications" onPress={() => go('notifications')} /><MenuRow icon={ShieldCheckIcon} title="App permissions" onPress={() => go('permissions')} /><MenuRow icon={GearIcon} title="Appearance" detail="System" showDivider={false} onPress={() => toast('Appearance follows the device')} /></ListContainer></Section>
    <Section title="Support and legal"><ListContainer><MenuRow icon={ReceiptIcon} title="Help and support" onPress={() => toast('Support opened')} /><MenuRow icon={ShieldCheckIcon} title="Terms, cancellation and privacy" showDivider={false} onPress={() => toast('Legal information opened')} /></ListContainer></Section>
    <Section><ListContainer><MenuRow icon={SignOutIcon} title="Log out" danger showDivider={false} onPress={() => toast('Logged out locally')} /></ListContainer></Section>
  </>;
}

function NotificationsPage({ onBack, toast }: { onBack: () => void; toast: (message: string) => void }) {
  const [values, setValues] = useState({ delivery: true, payment: true, reminders: true, nutrition: true, rewards: true, offers: false });
  const update = (key: keyof typeof values, value: boolean) => setValues((state) => ({ ...state, [key]: value }));
  return <>
    <Header onBack={onBack} title="Notifications" description="Choose which updates you receive. Essential service messages remain enabled." />
    <Section title="Operational"><ListContainer><ToggleRow title="Delivery and meal status" description="Required while you have active deliveries." value={values.delivery} onChange={() => {}} locked /><ToggleRow title="Payment and account security" description="Required for payment and account protection." value={values.payment} onChange={() => {}} locked showDivider={false} /></ListContainer></Section>
    <Section title="Personalised"><ListContainer><ToggleRow title="Meal reminders" value={values.reminders} onChange={(value) => update('reminders', value)} /><ToggleRow title="Nutrition insights" value={values.nutrition} onChange={(value) => update('nutrition', value)} /><ToggleRow title="Rewards and leaderboard" value={values.rewards} onChange={(value) => update('rewards', value)} /><ToggleRow title="Offers and promotions" value={values.offers} onChange={(value) => update('offers', value)} showDivider={false} /></ListContainer></Section>
  </>;
}

function PermissionsPage({ onBack, toast }: { onBack: () => void; toast: (message: string) => void }) {
  return <>
    <Header onBack={onBack} title="App permissions" description="Review access used to improve delivery and account updates." />
    <Section><ListContainer><MenuRow icon={MapPinIcon} title="Location" detail="Allowed · Used to find and validate addresses" onPress={() => toast('Opening system location settings')} /><MenuRow icon={BellIcon} title="Notifications" detail="Allowed · Used for meal and payment updates" showDivider={false} onPress={() => toast('Opening system notification settings')} /></ListContainer></Section>
    <Text className="mt-5 font-body text-body-sm leading-6 text-muted">Permissions are requested only when a feature needs them. Manual address search remains available without location access.</Text>
  </>;
}

function ReferralPage({ onBack, toast }: { onBack: () => void; toast: (message: string) => void }) {
  const { theme } = useUniwind();
  const palette = themePalette[theme === 'dark' ? 'dark' : 'light'];
  const steps = ['Friend signs up with your code', 'Friend completes first payment', 'Your account credit is unlocked'];
  return <>
    <Header onBack={onBack} eyebrow="REFER & EARN" title="Share healthy meals" description="Your friend gets a welcome offer. Your reward unlocks after their first successful payment." />
    <Section>
      <View className="rounded-field bg-accent-soft p-sheet">
        <Text className="font-mono-semibold text-body-xs text-accent">YOUR CODE</Text>
        <View className="mt-2 flex-row items-center justify-between gap-3">
          <Text className="font-heading text-heading-md text-foreground">AKSHAY250</Text>
          <Pressable onPress={() => toast('Referral code copied')} className="h-9 shrink-0 flex-row items-center gap-1.5 justify-center rounded-full bg-accent-light px-4">
            <CopyIcon size={16} weight="bold" color={palette.accent} />
            <Text className="font-mono-semibold text-body-sm text-accent">Copy</Text>
          </Pressable>
        </View>
        <View className="mt-3"><PrimaryShimmerButton label="Share invite" onPress={() => toast('Share sheet opened')} /></View>
      </View>
    </Section>
    <Section title="How it works">
      <ListContainer>
        {steps.map((step, index) => (
          <View key={step} className={`flex-row items-start gap-4 px-sheet py-3 ${index < steps.length - 1 ? 'border-b border-border' : ''}`}>
            <Text className="w-5 font-body text-body-sm text-muted">{index + 1}</Text>
            <Text className="flex-1 font-body-medium text-body-md leading-6 text-foreground">{step}</Text>
          </View>
        ))}
      </ListContainer>
    </Section>
    <Section title="Referral history">
      <ListContainer>
        <ListMetaRow label="A•••••" value="Qualified · Rewarded" />
        <ListMetaRow label="P•••••" value="Signed up · Pending" showDivider={false} />
      </ListContainer>
    </Section>
  </>;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <View className="h-3 overflow-hidden rounded-full bg-canvas">
      <View style={{ width: `${Math.min(100, value)}%` }} className="h-full rounded-full bg-accent" />
    </View>
  );
}

function LoyaltyPage({ onBack, go, completed = false, subscribed = true }: { onBack: () => void; go: (route: Route) => void; completed?: boolean; subscribed?: boolean }) {
  const daysCompleted = completed ? 28 : 18;
  return <>
    <Header onBack={onBack} eyebrow="HEALTHY STREAK" title="Your loyalty progress" description={completed ? 'You completed a qualifying paid month. Claim your free meal day before it expires.' : 'Complete one continuous paid subscription month to earn one free meal day.'} />
    <Section>
      <View className="rounded-field bg-accent-soft p-sheet">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            {completed ? (
              <>
                <Text className="font-mono-semibold text-body-xs text-accent">STREAK COMPLETED</Text>
                <Text className="mt-1 font-heading text-heading-md text-foreground">28 of 28</Text>
                <Text className="mt-1 font-body text-body-sm text-muted">active days completed</Text>
              </>
            ) : (
              <>
                <Text className="font-heading text-heading-md text-foreground">{daysCompleted} of 28</Text>
                <Text className="mt-1 font-body text-body-sm text-muted">active days completed</Text>
              </>
            )}
          </View>
          {completed ? (
            subscribed ? (
              <Text className="shrink-0 pt-0.5 font-body text-body-sm text-muted">Resets tomorrow</Text>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => go('checkout')} className="h-9 shrink-0 justify-center rounded-full bg-accent px-4">
                <Text className="font-mono-semibold text-body-sm text-accent-foreground">Subscribe now</Text>
              </Pressable>
            )
          ) : null}
        </View>
        <View className="mt-5"><ProgressBar value={(daysCompleted / 28) * 100} /></View>
        {!completed ? <Text className="mt-3 font-body text-body-sm text-muted">Expected reward: 1 August 2026</Text> : null}
      </View>
    </Section>
    <Section title="Your reward">
      <Card>
        {completed ? (
          <>
            <View className="flex-row items-center justify-between gap-3">
              <Text className="flex-1 font-mono-semibold text-body-md text-foreground">One free meal day</Text>
              <Pressable accessibilityRole="button" onPress={() => go('reward')} className="h-9 shrink-0 flex-row items-center gap-1 rounded-full bg-accent pl-4 pr-3">
                <Text className="font-mono-semibold text-body-sm text-accent-foreground">Claim</Text>
                <CaretRightIcon size={16} weight="bold" color="#ffffff" />
              </Pressable>
            </View>
            <Text className={`mt-2 ${headingDescriptionClass}`}>Your reward matches your active plan: one free lunch and dinner day.</Text>
          </>
        ) : (
          <>
            <Text className="font-mono-semibold text-body-md text-foreground">One free meal day</Text>
            <Text className={`mt-2 ${headingDescriptionClass}`}>Your reward matches your active plan: one free lunch and dinner day.</Text>
          </>
        )}
      </Card>
    </Section>
    <Section title="Progress rules">
      <ListContainer>
        <ListMetaRow label="Required active days" value="28" />
        <ListMetaRow label="Required fulfilled meal days" value="20" />
        <ListMetaRow label="Paused days" value="Extend the end date" showDivider={false} />
      </ListContainer>
    </Section>
  </>;
}

function LeaderboardPage({ onBack }: { onBack: () => void }) {
  const leaders = [
    { rank: 1, name: 'R••••• S.', points: 540 },
    { rank: 2, name: 'N••••• P.', points: 495 },
    { rank: 3, name: 'M••••• K.', points: 470 },
    { rank: 18, name: 'You', points: 285 },
  ];
  return <>
    <Header onBack={onBack} eyebrow="JULY 2026" title="Healthy Streak leaderboard" description="Friendly monthly points and recognition. Your guaranteed free meal does not depend on rank." />
    <Section>
      <View className="rounded-field bg-accent-soft p-sheet">
        <View className="flex-row justify-between">
          <View>
            <Text className="font-mono-semibold text-body-xs text-accent">YOUR RANK</Text>
            <Text className="mt-2 font-heading text-heading-md text-foreground">#18</Text>
          </View>
          <View className="items-end">
            <Text className="font-mono-semibold text-body-xs text-accent">YOUR POINTS</Text>
            <Text className="mt-2 font-heading text-heading-md text-foreground">285</Text>
          </View>
        </View>
        <Text className="mt-4 font-body text-body-sm text-muted">9 days until the monthly reset</Text>
      </View>
    </Section>
    <Section title="This month">
      <ListContainer>
        {leaders.map((leader, index) => (
          <View key={leader.rank} className={`flex-row items-center px-sheet py-3 ${index < leaders.length - 1 ? 'border-b border-border' : ''} ${leader.name === 'You' ? 'bg-warning-soft' : ''}`}>
            <Text className="w-12 font-mono-semibold text-body-md text-foreground">#{leader.rank}</Text>
            <Text className="flex-1 font-body-medium text-body-md text-foreground">{leader.name}</Text>
            <Text className="font-body-medium text-body-sm text-muted">{leader.points} pts</Text>
          </View>
        ))}
      </ListContainer>
    </Section>
  </>;
}

function RewardPage({ onBack, foodPreference, onFoodPreferenceChange }: { onBack: () => void; foodPreference: FoodPreference; onFoodPreferenceChange: (value: FoodPreference) => void }) {
  return (
    <>
      <Header onBack={onBack} eyebrow="REWARD EARNED" title="Your free meal day is ready" description="You completed one qualifying paid month. Choose an eligible delivery day within 60 days." />
      <View className="mt-6">
        <FoodPreferenceTabs value={foodPreference} onChange={onFoodPreferenceChange} />
      </View>
      <View className="mt-6 items-center">
        <View className="size-64 overflow-hidden rounded-full bg-accent-soft">
          <Image source={foodImageForPreference(foodPreference)} accessibilityLabel={`${foodPreference} home-style meal`} resizeMode="cover" className="size-full" />
        </View>
      </View>
      <Section>
        <Card>
          <MetaRow label="Reward" value="One free lunch & dinner day" />
          <MetaRow label="Earned" value="22 July 2026" />
          <MetaRow label="Use by" value="20 September 2026" />
          <MetaRow label="Value" value="Applied automatically" compact />
        </Card>
      </Section>
    </>
  );
}

function RedeemPage({ onBack, foodPreference }: { onBack: () => void; foodPreference: FoodPreference }) {
  const dates = [
    { day: '27', weekday: 'Mon' },
    { day: '28', weekday: 'Tue' },
    { day: '29', weekday: 'Wed' },
    { day: '30', weekday: 'Thu' },
    { day: '31', weekday: 'Fri' },
  ];
  const [selected, setSelected] = useState(2);
  return (
    <>
      <Header onBack={onBack} title="Choose your free meal day" description="Select an eligible date. Your current meal and address settings will be used." />
      <Section title="Eligible dates">
        <View className="flex-row justify-between gap-2">
          {dates.map((date, index) => (
            <Pressable key={`${date.day}-${date.weekday}`} onPress={() => setSelected(index)} className={`min-h-[72px] flex-1 items-center justify-center gap-1 px-1 py-3 ${selectionClass(selected === index)}`}>
              <Text className="font-mono-semibold text-body-md text-foreground">{date.day}</Text>
              <Text className="font-body text-body-xs text-muted">{date.weekday}</Text>
            </Pressable>
          ))}
        </View>
      </Section>
      <Section title="Reward details">
        <View className="rounded-field bg-accent-soft p-3">
          <MetaRow compact label="Meal" value="Lunch & dinner" />
          <MetaRow compact label="Food" value={foodPreferenceLabel(foodPreference)} />
          <MetaRow compact label="Payable" value="₹0" valueTone="text-accent" />
        </View>
      </Section>
      <Section title="Delivery address">
        <Card compact><IconText icon={MapPinIcon} tone="accent" title="Home" description="B-704, Green View Apartments, Baner Road, Pune 411045" titleClassName="font-body-medium text-body-sm text-foreground" /></Card>
      </Section>
    </>
  );
}

export default function CommerceProfileExperience({ stateId, onBack, onTransition, initialRoute, myPlanShowManageActions = true }: { stateId: LifecycleStateId; onBack: () => void; onTransition: (id: LifecycleStateId) => void; initialRoute?: Route; myPlanShowManageActions?: boolean }) {
  const insets = useSafeAreaInsets();
  const initial = initialRoute ?? stateRoute[stateId] ?? 'profile';
  const [stack, setStack] = useState<Route[]>([initial]);
  const [couponApplied, setCouponApplied] = useState(stateId === 'X');
  const [rewardFoodPreference, setRewardFoodPreference] = useState<FoodPreference>(userFoodPreference as FoodPreference);
  const [toastMessage, setToastMessage] = useState('');
  const [cancelSubscriptionOpen, setCancelSubscriptionOpen] = useState(false);
  const route = stack[stack.length - 1] ?? initial;
  const go = (next: Route) => setStack((items) => [...items, next]);
  const back = () => setStack((items) => { if (items.length <= 1) { onBack(); return items; } return items.slice(0, -1); });
  const toast = (message: string) => setToastMessage(message);
  const page = useMemo(() => {
    if (route === 'checkout') return <CheckoutPage onBack={back} go={go} couponApplied={couponApplied} setCouponApplied={setCouponApplied} />;
    if (route === 'coupon') return <CouponPage onBack={back} apply={() => { setCouponApplied(true); setStack((items) => [...items.slice(0, -1), 'checkout']); toast('HEALTHY300 applied'); }} />;
    if (route === 'profile') return <ProfilePage onBack={back} go={go} />;
    if (route === 'my_plan') return <MyPlanPage onBack={back} go={go} toast={toast} />;
    if (route === 'edit_profile') return <EditProfilePage onBack={back} toast={toast} />;
    if (route === 'addresses') return <AddressesPage onBack={back} toast={toast} />;
    if (route === 'transactions') return <TransactionsPage onBack={back} />;
    if (route === 'settings') return <SettingsPage onBack={back} go={go} toast={toast} />;
    if (route === 'notifications') return <NotificationsPage onBack={back} toast={toast} />;
    if (route === 'permissions') return <PermissionsPage onBack={back} toast={toast} />;
    if (route === 'referral') return <ReferralPage onBack={back} toast={toast} />;
    if (route === 'loyalty') return <LoyaltyPage onBack={back} go={go} completed={stateId === 'AN'} subscribed={isSubscribedState(stateId)} />;
    if (route === 'leaderboard') return <LeaderboardPage onBack={back} />;
    if (route === 'reward') return <RewardPage onBack={back} foodPreference={rewardFoodPreference} onFoodPreferenceChange={setRewardFoodPreference} />;
    return <RedeemPage onBack={back} foodPreference={rewardFoodPreference} />;
  }, [couponApplied, onTransition, route, stateId, rewardFoodPreference]);
  const checkoutTotal = priceBefore - (couponApplied ? discountValue : 0);
  const fixedFooterRoutes: Route[] = ['loyalty', 'reward', 'redeem', 'checkout', 'edit_profile', 'notifications', ...(myPlanShowManageActions ? ['my_plan' as const] : [])];
  const hasFixedFooter = fixedFooterRoutes.includes(route);
  const fixedFooterScrollPadding = route === 'my_plan' && myPlanShowManageActions ? insets.bottom + 168 : insets.bottom + 92;
  const fixedFooter = route === 'loyalty'
    ? <PrimaryShimmerButton label="View monthly leaderboard" onPress={() => go('leaderboard')} />
    : route === 'reward'
      ? <PrimaryShimmerButton label="Choose free meal day" onPress={() => go('redeem')} />
      : route === 'redeem'
        ? <PrimaryShimmerButton label="Confirm free meal" onPress={() => onTransition('K')} />
        : route === 'checkout'
          ? <PrimaryShimmerButton label={`Subscribe · Pay ${formatRupee(checkoutTotal)}`} onPress={() => onTransition('Y')} />
          : route === 'my_plan' && myPlanShowManageActions
            ? (
              <View className="gap-3">
                <PrimaryShimmerButton label="Pause subscription" onPress={() => toast('Pause subscription selected')} />
                <Pressable accessibilityRole="button" onPress={() => setCancelSubscriptionOpen(true)} className="h-12 items-center justify-center">
                  <Text className="font-mono-semibold text-body-sm text-muted">Cancel subscription</Text>
                </Pressable>
              </View>
            )
          : route === 'edit_profile'
            ? <PrimaryShimmerButton label="Save changes" onPress={() => { toast('Profile updated'); back(); }} />
            : route === 'notifications'
              ? <PrimaryShimmerButton label="Save preferences" onPress={() => { toast('Notification preferences saved'); back(); }} />
              : null;
  return (
    <View className="flex-1 bg-canvas">
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 20, paddingBottom: hasFixedFooter ? fixedFooterScrollPadding : insets.bottom + 24 }}>
        <View className="flex-1 px-5">{page}</View>
      </ScrollView>
      {hasFixedFooter && fixedFooter ? (
        <View style={{ paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(16, insets.bottom + 8) }} className="absolute inset-x-0 bottom-0 bg-canvas px-5 pt-2">
          {fixedFooter}
        </View>
      ) : null}
      {cancelSubscriptionOpen ? (
        <BottomSheetOverlay onClose={() => setCancelSubscriptionOpen(false)}>
          <CancelSubscriptionSheet
            onPause={() => {
              setCancelSubscriptionOpen(false);
              toast('Pause subscription selected');
            }}
            onCancel={() => {
              setCancelSubscriptionOpen(false);
              toast('Subscription cancelled');
            }}
          />
        </BottomSheetOverlay>
      ) : null}
      {toastMessage ? <AppToast message={toastMessage} onDismiss={() => setToastMessage('')} /> : null}
    </View>
  );
}
