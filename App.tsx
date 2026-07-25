import './global.css';
import { useEffect, useReducer, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { useFonts } from '@expo-google-fonts/geist/useFonts';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { AbrilFatface_400Regular } from '@expo-google-fonts/abril-fatface/400Regular';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInDown,
  cancelAnimation,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useUniwind } from 'uniwind';
import * as Location from 'expo-location';
import { type Icon, type IconWeight } from 'phosphor-react-native';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import TrialFlow from './src/TrialFlow';
import TrialHome from './src/TrialHome';
import { LifecycleStateSelector } from './src/LifecycleStateSelector';
import LifecycleExperience from './src/LifecycleExperience';
import CommerceProfileExperience from './src/CommerceProfileExperience';
import { getLifecycleDefinition, initialLifecycleMachineState, lifecycleMachineReducer, type LifecycleStateId } from './src/lifecycleStateMachine';

const foodThali = require('./assets/food-thali.png');
const MOCK_OTP = '123456';

// Keep system text-size accessibility without allowing extreme multipliers to
// overflow compact mobile cards, buttons and form controls.
(Text as any).defaultProps = { ...(Text as any).defaultProps, maxFontSizeMultiplier: 1.2 };
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, maxFontSizeMultiplier: 1.2 };

function AppGlyph({ icon: Glyph, size = 20, weight = 'regular', tone = 'foreground' }: { icon: Icon; size?: number; weight?: IconWeight; tone?: 'foreground' | 'success' }) {
  const { theme } = useUniwind();
  const color = tone === 'success' ? (theme === 'dark' ? '#55c986' : '#078a4b') : (theme === 'dark' ? '#ffffff' : '#101010');
  return <Glyph size={Math.max(8, size - 4)} weight="bold" color={color} />;
}

type Story = {
  id: string;
  title: string;
  body: string;
  support?: string[];
  artDirection: string;
};

const stories: Story[] = [
  {
    id: 'home',
    title: 'Everyday meals that feel like home',
    body: 'Freshly prepared Indian meals made with familiar recipes, balanced portions and comforting flavours.',
    artDirection: 'Maharashtrian tiffin · bhakri, rice, vegetable, dal and accompaniment',
  },
  {
    id: 'choice',
    title: 'Your meal, your everyday choices',
    body: 'Choose the meals, bread and rice preferences that work best for your routine.',
    artDirection: 'Editorial meal choices · chapati, bhakri, rice and seasonal dishes',
  },
  {
    id: 'routine',
    title: 'Lunch, dinner or both',
    body: 'Enjoy dependable meals delivered within our fixed everyday delivery windows.',
    artDirection: 'Day and evening tiffins · two moments from one everyday routine',
  },
  {
    id: 'nutrition',
    title: 'Know what goes into every meal',
    body: 'View estimated calories, protein, carbohydrates, fat, fibre and sodium for every dish and complete meal.',
    artDirection: 'Open steel tiffin · paired with a quiet, minimal nutrition card',
  },
  {
    id: 'trial',
    title: 'Start with a simple trial',
    body: 'Try the service, manage upcoming meals and share your feedback before subscribing.',
    artDirection: 'Trial tracker · Day 2 of 5, meal details, nutrition and meal actions',
  },
];

const carouselStories: Story[] = Array.from({ length: 3 }, (_, cycle) =>
  stories.map((story) => ({ ...story, id: `${story.id}-${cycle}` })),
).flat();

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);
  return reduced;
}

function RotatingThali({ size = 164, subtle = false }: { size?: number; subtle?: boolean }) {
  const rotation = useSharedValue(0);
  const float = useSharedValue(0);
  const reduced = useReducedMotionPreference();
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { translateY: float.value }],
  }));

  useEffect(() => {
    if (!reduced) {
      rotation.value = withRepeat(withTiming(360, { duration: 22000, easing: Easing.linear }), -1, false);
      if (subtle) float.value = withRepeat(withSequence(withTiming(-4, { duration: 1100 }), withTiming(3, { duration: 1100 })), -1, true);
    }
    return () => { cancelAnimation(rotation); cancelAnimation(float); };
  }, [float, reduced, rotation, subtle]);

  return (
    <Animated.View style={[style, { width: size, height: size }]}>
      <Image source={foodThali} accessibilityLabel="Traditional Indian tiffin meal" resizeMode="contain" className="h-full w-full" />
    </Animated.View>
  );
}

