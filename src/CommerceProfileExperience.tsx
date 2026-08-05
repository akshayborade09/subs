import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUniwind } from 'uniwind';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { Icon } from 'phosphor-react-native';
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
import { themePalette, useAccentColor } from './themeColors';

type Route = 'checkout' | 'coupon' | 'profile' | 'edit_profile' | 'addresses' | 'transactions' | 'settings' | 'notifications' | 'permissions' | 'referral' | 'loyalty' | 'leaderboard' | 'reward' | 'redeem';

const stateRoute: Partial<Record<LifecycleStateId, Route>> = {
  V: 'checkout', W: 'coupon', X: 'checkout', AB: 'profile', AC: 'edit_profile', AD: 'addresses', AE: 'transactions', AF: 'settings', AG: 'notifications', AH: 'permissions', AI: 'referral', AJ: 'loyalty', AK: 'leaderboard', AL: 'reward', AM: 'redeem',
};

function Glyph({ icon: GlyphIcon, color, tone }: { icon: Icon; color?: string; tone?: 'accent' | 'success' | 'foreground' }) {
  const { theme } = useUniwind();
  const palette = themePalette[theme === 'dark' ? 'dark' : 'light'];
  const resolved = color ?? (tone === 'success' ? palette.success : tone === 'accent' ? palette.accent : (theme === 'dark' ? '#ffffff' : '#101010'));
  return <GlyphIcon size={18} weight="bold" color={resolved} />;
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const [width, setWidth] = useState(0);
  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} className={`min-h-14 w-full items-center justify-center overflow-hidden rounded-xl ${disabled ? 'opacity-40' : ''}`}>
    {width > 0 ? <Svg width={width} height="100%" pointerEvents="none" style={StyleSheet.absoluteFill}><Defs><LinearGradient id="commercePrimary" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={dark ? '#FFFFFF' : '#4D4D4D'} /><Stop offset="1" stopColor={dark ? '#888888' : '#000000'} /></LinearGradient></Defs><Rect width={width} height="100%" fill="url(#commercePrimary)" /></Svg> : null}
    <Text className={`z-10 px-4 py-4 text-center font-bold text-base ${dark ? 'text-black' : 'text-white'}`}>{label}</Text>
  </Pressable>;
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} className="min-h-14 w-full items-center justify-center rounded-xl border border-border px-4"><Text className="py-4 text-center font-semibold text-base text-foreground">{label}</Text></Pressable>;
}

function Header({ title, description, onBack, eyebrow }: { title: string; description?: string; onBack: () => void; eyebrow?: string }) {
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} className="mb-6 h-10 w-10 items-center justify-center rounded-full border border-border"><Glyph icon={CaretLeftIcon} /></Pressable>
    {eyebrow ? <Text className="mb-2 font-medium text-sm uppercase tracking-[0.4px] text-accent">{eyebrow}</Text> : null}
    <Text className="font-semibold text-[24px] leading-8 tracking-[-0.5px] text-foreground">{title}</Text>
    {description ? <Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{description}</Text> : null}
  </View>;
}

