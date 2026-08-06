import { useEffect, useRef, useState } from 'react';
import { Animated as NativeAnimated, Easing, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUniwind } from 'uniwind';
import { PrimaryShimmerButton, GhostFieldButton } from './primaryButton';
import { headingDescriptionClass } from './typographyClasses';
import { SectionHeading } from './SectionHeading';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { CreditCardIcon } from 'phosphor-react-native/src/icons/CreditCard';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { WifiSlashIcon } from 'phosphor-react-native/src/icons/WifiSlash';
import type { Icon } from 'phosphor-react-native';
import type { LifecycleDefinition, LifecycleStateId } from './lifecycleStateMachine';
import { themePalette } from './themeColors';

const nextState: Partial<Record<LifecycleStateId, LifecycleStateId>> = {
  E: 'D', F: 'G', H: 'J', I: 'J', J: 'K', L: 'K', M: 'K', N: 'K', O: 'J', P: 'K', Q: 'K', R: 'K', S: 'K', T: 'U', U: 'F', Y: 'K', Z: 'K', AA: 'Y',
};

function Glyph({ icon: GlyphIcon, color }: { icon: Icon; color?: string }) {
  const { theme } = useUniwind();
  const palette = themePalette[theme === 'dark' ? 'dark' : 'light'];
  return <GlyphIcon size={20} weight="bold" color={color ?? palette.accent} />;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <PrimaryShimmerButton label={label} onPress={onPress} />;
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <GhostFieldButton label={label} onPress={onPress} />;
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <View className="mt-7 rounded-field border border-border bg-canvas p-sheet">{children}</View>;
}

function StatusPill({ text, tone }: { text: string; tone: LifecycleDefinition['tone'] }) {
  const bg = tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-[#f59e0b]' : tone === 'danger' ? 'bg-destructive' : 'bg-accent';
  return (
    <View className={`self-start rounded-full px-3 py-1.5 ${bg}`}>
      <Text className="font-body-medium text-body-xs text-white">{text}</Text>
    </View>
  );
}

function MetaRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="max-w-[40%] shrink-0 font-body text-body-sm text-muted">{label}</Text>
      <View className="min-w-0 flex-1">
        <Text className={`text-right font-body-medium text-body-md leading-6 text-foreground ${strong ? 'font-mono-semibold' : ''}`}>{value}</Text>
      </View>
    </View>
  );
}