function ActionButton({ label, onPress, enabled = true, loading = false }: { label: string; onPress: () => void; enabled?: boolean; loading?: boolean }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const scale = useSharedValue(1);
  const [width, setWidth] = useState(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[style, { alignSelf: 'stretch', width: '100%' }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !enabled, busy: loading }}
        disabled={!enabled || loading}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 20, stiffness: 360 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 300 }); }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ alignSelf: 'stretch' }}
        className={`h-14 items-center justify-center overflow-hidden rounded-xl ${enabled ? 'opacity-100' : 'opacity-40'}`}
      >
        {width > 0 ? <Svg pointerEvents="none" width={width} height={56} preserveAspectRatio="none" style={StyleSheet.absoluteFill}><Defs><LinearGradient id="actionButtonGradient" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={dark ? '#FFFFFF' : '#4D4D4D'} /><Stop offset="1" stopColor={dark ? '#888888' : '#000000'} /></LinearGradient></Defs><Rect width={width} height={56} fill="url(#actionButtonGradient)" /></Svg> : null}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76} style={{ zIndex: 1, paddingHorizontal: 16 }} className={`w-full text-center font-bold text-base ${dark ? 'text-black' : 'text-white'}`}>{loading ? 'Please wait…' : label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function LoadingDots() {
  return (
    <View accessibilityLabel="Loading" className="mt-8 flex-row gap-2">
      {[0, 1, 2].map((index) => <LoadingDot key={index} index={index} />)}
    </View>
  );
}

function LoadingDot({ index }: { index: number }) {
  const opacity = useSharedValue(0.3);
  const reduced = useReducedMotionPreference();
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => {
    if (!reduced) opacity.value = withDelay(index * 180, withRepeat(withSequence(withTiming(1, { duration: 420 }), withTiming(0.3, { duration: 420 })), -1, false));
    return () => cancelAnimation(opacity);
  }, [index, opacity, reduced]);
  return <Animated.View style={style} className="h-2 w-2 rounded-full bg-accent-foreground light:bg-white" />;
}

function SplashScreen() {
  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(250)} className="flex-1 items-center justify-center bg-accent px-8">
      <Animated.View entering={FadeInUp.delay(80).springify().damping(19)} className="h-44 w-44 items-center justify-center">
        <RotatingThali subtle />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(220).duration(450)} className="mt-7 items-center">
        <Text numberOfLines={1} allowFontScaling={false} className="font-bold text-center text-[38px] leading-[54px] text-accent-foreground light:text-white">Healthy Tiffins</Text>
        <Text className="mt-2 max-w-[290px] font-medium text-center text-sm leading-5 text-accent-foreground/75 light:text-white/75">Wholesome meals, made for everyday life.</Text>
        <LoadingDots />
      </Animated.View>
    </Animated.View>
  );
}

function PlaceholderArt({ item, index }: { item: Story; index: number }) {
  return (
    <View className="flex-1 overflow-hidden rounded-[16px] bg-surface p-3">
      <View className="flex-1 items-center justify-center rounded-xl bg-surface-raised">
        <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-accent/10">
          <Text className="font-semibold text-2xl text-accent">0{index + 1}</Text>
        </View>
        <Text className="font-semibold text-[11px] tracking-[1.5px] text-muted">PLACEHOLDER ARTWORK</Text>
        <Text className="mt-3 max-w-[275px] px-3 font-sans text-center text-[15px] leading-6 text-muted">{item.artDirection}</Text>
      </View>
    </View>
  );
}

function StoryProgress({ activeIndex }: { activeIndex: number }) {
  return (
    <View accessibilityLabel={`Story ${activeIndex + 1} of ${stories.length}`} className="flex-row gap-1.5">
      {stories.map((story, index) => (
        <View key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-border">
          <Animated.View entering={index <= activeIndex ? FadeIn.duration(300) : undefined} className={`h-full rounded-full ${index <= activeIndex ? 'w-full bg-accent' : 'w-0'}`} />
        </View>
      ))}
    </View>
  );
}

