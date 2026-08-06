/** Shared 1:1 preference illustrations for onboarding, summary, and confirmation. */
export const foodImages = {
  Vegetarian: require('../assets/food-images/veg.webp'),
  'Non-vegetarian': require('../assets/food-images/nonveg.webp'),
  'Mix of both': require('../assets/food-images/veg-nonveg.webp'),
  Lunch: require('../assets/food-images/day.webp'),
  Dinner: require('../assets/food-images/night.webp'),
  Both: require('../assets/food-images/day-night.webp'),
  Chapati: require('../assets/food-images/chapati.webp'),
  Bhakri: require('../assets/food-images/bhakri.webp'),
  Any: require('../assets/food-images/any-bread.webp'),
  'Plain Rice': require('../assets/food-images/plain-rice.webp'),
  'Jeera Rice': require('../assets/food-images/jeera-rice.webp'),
} as const;

export type FoodImageKey = keyof typeof foodImages;
