import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../platform/db/index.js';
import { env } from '../platform/config/env.js';
import { drainOutbox } from '../jobs/drainOutbox.js';
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
  type Session,
} from './harness.js';

let app: App;

beforeAll(async () => {
  app = await getApp();
});

beforeEach(async () => {
  await resetData();
});

const ADMIN = { 'x-admin-key': env.ADMIN_API_KEY, 'x-operator': 'ops-tester', 'content-type': 'application/json' };

async function scheduledTrial(): Promise<{ session: Session; mealIds: string[] }> {
  const session = await signIn(app);
  const { checkoutSessionId } = await setUpTrial(app, session, { startOffset: 3 });
  const { paymentId } = await pay(app, session, checkoutSessionId);
  await deliverWebhook(app, paymentId);
  const state = await appState(app, session);
  return { session, mealIds: state.home!.week.flatMap((day) => day.markers.map((m) => m.mealOrderId)) };
}

/** A plain calendar offset. futureWeekdays() always moves forward, so it cannot
 *  express "yesterday" — using it with a negative offset silently returns a
 *  future date. */
const daysFromToday = (offset: number): string =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const setStatus = (mealOrderId: string, status: string, note?: string) =>
  app.inject({
    method: 'PATCH',
    url: `/v1/ops/meals/${mealOrderId}/status`,
    headers: ADMIN,
    payload: { status, ...(note ? { note } : {}) },
  });