function Section({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return <View className="mt-7">{title ? <View className="mb-3 flex-row items-center justify-between gap-3"><Text className="font-semibold text-lg text-foreground">{title}</Text>{right}</View> : null}{children}</View>;
}

type SurfaceTone = 'default' | 'success' | 'warning' | 'danger' | 'purple';

function surfaceToneClass(tone: SurfaceTone) {
  return tone === 'success' ? 'bg-success-soft' : tone === 'warning' ? 'bg-yellow-100 dark:bg-yellow-950' : tone === 'danger' ? 'bg-red-100 dark:bg-red-950' : tone === 'purple' ? 'bg-purple-100 dark:bg-purple-950' : 'border border-border bg-canvas';
}

function Card({ children, tone = 'default' }: { children: ReactNode; tone?: SurfaceTone }) {
  return <View className={`overflow-hidden rounded-xl p-4 ${surfaceToneClass(tone)}`}>{children}</View>;
}

function ListContainer({ children, tone = 'default' }: { children: ReactNode; tone?: SurfaceTone }) {
  return <View className={`overflow-hidden rounded-xl ${surfaceToneClass(tone)}`}>{children}</View>;
}

function IconText({ icon, title, description, color, tone, trailing, titleClassName = 'font-semibold text-base text-foreground' }: { icon: Icon; title: string; description?: string; color?: string; tone?: 'accent' | 'success' | 'foreground'; trailing?: ReactNode; titleClassName?: string }) {
  return <View className="flex-row items-start gap-2"><View className="h-6 w-6 items-center justify-center"><Glyph icon={icon} color={color} tone={tone} /></View><View className="flex-1"><Text className={`${titleClassName} leading-6`}>{title}</Text>{description ? <Text className="mt-1 font-sans text-sm leading-5 text-muted">{description}</Text> : null}</View>{trailing ? <View className="h-6 items-center justify-center">{trailing}</View> : null}</View>;
}

function ListMetaRow({ label, value, valueTone, showDivider = true }: { label: string; value: string; valueTone?: string; showDivider?: boolean }) {
  return <View className={`flex-row items-start justify-between gap-5 px-4 py-3 ${showDivider ? 'border-b border-border' : ''}`}><Text className="flex-1 font-sans text-[15px] leading-6 text-muted">{label}</Text><Text className={`max-w-[58%] text-right font-semibold text-[15px] leading-6 ${valueTone ?? 'text-foreground'}`}>{value}</Text></View>;
}

function MetaRow({ label, value, valueTone }: { label: string; value: string; valueTone?: string }) {
  return <View className="flex-row items-start justify-between gap-5 py-2"><Text className="flex-1 font-sans text-[15px] leading-6 text-muted">{label}</Text><Text className={`max-w-[58%] text-right font-semibold text-[15px] leading-6 ${valueTone ?? 'text-foreground'}`}>{value}</Text></View>;
}

function MenuRow({ icon, title, detail, onPress, danger = false, showDivider = true }: { icon: Icon; title: string; detail?: string; onPress: () => void; danger?: boolean; showDivider?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} className={`px-4 py-4 ${showDivider ? 'border-b border-border' : ''}`}><IconText icon={icon} title={title} description={detail} color={danger ? '#dc2626' : undefined} titleClassName={`font-semibold text-base ${danger ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`} trailing={<Glyph icon={CaretRightIcon} color="#8b8b8b" />} /></Pressable>;
}

function GreenButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} className="min-h-14 items-center justify-center rounded-xl bg-accent px-5"><Text className="font-bold text-base text-accent-foreground">{label}</Text></Pressable>;
}

function ToggleRow({ title, description, value, onChange, locked = false, showDivider = true }: { title: string; description?: string; value: boolean; onChange: (value: boolean) => void; locked?: boolean; showDivider?: boolean }) {
  const accent = useAccentColor();
  return <View className={`flex-row items-center gap-4 px-4 py-3 ${showDivider ? 'border-b border-border' : ''}`}><View className="flex-1"><Text className="font-semibold text-base text-foreground">{title}</Text>{description ? <Text className="mt-1 font-sans text-sm leading-5 text-muted">{description}</Text> : null}</View><Switch value={value} disabled={locked} onValueChange={onChange} trackColor={{ false: '#8b8b8b', true: accent }} /></View>;
}

function ActionChip({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} className={`rounded-lg px-3 py-2 ${danger ? 'bg-red-100 dark:bg-red-950' : 'bg-accent-soft'}`}><Text className={`font-semibold text-sm ${danger ? 'text-red-700 dark:text-red-300' : 'text-accent'}`}>{label}</Text></Pressable>;
}

const priceBefore = 2799;
const discountValue = 300;

