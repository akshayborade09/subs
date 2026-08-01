import type { Executor } from './db/index.js';

/** The ~25 domain events from handoff §17. */
export type DomainEventName =
  | 'otp.requested'
  | 'otp.verified'
  | 'profile.completed'
  | 'trial.created'
  | 'trial.payment.pending'
  | 'trial.payment.succeeded'
  | 'trial.payment.failed'
  | 'trial.scheduled'
  | 'trial.completed'
  | 'subscription.checkout.created'
  | 'subscription.payment.succeeded'
  | 'subscription.payment.failed'
  | 'subscription.activated'
  | 'subscription.renewal.failed'
  | 'meal.scheduled'
  | 'meal.delivered'
  | 'meal.delayed'
  | 'meal.failed'
  | 'meal.cancelled'
  | 'meal.date_changed'
  | 'meal.address_changed'
  | 'meal.preference_changed'
  | 'coupon.applied'
  | 'reward.earned'
  | 'reward.redeemed'
  | 'referral.qualified';

export type EmitInput = {
  eventName: DomainEventName;
  aggregateType: 'user' | 'trial' | 'subscription' | 'meal_order' | 'checkout' | 'payment' | 'reward';
  aggregateId: string;
  userId?: string | null;
  payload?: Record<string, unknown>;
};

/**
 * The ONLY way a module causes a side effect in another module.
 *
 * Writers only ever INSERT, inside the business transaction. No HTTP call, no
 * queue publish and no notification send may happen inside a transaction — the
 * drain worker does that after the commit, which is what makes "the meal was
 * scheduled but the SMS never sent" impossible to produce by crashing.
 */
export async function emit(tx: Executor, input: EmitInput): Promise<void> {
  await tx
    .insertInto('outbox_events')
    .values({
      event_name: input.eventName,
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId,
      user_id: input.userId ?? null,
      payload: input.payload ?? {},
    })
    .execute();
}

export async function emitMany(tx: Executor, inputs: EmitInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await tx
    .insertInto('outbox_events')
    .values(
      inputs.map((input) => ({
        event_name: input.eventName,
        aggregate_type: input.aggregateType,
        aggregate_id: input.aggregateId,
        user_id: input.userId ?? null,
        payload: input.payload ?? {},
      })),
    )
    .execute();
}
