import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navContentInset } from '../subscriberNavigation';
import { NutritionCard } from './nutritionComponents';
import { track } from './nutritionAnalytics';

const plannedInsights = [
  'Weekly patterns',
  'Protein consistency',
  'Water consistency',
  'Subscription contribution',
  'Meal consistency',
  'Trend comparisons',
];

export function InsightsScreen() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    track('nutrition_insights_opened', {});
  }, []);

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: navContentInset(insets.bottom) }}
      >
        <View style={{ paddingTop: insets.top + 12 }} className="px-5 pb-3">
          <Text className="font-heading text-heading-md text-foreground">Insights</Text>
        </View>

        <View className="gap-3 px-5">
          <NutritionCard>
            <Text className="font-heading text-heading-sm text-foreground">Insights are on the way</Text>
            <Text className="mt-2 font-body text-body-sm text-muted">
              Once you have a few weeks of tracking, this is where patterns across your meals, protein and hydration
              will show up.
            </Text>
          </NutritionCard>

          <NutritionCard>
            <Text className="font-body text-body-xs text-muted">Planned</Text>
            <View className="mt-3 gap-2">
              {plannedInsights.map((item) => (
                <Text key={item} className="font-body text-body-sm text-foreground">
                  {item}
                </Text>
              ))}
            </View>
          </NutritionCard>
        </View>
      </ScrollView>
    </View>
  );
}