function CheckoutPage({ onBack, go, onPayment, couponApplied, setCouponApplied }: { onBack: () => void; go: (route: Route) => void; onPayment: () => void; couponApplied: boolean; setCouponApplied: (value: boolean) => void }) {
  const total = priceBefore - (couponApplied ? discountValue : 0);
  return <>
    <Header onBack={onBack} title="Review your subscription" description="Confirm your plan, meals, delivery and payment before subscribing." />
    <Section title="Plan"><Card><Text className="font-semibold text-lg text-foreground">Monthly</Text><Text className="mt-1 font-sans text-sm text-muted">4 weeks · 40 meals</Text><View className="my-3 h-px bg-border" /><MetaRow label="Meals" value="Lunch & dinner" /><MetaRow label="Starts" value="26 July 2026" /><View className="my-3 h-px bg-border" /><View className="mb-1 flex-row items-center justify-between"><Text className="font-semibold text-base text-foreground">Current preferences</Text><Pressable accessibilityRole="button" className="h-9 w-9 items-center justify-center"><Glyph icon={PencilSimpleIcon} tone="accent" /></Pressable></View><MetaRow label="Food" value="Mix of both" /><MetaRow label="Bread" value="Chapati" /><MetaRow label="Rice" value="Jeera rice" /></Card></Section>
    <Section title="Delivery address" right={<Pressable accessibilityRole="button" onPress={() => go('addresses')}><Text className="font-semibold text-sm text-accent">Edit</Text></Pressable>}><Card><IconText icon={MapPinIcon} tone="accent" title="Home · B-704, Green View Apartments, Baner Road, Pune 411045" titleClassName="font-sans text-[15px] text-foreground" /></Card></Section>
    <Section title="Coupon and rewards"><Pressable accessibilityRole="button" onPress={() => go('coupon')}><Card tone={couponApplied ? 'success' : 'default'}><IconText icon={TagIcon} tone="accent" title={couponApplied ? 'HEALTHY300 applied' : 'Apply coupon'} description={couponApplied ? 'You save ₹300 on this subscription.' : 'View eligible offers and rewards.'} trailing={<Text className="font-semibold text-sm text-accent">{couponApplied ? 'Change' : 'View'}</Text>} /></Card></Pressable>{couponApplied ? <Pressable onPress={() => setCouponApplied(false)} className="mt-2 self-end"><Text className="font-medium text-sm text-red-600 dark:text-red-400">Remove coupon</Text></Pressable> : null}</Section>
    <Section title="Price breakdown"><ListContainer><ListMetaRow label="Plan price" value="₹2,799" /><ListMetaRow label="Delivery charges" value="Included" /><ListMetaRow label="Taxes" value="Included" />{couponApplied ? <ListMetaRow label="Coupon discount" value="− ₹300" valueTone="text-accent" /> : null}<ListMetaRow label="Total payable" value={`₹${total.toLocaleString('en-IN')}`} showDivider={false} /></ListContainer></Section>
    <Section title="Payment method"><Pressable accessibilityRole="button"><Card><IconText icon={CreditCardIcon} title="UPI" description="Pay using any UPI app" trailing={<Text className="font-semibold text-sm text-accent">Change</Text>} /></Card></Pressable></Section>
    <Text className="mt-6 font-sans text-xs leading-5 text-muted">By continuing, you agree to the subscription, cancellation and refund terms.</Text>
    <View className="mt-5"><PrimaryButton label={`Subscribe · Pay ₹${total.toLocaleString('en-IN')}`} onPress={onPayment} /></View>
  </>;
}

