import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lifecycleDefinitions, type LifecycleDefinition, type LifecycleGroup, type LifecycleStateId } from './lifecycleStateMachine';

const groups: LifecycleGroup[] = ['Entry and onboarding', 'Trial', 'Subscription', 'Recovery and delivery', 'Checkout and coupons', 'Profile and settings', 'Loyalty and referrals'];

const toneClass: Record<LifecycleDefinition['tone'], string> = {
  neutral: 'bg-surface-raised text-muted',
  success: 'bg-success-soft text-accent',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export function LifecycleStateSelector({ onSelect }: { onSelect: (id: LifecycleStateId) => void }) {
  const insets = useSafeAreaInsets();
  return <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-canvas" contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}>
    <View className="px-5">
      <Text className="font-medium text-sm text-accent">STATE MACHINE</Text>
      <Text className="mt-2 font-semibold text-[24px] leading-8 tracking-[-0.5px] text-foreground">Choose an application state</Text>
      <Text className="mt-2 font-sans text-[15px] leading-6 text-muted">Launch the app in any lifecycle state to review its routing, content and available actions.</Text>
      {groups.map((group) => <View key={group} className="mt-8">
        <Text className="mb-3 font-semibold text-lg text-foreground">{group}</Text>
        <View className="gap-3">
          {lifecycleDefinitions.filter((item) => item.group === group).map((item) => <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`Open state ${item.id}: ${item.title}`}
            onPress={() => onSelect(item.id)}
            className="rounded-[16px] border border-border bg-sheet p-4 active:opacity-80"
          >
            <View className="flex-row items-start gap-3">
              <View className={`h-9 w-9 items-center justify-center rounded-full ${toneClass[item.tone].split(' ')[0]}`}><Text className={`font-bold text-sm ${toneClass[item.tone].split(' ').slice(1).join(' ')}`}>{item.id}</Text></View>
              <View className="flex-1">
                <Text className="font-semibold text-lg leading-6 text-foreground">{item.title}</Text>
                <Text className="mt-1 font-sans text-[15px] leading-6 text-muted">{item.summary}</Text>
                <View className="mt-3 flex-row items-center justify-between gap-3"><Text className="flex-1 font-medium text-xs text-muted">{item.entry}</Text><Text className="font-semibold text-sm text-accent">Open state</Text></View>
              </View>
            </View>
          </Pressable>)}
        </View>
      </View>)}
    </View>
  </ScrollView>;
}

export function LifecycleStatePreview({ definition, onBack }: { definition: LifecycleDefinition; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-canvas" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }}>
    <View className="flex-1 px-5">
      <Pressable accessibilityRole="button" onPress={onBack} className="mb-8 h-10 self-start justify-center rounded-full border border-border px-4"><Text className="font-semibold text-sm text-foreground">All states</Text></Pressable>
      <View className={`self-start rounded-full px-3 py-2 ${toneClass[definition.tone].split(' ')[0]}`}><Text className={`font-semibold text-xs ${toneClass[definition.tone].split(' ').slice(1).join(' ')}`}>STATE {definition.id}</Text></View>
      <Text className="mt-4 font-semibold text-[24px] leading-8 text-foreground">{definition.title}</Text>
      <Text className="mt-2 font-sans text-[15px] leading-6 text-muted">{definition.summary}</Text>
      <View className="mt-7 rounded-[16px] border border-border bg-sheet p-4">
        <Text className="font-medium text-xs text-muted">ENTRY DESTINATION</Text>
        <Text className="mt-2 font-semibold text-lg text-foreground">{definition.entry}</Text>
        <View className="my-4 h-px bg-border" />
        <Text className="font-medium text-xs text-muted">SIMULATED STATE</Text>
        <Text className="mt-2 font-sans text-[15px] leading-6 text-foreground">This route is now controlled by the lifecycle state machine. Its full production screen can be implemented against this stable state contract.</Text>
      </View>
      <View className="mt-auto gap-3 pt-8">
        <Pressable accessibilityRole="button" className="h-14 items-center justify-center rounded-xl bg-foreground"><Text className="font-bold text-base text-canvas">{definition.primaryAction}</Text></Pressable>
        {definition.secondaryAction ? <Pressable accessibilityRole="button" className="h-14 items-center justify-center rounded-xl border border-border"><Text className="font-semibold text-base text-foreground">{definition.secondaryAction}</Text></Pressable> : null}
      </View>
    </View>
  </ScrollView>;
}
