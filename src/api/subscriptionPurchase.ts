/**
 * Real subscription purchase for the subscription sheet's pay button. The
 * server quotes and charges from its own plan catalogue and pricing engine;
 * the sheet's local pricing is display-only.
 */
import {
  ApiError,
  createSubscriptionCheckout,
  fetchPaymentStatus,
  payCheckout,
} from './client';
import { BREAD, FOOD, MEAL, RICE } from './trialPurchase';

const PLAN: Record<string, string> = { Weekly: 'weekly', Monthly: 'monthly', Quarterly: 'quarterly' };

export type SubscriptionPurchaseInput = {
  planName: string;
  mealChoice: string;
  food: string;
  bread: string;
  rice: string;
};

export class SubscriptionPurchaseError extends Error {}

/**
 * checkout → pay → poll. The server places the subscription on the user's
 * default address (created during the trial purchase); per-slot addresses and
 * weekdays ride the top-level fallback until the saved-address sync is wired.
 */
export async function purchaseSubscriptionOnServer(
  input: SubscriptionPurchaseInput,
): Promise<void> {
  try {
    const { checkoutSessionId } = await createSubscriptionCheckout({
      planCode: PLAN[input.planName] ?? 'monthly',
      mealPreference: MEAL[input.mealChoice] ?? 'lunch',
      foodPreference: FOOD[input.food] ?? 'vegetarian',
      breadPreference: BREAD[input.bread] ?? 'chapati',
      ricePreference: RICE[input.rice] ?? 'plain_rice',
    });
    await payCheckout(checkoutSessionId);

    for (let attempt = 0; attempt < 15; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const status = await fetchPaymentStatus(checkoutSessionId);
      if (status.step === 'payment_success' || status.paymentStatus === 'captured') return;
      if (status.step === 'payment_failed' || status.paymentStatus === 'failed') {
        throw new SubscriptionPurchaseError(
          status.failureReason ?? 'The payment did not go through. Please try again.',
        );
      }
    }
    throw new SubscriptionPurchaseError(
      'Payment confirmation is taking longer than expected. Check the payment status shortly.',
    );
  } catch (error) {
    if (error instanceof SubscriptionPurchaseError) throw error;
    if (error instanceof ApiError) throw new SubscriptionPurchaseError(error.message);
    throw new SubscriptionPurchaseError(
      'Something went wrong while confirming your subscription. Please try again.',
    );
  }
}
