import { randomUUID } from 'node:crypto';
import { db, type Tx } from '../../platform/db/index.js';
import { policy } from '../../platform/config/policy.js';
import { AppError } from '../../platform/errors.js';
import { emit } from '../../platform/outbox.js';
import { getProvider, mockProvider, type MockScenario } from '../payments/provider.js';
import { getTrial } from '../trial/service.js';

export type CheckoutSummary = {
  checkoutSessionId: string;
  kind: string;
  step: string;
  priceBreakdown: {
    planPricePaise: number;
    deliveryChargesPaise: number;
    taxesPaise: number;
    discountPaise: number;
    trialCreditPaise: number;
    rewardCreditPaise: number;
    totalPayablePaise: number;
  };
  paymentMethod: string | null;
};

function toSummary(row: {
  id: string;
  kind: string;
  step: string;
  plan_price_paise: number;
  delivery_charges_paise: number;
  taxes_paise: number;
  discount_paise: number;
  trial_credit_paise: number;
  reward_credit_paise: number;
  total_payable_paise: number;
  payment_method: string | null;
}): CheckoutSummary {
  return {
    checkoutSessionId: row.id,
    kind: row.kind,
    step: row.step,
    priceBreakdown: {
      planPricePaise: row.plan_price_paise,
      deliveryChargesPaise: row.delivery_charges_paise,
      taxesPaise: row.taxes_paise,
      discountPaise: row.discount_paise,
      trialCreditPaise: row.trial_credit_paise,
      rewardCreditPaise: row.reward_credit_paise,
      totalPayablePaise: row.total_payable_paise,
    },
    paymentMethod: row.payment_method,
  };
}

/**
 * Creates (or returns) the checkout session for the user's trial. Totals are
 * computed here and never accepted from the client (handoff §3).
 */
