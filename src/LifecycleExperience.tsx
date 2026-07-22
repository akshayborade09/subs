import { useEffect, useRef, useState } from 'react';
import { Animated as NativeAnimated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useUniwind } from 'uniwind';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { CreditCardIcon } from 'phosphor-react-native/src/icons/CreditCard';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { WifiSlashIcon } from 'phosphor-react-native/src/icons/WifiSlash';
import type { Icon } from 'phosphor-react-native';
import type { LifecycleDefinition, LifecycleStateId } from './lifecycleStateMachine';

const nextState: Partial<Record<LifecycleStateId, LifecycleStateId>> = {
  E: 'D', F: 'G', H: 'J', I: 'J', J: 'K', L: 'K', M: 'K', N: 'K', O: 'J', P: 'K', Q: 'K', R: 'K', S: 'K', T: 'U', U: 'F', Y: 'K', Z: 'K', AA: 'Y',
};

function Glyph({ icon: GlyphIcon, color = '#078a4b' }: { icon: Icon; color?: string }) {
  return <GlyphIcon size={20} weight="bold" color={color} />;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const [width, setWidth] = useState(0);
  return <Pressable accessibilityRole="button" onPress={onPress} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} className="h-14 w-full items-center justify-center overflow-hidden rounded-xl">
    {width ? <Svg width={width} height={56} pointerEvents="none" style={StyleSheet.absoluteFill}><Defs><LinearGradient id="lifecyclePrimary" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={dark ? '#FFFFFF' : '#4D4D4D'} /><Stop offset="1" stopColor={dark ? '#888888' : '#000000'} /></LinearGradient></Defs><Rect width={width} height={56} fill="url(#lifecyclePrimary)" /></Svg> : null}
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className={`z-10 px-4 font-bold text-base ${dark ? 'text-black' : 'text-white'}`}>{label}</Text>
  </Pressable>;
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} className="h-14 w-full items-center justify-center rounded-xl border border-border"><Text className="font-semibold text-base text-foreground">{label}</Text></Pressable>;
}

function StatusPill({ text, tone }: { text: string; tone: LifecycleDefinition['tone'] }) {
  const styles = tone === 'success' ? 'bg-success-soft text-accent' : tone === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' : tone === 'danger' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-surface-raised text-muted';
  const [background, ...copy] = styles.split(' ');
  return <View className={`self-start rounded-full px-3 py-2 ${background}`}><Text className={`font-semibold text-xs ${copy.join(' ')}`}>{text}</Text></View>;
}

function MetaRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View className="flex-row items-start justify-between gap-5"><Text className="flex-1 font-sans text-[15px] leading-6 text-muted">{label}</Text><Text className={`${strong ? 'font-bold' : 'font-semibold'} max-w-[58%] text-right text-[15px] leading-6 text-foreground`}>{value}</Text></View>;
}

function TrialDates({ completed = 2 }: { completed?: number }) {
  return <View className="mt-5 flex-row justify-between">{['21', '22', '23', '24', '25'].map((date, index) => <View key={date} className="items-center gap-3"><View className={`h-14 w-12 items-center justify-center rounded-xl ${index === completed ? 'bg-success-soft' : 'bg-surface-raised'}`}><Text className={`font-bold text-lg ${index === completed ? 'text-accent' : 'text-foreground'}`}>{date}</Text><Text className="font-medium text-[10px] text-muted">{['MON','TUE','WED','THU','FRI'][index]}</Text></View><View className={`h-6 w-6 items-center justify-center rounded-full ${index < completed ? 'bg-accent' : 'border-2 border-border'}`}>{index < completed ? <Glyph icon={CheckIcon} color="#ffffff" /> : null}</View></View>)}</View>;
}

function WeekTracker() {
  return <View className="mt-4 flex-row justify-between">{['MON','TUE','WED','THU','FRI','SAT','SUN'].map((day, index) => <View key={day} className="items-center gap-2"><Text className="font-medium text-[10px] text-muted">{day}</Text><View className={`h-9 w-9 items-center justify-center rounded-full ${index < 2 ? 'bg-accent' : index === 2 ? 'border-2 border-accent bg-success-soft' : 'bg-surface-raised'}`}>{index < 2 ? <Glyph icon={CheckIcon} color="#ffffff" /> : <Text className={`font-semibold text-xs ${index === 2 ? 'text-accent' : 'text-foreground'}`}>{21 + index}</Text>}</View></View>)}</View>;
}