function OnboardingScreen({ onComplete, sheetOpen = false }: { onComplete: () => void; sheetOpen?: boolean }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Story>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [physicalPage, setPhysicalPage] = useState(stories.length);
  const goTo = (index: number) => {
    listRef.current?.scrollToOffset({ offset: index * width, animated: true });
    setActiveIndex((index + stories.length) % stories.length);
    setPhysicalPage(index);
  };

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: stories.length * width, animated: false }));
  }, [width]);

  useEffect(() => {
    if (sheetOpen) {
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: physicalPage * width, animated: false }));
    }
  }, [physicalPage, sheetOpen, width]);

  useEffect(() => {
    if (sheetOpen) return;
    const timer = setTimeout(() => goTo(physicalPage + 1), 5000);
    return () => clearTimeout(timer);
  }, [physicalPage, sheetOpen, width]);

  return (
    <Animated.View entering={FadeIn.duration(300)} className="flex-1 bg-canvas">
      <View style={{ paddingTop: insets.top + 10 }} className="absolute inset-x-0 top-0 z-10 px-5">
        <StoryProgress activeIndex={activeIndex} />
      </View>
      <FlatList
        ref={listRef}
        data={carouselStories}
        initialScrollIndex={stories.length}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(event) => {
          const page = Math.round(event.nativeEvent.contentOffset.x / width);
          if (page >= stories.length * 2) {
            listRef.current?.scrollToOffset({ offset: stories.length * width, animated: false });
            setActiveIndex(0);
            setPhysicalPage(stories.length);
          } else if (page < stories.length) {
            const matchingMiddlePage = page + stories.length;
            listRef.current?.scrollToOffset({ offset: matchingMiddlePage * width, animated: false });
            setActiveIndex(page % stories.length);
            setPhysicalPage(matchingMiddlePage);
          } else {
            setActiveIndex(page % stories.length);
            setPhysicalPage(page);
          }
        }}
        renderItem={({ item, index }) => {
          const storyIndex = index % stories.length;
          const isActive = index === physicalPage;
          return (
          <View style={{ width, paddingTop: insets.top + 36, paddingBottom: insets.bottom + 92 }} className="flex-1 px-5">
            <View style={{ height: Math.max(300, Math.min(height * 0.51, 455)) }}>
              <PlaceholderArt item={item} index={storyIndex} />
              <View className="absolute inset-y-0 left-0 w-1/2">
                <Pressable accessibilityRole="button" accessibilityLabel="Previous story" className="h-full" onPress={() => goTo(physicalPage - 1)} />
              </View>
              <View className="absolute inset-y-0 right-0 w-1/2">
                <Pressable accessibilityRole="button" accessibilityLabel="Next story" className="h-full" onPress={() => goTo(physicalPage + 1)} />
              </View>
            </View>
            <View className="flex-1 justify-end px-1 pb-2 pt-6">
              <Animated.Text key={`title-${item.id}-${physicalPage}`} entering={isActive ? FadeInDown.delay(200).duration(360) : undefined} className="font-semibold text-[24px] leading-8 tracking-[-0.5px] text-foreground">{item.title}</Animated.Text>
              <Animated.View key={`body-${item.id}-${physicalPage}`} entering={isActive ? FadeInDown.delay(400).duration(360) : undefined}>
                <Text className="mt-3 font-sans text-[15px] leading-[22px] text-muted">{item.body}</Text>
                {item.support ? <View className="mt-3 gap-1">{item.support.map((line) => <Text key={line} className="font-medium text-sm text-foreground">{line}</Text>)}</View> : null}
              </Animated.View>
            </View>
          </View>
          );
        }}
      />
      <View style={{ paddingBottom: insets.bottom + 14 }} className="absolute inset-x-0 bottom-0 bg-canvas px-6 pt-3">
        <ActionButton label="Get started" onPress={onComplete} />
      </View>
    </Animated.View>
  );
}

type SheetStep = 'phone' | 'otp';

function normalizeIndianPhone(value: string, previous = '') {
  const numeric = value.replace(/\D/g, '');
  if (previous.length === 10 && numeric.length > 10) return previous;
  const withoutCountryCode = numeric.length >= 12 && numeric.startsWith('91') ? numeric.slice(2) : numeric;
  return withoutCountryCode.slice(0, 10);
}

