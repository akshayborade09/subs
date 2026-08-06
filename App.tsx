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
import type { ImageSourcePropType } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { useFonts } from '@expo-google-fonts/geist/useFonts';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { AbrilFatface_400Regular } from '@expo-google-fonts/abril-fatface/400Regular';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono/600SemiBold';
import { GeistMono_700Bold } from '@expo-google-fonts/geist-mono/700Bold';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  SlideInDown,
  cancelAnimation,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useUniwind } from 'uniwind';
import * as Location from 'expo-location';
import { type Icon, type IconWeight } from 'phosphor-react-native';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import TrialFlow from './src/TrialFlow';
import { CenteredFieldInput, fieldValueTextClass } from './src/centeredFieldInput';
import {
  FormFooterCopy,
  FormSheetLayout,
  FormValidationText,
} from './src/formLayout';
import { headingDescriptionClass } from './src/typographyClasses';
import TrialHome from './src/TrialHome';
import { LifecycleStateSelector } from './src/LifecycleStateSelector';
import LifecycleExperience from './src/LifecycleExperience';
import CommerceProfileExperience from './src/CommerceProfileExperience';
import { BlurInText } from './src/BlurInText';
import { getLifecycleDefinition, initialLifecycleMachineState, lifecycleMachineReducer, type LifecycleStateId } from './src/lifecycleStateMachine';
import { themePalette } from './src/themeColors';
import { PrimaryShimmerButton } from './src/primaryButton';

const onboardingImages = {
  everydayMeals: require('./assets/onboarding/everyday-meals.webp'),
  knowWhatGoes: require('./assets/onboarding/know-what-goes.webp'),
  lunchDinnerBoth: require('./assets/onboarding/lunch-dinner-both.webp'),
  simpleTrial: require('./assets/onboarding/simple-trial.webp'),
  yourMeal: require('./assets/onboarding/your-meal.webp'),
};
const MOCK_OTP = '123456';

// Keep system text-size accessibility without allowing extreme multipliers to
// overflow compact mobile cards, buttons and form controls.
(Text as any).defaultProps = { ...(Text as any).defaultProps, maxFontSizeMultiplier: 1.2 };
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, maxFontSizeMultiplier: 1.2 };

function AppGlyph({ icon: Glyph, size = 20, weight = 'regular', tone = 'foreground' }: { icon: Icon; size?: number; weight?: IconWeight; tone?: 'foreground' | 'success' }) {
  const { theme } = useUniwind();
  const palette = themePalette[theme === 'dark' ? 'dark' : 'light'];
  const color = tone === 'success' ? palette.success : (theme === 'dark' ? '#ffffff' : '#101010');
  return <Glyph size={Math.max(8, size - 4)} weight="bold" color={color} />;
}

type Story = {
  id: string;
  title: string;
  titleLines?: [string, string];
  image: ImageSourcePropType;
};

const stories: Story[] = [
  {
    id: 'everyday-meals',
    title: 'meals that feel like home',
    titleLines: ['meals that ', 'feel like home'],
    image: onboardingImages.everydayMeals,
  },
  {
    id: 'your-meal',
    title: 'your meal, your choices',
    image: onboardingImages.yourMeal,
  },
  {
    id: 'lunch-dinner-both',
    title: 'lunch, dinner or both',
    image: onboardingImages.lunchDinnerBoth,
  },
  {
    id: 'know-what-goes',
    title: 'what goes into every meal?',
    image: onboardingImages.knowWhatGoes,
  },
  {
    id: 'simple-trial',
    title: 'start with a simple trial',
    image: onboardingImages.simpleTrial,
  },
];

const carouselStories: Story[] = Array.from({ length: 3 }, (_, cycle) =>
  stories.map((story) => ({ ...story, id: `${story.id}-${cycle}` })),
).flat();

const ONBOARDING_STORY_DURATION = 5000;
const ONBOARDING_GRADIENT_HEIGHT = 349;
const AUTH_LEGAL_COPY = 'We’ll use this number for OTP verification, trial confirmations and important meal updates.';

function usePlaceholderColor() {
  const { theme } = useUniwind();
  return theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(16, 16, 16, 0.2)';
}

function useForegroundColor() {
  const { theme } = useUniwind();
  return theme === 'dark' ? '#ffffff' : '#101010';
}