function PaymentRecovery({ definition, confirmed = false }: { definition: LifecycleDefinition; confirmed?: boolean }) {
  const subscription = definition.id === 'Y' || definition.id === 'Z' || definition.id === 'AA';
  const failed = definition.id === 'E' || definition.id === 'AA';
  const rotation = useRef(new NativeAnimated.Value(0)).current;
  useEffect(() => { if (failed || confirmed) return; const animation = NativeAnimated.loop(NativeAnimated.timing(rotation, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })); animation.start(); return () => animation.stop(); }, [confirmed, failed, rotation]);
  const pendingColor = '#d97706';
  const description = confirmed
    ? subscription ? 'Your subscription is active. Your meals and nutrition tools are ready.' : 'Your five-day trial is ready to be scheduled. We are taking you to Home.'
    : failed
      ? subscription ? 'Your plan and preferences are saved. Retry payment safely when you are ready.' : 'No amount has been applied to your trial. Retry safely or choose another payment method.'
      : subscription ? 'Your bank has received the request. Your subscription starts only after payment is confirmed.' : 'Your bank has received the request. Your trial will start only after payment is confirmed.';
  return <><View className="mt-7 rounded-[16px] border border-border bg-sheet p-5"><View className={`h-16 w-16 items-center justify-center rounded-full ${confirmed ? 'bg-accent' : failed ? 'bg-[#FDECEC] dark:bg-[#3A1717]' : 'bg-white'}`}>{!failed && !confirmed ? <NativeAnimated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }], borderColor: pendingColor, borderTopColor: 'transparent' }} className="absolute h-16 w-16 rounded-full border-[3px]" /> : null}{confirmed ? <Glyph icon={CheckIcon} color="#ffffff" /> : <Glyph icon={CreditCardIcon} color={failed ? '#dc2626' : pendingColor} />}</View><Text className="mt-5 font-semibold text-xl text-foreground">{confirmed ? subscription ? 'Your subscription is active' : 'Your payment is confirmed' : failed ? 'Payment could not be completed' : 'We are confirming your payment'}</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{description}</Text><View className="my-5 h-px bg-border" /><View className="gap-3"><MetaRow label="Amount" value={subscription ? '₹2,499' : '₹899'} strong /><MetaRow label="Method" value="UPI" /><MetaRow label="Reference" value={subscription ? 'SUB-260722' : 'TRIAL-260721'} /><MetaRow label="Status" value={confirmed ? 'Confirmed' : failed ? 'Failed' : 'Pending'} /></View></View></>;
}

function TrialState({ id }: { id: LifecycleStateId }) {
  if (id === 'F') return <><View className="mt-7 rounded-[16px] border border-border bg-sheet p-5"><StatusPill text="STARTS SOON" tone="success" /><Text className="mt-4 font-semibold text-xl text-foreground">Your trial starts Monday</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Your first home-style lunch is scheduled for 27 July.</Text><View className="mt-5 gap-3"><MetaRow label="Trial dates" value="27–31 July" /><MetaRow label="Meals" value="Lunch" /><MetaRow label="Address" value="Home · Baner" /></View></View><TrialDates completed={-1} /></>;
  if (id === 'H') return <><TrialDates /><View className="mt-7 rounded-[16px] border border-border bg-sheet p-5"><StatusPill text="SUBSCRIPTION READY" tone="success" /><Text className="mt-4 font-semibold text-xl text-foreground">Your Monthly plan starts next</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Finish your trial first. Your subscription begins automatically on 26 July.</Text><View className="mt-5 gap-3"><MetaRow label="Plan" value="Monthly" /><MetaRow label="Meal" value="Lunch & Dinner" /><MetaRow label="Starts" value="26 July" /></View></View></>;
  return <><View className="mt-7 rounded-[16px] border border-border bg-sheet p-5"><StatusPill text="TRIAL COMPLETE" tone="success" /><Text className="mt-4 font-semibold text-xl text-foreground">Five meals delivered</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Continue the routine with a plan that fits your week.</Text><View className="mt-5 gap-3"><MetaRow label="Delivered" value="5 of 5 meals" /><MetaRow label="Preference" value="Mix of both" /><MetaRow label="Saved address" value="Home · Baner" /></View></View><View className="mt-4 rounded-[16px] bg-surface p-5"><Text className="font-semibold text-lg text-foreground">Your trial nutrition</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Average 710 kcal and 27 g protein per meal.</Text></View></>;
}

