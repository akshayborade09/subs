import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../platform/db/index.js';
import { drainOutbox } from '../jobs/drainOutbox.js';
import { evaluateLoyalty } from '../modules/loyalty/service.js';
import { addAddress, deliverWebhook, getApp, pay, resetData, signIn, uniqueKey, type App, type Session } from './harness.js';

let app: App;

beforeAll(async () => {
  app = await getApp();
});

beforeEach(async () => {
  await resetData();
});

const get = (session: Session, url: string) =>
  app.inject({ method: 'GET', url, headers: session.headers });

const iso = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** A paid subscriber whose period started far enough back to qualify. */
async function qualifiedSubscriber(): Promise<Session> {
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
  const checkoutId = checkout.json<{ checkoutSessionId: string }>().checkoutSessionId;
  const { paymentId } = await pay(app, session, checkoutId);
  await deliverWebhook(app, paymentId);

  // Backdate the period and mark 20 delivered days, which is what the rule needs.
  const start = iso(-30);
  await db.updateTable('subscriptions').set({ starts_on: start }).where('user_id', '=', session.userId).execute();

  const address = await db
    .selectFrom('addresses')
    .select('id')
    .where('user_id', '=', session.userId)
    .executeTakeFirstOrThrow();
  const subscription = await db
    .selectFrom('subscriptions')
    .select('id')
    .where('user_id', '=', session.userId)
    .executeTakeFirstOrThrow();

  await db
    .insertInto('meal_orders')
    .values(
      Array.from({ length: 20 }, (_, i) => ({
        user_id: session.userId,
        source_type: 'subscription' as const,
        source_id: subscription.id,
        service_date: iso(-29 + i),
        slot: 'lunch' as const,
        food_type: 'vegetarian' as const,
        bread_preference: 'bhakri',
        rice_preference: 'jeera_rice',
        address_id: address.id,
        ops_status: 'delivered' as const,
      })),
    )
    .onConflict((oc) => oc.columns(['source_type', 'source_id', 'service_date', 'slot']).doNothing())
    .execute();

  return session;
}