const onboardingTitleStyle = {
  fontFamily: 'AbrilFatface_400Regular',
  fontSize: 48,
  lineHeight: 52,
  color: '#ffffff',
  textAlign: 'left' as const,
  textShadowColor: 'rgba(0,0,0,0.25)',
  textShadowOffset: { width: 0, height: 4 },
  textShadowRadius: 14,
};

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);
  return reduced;
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

function OnboardingProgressSegment({ index, activeIndex, progress }: { index: number; activeIndex: number; progress: SharedValue<number> }) {
  const fillStyle = useAnimatedStyle(() => {
    if (index < activeIndex) return { width: '100%' };
    if (index > activeIndex) return { width: '0%' };
    return { width: `${progress.value * 100}%` };
  });
  return (
    <View className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
      <Animated.View style={fillStyle} className="h-full rounded-full bg-white" />
    </View>
  );
}

function OnboardingProgress({ activeIndex, progress }: { activeIndex: number; progress: SharedValue<number> }) {
  return (
    <View accessibilityLabel={`Story ${activeIndex + 1} of ${stories.length}`} className="flex-row gap-1.5">
      {stories.map((story, index) => (
        <OnboardingProgressSegment key={story.id} index={index} activeIndex={activeIndex} progress={progress} />
      ))}
    </View>
  );
}

function OnboardingImageGradient({ width, height }: { width: number; height: number }) {
  if (width <= 0 || height <= 0) return null;
  return (
    <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="onboardingImageGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000000" stopOpacity="0" />
          <Stop offset="0.22596" stopColor="#000000" stopOpacity="0.6" />
          <Stop offset="0.51652" stopColor="#000000" stopOpacity="0.8" />
          <Stop offset="0.78042" stopColor="#000000" stopOpacity="1" />
          <Stop offset="1" stopColor="#000000" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#onboardingImageGradient)" />
    </Svg>
  );
}

