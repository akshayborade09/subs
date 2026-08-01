import { db, type Tx } from '../../platform/db/index.js';
import { logger } from '../../platform/logger.js';
import { emit, emitMany } from '../../platform/outbox.js';
import { transactionTimestamp } from '../../platform/time.js';
import { materializeTrialOrders } from '../trial/service.js';
import type { PaymentStatus } from '../../platform/db/types.js';
import type { NormalizedEvent } from './provider.js';

/**
 * Monotonic ranking. A provider may deliver events out of order, so a late
 * `pending` must never be allowed to downgrade a `captured`.
 */
const RANK: Record<PaymentStatus, number> = {
  created: 0,
  pending: 1,
  authorized: 2,
  captured: 3,
  failed: 3,
  refunded: 4,
};

/**
 * Plain-language failure text for the payment-recovery screen (lifecycle spec §E).
 * Provider codes are never shown to a user verbatim.
 */
const FAILURE_MESSAGES: Record<string, string> = {
  insufficient_funds: 'Your bank declined the payment for insufficient funds.',
  card_declined: 'Your bank declined this card.',
  expired_card: 'That card has expired.',
  authentication_failed: 'The payment could not be authenticated with your bank.',
  timeout: 'Your bank did not respond in time.',
};

function failureMessage(code: string): string {
  return FAILURE_MESSAGES[code] ?? 'The payment did not go through. Please try again.';
}

export type WebhookOutcome =
  | 'processed'
  | 'duplicate'
  | 'superseded'
  | 'unknown_payment';

export async function handleProviderEvent(
  provider: string,
  event: NormalizedEvent,
  raw: Record<string, unknown>,
): Promise<WebhookOutcome> {
  return db.transaction().execute(async (tx) => {
    // The primary key is the entire dedupe mechanism: a redelivery inserts zero
    // rows and we return without touching domain state.
    const claimed = await tx
      .insertInto('provider_events')
      .values({ provider, provider_event_id: event.providerEventId, raw })
      .onConflict((oc) => oc.columns(['provider', 'provider_event_id']).doNothing())
      .returning('provider_event_id')
      .executeTakeFirst();

    if (!claimed) return 'duplicate';

    const payment = await tx
      .selectFrom('payments')
      .selectAll()
      .where('provider', '=', provider as 'mock')
      .where('provider_payment_id', '=', event.providerPaymentId)
      .forUpdate()
      .executeTakeFirst();

    if (!payment) {
      // Park it rather than 500-ing: making a provider retry an event we can never
      // process just fills their dead-letter queue.
      await tx
        .updateTable('provider_events')
        .set({ processed_at: new Date(), error: 'unknown payment' })
        .where('provider', '=', provider)
        .where('provider_event_id', '=', event.providerEventId)
        .execute();
      return 'unknown_payment';
    }

    const incomingRank = RANK[event.status];
    const currentRank = payment.status_rank;
    const isNewer = !payment.last_event_at || new Date(event.occurredAt) > payment.last_event_at;
    const wins = incomingRank > currentRank || (incomingRank === currentRank && isNewer && event.status !== payment.status);

    if (!wins) {
      await tx
        .updateTable('provider_events')
        .set({ processed_at: new Date(), superseded: true })
        .where('provider', '=', provider)
        .where('provider_event_id', '=', event.providerEventId)
        .execute();
      return 'superseded';
    }

    await tx
      .updateTable('payments')
      .set({
        status: event.status,
        status_rank: incomingRank,
        last_event_at: new Date(event.occurredAt),
        ...(event.failureCode
          ? { failure_code: event.failureCode, failure_reason: failureMessage(event.failureCode) }
          : {}),
      })
      .where('id', '=', payment.id)
      .execute();

    const checkout = await tx
      .selectFrom('checkout_sessions')
      .selectAll()
      .where('id', '=', payment.checkout_session_id)
      .forUpdate()
      .executeTakeFirstOrThrow();

    if (event.status === 'captured') {
      await tx
        .updateTable('checkout_sessions')
        .set({ step: 'payment_success' })
        .where('id', '=', checkout.id)
        .execute();

      if (checkout.source_type === 'trial') {
        await tx
          .updateTable('trials')
          .set({ status: 'paid', paid_at: new Date() })
          .where('id', '=', checkout.source_id)
          .execute();

        const created = await materializeTrialOrders(tx, checkout.source_id);
        await completeOnboarding(tx, payment.user_id);

        await tx
          .insertInto('transactions')
          .values({
            user_id: payment.user_id,
            type: 'payment',
            title: 'Five-day trial',
            subtitle: transactionTimestamp(new Date()),
            amount_paise: payment.amount_paise,
            status: 'succeeded',
            payment_id: payment.id,
            reference: `TRIAL-${payment.id.slice(0, 8).toUpperCase()}`,
          })
          .execute();

        await emitMany(tx, [
          {
            eventName: 'trial.payment.succeeded',
            aggregateType: 'trial',
            aggregateId: checkout.source_id,
            userId: payment.user_id,
            payload: { amountPaise: payment.amount_paise, mealOrdersCreated: created },
          },
          {
            eventName: 'trial.scheduled',
            aggregateType: 'trial',
            aggregateId: checkout.source_id,
            userId: payment.user_id,
            payload: { mealOrdersCreated: created },
          },
        ]);
      }
    } else if (event.status === 'failed') {
      await tx
        .updateTable('checkout_sessions')
        .set({ step: 'payment_failed' })
        .where('id', '=', checkout.id)
        .execute();

      if (checkout.source_type === 'trial') {
        await tx
          .updateTable('trials')
          .set({ status: 'payment_failed' })
          .where('id', '=', checkout.source_id)
          .execute();
      }

      await emit(tx, {
        eventName: 'trial.payment.failed',
        aggregateType: 'payment',
        aggregateId: payment.id,
        userId: payment.user_id,
        payload: { failureCode: event.failureCode ?? null },
      });
    }

    await tx
      .updateTable('provider_events')
      .set({ processed_at: new Date() })
      .where('provider', '=', provider)
      .where('provider_event_id', '=', event.providerEventId)
      .execute();

    logger.info(
      { paymentId: payment.id, status: event.status, outcome: 'processed' },
      'provider event applied',
    );
    return 'processed';
  });
}

/** Paying for the trial ends the setup wizard, whatever step it was left on. */
async function completeOnboarding(tx: Tx, userId: string): Promise<void> {
  await tx
    .updateTable('onboarding_drafts')
    .set({ status: 'complete', resume_step: 'tracker', last_completed_step: 'success' })
    .where('user_id', '=', userId)
    .execute();
}