function CouponPage({ onBack, apply }: { onBack: () => void; apply: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const submit = () => { if (code.trim().toUpperCase() === 'HEALTHY300') apply(); else setError('This coupon does not exist or is not eligible for this plan.'); };
  return <><Header onBack={onBack} title="Apply coupon" description="Choose an eligible offer or enter a coupon code." /><View className="mt-6 flex-row gap-2"><TextInput value={code} onChangeText={(value) => { setCode(value.toUpperCase()); setError(''); }} placeholder="Enter coupon code" placeholderTextColor="#8b8b8b" autoCapitalize="characters" style={{ paddingVertical: 0, textAlignVertical: "center" }} className="h-14 flex-1 rounded-xl bg-field px-4 font-semibold text-lg text-foreground" /><Pressable accessibilityRole="button" onPress={submit} className="h-14 items-center justify-center rounded-xl bg-foreground px-5"><Text className="font-bold text-canvas">Apply</Text></Pressable></View>{error ? <Text className="mt-2 font-sans text-sm text-red-600 dark:text-red-400">{error}</Text> : null}<Section title="Available for you"><View className="gap-3">{[{ code: 'HEALTHY300', title: 'Save ₹300', detail: 'Valid on your first monthly subscription.' }, { code: 'WELCOME10', title: 'Save 10%', detail: 'Up to ₹200 on eligible weekly plans.' }].map((coupon) => <Card key={coupon.code}><View className="flex-row items-center gap-3"><View className="w-6 items-center justify-center"><Glyph icon={TagIcon} tone="accent" /></View><View className="flex-1"><Text className="font-semibold text-lg text-foreground">{coupon.title}</Text><Text className="mt-1 font-sans text-sm leading-5 text-muted">{coupon.detail}</Text><Text className="mt-2 font-bold text-sm text-foreground">{coupon.code}</Text></View><Pressable accessibilityRole="button" onPress={() => { if (coupon.code === 'HEALTHY300') apply(); else { setCode(coupon.code); setError('This coupon is valid only on weekly plans.'); } }}><Text className="font-semibold text-sm text-accent">Apply</Text></Pressable></View></Card>)}</View></Section></>;
}

const profileMenu: { icon: Icon; title: string; detail?: string; route: Route }[] = [
  { icon: WalletIcon, title: 'My plan', detail: 'Monthly · Active', route: 'checkout' },
  { icon: GiftIcon, title: 'Loyalty & rewards', detail: '18 of 28 days completed', route: 'loyalty' },
  { icon: MapPinIcon, title: 'Saved addresses', detail: '2 addresses', route: 'addresses' },
  { icon: ReceiptIcon, title: 'Transactions', route: 'transactions' },
  { icon: ShareNetworkIcon, title: 'Refer & earn', route: 'referral' },
  { icon: BellIcon, title: 'Notifications', route: 'notifications' },
  { icon: GearIcon, title: 'Settings', route: 'settings' },
];

function ProfilePage({ onBack, go }: { onBack: () => void; go: (route: Route) => void }) {
  return <><Header onBack={onBack} eyebrow="ACTIVE SUBSCRIPTION" title="Profile" /><View className="mt-6 flex-row items-center gap-4"><View className="h-16 w-16 items-center justify-center rounded-full bg-icon-surface"><Text className="font-bold text-xl text-foreground">AB</Text></View><View className="flex-1"><Text className="font-semibold text-xl text-foreground">Akshay Borade</Text><Text className="mt-1 font-sans text-sm text-muted">+91 ••••••9919</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => go('edit_profile')} className="h-10 w-10 items-center justify-center"><Glyph icon={PencilSimpleIcon} /></Pressable></View><Section><ListContainer>{profileMenu.map((item, index) => <MenuRow key={item.title} {...item} showDivider={index < profileMenu.length - 1} onPress={() => go(item.route)} />)}</ListContainer></Section><Text className="mt-7 text-center font-sans text-xs text-muted">Healthy Tiffins · Version 1.0.0</Text></>;
}

function EditProfilePage({ onBack, toast }: { onBack: () => void; toast: (message: string) => void }) {
  const [name, setName] = useState('Akshay Borade'); const [gender, setGender] = useState('Man');
  return <><Header onBack={onBack} title="Personal information" description="Keep your profile details accurate for a more personalised experience." /><Section title="Full name"><TextInput value={name} onChangeText={setName} style={{ paddingVertical: 0, textAlignVertical: "center" }} className="h-14 rounded-xl bg-field px-4 font-semibold text-lg text-foreground" /></Section><Section title="Date of birth"><Pressable className="h-14 justify-center rounded-xl bg-field px-4"><Text className="font-semibold text-lg text-foreground">18 Jul 1992</Text></Pressable></Section><Section title="Gender"><View className="flex-row gap-2">{['Woman','Man','Non-binary'].map((item) => <Pressable key={item} onPress={() => setGender(item)} className={`min-h-14 flex-1 items-center justify-center rounded-xl border px-2 ${gender === item ? 'border-[3px] border-accent bg-accent-soft' : 'border-field bg-field'}`}><Text numberOfLines={1} adjustsFontSizeToFit className="font-semibold text-sm text-foreground">{item}</Text></Pressable>)}</View></Section><Section title="WhatsApp number"><View className="h-14 flex-row items-center justify-between rounded-xl bg-field px-4"><Text className="font-semibold text-lg text-foreground">+91 ••••••9919</Text><View className="rounded-full bg-success-soft px-3 py-1.5"><Text className="font-semibold text-xs text-accent">Verified</Text></View></View></Section><View className="mt-auto pt-6"><PrimaryButton label="Save changes" onPress={() => { toast('Profile updated'); onBack(); }} /></View></>;
}

