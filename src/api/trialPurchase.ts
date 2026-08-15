/**
 * Runs the real trial purchase against the backend when the user confirms
 * payment in TrialFlow. The app's display labels are mapped to the server's
 * enums here, in one place, so the flow components never carry both vocabularies.
 */
import type { TrialMealDeliveryState } from '../trialOnboardingSummary';
import {
  ApiError,
  createSavedAddress,
  createTrialCheckout,
  fetchPaymentStatus,
  payCheckout,
  saveTrialAddress,
  saveTrialDates,
  saveTrialPreferences,
  startTrialDraft,
} from './client';

const FOOD: Record<string, string> = {
  Vegetarian: 'vegetarian',
  'Non-vegetarian': 'non_vegetarian',
  'Mix of both': 'mix',
};

const MEAL: Record<string, string> = { Lunch: 'lunch', Dinner: 'dinner', Both: 'both' };

const BREAD: Record<string, string> = { Chapati: 'chapati', Bhakri: 'bhakri', Any: 'any' };

const RICE: Record<string, string> = {
  'Plain Rice': 'plain_rice',
  'Jeera Rice': 'jeera_rice',
  'Jeera rice': 'jeera_rice',
  Any: 'any',
};

const PAYMENT: Record<string, string> = {
  UPI: 'upi',
  'Credit or debit card': 'card',
  'Net banking': 'net_banking',
  'Digital wallet': 'wallet',
};

const dayFood = (value: string): string | null => (value ? (FOOD[value] ?? null) : null);

function addressBody(delivery: TrialMealDeliveryState): Record<string, unknown> {
  const address = delivery.address;
  return {
    label: address.labelType,
    ...(address.labelType === 'custom' && address.customLabel
      ? { customLabel: address.customLabel }
      : {}),
    flatOrHouse: address.number,
    ...(address.society ? { buildingOrSociety: address.society } : {}),
    line1: delivery.deliveryLocation,
    ...(address.landmark ? { landmark: address.landmark } : {}),
    ...(address.instructions ? { deliveryInstructions: address.instructions } : {}),
    pincode: address.pincode,
    ...(delivery.latitude !== undefined ? { latitude: delivery.latitude } : {}),
    ...(delivery.longitude !== undefined ? { longitude: delivery.longitude } : {}),
  };
}

export type TrialPurchaseInput = {
  food: string;
  meal: string;
  bread: string;
  rice: string;
  dailyMeals: Array<{ lunch: string; dinner: string }>;
  trialDays: string[];
  lunchDelivery: TrialMealDeliveryState | null;
  dinnerDelivery: TrialMealDeliveryState | null;
  paymentLabel: string;
};

export class TrialPurchaseError extends Error {}

function friendly(error: unknown): TrialPurchaseError {
  if (error instanceof ApiError) return new TrialPurchaseError(error.message);
  return new TrialPurchaseError('Something went wrong while confirming your trial. Please try again.');
}

/**
 * draft → preferences → dates → addresses → checkout → pay → poll. Every step
 * is idempotent server-side (the draft upserts, checkout replays via the
 * idempotency key), so retrying after a failure re-runs safely from the top.
 */
export async function purchaseTrialOnServer(input: TrialPurchaseInput): Promise<void> {
  try {
    await startTrialDraft();

    await saveTrialPreferences({
      foodPreference: FOOD[input.food] ?? 'vegetarian',
      mealPreference: MEAL[input.meal] ?? 'lunch',
      breadPreference: BREAD[input.bread] ?? 'chapati',
      ricePreference: RICE[input.rice] ?? 'plain_rice',
      ...(FOOD[input.food] === 'mix'
        ? {
            dailyMeals: input.dailyMeals.map((day) => ({
              lunch: dayFood(day.lunch),
              dinner: dayFood(day.dinner),
            })),
          }
        : {}),
    });

    await saveTrialDates([...input.trialDays].sort());

    const meal = MEAL[input.meal] ?? 'lunch';
    if (meal === 'both' && input.lunchDelivery && input.dinnerDelivery) {
      const [lunch, dinner] = await Promise.all([
        createSavedAddress(addressBody(input.lunchDelivery)),
        createSavedAddress(addressBody(input.dinnerDelivery)),
      ]);
      await saveTrialAddress({ lunchAddressId: lunch.id, dinnerAddressId: dinner.id });
    } else {
      const delivery = meal === 'dinner' ? (input.dinnerDelivery ?? input.lunchDelivery) : (input.lunchDelivery ?? input.dinnerDelivery);
      if (!delivery) throw new TrialPurchaseError('Add a delivery address before paying.');
      const created = await createSavedAddress(addressBody(delivery));
      await saveTrialAddress({ addressId: created.id });
    }

    const { checkoutSessionId } = await createTrialCheckout(PAYMENT[input.paymentLabel] ?? 'upi');
    await payCheckout(checkoutSessionId);

    // The mock provider confirms via webhook within a couple of seconds.
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const status = await fetchPaymentStatus(checkoutSessionId);
      if (status.step === 'payment_success' || status.paymentStatus === 'captured') return;
      if (status.step === 'payment_failed' || status.paymentStatus === 'failed') {
        throw new TrialPurchaseError(
          status.failureReason ?? 'The payment did not go through. Please try again.',
        );
      }
    }
    throw new TrialPurchaseError(
      'Payment confirmation is taking longer than expected. Check the payment status shortly.',
    );
  } catch (error) {
    if (error instanceof TrialPurchaseError) throw error;
    throw friendly(error);
  }
}
