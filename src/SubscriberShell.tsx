import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardVisible } from './accessibilityPreferences';
import { SkeletonBlock } from './nutrition/nutritionComponents';
import { SubscriberGlassNav } from './subscriberNavigation';
import { DietPlanScreen } from './nutrition/DietPlanScreen';
import { InsightsScreen } from './nutrition/InsightsScreen';
import { NutritionOnboarding } from './nutrition/NutritionOnboarding';
import { NutritionScreen } from './nutrition/NutritionScreen';
import { useNutrition } from './nutrition/nutritionStore';
import type { NutritionPeriodMode, SubscriberTab } from './nutrition/types';

function NutritionLoadingState() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 12 }} className="flex-1 gap-3 bg-canvas px-5">
      <Text className="font-heading text-heading-md text-foreground">Nutrition</Text>
      <SkeletonBlock height={44} />
      <SkeletonBlock height={168} />
      <SkeletonBlock height={104} />
    </View>
  );
}

/**
 * Tab host for active subscribers. Home stays mounted while other tabs render
 * so its meal state and scroll position survive tab switches.
 */
export type SubscriberShellLaunch = {
  tab: SubscriberTab;
  /** reset replays onboarding; complete jumps straight to the tracking screens. */
  setup: 'reset' | 'complete';
  periodMode?: NutritionPeriodMode;
};

export function SubscriberShell({ home, launch }: { home: ReactNode; launch?: SubscriberShellLaunch }) {
  const { hydrated, setup, resetSetup, seedCompletedSetup, period, setPeriod } = useNutrition();
  const [tab, setTab] = useState<SubscriberTab>(launch?.tab ?? 'home');
  const [fullScreenEditorOpen, setFullScreenEditorOpen] = useState(false);
  const keyboardVisible = useKeyboardVisible();

  // The lifecycle selector launches a specific nutrition screen, so setup state
  // is forced to match before that screen decides what to render.
  const launchApplied = useRef(false);
  useEffect(() => {
    if (!launch || !hydrated || launchApplied.current) return;
    launchApplied.current = true;
    if (launch.setup === 'reset') resetSetup();
    else seedCompletedSetup();
    if (launch.periodMode) setPeriod({ ...period, mode: launch.periodMode });
  }, [hydrated, launch, period, resetSetup, seedCompletedSetup, setPeriod]);

  // Entry logic: every nutrition destination depends on setup, so an incomplete
  // setup routes to onboarding rather than showing empty targets. Setup status
  // is unknown until storage resolves, so hold the tab back until then.
  const nutritionTab = tab !== 'home';
  const setupPending = nutritionTab && !hydrated;
  const showOnboarding = nutritionTab && hydrated && !setup.completed;
  const ready = nutritionTab && hydrated && setup.completed;
  const navHidden = showOnboarding || fullScreenEditorOpen || keyboardVisible;

  const handleEditorVisibility = useCallback((open: boolean) => setFullScreenEditorOpen(open), []);

  return (
    <View className="flex-1 bg-canvas">
      <View style={{ display: tab === 'home' ? 'flex' : 'none' }} className="flex-1">
        {home}
      </View>

      {setupPending ? <NutritionLoadingState /> : null}
      {ready && tab === 'nutrition' ? <NutritionScreen onEditorVisibilityChange={handleEditorVisibility} /> : null}
      {ready && tab === 'diet_plan' ? <DietPlanScreen /> : null}
      {ready && tab === 'insights' ? <InsightsScreen /> : null}

      {showOnboarding ? <NutritionOnboarding onComplete={() => setTab('nutrition')} /> : null}

      <SubscriberGlassNav active={tab} onChange={setTab} hidden={navHidden} />
    </View>
  );
}