function AddressesPage({ onBack, toast }: { onBack: () => void; toast: (message: string) => void }) {
  const [addresses, setAddresses] = useState([{ label: 'Home', text: 'B-704, Green View Apartments, Baner Road, Pune 411045', primary: true }, { label: 'Office', text: 'Tech Park One, Yerawada, Pune 411006', primary: false }]);
  const add = () => { setAddresses((items) => [...items, { label: 'Other', text: 'New serviceable address, Pune 411007', primary: false }]); toast('Address added'); };
  return <><Header onBack={onBack} title="Saved addresses" description="Manage delivery locations and choose your default address." /><Section><View className="gap-3">{addresses.map((address, index) => <Card key={`${address.label}-${index}`}><IconText icon={MapPinIcon} tone="accent" title={address.label} description={address.text} titleClassName="font-semibold text-lg text-foreground" trailing={address.primary ? <View className="rounded-full bg-accent-soft px-2 py-1"><Text className="font-semibold text-[10px] text-accent">DEFAULT</Text></View> : undefined} /><View className="ml-8 mt-4 flex-row flex-wrap gap-2"><ActionChip label="Edit" onPress={() => toast('Address editing opened')} />{!address.primary ? <ActionChip label="Set as default" onPress={() => { setAddresses((items) => items.map((item, i) => ({ ...item, primary: i === index }))); toast('Default address updated'); }} /> : null}{!address.primary ? <ActionChip label="Delete" danger onPress={() => setAddresses((items) => items.filter((_, i) => i !== index))} /> : null}</View></Card>)}</View></Section><View className="mt-6"><PrimaryButton label="Add address" onPress={add} /></View></>;
}

function TransactionsPage({ onBack }: { onBack: () => void }) {
  const transactions = [{ title: 'Monthly subscription', date: '22 Jul 2026 · 10:42 AM', amount: '₹2,499', status: 'Succeeded' }, { title: 'Healthy Streak reward', date: '01 Jul 2026 · 9:10 AM', amount: 'Free meal day', status: 'Credited' }, { title: 'Three-day trial', date: '21 Jun 2026 · 4:18 PM', amount: '₹899', status: 'Succeeded' }];
  return <><Header onBack={onBack} title="Transactions" description="Payments, refunds, credits and rewards in one place." /><View className="mt-6 flex-row gap-2">{['All','Payments','Rewards'].map((item, index) => <View key={item} className={`rounded-full px-4 py-2 ${index === 0 ? 'bg-accent' : 'bg-field'}`}><Text className={`font-semibold text-sm ${index === 0 ? 'text-white dark:text-black' : 'text-foreground'}`}>{item}</Text></View>)}</View><Section title="July 2026"><ListContainer>{transactions.map((item, index) => <Pressable key={item.title} className={`px-4 py-3 ${index < transactions.length - 1 ? 'border-b border-border' : ''}`}><IconText icon={ReceiptIcon} title={item.title} description={`${item.date} · ${item.status}`} trailing={<Text className="text-right font-semibold text-sm leading-6 text-foreground">{item.amount}</Text>} /></Pressable>)}</ListContainer></Section></>;
}

function SettingsPage({ onBack, go, toast }: { onBack: () => void; go: (route: Route) => void; toast: (message: string) => void }) {
  return <><Header onBack={onBack} title="Settings" description="Manage your account, app preferences, privacy and support." /><Section title="Account"><ListContainer><MenuRow icon={UserIcon} title="Personal information" onPress={() => go('edit_profile')} /><MenuRow icon={ShieldCheckIcon} title="Privacy and data" onPress={() => toast('Privacy and data opened')} /><MenuRow icon={MapPinIcon} title="Saved addresses" showDivider={false} onPress={() => go('addresses')} /></ListContainer></Section><Section title="App"><ListContainer><MenuRow icon={BellIcon} title="Notifications" onPress={() => go('notifications')} /><MenuRow icon={ShieldCheckIcon} title="App permissions" onPress={() => go('permissions')} /><MenuRow icon={GearIcon} title="Appearance" detail="System" showDivider={false} onPress={() => toast('Appearance follows the device')} /></ListContainer></Section><Section title="Support and legal"><ListContainer><MenuRow icon={ReceiptIcon} title="Help and support" onPress={() => toast('Support opened')} /><MenuRow icon={ShieldCheckIcon} title="Terms, cancellation and privacy" showDivider={false} onPress={() => toast('Legal information opened')} /></ListContainer></Section><Section><ListContainer><MenuRow icon={SignOutIcon} title="Log out" danger showDivider={false} onPress={() => toast('Logged out locally')} /></ListContainer></Section></>;
}

