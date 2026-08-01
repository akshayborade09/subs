/**
 * Reference data, seeded from the values the Expo prototype already renders so the
 * backend and the app agree from day one.
 *
 * Sources:
 *   src/TrialHome.tsx:329  serviceable PIN codes
 *   src/TrialHome.tsx:390  subscription plans (rupees → paise here)
 *   src/TrialHome.tsx:44   nutrition totals and the six-item menu
 *   src/CommerceProfileExperience.tsx  coupon fixtures
 *
 * Idempotent: safe to re-run.
 */
import { db, closeDb } from './index.js';

const rupees = (value: number): number => value * 100;

const PINCODES = [
  { pincode: '411001', city: 'Pune', state: 'Maharashtra', zone: 'Central' },
  { pincode: '411007', city: 'Pune', state: 'Maharashtra', zone: 'North' },
  { pincode: '411014', city: 'Pune', state: 'Maharashtra', zone: 'East' },
  { pincode: '411021', city: 'Pune', state: 'Maharashtra', zone: 'North West' },
  { pincode: '411027', city: 'Pune', state: 'Maharashtra', zone: 'North' },
  { pincode: '411038', city: 'Pune', state: 'Maharashtra', zone: 'West' },
  { pincode: '411045', city: 'Pune', state: 'Maharashtra', zone: 'West' },
  { pincode: '411057', city: 'Pune', state: 'Maharashtra', zone: 'Hinjawadi' },
];

const PLANS = [
  {
    code: 'weekly' as const,
    name: 'Weekly',
    duration_days: 7,
    meal_count: 5,
    price_paise: rupees(1499),
    discount_paise: rupees(100),
    badge: null,
    sort_order: 1,
  },
  {
    code: 'monthly' as const,
    name: 'Monthly',
    duration_days: 28,
    meal_count: 20,
    price_paise: rupees(5499),
    discount_paise: rupees(500),
    badge: 'recommended' as const,
    sort_order: 2,
  },
  {
    code: 'quarterly' as const,
    name: 'Quarterly',
    duration_days: 84,
    meal_count: 60,
    price_paise: rupees(14999),
    discount_paise: rupees(2000),
    badge: 'best_value' as const,
    sort_order: 3,
  },
];

const MENU_ITEMS = [
  { name: 'Paneer masala', serving: '180 g', category: 'main', calories_kcal: 260, protein_g: 13, carbs_g: 14, fat_g: 16, fibre_g: 3, sodium_mg: 240 },
  { name: 'Dal tadka', serving: '150 g', category: 'main', calories_kcal: 150, protein_g: 8, carbs_g: 18, fat_g: 5, fibre_g: 4, sodium_mg: 180 },
  { name: 'Bhakri', serving: '2 pieces', category: 'bread', calories_kcal: 130, protein_g: 3, carbs_g: 26, fat_g: 1, fibre_g: 2, sodium_mg: 90 },
  { name: 'Jeera rice', serving: '160 g', category: 'rice', calories_kcal: 150, protein_g: 3, carbs_g: 31, fat_g: 2, fibre_g: 1, sodium_mg: 120 },
  { name: 'Salad', serving: '80 g', category: 'side', calories_kcal: 20, protein_g: 1, carbs_g: 3, fat_g: 0, fibre_g: 1, sodium_mg: 20 },
  { name: 'Pickle', serving: '15 g', category: 'accompaniment', calories_kcal: 10, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, sodium_mg: 30 },
];

const COUPONS = [
  {
    code: 'HEALTHY300',
    title: 'Save ₹300',
    description: 'Valid on your first monthly subscription.',
    kind: 'flat' as const,
    value_paise: rupees(300),
    percent_bps: null,
    max_discount_paise: null,
    min_order_paise: rupees(2000),
    applies_to_plan_codes: ['monthly', 'quarterly'],
    new_users_only: true,
  },
  {
    code: 'WELCOME10',
    title: '10% off',
    description: 'Valid only on weekly plans, up to ₹150.',
    kind: 'percent' as const,
    value_paise: null,
    percent_bps: 1000,
    max_discount_paise: rupees(150),
    min_order_paise: 0,
    applies_to_plan_codes: ['weekly'],
    new_users_only: false,
  },
];

async function seed(): Promise<void> {
  await db
    .insertInto('serviceable_pincodes')
    .values(PINCODES)
    .onConflict((oc) => oc.column('pincode').doUpdateSet({ is_active: true }))
    .execute();

  for (const plan of PLANS) {
    const effective = Math.round((plan.price_paise - plan.discount_paise) / plan.meal_count);
    await db
      .insertInto('subscription_plans')
      .values({ ...plan, effective_price_per_meal_paise: effective, is_active: true })
      .onConflict((oc) =>
        oc.column('code').doUpdateSet({
          name: plan.name,
          duration_days: plan.duration_days,
          meal_count: plan.meal_count,
          price_paise: plan.price_paise,
          discount_paise: plan.discount_paise,
          effective_price_per_meal_paise: effective,
          badge: plan.badge,
          sort_order: plan.sort_order,
          is_active: true,
        }),
      )
      .execute();
  }

  const existingItems = await db.selectFrom('menu_items').select('name').execute();
  const known = new Set(existingItems.map((row) => row.name));
  const newItems = MENU_ITEMS.filter((item) => !known.has(item.name)).map((item) => ({
    ...item,
    food_type: 'vegetarian' as const,
    protein_g: String(item.protein_g),
    carbs_g: String(item.carbs_g),
    fat_g: String(item.fat_g),
    fibre_g: String(item.fibre_g),
  }));
  if (newItems.length > 0) {
    await db.insertInto('menu_items').values(newItems).execute();
  }

  for (const coupon of COUPONS) {
    await db
      .insertInto('coupons')
      .values({ ...coupon, applies_to_kinds: ['trial', 'subscription', 'renewal', 'resubscription'] })
      .onConflict((oc) => oc.column('code').doNothing())
      .execute();
  }

  const counts = {
    pincodes: PINCODES.length,
    plans: PLANS.length,
    menuItems: MENU_ITEMS.length,
    coupons: COUPONS.length,
  };
  console.log('Seed complete:', counts);
}

seed()
  .then(closeDb)
  .catch(async (error: unknown) => {
    console.error('Seed failed:', error);
    await closeDb();
    process.exitCode = 1;
  });