function OnboardingCtaButton({ label, onPress }: { label: string; onPress: () => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 20, stiffness: 360 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 300 }); }}
        className="w-full rounded-button-outer border border-white p-button-wrap"
      >
        <View className="h-field items-center justify-center rounded-button-inner bg-white">
          <Text className="font-mono-semibold text-body-md text-black">{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function OnboardingLegalText() {
  return (
    <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
      <Text className="font-body text-body-xs text-white/40">By continuing, you agree to our</Text>
      <Pressable accessibilityRole="link" hitSlop={8}><Text className="font-body text-body-xs text-white">Terms</Text></Pressable>
      <Text className="font-body text-body-xs text-white/40">and</Text>
      <Pressable accessibilityRole="link" hitSlop={8}><Text className="font-body text-body-xs text-white">Privacy Policy.</Text></Pressable>
    </View>
  );
}

function OnboardingStoryTitle({ story, animateKey }: { story: Story; animateKey: number }) {
  const reduced = useReducedMotionPreference();
  const titleText = story.titleLines ? `${story.titleLines[0].trimEnd()}\n${story.titleLines[1]}` : story.title;

  if (reduced) {
    return (
      <Text className="w-full font-heading text-heading-xl text-left text-white" style={{ textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 14 }}>
        {titleText}
      </Text>
    );
  }

  return (
    <BlurInText
      key={`onboarding-title-${animateKey}`}
      by={story.titleLines ? 'line' : 'word'}
      duration={520}
      delayStep={story.titleLines ? 90 : 70}
      startDelay={80}
      animateKey={animateKey}
      style={onboardingTitleStyle}
      containerStyle={{ width: '100%', alignItems: 'flex-start' }}
    >
      {titleText}
    </BlurInText>
  );
}

function OnboardingScreen({ onComplete, sheetOpen = false }: { onComplete: () => void; sheetOpen?: boolean }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Story>>(null);
  const physicalPageRef = useRef(stories.length);
  const [physicalPage, setPhysicalPage] = useState(stories.length);
  const [settledPage, setSettledPage] = useState(stories.length);
  const progress = useSharedValue(0);
  const reduced = useReducedMotionPreference();
  const activeStoryIndex = ((physicalPage % stories.length) + stories.length) % stories.length;
  const settledStoryIndex = ((settledPage % stories.length) + stories.length) % stories.length;
  const settledStory = stories[settledStoryIndex]!;
  const bottomPanelHeight = ONBOARDING_GRADIENT_HEIGHT + insets.bottom;

  physicalPageRef.current = physicalPage;

  const resolveCarouselPage = (page: number) => {
    if (page >= stories.length * 2) {
      listRef.current?.scrollToOffset({ offset: stories.length * width, animated: false });
      return stories.length;
    }
    if (page < stories.length) {
      const matchingMiddlePage = page + stories.length;
      listRef.current?.scrollToOffset({ offset: matchingMiddlePage * width, animated: false });
      return matchingMiddlePage;
    }
    return page;
  };

  const goTo = (index: number) => {
    listRef.current?.scrollToOffset({ offset: index * width, animated: true });
    setPhysicalPage(index);
    setTimeout(() => setSettledPage(index), 420);
  };

  const advanceStory = () => {
    goTo(physicalPageRef.current + 1);
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: stories.length * width, animated: false });
      setSettledPage(stories.length);
    });
  }, [width]);

  useEffect(() => {
    if (sheetOpen) {
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: physicalPage * width, animated: false }));
    }
  }, [physicalPage, sheetOpen, width]);

  useEffect(() => {
    if (sheetOpen) {
      cancelAnimation(progress);
      return;
    }
    cancelAnimation(progress);
    progress.value = 0;
    if (reduced) {
      progress.value = 1;
      const timer = setTimeout(advanceStory, ONBOARDING_STORY_DURATION);
      return () => clearTimeout(timer);
    }
    progress.value = withTiming(1, { duration: ONBOARDING_STORY_DURATION, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(advanceStory)();
    });
    return () => cancelAnimation(progress);
  }, [physicalPage, sheetOpen, reduced]);

  return (
    <Animated.View entering={FadeIn.duration(300)} className="flex-1 bg-black">
      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={carouselStories}
        initialScrollIndex={stories.length}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        horizontal
        pagingEnabled
        bounces={false}
        scrollEnabled={!sheetOpen}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(event) => {
          const page = resolveCarouselPage(Math.round(event.nativeEvent.contentOffset.x / width));
          setPhysicalPage(page);
          setSettledPage(page);
        }}
        renderItem={({ item }) => (
          <View style={{ width, height }} className="bg-black">
            <Image source={item.image} accessibilityLabel={item.title} resizeMode="cover" className="absolute inset-0 h-full w-full" />
            <View className="absolute inset-y-0 left-0 w-1/3">
              <Pressable accessibilityRole="button" accessibilityLabel="Previous story" className="h-full" onPress={() => goTo(physicalPage - 1)} />
            </View>
            <View className="absolute inset-y-0 right-0 w-1/3">
              <Pressable accessibilityRole="button" accessibilityLabel="Next story" className="h-full" onPress={() => goTo(physicalPage + 1)} />
            </View>
          </View>
        )}
      />
      <View pointerEvents="box-none" style={{ height: bottomPanelHeight, paddingBottom: insets.bottom }} className="absolute inset-x-0 bottom-0 z-10 justify-end">
        <OnboardingImageGradient width={width} height={bottomPanelHeight} />
        <View className="w-full items-start gap-6 px-5 pb-5 pt-8">
          <OnboardingStoryTitle story={settledStory} animateKey={settledPage} />
          <View className="w-full gap-6">
            <OnboardingCtaButton label="Get started" onPress={onComplete} />
            <OnboardingLegalText />
          </View>
        </View>
      </View>
      <View style={{ paddingTop: insets.top + 10 }} className="absolute inset-x-0 top-0 z-20 px-5" pointerEvents="box-none">
        <OnboardingProgress activeIndex={activeStoryIndex} progress={progress} />
        <Text className="mt-[18px] text-right font-mono-semibold text-body-md text-foreground/70">sora kitchen</Text>
      </View>
    </Animated.View>
  );
}

type SheetStep = 'phone' | 'otp';

function normalizeIndianPhone(value: string) {
  let numeric = value.replace(/\D/g, '');
  if (numeric.startsWith('0091')) {
    numeric = numeric.slice(4);
  } else if (numeric.startsWith('91') && numeric.length > 10) {
    numeric = numeric.slice(2);
  }
  return numeric.slice(0, 10);
}

function AuthIconButton({ icon: Glyph, variant, onPress, accessibilityLabel }: { icon: Icon; variant: 'inverse' | 'surface'; onPress: () => void; accessibilityLabel: string }) {
  const { theme } = useUniwind();
  const iconColor = variant === 'inverse'
    ? (theme === 'dark' ? '#101010' : '#ffffff')
    : (theme === 'dark' ? '#ffffff' : '#101010');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      className={`size-icon-button items-center justify-center rounded-full p-2 ${variant === 'inverse' ? 'bg-foreground' : 'bg-surface'}`}
    >
      <Glyph size={20} weight="bold" color={iconColor} />
    </Pressable>
  );
}