function NotificationsPage({ onBack, toast }: { onBack: () => void; toast: (message: string) => void }) {
  const [values, setValues] = useState({ delivery: true, payment: true, reminders: true, nutrition: true, rewards: true, offers: false });
  const update = (key: keyof typeof values, value: boolean) => setValues((state) => ({ ...state, [key]: value }));
  return <><Header onBack={onBack} title="Notifications" description="Choose which updates you receive. Essential service messages remain enabled." /><Section title="Operational"><ListContainer><ToggleRow title="Delivery and meal status" description="Required while you have active deliveries." value={values.delivery} onChange={() => {}} locked /><ToggleRow title="Payment and account security" description="Required for payment and account protection." value={values.payment} onChange={() => {}} locked showDivider={false} /></ListContainer></Section><Section title="Personalised"><ListContainer><ToggleRow title="Meal reminders" value={values.reminders} onChange={(value) => update('reminders', value)} /><ToggleRow title="Nutrition insights" value={values.nutrition} onChange={(value) => update('nutrition', value)} /><ToggleRow title="Rewards and leaderboard" value={values.rewards} onChange={(value) => update('rewards', value)} /><ToggleRow title="Offers and promotions" value={values.offers} onChange={(value) => update('offers', value)} showDivider={false} /></ListContainer></Section><View className="mt-6"><PrimaryButton label="Save preferences" onPress={() => { toast('Notification preferences saved'); onBack(); }} /></View></>;
}

function PermissionsPage({ onBack, toast }: { onBack: () => void; toast: (message: string) => void }) {
  return <><Header onBack={onBack} title="App permissions" description="Review access used to improve delivery and account updates." /><Section><ListContainer><MenuRow icon={MapPinIcon} title="Location" detail="Allowed · Used to find and validate addresses" onPress={() => toast('Opening system location settings')} /><MenuRow icon={BellIcon} title="Notifications" detail="Allowed · Used for meal and payment updates" showDivider={false} onPress={() => toast('Opening system notification settings')} /></ListContainer></Section><Text className="mt-5 font-sans text-sm leading-6 text-muted">Permissions are requested only when a feature needs them. Manual address search remains available without location access.</Text></>;
}

function ReferralPage({ onBack, toast }: { onBack: () => void; toast: (message: string) => void }) {
  const steps = ['Friend signs up with your code', 'Friend completes first payment', 'Your account credit is unlocked'];
  return <><Header onBack={onBack} eyebrow="REFER & EARN" title="Share healthy meals" description="Your friend gets a welcome offer. Your reward unlocks after their first successful payment." /><Section><Card tone="success"><Text className="font-medium text-xs text-accent">YOUR CODE</Text><View className="mt-2 flex-row items-center justify-between"><Text className="font-bold text-2xl text-foreground">AKSHAY250</Text><Pressable onPress={() => toast('Referral code copied')} className="h-10 w-10 items-center justify-center"><Glyph icon={CopyIcon} /></Pressable></View><View className="mt-3"><GreenButton label="Share invite" onPress={() => toast('Share sheet opened')} /></View></Card></Section><Section title="How it works"><ListContainer>{steps.map((step, index) => <View key={step} className={`flex-row items-start gap-4 px-4 py-3 ${index < steps.length - 1 ? 'border-b border-border' : ''}`}><Text className="w-5 font-sans text-[15px] leading-6 text-muted">{index + 1}</Text><Text className="flex-1 font-semibold text-[15px] leading-6 text-foreground">{step}</Text></View>)}</ListContainer></Section><Section title="Referral history"><ListContainer><ListMetaRow label="A•••••" value="Qualified · Rewarded" /><ListMetaRow label="P•••••" value="Signed up · Pending" showDivider={false} /></ListContainer></Section></>;
}

