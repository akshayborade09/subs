import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../platform/db/index.js';
import { signMockPayload } from '../modules/payments/provider.js';
import {
  addAddress,
  appState,
  deliverWebhook,
  futureWeekdays,
  getApp,
  pay,
  resetData,
  setUpTrial,
  signIn,
  uniqueKey,
  type App,
} from './harness.js';

let app: App;

beforeAll(async () => {
  app = await getApp();
});

beforeEach(async () => {
  await resetData();
});

describe('the trial journey', () => {
  it('walks a new user from signed out to a scheduled trial', async () => {
    const session = await signIn(app);

    const beforeOnboarding = await appState(app, session);
    expect(beforeOnboarding.lifecycleState).toBe('ONBOARDING_INCOMPLETE');
    expect(beforeOnboarding.legacyStateId).toBe('C');
    expect(beforeOnboarding.home).toBeNull();

    const { checkoutSessionId, dates } = await setUpTrial(app, session);

    const { paymentId } = await pay(app, session, checkoutSessionId);
    const pending = await appState(app, session);
    expect(pending.lifecycleState).toBe('TRIAL_PAYMENT_PENDING');
    expect(pending.legacyStateId).toBe('D');

    await deliverWebhook(app, paymentId, { status: 'captured' });

    const scheduled = await appState(app, session);
    expect(scheduled.lifecycleState).toBe('TRIAL_SCHEDULED');
    expect(scheduled.route).toBe('home');
    expect(scheduled.home?.week.map((day) => day.date)).toEqual(dates);

    // One meal order per (date, slot) — lunch only here.
    const orders = await db
      .selectFrom('meal_orders')
      .selectAll()
      .where('user_id', '=', session.userId)
      .execute();
    expect(orders).toHaveLength(5);
  });

  it('creates lunch and dinner orders independently for a "both" trial', async () => {
    const session = await signIn(app);
    const { checkoutSessionId } = await setUpTrial(app, session, { mealPreference: 'both' });
    const { paymentId } = await pay(app, session, checkoutSessionId);
    await deliverWebhook(app, paymentId);

    const state = await appState(app, session);
    const firstDay = state.home!.week[0]!;
    expect(firstDay.markers).toHaveLength(2);
    // Positional: index 0 is lunch, index 1 dinner — the contract TrialHome reads.
    expect(firstDay.markers.map((m) => m.slot)).toEqual(['lunch', 'dinner']);
  });

  it('leaves the trial recoverable after a failed payment', async () => {
    const session = await signIn(app);
    const { checkoutSessionId } = await setUpTrial(app, session);
    const { paymentId } = await pay(app, session, checkoutSessionId, 'fail_after_2s');

    await deliverWebhook(app, paymentId, { status: 'failed', failureCode: 'insufficient_funds' });

    const state = await appState(app, session);
    expect(state.lifecycleState).toBe('TRIAL_PAYMENT_FAILED');

    const status = await app.inject({
      method: 'GET',
      url: `/v1/me/checkout/${checkoutSessionId}/payment-status`,
      headers: session.headers,
    });
    expect(status.json()).toMatchObject({
      paymentStatus: 'failed',
      failureCode: 'insufficient_funds',
      failureReason: 'Your bank declined the payment for insufficient funds.',
    });

    // The dates the user chose survive, so a retry does not restart setup.
    const review = await app.inject({
      method: 'GET',
      url: '/v1/me/trial/review',
      headers: session.headers,
    });
    expect(review.json<{ ready: boolean }>().ready).toBe(true);
  });
});