describe('Healthy Streak', () => {
  it('reports progress and states the exact rule', async () => {
    const session = await qualifiedSubscriber();
    const progress = (await get(session, '/v1/me/loyalty/progress')).json<{
      status: string;
      activeDays: number;
      fulfilledMealDays: number;
      ruleStatement: string;
    }>();

    expect(progress.ruleStatement).toBe(
      '28 continuous active days with at least 20 delivered meal days.',
    );
    expect(progress.activeDays).toBe(28);
    expect(progress.fulfilledMealDays).toBe(20);
    expect(progress.status).toBe('qualified');
  });

  it('mints exactly one reward however often the reconciler runs', async () => {
    const session = await qualifiedSubscriber();

    expect(await evaluateLoyalty()).toBe(1);
    expect(await evaluateLoyalty()).toBe(0);
    expect(await evaluateLoyalty()).toBe(0);

    const rewards = (await get(session, '/v1/me/rewards')).json<{
      rewards: Array<{ source: string; status: string }>;
    }>();
    expect(rewards.rewards).toHaveLength(1);
    expect(rewards.rewards[0]).toMatchObject({ source: 'loyalty', status: 'earned' });
  });

  it('freezes progress while a renewal payment is unresolved', async () => {
    const session = await qualifiedSubscriber();
    await db
      .updateTable('subscriptions')
      .set({ renewal_failed_at: new Date() })
      .where('user_id', '=', session.userId)
      .execute();

    const progress = (await get(session, '/v1/me/loyalty/progress')).json<{
      status: string;
      activeDays: number;
    }>();
    expect(progress.status).toBe('frozen');
    // Frozen keeps what was earned rather than discarding it.
    expect(progress.activeDays).toBe(28);
    expect(await evaluateLoyalty()).toBe(0);
  });

  it('redeems onto a chosen date, creating a reward-sourced meal', async () => {
    const session = await qualifiedSubscriber();
    await evaluateLoyalty();

    const rewardId = (await get(session, '/v1/me/rewards')).json<{ rewards: Array<{ id: string }> }>()
      .rewards[0]!.id;
    const dates = (await get(session, '/v1/me/rewards/eligible-dates')).json<{ dates: string[] }>().dates;
    expect(dates.length).toBeGreaterThan(0);

    const redeemed = await app.inject({
      method: 'POST',
      url: `/v1/me/rewards/${rewardId}/redeem`,
      headers: session.headers,
      payload: { serviceDate: dates[0] },
    });
    expect(redeemed.json()).toMatchObject({ serviceDate: dates[0], mealsCreated: 1 });

    const order = await db
      .selectFrom('meal_orders')
      .selectAll()
      .where('source_type', '=', 'reward')
      .where('user_id', '=', session.userId)
      .executeTakeFirstOrThrow();
    expect(order.service_date).toBe(dates[0]);

    // And it shows up as a ₹0 ledger entry disclosing what it was.
    const tx = (await get(session, '/v1/me/transactions?filter=rewards')).json<{
      groups: Array<{ transactions: Array<{ displayAmount: string; amountPaise: number | null }> }>;
    }>();
    expect(tx.groups[0]!.transactions[0]).toMatchObject({
      displayAmount: 'Free meal day',
      amountPaise: null,
    });
  });

  it('refuses to redeem the same reward twice', async () => {
    const session = await qualifiedSubscriber();
    await evaluateLoyalty();
    const rewardId = (await get(session, '/v1/me/rewards')).json<{ rewards: Array<{ id: string }> }>()
      .rewards[0]!.id;
    const dates = (await get(session, '/v1/me/rewards/eligible-dates')).json<{ dates: string[] }>().dates;

    await app.inject({
      method: 'POST',
      url: `/v1/me/rewards/${rewardId}/redeem`,
      headers: session.headers,
      payload: { serviceDate: dates[0] },
    });
    const again = await app.inject({
      method: 'POST',
      url: `/v1/me/rewards/${rewardId}/redeem`,
      headers: session.headers,
      payload: { serviceDate: dates[1] },
    });

    expect(again.statusCode).toBe(422);
    expect(again.json<{ error: { message: string } }>().error.message).toContain('already been used');
  });

  it('refuses an expired reward', async () => {
    const session = await qualifiedSubscriber();
    await evaluateLoyalty();
    const rewardId = (await get(session, '/v1/me/rewards')).json<{ rewards: Array<{ id: string }> }>()
      .rewards[0]!.id;
    await db.updateTable('rewards').set({ expires_on: iso(-1) }).where('id', '=', rewardId).execute();

    const dates = (await get(session, '/v1/me/rewards/eligible-dates')).json<{ dates: string[] }>().dates;
    const response = await app.inject({
      method: 'POST',
      url: `/v1/me/rewards/${rewardId}/redeem`,
      headers: session.headers,
      payload: { serviceDate: dates[0] },
    });
    expect(response.json<{ error: { message: string } }>().error.message).toContain('expired');
  });
});