function SubscriberState({ id }: { id: LifecycleStateId }) {
  const noMeal = id === 'L';
  const paused = id === 'M';
  const ending = id === 'N';
  const expired = id === 'O';
  const scheduled = id === 'J';
  if (scheduled || paused || expired) return <View className="mt-7 rounded-[16px] border border-border bg-sheet p-5"><StatusPill text={scheduled ? 'STARTS 26 JULY' : paused ? 'PAUSED' : 'PLAN ENDED'} tone={scheduled ? 'success' : 'warning'} /><Text className="mt-4 font-semibold text-xl text-foreground">{scheduled ? 'Your Monthly plan is ready' : paused ? 'Your subscription is paused' : 'Your subscription has ended'}</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{scheduled ? 'Your first subscribed meal is scheduled after the trial.' : paused ? 'Deliveries resume on 2 August. Past meals and nutrition remain available.' : 'Renew to restart everyday meals. Your history and preferences are saved.'}</Text><View className="mt-5 gap-3"><MetaRow label="Plan" value="Monthly" /><MetaRow label={paused ? 'Resume date' : scheduled ? 'Start date' : 'Ended'} value={paused ? '2 August' : scheduled ? '26 July' : '20 July'} /><MetaRow label="Meals" value="Lunch & Dinner" /></View></View>;
  return <><View className="mt-7 rounded-[16px] border border-border bg-sheet p-5"><StatusPill text={ending ? 'ACTIVE UNTIL 20 AUG' : noMeal ? 'NO MEAL TODAY' : 'TODAY'} tone={ending ? 'warning' : 'success'} /><Text className="mt-4 font-semibold text-xl text-foreground">{noMeal ? 'Your next meal is tomorrow' : 'Lunch is being prepared'}</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{noMeal ? 'Dinner · 6:30 PM–8:30 PM · Home' : 'Paneer masala, dal tadka, chapati, jeera rice and salad.'}</Text>{!noMeal ? <View className="mt-5 gap-3"><MetaRow label="Delivery window" value="11:00 AM–1:00 PM" /><MetaRow label="Address" value="Home · Baner" /><MetaRow label="Status" value="Preparing" /></View> : null}</View><View className="mt-6 rounded-[16px] border border-border bg-sheet p-5"><Text className="font-semibold text-lg text-foreground">Next seven days</Text><WeekTracker /></View><View className="mt-4 rounded-[16px] border border-border bg-sheet p-5"><Text className="font-semibold text-lg text-foreground">Weekly nutrition</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">You’re averaging 28 g protein across subscribed meals this week.</Text></View></>;
}

function RecoveryState({ id }: { id: LifecycleStateId }) {
  const config = id === 'P'
    ? { icon: CreditCardIcon, title: 'Renewal payment failed', body: 'Paid meals remain confirmed. Update payment to avoid interruption after 31 July.', color: '#dc2626' }
    : id === 'Q'
      ? { icon: ClockIcon, title: 'Lunch is delayed', body: 'Your delivery is running about 25 minutes late. We’ll keep this status updated.', color: '#a16207' }
      : id === 'R'
        ? { icon: MapPinIcon, title: 'We could not complete delivery', body: 'The delivery partner could not verify the address. Check the saved PIN and location.', color: '#dc2626' }
        : { icon: WifiSlashIcon, title: 'You’re offline', body: 'Showing the latest saved information. Changes are unavailable until you reconnect.', color: '#6b7280' };
  return <><View className="mt-7 rounded-[16px] border border-border bg-sheet p-5"><View className="h-11 w-11 items-center justify-center rounded-full bg-icon-surface"><Glyph icon={config.icon} color={config.color} /></View><Text className="mt-5 font-semibold text-xl text-foreground">{config.title}</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{config.body}</Text>{id !== 'S' ? <View className="mt-5 gap-3"><MetaRow label="Affected meal" value="Lunch · 23 July" /><MetaRow label="Current address" value="Home · Baner" /><MetaRow label="Credit status" value={id === 'R' ? 'Pending review' : 'Not applicable'} /></View> : null}</View>{id !== 'S' ? <View className="mt-4 rounded-[16px] border border-border bg-sheet p-5"><Text className="font-semibold text-lg text-foreground">Upcoming deliveries</Text><WeekTracker /></View> : null}</>;
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
  return <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-canvas" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }}>
    <View className="flex-1 px-5">
      <Pressable accessibilityRole="button" onPress={onBack} className="mb-7 h-10 self-start justify-center rounded-full border border-border px-4"><Text className="font-semibold text-sm text-foreground">All states</Text></Pressable>
      <StatusPill text={`STATE ${id}`} tone={definition.tone} />
      <Text className="mt-4 font-semibold text-[24px] leading-8 tracking-[-0.5px] text-foreground">{definition.title}</Text>
      <Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{definition.summary}</Text>
      {(id === 'D' || id === 'E' || id === 'T' || id === 'U' || id === 'Y' || id === 'Z' || id === 'AA') ? <PaymentRecovery definition={definition} confirmed={paymentConfirmed || id === 'Z'} /> : null}
      {(['F','H','I'] as LifecycleStateId[]).includes(id) ? <TrialState id={id} /> : null}
      {(['J','K','L','M','N','O'] as LifecycleStateId[]).includes(id) ? <SubscriberState id={id} /> : null}
      {(['P','Q','R','S'] as LifecycleStateId[]).includes(id) ? <RecoveryState id={id} /> : null}
      {expanded ? <View className="mt-4 flex-row items-start gap-3 rounded-[16px] bg-success-soft p-4"><Glyph icon={CheckIcon} /><Text className="flex-1 font-sans text-[15px] leading-6 text-foreground">Action completed locally for this preview state.</Text></View> : null}
      <View className="mt-auto gap-3 pt-8">
        {id !== 'T' && id !== 'U' ? <PrimaryButton label={definition.primaryAction} onPress={primary} /> : null}
        {definition.secondaryAction && id !== 'T' && id !== 'U' ? <SecondaryButton label={definition.secondaryAction} onPress={() => setExpanded(true)} /> : null}
      </View>
    </View>
  </ScrollView>;
}