describe('ops auth', () => {
  it('refuses without an admin key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/ops/deliveries',
      headers: { 'x-operator': 'someone' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('refuses a wrong key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/ops/deliveries',
      headers: { 'x-admin-key': 'wrong-key-entirely-here', 'x-operator': 'someone' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('insists on an operator name so actions stay attributable', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/ops/deliveries',
      headers: { 'x-admin-key': env.ADMIN_API_KEY },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: { message: string } }>().error.message).toContain('attributable');
  });
});

describe('delivery status drives lifecycle state', () => {
  it('moves a subscriber Home into the delayed state', async () => {
    const { session, mealIds } = await scheduledTrial();
    // Delivery exceptions are gated to subscription sources by policy, so make
    // this order look like one.
    await db.updateTable('meal_orders').set({ source_type: 'subscription' }).where('id', '=', mealIds[0]!).execute();

    const response = await setStatus(mealIds[0]!, 'delayed', 'Traffic on Baner Road');
    expect(response.json()).toMatchObject({ status: 'delayed', changed: true });

    const state = await appState(app, session);
    expect(state.lifecycleState).toBe('DELIVERY_DELAYED');
    expect(state.legacyStateId).toBe('Q');
  });

  it('moves Home into the failed-delivery state', async () => {
    const { session, mealIds } = await scheduledTrial();
    await db.updateTable('meal_orders').set({ source_type: 'subscription' }).where('id', '=', mealIds[0]!).execute();

    await setStatus(mealIds[0]!, 'delivery_failed', 'Nobody at the address');

    const state = await appState(app, session);
    expect(state.lifecycleState).toBe('DELIVERY_FAILED');
    expect(state.legacyStateId).toBe('R');
  });

  it('records an event trail and an audit entry', async () => {
    const { mealIds } = await scheduledTrial();
    await setStatus(mealIds[0]!, 'preparing');
    await setStatus(mealIds[0]!, 'out_for_delivery');
    await setStatus(mealIds[0]!, 'delivered');

    const events = await db
      .selectFrom('meal_order_events')
      .select(['ops_status', 'actor'])
      .where('meal_order_id', '=', mealIds[0]!)
      .orderBy('occurred_at')
      .execute();
    expect(events.map((e) => e.ops_status)).toEqual(['preparing', 'out_for_delivery', 'delivered']);
    expect(events.every((e) => e.actor === 'ops-tester')).toBe(true);

    const audit = await db
      .selectFrom('audit_logs')
      .select('actor_id')
      .where('entity_id', '=', mealIds[0]!)
      .where('action', '=', 'delivery.status_changed')
      .execute();
    expect(audit).toHaveLength(3);
  });

  it('refuses to un-deliver a meal, which would unwind points already awarded', async () => {
    const { mealIds } = await scheduledTrial();
    await setStatus(mealIds[0]!, 'delivered');

    const response = await setStatus(mealIds[0]!, 'preparing');
    expect(response.statusCode).toBe(422);
    expect(response.json<{ error: { message: string } }>().error.message).toContain('already delivered');
  });

  it('is a no-op when the status is unchanged', async () => {
    const { mealIds } = await scheduledTrial();
    await setStatus(mealIds[0]!, 'delivered');
    const again = await setStatus(mealIds[0]!, 'delivered');
    expect(again.json<{ changed: boolean }>().changed).toBe(false);
  });

  it('awards a leaderboard point per delivered meal, once', async () => {
    const { session, mealIds } = await scheduledTrial();
    await setStatus(mealIds[0]!, 'delivered');
    await setStatus(mealIds[1]!, 'delivered');
    await drainOutbox();
    await drainOutbox();

    const board = await app.inject({
      method: 'GET',
      url: '/v1/loyalty/leaderboard',
      headers: session.headers,
    });
    expect(board.json<{ me: { points: number } }>().me.points).toBe(20);
  });
});

describe('production schedule', () => {
  it('aggregates what the kitchen must cook', async () => {
    const { mealIds } = await scheduledTrial();
    const order = await db
      .selectFrom('meal_orders')
      .select('service_date')
      .where('id', '=', mealIds[0]!)
      .executeTakeFirstOrThrow();

    const response = await app.inject({
      method: 'GET',
      url: `/v1/ops/production?date=${order.service_date}`,
      headers: ADMIN,
    });
    const body = response.json<{
      totalMeals: number;
      breakdown: Array<{ slot: string; count: number }>;
      byPincode: Array<{ pincode: string; count: number }>;
    }>();

    expect(body.totalMeals).toBe(1);
    expect(body.breakdown[0]).toMatchObject({ slot: 'lunch', count: 1 });
    expect(body.byPincode[0]).toMatchObject({ pincode: '411045', count: 1 });
  });
});

describe('feedback', () => {
  it('accepts a rating on a delivered meal and scores it once', async () => {
    const { session, mealIds } = await scheduledTrial();
    await setStatus(mealIds[0]!, 'delivered');

    const first = await app.inject({
      method: 'POST',
      url: `/v1/me/meals/${mealIds[0]}/feedback`,
      headers: session.headers,
      payload: { rating: 5, tags: ['Tasty'], note: 'Lovely bhakri' },
    });
    expect(first.json()).toMatchObject({ rating: 5, pointsAwarded: true });

    // Resubmitting updates the text but must not pay again.
    const second = await app.inject({
      method: 'POST',
      url: `/v1/me/meals/${mealIds[0]}/feedback`,
      headers: session.headers,
      payload: { rating: 4 },
    });
    expect(second.json<{ pointsAwarded: boolean }>().pointsAwarded).toBe(false);

    const points = await db
      .selectFrom('leaderboard_points')
      .select('id')
      .where('event_kind', '=', 'meal_rated')
      .execute();
    expect(points).toHaveLength(1);
  });

  it('refuses a rating before the meal is delivered', async () => {
    const { session, mealIds } = await scheduledTrial();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/me/meals/${mealIds[0]}/feedback`,
      headers: session.headers,
      payload: { rating: 5 },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json<{ error: { message: string } }>().error.message).toContain('delivered');
  });

  it('raises a support issue that ops can resolve with a credit', async () => {
    const { session, mealIds } = await scheduledTrial();
    const reported = await app.inject({
      method: 'POST',
      url: `/v1/me/meals/${mealIds[0]}/report-issue`,
      headers: session.headers,
      payload: { category: 'missing_item', description: 'No pickle' },
    });
    const issueId = reported.json<{ issueId: string }>().issueId;

    const open = await app.inject({ method: 'GET', url: '/v1/ops/support-issues', headers: ADMIN });
    expect(open.json<{ issues: Array<{ id: string }> }>().issues.map((i) => i.id)).toContain(issueId);

    const resolved = await app.inject({
      method: 'POST',
      url: `/v1/ops/support-issues/${issueId}/resolve`,
      headers: ADMIN,
      payload: { status: 'resolved', resolution: 'Credited for the missing item', creditPaise: 5000 },
    });
    expect(resolved.json()).toMatchObject({ status: 'resolved', creditPaise: 5000 });

    const credits = await app.inject({
      method: 'GET',
      url: '/v1/me/transactions?filter=refunds_credits',
      headers: session.headers,
    });
    expect(
      credits.json<{ groups: Array<{ transactions: Array<{ displayAmount: string }> }> }>().groups[0]!
        .transactions[0]!.displayAmount,
    ).toBe('₹50');
  });
});

describe('refunds reverse the points they earned', () => {
  it('reverses meal points when the meal is refunded', async () => {
    const { session, mealIds } = await scheduledTrial();
    await setStatus(mealIds[0]!, 'delivered');
    await drainOutbox();

    const before = await app.inject({
      method: 'GET',
      url: '/v1/loyalty/leaderboard',
      headers: session.headers,
    });
    expect(before.json<{ me: { points: number } }>().me.points).toBe(10);

    const refund = await app.inject({
      method: 'POST',
      url: '/v1/ops/refunds',
      headers: ADMIN,
      payload: {
        userId: session.userId,
        amountPaise: 17_980,
        reason: 'Meal never arrived',
        reversePointsFor: { sourceType: 'meal_order', sourceId: mealIds[0] },
      },
    });
    expect(refund.json<{ pointsReversed: number }>().pointsReversed).toBe(1);

    const after = await app.inject({
      method: 'GET',
      url: '/v1/loyalty/leaderboard',
      headers: session.headers,
    });
    expect(after.json<{ me: { points: number } }>().me.points).toBe(0);
  });
});

describe('subscription management', () => {
  async function paidSubscription(): Promise<Session> {
    const session = await signIn(app);
    await addAddress(app, session);
    const checkout = await app.inject({
      method: 'POST',
      url: '/v1/me/subscriptions/checkout',
      headers: { ...session.headers, 'idempotency-key': uniqueKey() },
      payload: {
        planCode: 'monthly',
        mealPreference: 'lunch',
        foodPreference: 'vegetarian',
        breadPreference: 'bhakri',
        ricePreference: 'jeera_rice',
      },
    });
    const { paymentId } = await pay(
      app,
      session,
      checkout.json<{ checkoutSessionId: string }>().checkoutSessionId,
    );
    await deliverWebhook(app, paymentId);
    // Backdate so the plan is running rather than scheduled.
    await db
      .updateTable('subscriptions')
      .set({ starts_on: daysFromToday(-10) })
      .where('user_id', '=', session.userId)
      .execute();
    return session;
  }

  it('cancels at period end, keeping paid meals', async () => {
    const session = await paidSubscription();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/subscriptions/cancel',
      headers: session.headers,
      payload: { reason: 'Travelling' },
    });

    const body = response.json<{ status: string; remainingMeals: number; message: string }>();
    expect(body.status).toBe('cancelled_at_period_end');
    expect(body.remainingMeals).toBeGreaterThan(0);
    expect(body.message).toContain('still arrive');

    const state = await appState(app, session);
    expect(state.lifecycleState).toBe('SUBSCRIPTION_ENDING');
    expect(state.legacyStateId).toBe('N');
  });

  it('reactivates a cancelled plan while it is still running', async () => {
    const session = await paidSubscription();
    await app.inject({
      method: 'POST',
      url: '/v1/me/subscriptions/cancel',
      headers: session.headers,
      payload: {},
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/subscriptions/resubscribe',
      headers: session.headers,
      payload: {},
    });
    expect(response.json<{ status: string }>().status).toBe('paid');

    const state = await appState(app, session);
    expect(['SUBSCRIPTION_ACTIVE', 'SUBSCRIPTION_NO_MEAL_TODAY']).toContain(state.lifecycleState);
  });

  it('pauses into state M and clears untouched meals in the window', async () => {
    const session = await paidSubscription();
    const from = futureWeekdays(1, 1)[0]!;
    const to = futureWeekdays(1, 12)[0]!;

    const paused = await app.inject({
      method: 'POST',
      url: '/v1/me/subscriptions/pause',
      headers: session.headers,
      payload: { from, to },
    });
    expect(paused.json()).toMatchObject({ pauseFrom: from, pauseTo: to });

    const remaining = await db
      .selectFrom('meal_orders')
      .select('id')
      .where('user_id', '=', session.userId)
      .where('service_date', '>=', from)
      .where('service_date', '<=', to)
      .execute();
    expect(remaining).toHaveLength(0);

    // The pause window starts tomorrow, so today is still active; move the clock
    // forward by shifting the window to include today.
    await db
      .updateTable('subscriptions')
      .set({ pause_from: daysFromToday(-1) })
      .where('user_id', '=', session.userId)
      .execute();

    const state = await appState(app, session);
    expect(state.lifecycleState).toBe('SUBSCRIPTION_PAUSED');
    expect(state.legacyStateId).toBe('M');
  });

  it('refuses a pause starting today', async () => {
    const session = await paidSubscription();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/subscriptions/pause',
      headers: session.headers,
      payload: { from: new Date().toISOString().slice(0, 10), to: null },
    });
    expect(response.statusCode).toBe(422);
  });

  it('resumes a paused subscription', async () => {
    const session = await paidSubscription();
    await app.inject({
      method: 'POST',
      url: '/v1/me/subscriptions/pause',
      headers: session.headers,
      payload: { from: futureWeekdays(1, 1)[0]!, to: null },
    });
    const resumed = await app.inject({
      method: 'POST',
      url: '/v1/me/subscriptions/resume',
      headers: session.headers,
      payload: {},
    });
    expect(resumed.json<{ status: string }>().status).toBe('resumed');
  });
});
