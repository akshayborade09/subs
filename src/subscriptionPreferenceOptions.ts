import { foodImages } from './foodImages';

export type PreferenceOption = {
  title: string;
  shortLabel: string;
  description: string;
  image: number;
};

export type SubscriptionPreferenceKind = 'food' | 'meal' | 'bread' | 'rice';

export const subscriptionFoodOptions: PreferenceOption[] = [
  { title: 'Vegetarian', shortLabel: 'Veg', description: 'Seasonal vegetables, paneer and home-style dals.', image: foodImages.Vegetarian },
  { title: 'Non-vegetarian', shortLabel: 'Non-veg', description: 'Home-style chicken, mutton and egg preparations.', image: foodImages['Non-vegetarian'] },
  { title: 'Mix of both', shortLabel: 'Mix', description: 'Enjoy vegetarian and non-vegetarian meals during your trial.', image: foodImages['Mix of both'] },
];

export const subscriptionMealOptions: PreferenceOption[] = [
  { title: 'Lunch', shortLabel: 'Lunch', description: 'Delivery between 11:00 AM and 1:00 PM', image: foodImages.Lunch },
  { title: 'Dinner', shortLabel: 'Dinner', description: 'Delivery between 6:30 PM and 8:30 PM', image: foodImages.Dinner },
  { title: 'Both', shortLabel: 'Both', description: 'Lunch and dinner every day', image: foodImages.Both },
];

export const subscriptionBreadOptions: PreferenceOption[] = [
  { title: 'Chapati', shortLabel: 'Chapati', description: 'Soft whole-wheat chapatis.', image: foodImages.Chapati },
  { title: 'Bhakri', shortLabel: 'Bhakri', description: 'Traditional Maharashtrian bhakri.', image: foodImages.Bhakri },
  { title: 'Any', shortLabel: 'Any', description: 'Let us serve chapati or bhakri based on the day’s meal.', image: foodImages.Any },
];

export const subscriptionRiceOptions: PreferenceOption[] = [
  { title: 'Plain Rice', shortLabel: 'Plain rice', description: 'Simple steamed rice.', image: foodImages['Plain Rice'] },
  { title: 'Jeera Rice', shortLabel: 'Jeera rice', description: 'Rice lightly tempered with cumin.', image: foodImages['Jeera Rice'] },
];

export const subscriptionPreferenceOptions: Record<SubscriptionPreferenceKind, PreferenceOption[]> = {
  food: subscriptionFoodOptions,
  meal: subscriptionMealOptions,
  bread: subscriptionBreadOptions,
  rice: subscriptionRiceOptions,
};

export const subscriptionPreferencePickerTitles: Record<SubscriptionPreferenceKind, string> = {
  food: 'Food preference',
  meal: 'Meal preference',
  bread: 'Bread preference',
  rice: 'Rice preference',
};