function AuthSheetToolbar({ onBack, onClose }: { onBack?: () => void; onClose?: () => void }) {
  if (!onBack && !onClose) return null;
  return (
    <View className="flex-row items-center justify-between">
      {onBack ? <AuthIconButton icon={CaretLeftIcon} variant="inverse" onPress={onBack} accessibilityLabel="Back" /> : <View className="size-icon-button" />}
      {onClose ? <AuthIconButton icon={XIcon} variant="surface" onPress={onClose} accessibilityLabel="Close" /> : null}
    </View>
  );
}

function AuthSheetInlineHeader({ title, onBack, onClose }: { title: string; onBack?: () => void; onClose?: () => void }) {
  const foregroundColor = useForegroundColor();
  return (
    <View className="flex-row items-center justify-between">
      <View className="min-w-0 flex-1 flex-row items-center gap-field-inline">
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={onBack} className="size-6 shrink-0 items-center justify-center">
            <CaretLeftIcon size={24} weight="regular" color={foregroundColor} />
          </Pressable>
        ) : null}
        <Text numberOfLines={1} className="min-w-0 flex-1 font-heading text-heading-sm text-foreground">{title}</Text>
      </View>
      {onClose ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} className="ml-2 size-6 shrink-0 items-center justify-center">
          <XIcon size={24} weight="regular" color={foregroundColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

function AuthPrimaryButton({ label, onPress, enabled = true, loading = false }: { label: string; onPress: () => void; enabled?: boolean; loading?: boolean }) {
  return <PrimaryShimmerButton label={label} onPress={onPress} enabled={enabled} loading={loading} />;
}

function PhoneForm({ phone, setPhone, onContinue }: { phone: string; setPhone: (value: string) => void; onContinue: () => void }) {
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const phoneInputRef = useRef<TextInput>(null);
  const foregroundColor = useForegroundColor();
  useEffect(() => {
    const timer = setTimeout(() => phoneInputRef.current?.focus(), 360);
    return () => clearTimeout(timer);
  }, []);
  const digits = normalizeIndianPhone(phone);
  const valid = /^[6-9]\d{9}$/.test(digits);
  const showError = touched && !valid;
  const fieldClass = showError
    ? 'border border-destructive bg-field'
    : focused
      ? 'border border-foreground bg-canvas'
      : 'border border-transparent bg-field';
  return (
    <FormSheetLayout
      title="Create your account"
      subtitle="Use your WhatsApp number to securely continue."
      fields={
        <>
          <CenteredFieldInput
            value={digits}
            onChangeText={(value) => setPhone(normalizeIndianPhone(value))}
            placeholder="10 digit number"
            selectionColor={foregroundColor}
            shellClassName={fieldClass}
            inputRef={phoneInputRef}
            autoFocus
            keyboardType="phone-pad"
            inputMode="numeric"
            textContentType="telephoneNumber"
            autoComplete="tel"
            returnKeyType="done"
            onSubmitEditing={() => { setTouched(true); if (valid) onContinue(); }}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); setTouched(true); }}
            accessibilityLabel="Indian mobile number"
            prefix={
              <>
                <Text className={`${fieldValueTextClass} text-foreground`}>+91</Text>
                <View className="h-6 w-px bg-foreground/15" />
              </>
            }
          />
          {showError ? (
            <FormValidationText>Enter 10 digits starting with 6, 7, 8 or 9.</FormValidationText>
          ) : null}
        </>
      }
      primaryAction={
        <AuthPrimaryButton label="Get started" enabled={valid} onPress={() => { setTouched(true); onContinue(); }} />
      }
      footer={<FormFooterCopy>{AUTH_LEGAL_COPY}</FormFooterCopy>}
    />
  );
}

function OtpCursor() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0, { duration: 530 }), withTiming(1, { duration: 530 })),
      -1,
    );
    return () => { cancelAnimation(opacity); };
  }, [opacity]);
  const cursorStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={cursorStyle} className="h-5 w-0.5 rounded-full bg-foreground" />;
}