function TrialDates({ completed = 2 }: { completed?: number }) {
  return (
    <View className="mt-5 flex-row justify-between">
      {['21', '22', '23', '24', '25'].map((date, index) => (
        <View key={date} className="items-center gap-3">
          <View className={`h-14 w-12 items-center justify-center rounded-field border ${index === completed ? 'border-accent bg-accent-soft' : 'border-border bg-field'}`}>
            <Text className={`font-mono-semibold text-body-md ${index === completed ? 'text-accent' : 'text-foreground'}`}>{date}</Text>
            <Text className="font-body text-body-xs text-muted">{['MON', 'TUE', 'WED', 'THU', 'FRI'][index]}</Text>
          </View>
          <View className={`h-6 w-6 items-center justify-center rounded-full ${index < completed ? 'bg-success' : 'border-2 border-border bg-canvas'}`}>
            {index < completed ? <Glyph icon={CheckIcon} color="#ffffff" /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function WeekTracker() {
  return (
    <View className="mt-4 flex-row justify-between">
      {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, index) => (
        <View key={day} className="items-center gap-2">
          <Text className="font-body text-body-xs text-muted">{day}</Text>
          <View className={`h-9 w-9 items-center justify-center rounded-full border ${index < 2 ? 'border-success bg-success' : index === 2 ? 'border-2 border-accent bg-accent-soft' : 'border-border bg-field'}`}>
            {index < 2 ? <Glyph icon={CheckIcon} color="#ffffff" /> : <Text className={`font-mono-semibold text-body-xs ${index === 2 ? 'text-accent' : 'text-foreground'}`}>{21 + index}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

function PaymentRecovery({ definition, confirmed = false }: { definition: LifecycleDefinition; confirmed?: boolean }) {
  const subscription = definition.id === 'Y' || definition.id === 'Z' || definition.id === 'AA';
  const failed = definition.id === 'E' || definition.id === 'AA';
  const rotation = useRef(new NativeAnimated.Value(0)).current;
  useEffect(() => { if (failed || confirmed) return; const animation = NativeAnimated.loop(NativeAnimated.timing(rotation, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })); animation.start(); return () => animation.stop(); }, [confirmed, failed, rotation]);
  const { theme } = useUniwind();
  const pendingColor = theme === 'dark' ? '#fb923c' : '#d97706';
  const description = confirmed
    ? subscription ? 'Your subscription is active. Your meals and nutrition tools are ready.' : 'Your three-day trial is ready to be scheduled. We are taking you to Home.'
    : failed
      ? subscription ? 'Your plan and preferences are saved. Retry payment safely when you are ready.' : 'No amount has been applied to your trial. Retry safely or choose another payment method.'
      : subscription ? 'Your bank has received the request. Your subscription starts only after payment is confirmed.' : 'Your bank has received the request. Your trial will start only after payment is confirmed.';
  return (
    <StateCard>
      <View className={`h-16 w-16 items-center justify-center rounded-full ${confirmed ? 'bg-success' : failed ? 'bg-destructive' : 'bg-field'}`}>
        {!failed && !confirmed ? <NativeAnimated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }], borderColor: pendingColor, borderTopColor: 'transparent' }} className="absolute h-16 w-16 rounded-full border-[3px]" /> : null}
        {confirmed ? <Glyph icon={CheckIcon} color="#ffffff" /> : <Glyph icon={CreditCardIcon} color={failed ? '#ffffff' : pendingColor} />}
      </View>
      <Text className="mt-5 font-mono-semibold text-heading-sm text-foreground">{confirmed ? subscription ? 'Your subscription is active' : 'Your payment is confirmed' : failed ? 'Payment could not be completed' : 'We are confirming your payment'}</Text>
      <Text className={`mt-2 ${headingDescriptionClass}`}>{description}</Text>
      <View className="my-5 h-px bg-border" />
      <View className="gap-3">
        <MetaRow label="Amount" value={subscription ? '₹2,499' : '₹899'} strong />
        <MetaRow label="Method" value="UPI" />
        <MetaRow label="Reference" value={subscription ? 'SUB-260722' : 'TRIAL-260721'} />
        <MetaRow label="Status" value={confirmed ? 'Confirmed' : failed ? 'Failed' : 'Pending'} />
      </View>
    </StateCard>
  );
}

function TrialState({ id }: { id: LifecycleStateId }) {
  if (id === 'F') return <><StateCard><StatusPill text="STARTS SOON" tone="success" /><SectionHeading className="mt-4">Your trial starts Monday</SectionHeading><Text className={`mt-2 ${headingDescriptionClass}`}>Your first home-style lunch is scheduled for 27 July.</Text><View className="mt-5 gap-3"><MetaRow label="Trial dates" value="27–31 July" /><MetaRow label="Meals" value="Lunch" /><MetaRow label="Address" value="Home · Baner" /></View></StateCard><TrialDates completed={-1} /></>;
  if (id === 'H') return <><TrialDates /><StateCard><StatusPill text="SUBSCRIPTION READY" tone="success" /><SectionHeading className="mt-4">Your Monthly plan starts next</SectionHeading><Text className={`mt-2 ${headingDescriptionClass}`}>Finish your trial first. Your subscription begins automatically on 26 July.</Text><View className="mt-5 gap-3"><MetaRow label="Plan" value="Monthly" /><MetaRow label="Meal" value="Lunch & Dinner" /><MetaRow label="Starts" value="26 July" /></View></StateCard></>;
  return <><StateCard><StatusPill text="TRIAL COMPLETE" tone="success" /><SectionHeading className="mt-4">Three meals delivered</SectionHeading><Text className={`mt-2 ${headingDescriptionClass}`}>Continue the routine with a plan that fits your week.</Text><View className="mt-5 gap-3"><MetaRow label="Delivered" value="3 of 3 meals" /><MetaRow label="Preference" value="Mix of both" /><MetaRow label="Saved address" value="Home · Baner" /></View></StateCard><StateCard><SectionHeading>Your trial nutrition</SectionHeading><Text className={`mt-2 ${headingDescriptionClass}`}>Average 710 kcal and 27 g protein per meal.</Text></StateCard></>;
}

function SubscriberState({ id }: { id: LifecycleStateId }) {
  const noMeal = id === 'L';
  const paused = id === 'M';
  const ending = id === 'N';
  const expired = id === 'O';
  const scheduled = id === 'J';
  if (scheduled || paused || expired) return <StateCard><StatusPill text={scheduled ? 'STARTS 26 JULY' : paused ? 'PAUSED' : 'PLAN ENDED'} tone={scheduled ? 'success' : 'warning'} /><SectionHeading className="mt-4">{scheduled ? 'Your Monthly plan is ready' : paused ? 'Your subscription is paused' : 'Your subscription has ended'}</SectionHeading><Text className={`mt-2 ${headingDescriptionClass}`}>{scheduled ? 'Your first subscribed meal is scheduled after the trial.' : paused ? 'Deliveries resume on 2 August. Past meals and nutrition remain available.' : 'Renew to restart everyday meals. Your history and preferences are saved.'}</Text><View className="mt-5 gap-3"><MetaRow label="Plan" value="Monthly" /><MetaRow label={paused ? 'Resume date' : scheduled ? 'Start date' : 'Ended'} value={paused ? '2 August' : scheduled ? '26 July' : '20 July'} /><MetaRow label="Meals" value="Lunch & Dinner" /></View></StateCard>;
  return <><StateCard><StatusPill text={ending ? 'ACTIVE UNTIL 20 AUG' : noMeal ? 'NO MEAL TODAY' : 'TODAY'} tone={ending ? 'warning' : 'success'} /><SectionHeading className="mt-4">{noMeal ? 'Your next meal is tomorrow' : 'Lunch is being prepared'}</SectionHeading><Text className={`mt-2 ${headingDescriptionClass}`}>{noMeal ? 'Dinner · 6:30 PM–8:30 PM · Home' : 'Paneer masala, dal tadka, chapati, jeera rice and salad.'}</Text>{!noMeal ? <View className="mt-5 gap-3"><MetaRow label="Delivery window" value="11:00 AM–1:00 PM" /><MetaRow label="Address" value="Home · Baner" /><MetaRow label="Status" value="Preparing" /></View> : null}</StateCard><StateCard><SectionHeading>Next seven days</SectionHeading><WeekTracker /></StateCard><StateCard><SectionHeading>Weekly nutrition</SectionHeading><Text className={`mt-2 ${headingDescriptionClass}`}>You’re averaging 28 g protein across subscribed meals this week.</Text></StateCard></>;
}

function RecoveryState({ id }: { id: LifecycleStateId }) {
  const { theme } = useUniwind();
  const config = id === 'P'
    ? { icon: CreditCardIcon, title: 'Renewal payment failed', body: 'Paid meals remain confirmed. Update payment to avoid interruption after 31 July.', color: theme === 'dark' ? '#f87171' : '#dc2626' }
    : id === 'Q'
      ? { icon: ClockIcon, title: 'Lunch is delayed', body: 'Your delivery is running about 25 minutes late. We’ll keep this status updated.', color: theme === 'dark' ? '#fb923c' : '#d97706' }
      : id === 'R'
        ? { icon: MapPinIcon, title: 'We could not complete delivery', body: 'The delivery partner could not verify the address. Check the saved PIN and location.', color: theme === 'dark' ? '#f87171' : '#dc2626' }
        : { icon: WifiSlashIcon, title: 'You’re offline', body: 'Showing the latest saved information. Changes are unavailable until you reconnect.', color: themePalette[theme === 'dark' ? 'dark' : 'light'].muted };
  return <><StateCard><View className="h-11 w-11 items-center justify-center rounded-full bg-icon-surface"><Glyph icon={config.icon} color={config.color} /></View><SectionHeading className="mt-5">{config.title}</SectionHeading><Text className={`mt-2 ${headingDescriptionClass}`}>{config.body}</Text>{id !== 'S' ? <View className="mt-5 gap-3"><MetaRow label="Affected meal" value="Lunch · 23 July" /><MetaRow label="Current address" value="Home · Baner" /><MetaRow label="Credit status" value={id === 'R' ? 'Pending review' : 'Not applicable'} /></View> : null}</StateCard>{id !== 'S' ? <StateCard><SectionHeading>Upcoming deliveries</SectionHeading><WeekTracker /></StateCard> : null}</>;
}

export default function LifecycleExperience({ definition, onBack, onTransition, onPaymentCheck }: { definition: LifecycleDefinition; onBack: () => void; onTransition: (id: LifecycleStateId) => void; onPaymentCheck?: () => void }) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(definition.id === 'U');
  const id = definition.id;
  useEffect(() => {
    if (id === 'T') { const confirmedTimer = setTimeout(() => setPaymentConfirmed(true), 2200); const routeTimer = setTimeout(() => onTransition('U'), 3400); return () => { clearTimeout(confirmedTimer); clearTimeout(routeTimer); }; }
    if (id === 'U') { const routeTimer = setTimeout(() => onTransition('F'), 1800); return () => clearTimeout(routeTimer); }
  }, [id, onTransition]);
  const primary = () => {
    if (id === 'D' && onPaymentCheck) { onPaymentCheck(); return; }
    const target = nextState[id];
    if (target) onTransition(target);
    else setExpanded(true);
  };
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-canvas" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 20, paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(16, insets.bottom + 8) }}>
      <View className="flex-1 px-5">
        <Pressable accessibilityRole="button" onPress={onBack} className="mb-7 h-10 self-start justify-center rounded-full border border-border px-4">
          <Text className="font-mono-semibold text-body-sm text-foreground">All states</Text>
        </Pressable>
        <StatusPill text={`STATE ${id}`} tone={definition.tone} />
        <Text className="mt-4 font-heading text-heading-md text-foreground">{definition.title}</Text>
        <Text className={`mt-2 ${headingDescriptionClass}`}>{definition.summary}</Text>
        {(id === 'D' || id === 'E' || id === 'T' || id === 'U' || id === 'Y' || id === 'Z' || id === 'AA') ? <PaymentRecovery definition={definition} confirmed={paymentConfirmed || id === 'Z'} /> : null}
        {(['F', 'H', 'I'] as LifecycleStateId[]).includes(id) ? <TrialState id={id} /> : null}
        {(['J', 'K', 'L', 'M', 'N', 'O'] as LifecycleStateId[]).includes(id) ? <SubscriberState id={id} /> : null}
        {(['P', 'Q', 'R', 'S'] as LifecycleStateId[]).includes(id) ? <RecoveryState id={id} /> : null}
        {expanded ? <View className="mt-4 flex-row items-start gap-3 rounded-field border border-border bg-accent-soft p-sheet"><Glyph icon={CheckIcon} /><Text className="flex-1 font-body text-body-sm leading-6 text-foreground">Action completed locally for this preview state.</Text></View> : null}
        <View className="mt-auto gap-3 pt-4">
          {id !== 'T' && id !== 'U' ? <PrimaryButton label={definition.primaryAction} onPress={primary} /> : null}
          {definition.secondaryAction && id !== 'T' && id !== 'U' ? <SecondaryButton label={definition.secondaryAction} onPress={() => setExpanded(true)} /> : null}
        </View>
      </View>
    </ScrollView>
  );
}