describe('webhook delivery is hostile-tolerant', () => {
  async function paidTrial() {
    const session = await signIn(app);
    const { checkoutSessionId } = await setUpTrial(app, session);
    const { paymentId } = await pay(app, session, checkoutSessionId);
    return { session, paymentId, checkoutSessionId };
  }

  it('absorbs a duplicate delivery without duplicating meal orders', async () => {
    const { session, paymentId } = await paidTrial();

    const first = await deliverWebhook(app, paymentId, { eventId: 'evt_same' });
    const second = await deliverWebhook(app, paymentId, { eventId: 'evt_same' });

    expect(first.outcome).toBe('processed');
    expect(second.outcome).toBe('duplicate');

    const orders = await db
      .selectFrom('meal_orders')
      .select('id')
      .where('user_id', '=', session.userId)
      .execute();
    expect(orders).toHaveLength(5);
  });

  it('refuses to let a late "pending" downgrade a captured payment', async () => {
    const { session, paymentId, checkoutSessionId } = await paidTrial();

    await deliverWebhook(app, paymentId, { status: 'captured', eventId: 'evt_cap' });
    const late = await deliverWebhook(app, paymentId, { status: 'pending', eventId: 'evt_late' });

    expect(late.outcome).toBe('superseded');

    const status = await app.inject({
      method: 'GET',
      url: `/v1/me/checkout/${checkoutSessionId}/payment-status`,
      headers: session.headers,
    });
    expect(status.json<{ paymentStatus: string }>().paymentStatus).toBe('captured');
  });

  it('rejects a forged signature', async () => {
    const { paymentId } = await paidTrial();
    const result = await deliverWebhook(app, paymentId, { signature: 'deadbeef' });
    expect(result.statusCode).toBe(403);
  });

  it('parks an event for a payment it has never seen rather than making the provider retry', async () => {
    const body = JSON.stringify({
      providerEventId: 'evt_unknown_payment',
      kind: 'payment.captured',
      providerPaymentId: 'pay_mock_does_not_exist',
      providerOrderId: 'order_mock_does_not_exist',
      amountPaise: 89_900,
      status: 'captured',
      occurredAt: new Date().toISOString(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/payments/mock',
      headers: { 'content-type': 'application/json', 'x-mock-signature': signMockPayload(body) },
      payload: body,
    });

    // 200, not 5xx: a permanently unprocessable event must not be retried forever.
    expect(response.statusCode).toBe(200);
    expect(response.json<{ outcome: string }>().outcome).toBe('unknown_payment');

    const parked = await db
      .selectFrom('provider_events')
      .select(['error', 'processed_at'])
      .where('provider_event_id', '=', 'evt_unknown_payment')
      .executeTakeFirstOrThrow();
    expect(parked.error).toBe('unknown payment');
    expect(parked.processed_at).not.toBeNull();
  });
});

describe('idempotency', () => {
  it('replays the original response instead of charging twice', async () => {
    const session = await signIn(app);
    const { checkoutSessionId } = await setUpTrial(app, session);
    const key = uniqueKey();

    const first = await app.inject({
      method: 'POST',
      url: `/v1/me/checkout/${checkoutSessionId}/pay`,
      headers: { ...session.headers, 'idempotency-key': key },
      payload: { scenario: 'pending_forever' },
    });
    const second = await app.inject({
      method: 'POST',
      url: `/v1/me/checkout/${checkoutSessionId}/pay`,
      headers: { ...session.headers, 'idempotency-key': key },
      payload: { scenario: 'pending_forever' },
    });

    expect(second.json<{ paymentId: string }>().paymentId).toBe(
      first.json<{ paymentId: string }>().paymentId,
    );

    const payments = await db
      .selectFrom('payments')
      .select('id')
      .where('checkout_session_id', '=', checkoutSessionId)
      .execute();
    expect(payments).toHaveLength(1);
  });

  it('refuses the same key with a different body', async () => {
    const session = await signIn(app);
    const { checkoutSessionId } = await setUpTrial(app, session);
    const key = uniqueKey();

    await app.inject({
      method: 'POST',
      url: `/v1/me/checkout/${checkoutSessionId}/pay`,
      headers: { ...session.headers, 'idempotency-key': key },
      payload: { scenario: 'pending_forever' },
    });
    const reused = await app.inject({
      method: 'POST',
      url: `/v1/me/checkout/${checkoutSessionId}/pay`,
      headers: { ...session.headers, 'idempotency-key': key },
      payload: { scenario: 'success_immediate' },
    });

    expect(reused.statusCode).toBe(422);
    expect(reused.json<{ error: { code: string } }>().error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });
});

describe('meal changes', () => {
  async function scheduledTrial() {
    const session = await signIn(app);
    // Start a few days out so the first meal is comfortably inside its edit window.
    const { checkoutSessionId, dates } = await setUpTrial(app, session, { startOffset: 3 });
    const { paymentId } = await pay(app, session, checkoutSessionId);
    await deliverWebhook(app, paymentId);
    const state = await appState(app, session);
    const mealId = state.home!.week[0]!.markers[0]!.mealOrderId;
    return { session, mealId, dates };
  }

  it('reports what may be changed, and when the window closes', async () => {
    const { session, mealId } = await scheduledTrial();
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/me/meals/${mealId}`,
      headers: session.headers,
    });
    expect(detail.json()).toMatchObject({
      canChangeDate: true,
      canChangeAddress: true,
      canChangePreference: true,
      lockedReason: null,
    });
    expect(detail.json<{ cutoffAt: string }>().cutoffAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('moves a meal and re-sorts the week chronologically', async () => {
    const { session, mealId, dates } = await scheduledTrial();
    const target = futureWeekdays(1, 20)[0]!;

    const moved = await app.inject({
      method: 'PATCH',
      url: `/v1/me/meals/${mealId}/date`,
      headers: session.headers,
      payload: { newDate: target },
    });
    expect(moved.statusCode).toBe(200);
    expect(moved.json()).toMatchObject({ from: dates[0], to: target });

    const state = await appState(app, session);
    const week = state.home!.week.map((day) => day.date);
    expect(week).toEqual([...week].sort());
    expect(week).toContain(target);
    expect(week).not.toContain(dates[0]);
  });

  it('rejects a stale schedule version with a fresh Home payload', async () => {
    const { session, mealId } = await scheduledTrial();
    const target = futureWeekdays(1, 20)[0]!;
    const other = futureWeekdays(1, 25)[0]!;

    await app.inject({
      method: 'PATCH',
      url: `/v1/me/meals/${mealId}/date`,
      headers: session.headers,
      payload: { newDate: target, expectedScheduleVersion: 0 },
    });

    const stale = await app.inject({
      method: 'PATCH',
      url: `/v1/me/meals/${mealId}/date`,
      headers: session.headers,
      payload: { newDate: other, expectedScheduleVersion: 0 },
    });

    expect(stale.statusCode).toBe(409);
    const body = stale.json<{ error: { code: string; details: { currentVersion: number; home: unknown } } }>();
    expect(body.error.code).toBe('SCHEDULE_CONFLICT');
    expect(body.error.details.currentVersion).toBe(1);
    expect(body.error.details.home).not.toBeNull();
  });

  it('leaves the meal untouched when the new address is unserviceable', async () => {
    const { session, mealId } = await scheduledTrial();
    const unserviceable = await addAddress(app, session, '560001');

    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/me/meals/${mealId}/address`,
      headers: session.headers,
      payload: { addressId: unserviceable },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('PINCODE_NOT_SERVICEABLE');

    const order = await db
      .selectFrom('meal_orders')
      .select('address_id')
      .where('id', '=', mealId)
      .executeTakeFirstOrThrow();
    expect(order.address_id).not.toBe(unserviceable);
  });

  it('refuses a change once the cutoff has passed', async () => {
    const session = await signIn(app);
    const { checkoutSessionId } = await setUpTrial(app, session);
    const { paymentId } = await pay(app, session, checkoutSessionId);
    await deliverWebhook(app, paymentId);

    const state = await appState(app, session);
    const mealId = state.home!.week[0]!.markers[0]!.mealOrderId;

    // Drag the meal back to today, which is always past its cutoff.
    const today = new Date().toISOString().slice(0, 10);
    await db.updateTable('meal_orders').set({ service_date: today }).where('id', '=', mealId).execute();

    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/me/meals/${mealId}/preferences`,
      headers: session.headers,
      payload: { breadPreference: 'chapati' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('CUTOFF_PASSED');
  });
});

describe('coupons', () => {
  async function subscriptionCheckout() {
    const session = await signIn(app);
    await addAddress(app, session);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/subscriptions/checkout',
      headers: { ...session.headers, 'idempotency-key': uniqueKey() },
      payload: {
        planCode: 'monthly',
        mealPreference: 'both',
        foodPreference: 'vegetarian',
        breadPreference: 'bhakri',
        ricePreference: 'jeera_rice',
      },
    });
    return { session, checkoutSessionId: response.json<{ checkoutSessionId: string }>().checkoutSessionId };
  }

  const applyCoupon = async (session: { headers: Record<string, string> }, id: string, code: string) =>
    app.inject({
      method: 'POST',
      url: `/v1/me/checkout/${id}/apply-coupon`,
      headers: session.headers,
      payload: { code },
    });

  it('applies a valid coupon and recomputes the total', async () => {
    const { session, checkoutSessionId } = await subscriptionCheckout();
    const response = await applyCoupon(session, checkoutSessionId, 'HEALTHY300');
    expect(response.json()).toMatchObject({
      couponStatus: 'applied',
      priceBreakdown: { discountPaise: 30_000, totalPayablePaise: 469_900 },
    });
  });

  it('does not stack when applied twice', async () => {
    const { session, checkoutSessionId } = await subscriptionCheckout();
    await applyCoupon(session, checkoutSessionId, 'HEALTHY300');
    const again = await applyCoupon(session, checkoutSessionId, 'HEALTHY300');
    expect(again.json<{ priceBreakdown: { totalPayablePaise: number } }>().priceBreakdown.totalPayablePaise).toBe(
      469_900,
    );
  });

  it('explains a rejection without disturbing the total', async () => {
    const { session, checkoutSessionId } = await subscriptionCheckout();
    const response = await applyCoupon(session, checkoutSessionId, 'WELCOME10');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      couponStatus: 'ineligible_plan',
      couponCode: 'WELCOME10',
      priceBreakdown: { totalPayablePaise: 499_900 },
    });
  });

  it('restores the original total on removal', async () => {
    const { session, checkoutSessionId } = await subscriptionCheckout();
    await applyCoupon(session, checkoutSessionId, 'HEALTHY300');
    const removed = await app.inject({
      method: 'POST',
      url: `/v1/me/checkout/${checkoutSessionId}/remove-coupon`,
      headers: session.headers,
      payload: {},
    });
    expect(removed.json<{ priceBreakdown: { totalPayablePaise: number } }>().priceBreakdown.totalPayablePaise).toBe(
      499_900,
    );
  });
});