function OtpForm({ phone, onBack, onClose, onVerified }: { phone: string; onBack: () => void; onClose: () => void; onVerified: () => void }) {
  const [otp, setOtp] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'invalid' | 'expired'>('idle');
  const inputRef = useRef<TextInput>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  useEffect(() => {
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 360);
    return () => clearTimeout(focusTimer);
  }, []);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);
  const masked = `+91 ••••••${phone.slice(-4)}`;
  const hasError = status === 'invalid' || status === 'expired';
  const verify = () => {
    if (otp.length !== 6) return;
    setStatus('loading');
    setTimeout(() => {
      if (otp !== MOCK_OTP) {
        setStatus('invalid');
        shake.value = withSequence(withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }), withTiming(-6, { duration: 60 }), withTiming(0, { duration: 60 }));
        return;
      }
      setStatus('idle');
      onVerified();
    }, 650);
  };
  const activeCell = focused && otp.length < 6 ? otp.length : -1;
  const cellClass = (index: number) => {
    if (hasError) return 'border border-destructive bg-field';
    if (focused && otp.length === index) return 'border border-foreground bg-canvas';
    return 'border border-transparent bg-field';
  };
  return (
    <FormSheetLayout
      header={<AuthSheetInlineHeader title="Verify your number" onBack={onBack} onClose={onClose} />}
      fields={
        <View className="gap-otp-section">
          <Text className={headingDescriptionClass}>{`Enter the six-digit code sent to ${masked}.`}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Enter verification code" onPress={() => inputRef.current?.focus()}>
            <Animated.View style={shakeStyle} className="flex-row gap-otp">
              {Array.from({ length: 6 }).map((_, index) => (
                <View key={index} className={`h-otp-cell flex-1 items-center justify-center rounded-field ${cellClass(index)}`}>
                  {otp[index] ? (
                    <Text className="font-body-medium text-body-md tracking-body-md text-foreground">{otp[index]}</Text>
                  ) : activeCell === index ? (
                    <OtpCursor />
                  ) : null}
                </View>
              ))}
            </Animated.View>
            <TextInput
              ref={inputRef}
              autoFocus
              accessibilityLabel="Six-digit verification code"
              value={otp}
              onChangeText={(value) => { setOtp(value.replace(/\D/g, '').slice(0, 6)); setStatus('idle'); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              keyboardType="number-pad"
              inputMode="numeric"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              maxLength={6}
              caretHidden
              className="absolute h-px w-px opacity-0"
            />
          </Pressable>
          {status === 'invalid' ? (
            <FormValidationText>That code is not correct. Try 123456 for this preview.</FormValidationText>
          ) : null}
          {status === 'expired' ? (
            <FormValidationText>That code has expired. Request a new one below.</FormValidationText>
          ) : null}
        </View>
      }
      extra={
        <View className="flex-row items-center justify-between">
          <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8}>
            <Text className="font-body text-body-sm tracking-body-sm text-accent">Change number</Text>
          </Pressable>
          {seconds > 0 ? (
            <Text className="font-body text-body-sm tracking-body-sm text-muted">Resend in 0:{String(seconds).padStart(2, '0')}</Text>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => { setSeconds(30); setStatus('idle'); }} hitSlop={8}>
              <Text className="font-body text-body-sm tracking-body-sm text-accent">Resend code</Text>
            </Pressable>
          )}
        </View>
      }
      primaryAction={
        <AuthPrimaryButton label="Verify and continue" enabled={otp.length === 6} loading={status === 'loading'} onPress={verify} />
      }
      footer={<FormFooterCopy>{AUTH_LEGAL_COPY}</FormFooterCopy>}
    />
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
        <Animated.View style={keyboardSheetStyle} className="mx-4 mb-4 overflow-hidden rounded-sheet bg-canvas">
          <Animated.View key={step} entering={step === 'otp' ? FadeIn.duration(120) : FadeInUp.duration(220)} className="p-sheet">
            {step === 'phone'
              ? <PhoneForm phone={phone} setPhone={setPhone} onContinue={() => { Keyboard.dismiss(); setStep('otp'); }} />
              : <OtpForm phone={phone} onBack={() => setStep('phone')} onClose={() => { Keyboard.dismiss(); onClose(); }} onVerified={onVerified} />}
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

type Screen = 'selector' | 'stories' | 'complete' | 'trial_home' | 'preview' | 'commerce_profile';

function AppFlow() {
  const insets = useSafeAreaInsets();
  const [machine, dispatch] = useReducer(lifecycleMachineReducer, initialLifecycleMachineState);
  const [screen, setScreen] = useState<Screen>('selector');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [homeReturnState, setHomeReturnState] = useState<LifecycleStateId | null>(null);
  const { theme } = useUniwind();
  useEffect(() => {
    if (Platform.OS !== 'web') void Location.requestForegroundPermissionsAsync();
  }, []);
  const statusStyle = screen === 'stories' ? 'light' : (theme === 'dark' ? 'light' : 'dark');
  const definition = getLifecycleDefinition(machine.selectedState);
  const chooseState = (stateId: LifecycleStateId) => {
    const selected = getLifecycleDefinition(stateId);
    if (!selected) return;
    dispatch({ type: 'SELECT_STATE', stateId });
    setSheetOpen(false);
    if (selected.destination === 'stories') setScreen('stories');
    else if (selected.destination === 'auth') { setScreen('stories'); setSheetOpen(true); }
    else if (selected.destination === 'onboarding') setScreen('complete');
    else if (selected.destination === 'trial_home') setScreen('trial_home');
    else if (selected.destination === 'commerce_profile') setScreen('commerce_profile');
    else setScreen('preview');
  };
  const openSelector = () => {
    dispatch({ type: 'OPEN_SELECTOR' });
    setSheetOpen(false);
    setHomeReturnState(null);
    setScreen('selector');
  };
  const openProfileFromHome = () => {
    if (machine.selectedState) setHomeReturnState(machine.selectedState);
    chooseState('AB');
  };
  const backFromCommerceProfile = () => {
    if (homeReturnState) {
      const returnState = homeReturnState;
      setHomeReturnState(null);
      chooseState(returnState);
      return;
    }
    openSelector();
  };
  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style={statusStyle} translucent backgroundColor="transparent" />
      <View style={{ display: screen === 'selector' ? 'flex' : 'none' }} className="flex-1">
        <LifecycleStateSelector onSelect={chooseState} />
      </View>
      {screen === 'stories' ? <Animated.View style={{ transform: [{ scale: sheetOpen ? 0.985 : 1 }] }} className="flex-1"><OnboardingScreen sheetOpen={sheetOpen} onComplete={() => setSheetOpen(true)} /></Animated.View> : null}
      {screen === 'complete' ? <TrialFlow /> : null}
      {screen === 'trial_home' ? <TrialHome key={machine.selectedState ?? 'trial'} food="Mix of both" meal="Both" bread="Chapati" rice="Jeera rice" address="B-704, Green View Apartments, Baner Road, Pune 411045" lifecycleVariant={(({ D: 'trial_payment_pending', F: 'trial_scheduled', G: 'trial_active', H: 'trial_subscription_purchased', I: 'trial_completed', J: 'subscription_scheduled', K: 'subscription_active', L: 'subscription_no_meal', M: 'subscription_paused', N: 'subscription_ending', O: 'subscription_expired', P: 'subscription_renewal_failed', Q: 'subscription_delivery_delayed', R: 'subscription_delivery_failed', S: 'subscription_offline' } as Partial<Record<LifecycleStateId, Parameters<typeof TrialHome>[0]['lifecycleVariant']>>)[machine.selectedState ?? 'G'] ?? 'trial_active')} onPaymentStatusPress={() => setScreen('preview')} onProfilePress={openProfileFromHome} /> : null}
      {screen === 'preview' && definition ? <LifecycleExperience definition={definition} onBack={openSelector} onTransition={chooseState} onPaymentCheck={() => setScreen('trial_home')} /> : null}
      {screen === 'commerce_profile' && machine.selectedState ? <CommerceProfileExperience key={machine.selectedState} stateId={machine.selectedState} onBack={backFromCommerceProfile} onTransition={chooseState} /> : null}
      {screen === 'stories' && sheetOpen ? <LoginSheet onClose={() => setSheetOpen(false)} onVerified={() => { setSheetOpen(false); setScreen('complete'); }} /> : null}
      {screen !== 'selector' && screen !== 'preview' && screen !== 'stories' ? <Pressable accessibilityRole="button" accessibilityLabel="Open lifecycle state selector" onPress={openSelector} style={{ top: insets.top + 8 }} className="absolute right-4 z-[100] h-9 justify-center rounded-full border border-border bg-sheet px-4"><Text className="font-semibold text-xs text-foreground">States</Text></Pressable> : null}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    AbrilFatface_400Regular,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
    GeistMono_700Bold,
  });
  if (!fontsLoaded) return <View className="flex-1 bg-canvas" />;
  return <SafeAreaProvider className="bg-canvas"><AppFlow /></SafeAreaProvider>;
}