function ProgressBar({ value }: { value: number }) { return <View className="h-3 overflow-hidden rounded-full bg-field"><View style={{ width: `${Math.min(100, value)}%` }} className="h-full rounded-full bg-accent" /></View>; }

function LoyaltyPage({ onBack, go }: { onBack: () => void; go: (route: Route) => void }) {
  return <><Header onBack={onBack} eyebrow="HEALTHY STREAK" title="Your loyalty progress" description="Complete one continuous paid subscription month to earn one free meal day." /><Section><Card tone="success"><View className="flex-row items-end justify-between"><View><Text className="font-bold text-3xl text-foreground">18 of 28</Text><Text className="mt-1 font-sans text-sm text-muted">active days completed</Text></View><Glyph icon={GiftIcon} tone="success" /></View><View className="mt-5"><ProgressBar value={(18 / 28) * 100} /></View><Text className="mt-3 font-sans text-sm text-muted">Expected reward: 1 August 2026</Text></Card></Section><Section title="Your reward"><Card><Text className="font-semibold text-lg text-foreground">One free meal day</Text><Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Your reward matches your active plan: one free lunch and dinner day.</Text></Card></Section><Section title="Progress rules"><ListContainer><ListMetaRow label="Required active days" value="28" /><ListMetaRow label="Required fulfilled meal days" value="20" /><ListMetaRow label="Paused days" value="Extend the end date" showDivider={false} /></ListContainer></Section><View className="mt-6 gap-3"><PrimaryButton label="View monthly leaderboard" onPress={() => go('leaderboard')} /><SecondaryButton label="Preview earned reward" onPress={() => go('reward')} /></View></>;
}

function LeaderboardPage({ onBack }: { onBack: () => void; toast: (message: string) => void }) {
  const leaders = [{ rank: 1, name: 'R••••• S.', points: 540 }, { rank: 2, name: 'N••••• P.', points: 495 }, { rank: 3, name: 'M••••• K.', points: 470 }, { rank: 18, name: 'You', points: 285 }];
  return <><Header onBack={onBack} eyebrow="JULY 2026" title="Healthy Streak leaderboard" description="Friendly monthly points and recognition. Your guaranteed free meal does not depend on rank." /><Section><Card tone="purple"><View className="flex-row justify-between"><View><Text className="font-medium text-xs text-purple-700 dark:text-purple-300">YOUR RANK</Text><Text className="mt-2 font-bold text-3xl text-foreground">#18</Text></View><View className="items-end"><Text className="font-medium text-xs text-purple-700 dark:text-purple-300">YOUR POINTS</Text><Text className="mt-2 font-bold text-3xl text-foreground">285</Text></View></View><Text className="mt-4 font-sans text-sm text-muted">9 days until the monthly reset</Text></Card></Section><Section title="This month"><ListContainer>{leaders.map((leader, index) => <View key={leader.rank} className={`flex-row items-center px-4 py-3 ${index < leaders.length - 1 ? 'border-b border-border' : ''} ${leader.name === 'You' ? 'bg-success-soft' : ''}`}><Text className="w-12 font-bold text-base text-foreground">#{leader.rank}</Text><Text className="flex-1 font-semibold text-base text-foreground">{leader.name}</Text><Text className="font-semibold text-sm text-muted">{leader.points} pts</Text></View>)}</ListContainer></Section></>;
}

function RewardPage({ onBack, go }: { onBack: () => void; go: (route: Route) => void }) {
  return <View className="flex-1"><Header onBack={onBack} eyebrow="REWARD EARNED" title="Your free meal day is ready" description="You completed one qualifying paid month. Choose an eligible delivery day within 60 days." /><View className="mt-10 items-center"><View className="h-24 w-24 items-center justify-center rounded-full bg-success-soft"><Glyph icon={GiftIcon} tone="success" /></View></View><Section><Card><MetaRow label="Reward" value="One free lunch & dinner day" /><MetaRow label="Earned" value="22 July 2026" /><MetaRow label="Use by" value="20 September 2026" /><MetaRow label="Value" value="Applied automatically" /></Card></Section><View className="mt-auto pt-6"><PrimaryButton label="Choose free meal day" onPress={() => go('redeem')} /></View></View>;
}