export async function createTrialCheckout(
  tx: Tx,
  userId: string,
  paymentMethod: 'upi' | 'card' | 'net_banking' | 'wallet' | null,
): Promise<CheckoutSummary> {
  const trial = await getTrial(userId, tx);
  if (!trial) throw new AppError('NOT_FOUND', 'Start your trial setup first.');
  if (trial.status === 'paid') {
    throw new AppError('CHECKOUT_INVALID_STATE', 'This trial has already been paid for.');
  }
  if (
    trial.service_dates.length !== policy.trial.requiredDays ||
    !trial.address_id ||
    !trial.meal_preference ||
    !trial.food_preference
  ) {
    throw new AppError('CHECKOUT_INVALID_STATE', 'Complete your trial setup before checkout.');
  }

  const existing = await tx
    .selectFrom('checkout_sessions')
    .selectAll()
    .where('user_id', '=', userId)
    .where('source_type', '=', 'trial')
    .where('source_id', '=', trial.id)
    .where('step', 'in', ['review', 'payment_method_required', 'payment_pending'])
    .orderBy('created_at', 'desc')
    .executeTakeFirst();

  if (existing) {
    if (paymentMethod && existing.payment_method !== paymentMethod) {
      const updated = await tx
        .updateTable('checkout_sessions')
        .set({ payment_method: paymentMethod })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return toSummary(updated);
    }
    return toSummary(existing);
  }

  const created = await tx
    .insertInto('checkout_sessions')
    .values({
      user_id: userId,
      kind: 'trial',
      step: paymentMethod ? 'review' : 'payment_method_required',
      source_type: 'trial',
      source_id: trial.id,
      payment_method: paymentMethod,
      plan_price_paise: trial.price_paise,
      total_payable_paise: trial.price_paise,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await emit(tx, {
    eventName: 'trial.created',
    aggregateType: 'checkout',
    aggregateId: created.id,
    userId,
    payload: { trialId: trial.id, totalPayablePaise: created.total_payable_paise },
  });

  return toSummary(created);
}

export type PayResult = {
  checkoutSessionId: string;
  paymentId: string;
  status: string;
  clientPayload: unknown;
  /** Which mock webhook sequence to run once this transaction commits. */
  scenario: MockScenario;
};

/**
 * Starts a payment attempt. The `payments` row is created BEFORE the provider is
 * called, so a webhook that arrives before this function returns still finds a row
 * to update (the `webhook_before_response` mock scenario proves it).
 */
export async function payCheckout(
  tx: Tx,
  userId: string,
  checkoutSessionId: string,
  scenario: MockScenario | undefined,
): Promise<PayResult> {
  const checkout = await tx
    .selectFrom('checkout_sessions')
    .selectAll()
    .where('id', '=', checkoutSessionId)
    .where('user_id', '=', userId)
    .forUpdate()
    .executeTakeFirst();

  if (!checkout) throw new AppError('NOT_FOUND', 'Checkout session not found.');
  if (checkout.step === 'payment_success') {
    throw new AppError('CHECKOUT_INVALID_STATE', 'This checkout has already been paid.');
  }
  if (checkout.step === 'expired') {
    throw new AppError('CHECKOUT_INVALID_STATE', 'This checkout has expired. Start again.');
  }

  const provider = getProvider();
  const paymentId = randomUUID();
  const providerPaymentId = `pay_mock_${paymentId.slice(0, 12)}`;

  const order = await provider.createOrder({
    paymentId,
    amountPaise: checkout.total_payable_paise,
    receipt: `TRIAL-${checkout.id.slice(0, 8)}`,
    notes: { paymentId, checkoutSessionId: checkout.id },
  });

  await tx
    .insertInto('payments')
    .values({
      id: paymentId,
      user_id: userId,
      checkout_session_id: checkout.id,
      provider: provider.name,
      provider_order_id: order.providerOrderId,
      provider_payment_id: providerPaymentId,
      amount_paise: checkout.total_payable_paise,
      status: 'created',
      status_rank: 0,
    })
    .execute();

  await tx
    .updateTable('checkout_sessions')
    .set({ step: 'payment_pending' })
    .where('id', '=', checkout.id)
    .execute();

  if (checkout.source_type === 'trial') {
    await tx
      .updateTable('trials')
      .set({ status: 'payment_pending' })
      .where('id', '=', checkout.source_id)
      .where('status', 'in', ['draft', 'payment_failed'])
      .execute();
  }

  await emit(tx, {
    eventName: 'trial.payment.pending',
    aggregateType: 'payment',
    aggregateId: paymentId,
    userId,
    payload: { checkoutSessionId: checkout.id, amountPaise: checkout.total_payable_paise },
  });

  return {
    checkoutSessionId: checkout.id,
    paymentId,
    status: 'created',
    clientPayload: order.clientPayload,
    scenario: scenario ?? 'pending_then_success',
  };
}

/**
 * Kicks off the mock provider's webhook sequence. MUST be called after the payment
 * transaction has committed: scheduling from inside it lets a 0ms webhook look up a
 * row that is not visible yet, which parks the event as "unknown payment" and
 * strands the user on the pending screen.
 */
export async function scheduleMockWebhooks(
  paymentId: string,
  scenario: MockScenario,
): Promise<void> {
  const payment = await db
    .selectFrom('payments')
    .select(['provider_payment_id', 'provider_order_id', 'amount_paise'])
    .where('id', '=', paymentId)
    .executeTakeFirst();

  if (!payment?.provider_payment_id || !payment.provider_order_id) return;

  mockProvider.schedule(scenario, {
    providerPaymentId: payment.provider_payment_id,
    providerOrderId: payment.provider_order_id,
    amountPaise: payment.amount_paise,
  });
}

export async function getPaymentStatus(userId: string, checkoutSessionId: string) {
  const checkout = await db
    .selectFrom('checkout_sessions')
    .selectAll()
    .where('id', '=', checkoutSessionId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!checkout) throw new AppError('NOT_FOUND', 'Checkout session not found.');

  const payment = await db
    .selectFrom('payments')
    .selectAll()
    .where('checkout_session_id', '=', checkoutSessionId)
    .orderBy('created_at', 'desc')
    .executeTakeFirst();

  return {
    checkoutSessionId,
    step: checkout.step,
    paymentStatus: payment?.status ?? 'created',
    amountPaise: checkout.total_payable_paise,
    failureCode: payment?.failure_code ?? null,
    failureReason: payment?.failure_reason ?? null,
    reference: payment ? `TRIAL-${payment.id.slice(0, 8).toUpperCase()}` : null,
  };
}