describe('referrals', () => {
  it('rejects a self-referral', async () => {
    const session = await signIn(app);
    const code = (await get(session, '/v1/me/referrals')).json<{ code: string }>().code;

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/referrals/apply',
      headers: session.headers,
      payload: { code },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json<{ error: { message: string } }>().error.message).toContain('your own');
  });

  it('rejects an unknown code', async () => {
    const session = await signIn(app);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/referrals/apply',
      headers: session.headers,
      payload: { code: 'HTZZZZZZ' },
    });
    expect(response.json<{ error: { message: string } }>().error.message).toContain('does not exist');
  });

  it('pays out only after the friend actually pays, never on signup', async () => {
    const referrer = await signIn(app);
    const code = (await get(referrer, '/v1/me/referrals')).json<{ code: string }>().code;

    const friend = await signIn(app);
    await app.inject({
      method: 'POST',
      url: '/v1/me/referrals/apply',
      headers: friend.headers,
      payload: { code },
    });

    // Signed up, not yet paid: no reward.
    let overview = (await get(referrer, '/v1/me/referrals')).json<{
      qualifiedCount: number;
      referrals: Array<{ status: string; friend: string }>;
    }>();
    expect(overview.referrals).toHaveLength(1);
    expect(overview.referrals[0]!.status).toBe('signed_up');
    expect(overview.qualifiedCount).toBe(0);
    expect((await get(referrer, '/v1/me/rewards')).json<{ rewards: unknown[] }>().rewards).toHaveLength(0);

    // Friend pays.
    await addAddress(app, friend);
    const checkout = await app.inject({
      method: 'POST',
      url: '/v1/me/subscriptions/checkout',
      headers: { ...friend.headers, 'idempotency-key': uniqueKey() },
      payload: {
        planCode: 'weekly',
        mealPreference: 'lunch',
        foodPreference: 'vegetarian',
        breadPreference: 'bhakri',
        ricePreference: 'jeera_rice',
      },
    });
    const { paymentId } = await pay(app, friend, checkout.json<{ checkoutSessionId: string }>().checkoutSessionId);
    await deliverWebhook(app, paymentId);

    overview = (await get(referrer, '/v1/me/referrals')).json<{
      qualifiedCount: number;
      referrals: Array<{ status: string; friend: string }>;
    }>();
    expect(overview.referrals[0]!.status).toBe('rewarded');
    expect(overview.qualifiedCount).toBe(1);

    const rewards = (await get(referrer, '/v1/me/rewards')).json<{
      rewards: Array<{ source: string }>;
    }>();
    expect(rewards.rewards).toHaveLength(1);
    expect(rewards.rewards[0]!.source).toBe('referral');
  });

  it('shows only privacy-safe friend details', async () => {
    const referrer = await signIn(app);
    const code = (await get(referrer, '/v1/me/referrals')).json<{ code: string }>().code;
    const friend = await signIn(app);
    await app.inject({
      method: 'PATCH',
      url: '/v1/me/profile',
      headers: friend.headers,
      payload: { fullName: 'Priya Sharma' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/me/referrals/apply',
      headers: friend.headers,
      payload: { code },
    });

    const overview = (await get(referrer, '/v1/me/referrals')).json<{
      referrals: Array<{ friend: string }>;
    }>();
    expect(overview.referrals[0]!.friend).toBe('P•••••');
    expect(overview.referrals[0]!.friend).not.toContain('Sharma');
  });
});

describe('leaderboard', () => {
  it('awards points for delivered meals, once each', async () => {
    const session = await qualifiedSubscriber();

    const orders = await db
      .selectFrom('meal_orders')
      .select('id')
      .where('user_id', '=', session.userId)
      .where('ops_status', '=', 'delivered')
      .limit(3)
      .execute();

    for (const order of orders) {
      await db
        .insertInto('outbox_events')
        .values({
          event_name: 'meal.delivered',
          aggregate_type: 'meal_order',
          aggregate_id: order.id,
          user_id: session.userId,
          payload: {},
        })
        .execute();
    }

    await drainOutbox();
    await drainOutbox(); // a second drain must not double-score

    const board = (await get(session, '/v1/loyalty/leaderboard')).json<{
      me: { points: number; rank: number | null };
    }>();
    expect(board.me.points).toBe(30);
    expect(board.me.rank).toBe(1);
  });

  it('hides an opted-out user from the public list but keeps their rank', async () => {
    const session = await qualifiedSubscriber();
    const order = await db
      .selectFrom('meal_orders')
      .select('id')
      .where('user_id', '=', session.userId)
      .executeTakeFirstOrThrow();
    await db
      .insertInto('outbox_events')
      .values({
        event_name: 'meal.delivered',
        aggregate_type: 'meal_order',
        aggregate_id: order.id,
        user_id: session.userId,
        payload: {},
      })
      .execute();
    await drainOutbox();

    await app.inject({
      method: 'PATCH',
      url: '/v1/me/notification-preferences',
      headers: session.headers,
      payload: { leaderboardOptIn: false },
    });

    const board = (await get(session, '/v1/loyalty/leaderboard')).json<{
      top: Array<{ isCurrentUser: boolean }>;
      me: { rank: number | null; points: number; optedIn: boolean; pinned: boolean };
    }>();
    expect(board.top.some((entry) => entry.isCurrentUser)).toBe(false);
    // Opting out of the public list must not cost the user their own standing.
    expect(board.me.rank).toBe(1);
    expect(board.me.points).toBe(10);
    expect(board.me.optedIn).toBe(false);
    expect(board.me.pinned).toBe(true);
  });

  it('reports zero for a user with no activity', async () => {
    const session = await signIn(app);
    const board = (await get(session, '/v1/loyalty/leaderboard')).json<{
      me: { rank: number | null; points: number };
      top: unknown[];
    }>();
    expect(board.me.points).toBe(0);
    expect(board.me.rank).toBeNull();
  });
});