function PhoneForm({ phone, setPhone, onContinue, onFocusChange }: { phone: string; setPhone: (value: string) => void; onContinue: () => void; onFocusChange: (focused: boolean) => void }) {
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const phoneInputRef = useRef<TextInput>(null);
  useEffect(() => {
    const timer = setTimeout(() => phoneInputRef.current?.focus(), 360);
    return () => clearTimeout(timer);
  }, []);
  const digits = normalizeIndianPhone(phone);
  const valid = /^[6-9]\d{9}$/.test(digits);
  const showError = touched && !valid;
  return (
    <>
      <Animated.Text entering={FadeInUp.delay(30).duration(260)} className="font-semibold text-[28px] leading-[34px] tracking-[-0.5px] text-foreground">Create your account</Animated.Text>
      <Animated.Text entering={FadeInUp.delay(100).duration(260)} className="mt-2 font-sans text-sm leading-5 text-muted">Use your WhatsApp number to securely continue.</Animated.Text>
      <Animated.View entering={FadeInUp.delay(170).duration(280)} className="mt-6 gap-2">
        <View className={`h-14 flex-row items-center rounded-xl border px-[14px] ${showError ? 'border-red-500 bg-surface dark:bg-field' : focused ? 'border-accent bg-white dark:bg-field' : 'border-surface bg-surface dark:border-field dark:bg-field'}`}>
          <Text className={`font-semibold text-lg leading-6 ${focused ? 'text-black dark:text-foreground' : 'text-foreground'}`}>+91</Text>
          <View className="mx-3 h-6 w-px bg-border" />
          <TextInput
            ref={phoneInputRef}
            autoFocus
            accessibilityLabel="Indian mobile number"
            value={digits}
            onChangeText={(value) => setPhone(normalizeIndianPhone(value, digits))}
            onFocus={() => { setFocused(true); onFocusChange(true); }}
            onBlur={() => { setFocused(false); setTouched(true); onFocusChange(false); }}
            placeholder="10-digit mobile number"
            placeholderTextColor="#8b8a84"
            keyboardType="phone-pad"
            inputMode="numeric"
            textContentType="telephoneNumber"
            autoComplete="tel"
            maxLength={18}
            returnKeyType="done"
            onSubmitEditing={() => { setTouched(true); if (valid) onContinue(); }}
            textAlignVertical="center"
            className={`h-14 flex-1 p-0 font-sans text-lg font-semibold leading-6 outline-none ${focused ? 'text-black dark:text-foreground' : 'text-foreground'}`}
          />
        </View>
        {showError ? <Text accessibilityRole="alert" className="px-1 font-sans text-xs text-red-500">Enter 10 digits starting with 6, 7, 8 or 9.</Text> : null}
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(250).duration(280)} className="mt-6"><ActionButton label="Continue with WhatsApp" enabled={valid} onPress={() => { setTouched(true); onContinue(); }} /></Animated.View>
      <Animated.Text entering={FadeInUp.delay(320).duration(280)} className="mt-5 px-1 font-sans text-center text-[13px] leading-5 text-muted">We’ll use this number for OTP verification, trial confirmations and important meal updates.</Animated.Text>
    </>
  );
}

function OtpForm({ phone, onBack, onVerified }: { phone: string; onBack: () => void; onVerified: () => void }) {
  const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [status, setStatus] = useState<'idle' | 'loading' | 'invalid' | 'expired'>('idle');
  const inputRef = useRef<TextInput>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  useEffect(() => {
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 180);
    return () => clearTimeout(focusTimer);
  }, []);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);
  const masked = `+91 ••••••${phone.slice(-4)}`;
  const verify = () => {
    if (otp.length !== 6) return;
    setStatus('loading');
    setTimeout(() => {
      setStatus('idle');
      onVerified();
    }, 650);
  };
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to phone number" hitSlop={10} onPress={onBack} className="mb-4 h-8 w-8 items-center justify-center rounded-full bg-icon-surface"><AppGlyph icon={CaretLeftIcon} size={20} weight="bold" /></Pressable>
      <Animated.Text entering={FadeInUp.delay(10).duration(180)} className="font-semibold text-[28px] leading-[34px] tracking-[-0.5px] text-foreground">Verify your number</Animated.Text>
      <Animated.Text entering={FadeInUp.delay(45).duration(180)} className="mt-2 font-sans text-sm leading-5 text-muted">Enter the six-digit code sent to {masked}.</Animated.Text>
      <View><Pressable accessibilityRole="button" accessibilityLabel="Enter verification code" onPress={() => inputRef.current?.focus()} className="mt-6">
        <Animated.View style={shakeStyle} className="flex-row gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Animated.View key={index} entering={FadeInUp.delay(85 + index * 20).duration(180)} className={`h-14 flex-1 items-center justify-center rounded-xl border ${status === 'invalid' || status === 'expired' ? 'border-red-500 bg-surface dark:bg-field' : otp.length === index ? 'border-accent bg-white dark:bg-field' : 'border-surface bg-surface dark:border-field dark:bg-field'}`}>
              <Text className={`font-semibold text-xl ${otp.length === index ? 'text-black dark:text-foreground' : 'text-foreground'}`}>{otp[index] ?? ''}</Text>
            </Animated.View>
          ))}
        </Animated.View>
        <TextInput ref={inputRef} accessibilityLabel="Six-digit verification code" value={otp} onChangeText={(value) => { setOtp(value.replace(/\D/g, '').slice(0, 6)); setStatus('idle'); }} keyboardType="number-pad" inputMode="numeric" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} caretHidden className="absolute h-px w-px opacity-0" />
      </Pressable></View>
      {status === 'invalid' ? <Text accessibilityRole="alert" className="mt-3 font-sans text-xs text-red-500">That code is not correct. Try 123456 for this preview.</Text> : null}
      {status === 'expired' ? <Text accessibilityRole="alert" className="mt-3 font-sans text-xs text-red-500">That code has expired. Request a new one below.</Text> : null}
      <Animated.View entering={FadeInUp.delay(220).duration(180)} className="mt-5 flex-row items-center justify-between">
        <Pressable accessibilityRole="button" onPress={onBack}><Text className="font-medium text-sm text-accent">Change number</Text></Pressable>
        {seconds > 0 ? <Text className="font-sans text-sm text-muted">Resend in 0:{String(seconds).padStart(2, '0')}</Text> : <Pressable accessibilityRole="button" onPress={() => { setSeconds(30); setStatus('idle'); }}><Text className="font-medium text-sm text-accent">Resend code</Text></Pressable>}
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(260).duration(180)} className="mt-6"><ActionButton label="Verify and continue" enabled={otp.length === 6} loading={status === 'loading'} onPress={verify} /></Animated.View>
    </>
  );
}