function RedeemPage({ onBack, toast, go }: { onBack: () => void; toast: (message: string) => void; go: (route: Route) => void }) {
  const dates = ['27 Mon','28 Tue','29 Wed','30 Thu','31 Fri']; const [selected, setSelected] = useState(2);
  return <><Header onBack={onBack} title="Choose your free meal day" description="Select an eligible date. Your current meal and address settings will be used." /><Section title="Eligible dates"><View className="flex-row justify-between gap-2">{dates.map((date, index) => <Pressable key={date} onPress={() => setSelected(index)} className={`min-h-16 flex-1 items-center justify-center rounded-xl border ${selected === index ? 'border-[3px] border-accent bg-accent-soft' : 'border-field bg-field'}`}><Text className={`text-center font-semibold text-sm ${selected === index ? 'text-accent' : 'text-foreground'}`}>{date}</Text></Pressable>)}</View></Section><Section title="Reward details"><Card tone="success"><MetaRow label="Meal" value="Lunch & dinner" /><MetaRow label="Food" value="Mix of both" /><MetaRow label="Payable" value="₹0" valueTone="text-accent" /></Card></Section><Section title="Delivery address"><Card><IconText icon={MapPinIcon} tone="accent" title="Home" description="B-704, Green View Apartments, Baner Road, Pune 411045" /></Card></Section><View className="mt-6"><PrimaryButton label="Confirm free meal" onPress={() => { toast(`Free meal scheduled for ${dates[selected]}`); go('loyalty'); }} /></View></>;
}

function Toast({ message }: { message: string }) { return <View className="absolute inset-x-5 bottom-12 z-50 rounded-full bg-[#064e3b] px-5 py-4"><Text className="text-center font-semibold text-sm text-white">{message}</Text></View>; }

export default function CommerceProfileExperience({ stateId, onBack, onTransition }: { stateId: LifecycleStateId; onBack: () => void; onTransition: (id: LifecycleStateId) => void }) {
  const insets = useSafeAreaInsets();
  const initial = stateRoute[stateId] ?? 'profile';
  const [stack, setStack] = useState<Route[]>([initial]);
  const [couponApplied, setCouponApplied] = useState(stateId === 'X');
  const [toastMessage, setToastMessage] = useState('');
  const route = stack[stack.length - 1] ?? initial;
  const go = (next: Route) => setStack((items) => [...items, next]);
  const back = () => setStack((items) => { if (items.length <= 1) { onBack(); return items; } return items.slice(0, -1); });
  const toast = (message: string) => { setToastMessage(message); setTimeout(() => setToastMessage(''), 5000); };
  const page = useMemo(() => {
    if (route === 'checkout') return <CheckoutPage onBack={back} go={go} onPayment={() => onTransition('Y')} couponApplied={couponApplied} setCouponApplied={setCouponApplied} />;
    if (route === 'coupon') return <CouponPage onBack={back} apply={() => { setCouponApplied(true); setStack((items) => [...items.slice(0, -1), 'checkout']); toast('HEALTHY300 applied'); }} />;
    if (route === 'profile') return <ProfilePage onBack={back} go={go} />;
    if (route === 'edit_profile') return <EditProfilePage onBack={back} toast={toast} />;
    if (route === 'addresses') return <AddressesPage onBack={back} toast={toast} />;
    if (route === 'transactions') return <TransactionsPage onBack={back} />;
    if (route === 'settings') return <SettingsPage onBack={back} go={go} toast={toast} />;
    if (route === 'notifications') return <NotificationsPage onBack={back} toast={toast} />;
    if (route === 'permissions') return <PermissionsPage onBack={back} toast={toast} />;
    if (route === 'referral') return <ReferralPage onBack={back} toast={toast} />;
    if (route === 'loyalty') return <LoyaltyPage onBack={back} go={go} />;
    if (route === 'leaderboard') return <LeaderboardPage onBack={back} toast={toast} />;
    if (route === 'reward') return <RewardPage onBack={back} go={go} />;
    return <RedeemPage onBack={back} toast={toast} go={go} />;
  }, [couponApplied, route]);
  return <View className="flex-1 bg-canvas"><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }}><View className="flex-1 px-5">{page}</View></ScrollView>{toastMessage ? <Toast message={toastMessage} /> : null}</View>;
}