function LoginSheet({ onClose, onVerified }: { onClose: () => void; onVerified: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const keyboard = useAnimatedKeyboard();
  const keyboardSheetStyle = useAnimatedStyle(() => ({
    maxHeight: Math.max(260, height - insets.top - keyboard.height.value - 32),
    transform: [{ translateY: -keyboard.height.value }],
  }), [height, insets.top]);
  const [step, setStep] = useState<SheetStep>('phone');
  const [phone, setPhone] = useState('');
  return (
    <View className="absolute inset-0 z-30">
      <BlurView intensity={Platform.OS === 'android' ? 24 : 32} tint="dark" experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'} style={StyleSheet.absoluteFill} />
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} className="absolute inset-0 bg-black/25" />
      <Pressable accessibilityRole="button" accessibilityLabel="Close account setup" className="absolute inset-0" onPress={() => { Keyboard.dismiss(); onClose(); }} />
      <View pointerEvents="box-none" className="flex-1 justify-end">
          <Animated.View style={keyboardSheetStyle} className="mx-4 mb-4 overflow-hidden rounded-[20px] bg-sheet">
            <Animated.View entering={FadeIn.duration(220)}>
            <View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose} className="absolute right-4 top-4 z-10 h-9 w-9 items-center justify-center rounded-full bg-icon-surface"><AppGlyph icon={XIcon} size={20} weight="bold" /></Pressable>
              <Animated.View key={step} entering={step === 'otp' ? FadeIn.duration(120) : FadeInUp.duration(220)} className="px-4 pb-4 pt-5">
                {step === 'phone' ? <PhoneForm phone={phone} setPhone={setPhone} onFocusChange={() => {}} onContinue={() => { Keyboard.dismiss(); setStep('otp'); }} /> : <OtpForm phone={phone} onBack={() => setStep('phone')} onVerified={onVerified} />}
              </Animated.View>
            </View>
            </Animated.View>
          </Animated.View>
      </View>
    </View>
  );
}

function OnboardingPlaceholder() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-canvas" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <Animated.View entering={FadeInUp.duration(420)} className="flex-1 items-center justify-center px-7">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-success-soft"><AppGlyph icon={CheckIcon} size={40} weight="bold" tone="success" /></View>
        <Text className="mt-7 font-semibold text-center text-[24px] leading-8 tracking-[-0.5px] text-foreground">Your account is ready</Text>
        <Text className="mt-3 max-w-[310px] font-sans text-center text-base leading-6 text-muted">Meal preference onboarding will continue here in the next step.</Text>
        <View className="mt-8 w-full rounded-[18px] border border-border bg-surface-raised p-6"><Text className="font-semibold text-center text-xs tracking-[1.3px] text-muted">ONBOARDING PLACEHOLDER</Text></View>
      </Animated.View>
    </ScrollView>
  );
}

type Screen = 'selector' | 'splash' | 'stories' | 'complete' | 'trial_home' | 'preview' | 'commerce_profile';

function AppFlow() {
  const insets = useSafeAreaInsets();
  const [machine, dispatch] = useReducer(lifecycleMachineReducer, initialLifecycleMachineState);
  const [screen, setScreen] = useState<Screen>('selector');
  const [sheetOpen, setSheetOpen] = useState(false);
  const { theme } = useUniwind();
  useEffect(() => {
    if (screen !== 'splash') return;
    const timer = setTimeout(() => setScreen('stories'), 1800);
    return () => clearTimeout(timer);
  }, [screen]);
  useEffect(() => {
    if (Platform.OS !== 'web') void Location.requestForegroundPermissionsAsync();
  }, []);
  const statusStyle = screen === 'splash' ? (theme === 'dark' ? 'dark' : 'light') : (theme === 'dark' ? 'light' : 'dark');
  const definition = getLifecycleDefinition(machine.selectedState);
  const chooseState = (stateId: LifecycleStateId) => {
    const selected = getLifecycleDefinition(stateId);
    if (!selected) return;
    dispatch({ type: 'SELECT_STATE', stateId });
    setSheetOpen(false);
    if (selected.destination === 'stories') setScreen('splash');
    else if (selected.destination === 'auth') { setScreen('stories'); setSheetOpen(true); }
    else if (selected.destination === 'onboarding') setScreen('complete');
    else if (selected.destination === 'trial_home') setScreen('trial_home');
    else if (selected.destination === 'commerce_profile') setScreen('commerce_profile');
    else setScreen('preview');
  };
  const openSelector = () => {
    dispatch({ type: 'OPEN_SELECTOR' });
    setSheetOpen(false);
    setScreen('selector');
  };
  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style={statusStyle} translucent backgroundColor="transparent" />
      <View style={{ display: screen === 'selector' ? 'flex' : 'none' }} className="flex-1">
        <LifecycleStateSelector onSelect={chooseState} />
      </View>
      {screen === 'splash' ? <SplashScreen /> : null}
      {screen === 'stories' ? <Animated.View style={{ transform: [{ scale: sheetOpen ? 0.985 : 1 }] }} className="flex-1"><OnboardingScreen sheetOpen={sheetOpen} onComplete={() => setSheetOpen(true)} /></Animated.View> : null}
      {screen === 'complete' ? <TrialFlow /> : null}
      {screen === 'trial_home' ? <TrialHome key={machine.selectedState ?? 'trial'} food="Mix of both" meal="Both" bread="Chapati" rice="Jeera rice" address="B-704, Green View Apartments, Baner Road, Pune 411045" lifecycleVariant={(({ D: 'trial_payment_pending', F: 'trial_scheduled', G: 'trial_active', H: 'trial_subscription_purchased', I: 'trial_completed', J: 'subscription_scheduled', K: 'subscription_active', L: 'subscription_no_meal', M: 'subscription_paused', N: 'subscription_ending', O: 'subscription_expired', P: 'subscription_renewal_failed', Q: 'subscription_delivery_delayed', R: 'subscription_delivery_failed', S: 'subscription_offline' } as Partial<Record<LifecycleStateId, Parameters<typeof TrialHome>[0]['lifecycleVariant']>>)[machine.selectedState ?? 'G'] ?? 'trial_active')} onPaymentStatusPress={() => setScreen('preview')} /> : null}
      {screen === 'preview' && definition ? <LifecycleExperience definition={definition} onBack={openSelector} onTransition={chooseState} onPaymentCheck={() => setScreen('trial_home')} /> : null}
      {screen === 'commerce_profile' && machine.selectedState ? <CommerceProfileExperience key={machine.selectedState} stateId={machine.selectedState} onBack={openSelector} onTransition={chooseState} /> : null}
      {screen === 'stories' && sheetOpen ? <LoginSheet onClose={() => setSheetOpen(false)} onVerified={() => { setSheetOpen(false); setScreen('complete'); }} /> : null}
      {screen !== 'selector' && screen !== 'preview' ? <Pressable accessibilityRole="button" accessibilityLabel="Open lifecycle state selector" onPress={openSelector} style={{ top: insets.top + 8 }} className="absolute right-4 z-[100] h-9 justify-center rounded-full border border-border bg-sheet px-4"><Text className="font-semibold text-xs text-foreground">States</Text></Pressable> : null}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, AbrilFatface_400Regular });
  if (!fontsLoaded) return <View className="flex-1 bg-canvas" />;
  return <SafeAreaProvider className="bg-canvas"><AppFlow /></SafeAreaProvider>;
}
