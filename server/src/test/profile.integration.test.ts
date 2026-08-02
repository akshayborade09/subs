import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../platform/db/index.js';
import { drainOutbox } from '../jobs/drainOutbox.js';
import {
  addAddress,
  deliverWebhook,
  getApp,
  pay,
  resetData,
  setUpTrial,
  signIn,
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

const get = (session: Session, url: string) =>
  app.inject({ method: 'GET', url, headers: session.headers });

describe('profile hub', () => {
  it('labels a user with no plan', async () => {
    const session = await signIn(app);
    const body = (await get(session, '/v1/me/profile-hub')).json();
    expect(body).toMatchObject({
      lifecycleLabel: 'No Active Plan',
      planDestination: 'choose_subscription',
      savedAddresses: 0,
      unreadNotifications: 0,
    });
  });

  it('labels a trial user and points My Plan at trial details', async () => {
    const session = await signIn(app);
    const { checkoutSessionId } = await setUpTrial(app, session);
    const { paymentId } = await pay(app, session, checkoutSessionId);
    await deliverWebhook(app, paymentId);

    const body = (await get(session, '/v1/me/profile-hub')).json<{
      lifecycleLabel: string;
      planDestination: string;
      savedAddresses: number;
    }>();
    expect(body.lifecycleLabel).toBe('Trial');
    expect(body.planDestination).toBe('trial_details');
    expect(body.savedAddresses).toBe(1);
  });

  it('masks the phone number and exposes the referral code', async () => {
    const session = await signIn(app);
    const body = (await get(session, '/v1/me/profile-hub')).json<{
      phoneNumberMasked: string;
      referralCode: string;
    }>();
    expect(body.phoneNumberMasked).toMatch(/^\+91 •{6}\d{4}$/);
    expect(body.referralCode).toMatch(/^HT[A-Z2-9]{6}$/);
  });
});

describe('notification preferences', () => {
  it('defaults operational channels on and promotions off', async () => {
    const session = await signIn(app);
    expect((await get(session, '/v1/me/notification-preferences')).json()).toMatchObject({
      delivery: true,
      payment: true,
      offers: false,
      appearance: 'system',
      operationalChannels: ['delivery', 'payment'],
    });
  });

  it('updates optional channels', async () => {
    const session = await signIn(app);
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/me/notification-preferences',
      headers: session.headers,
      payload: { offers: true, appearance: 'dark', leaderboardOptIn: false },
    });
    expect(response.json()).toMatchObject({
      offers: true,
      appearance: 'dark',
      leaderboardOptIn: false,
    });
  });

  it('refuses to disable delivery alerts while meals are upcoming', async () => {
    const session = await signIn(app);
    const { checkoutSessionId } = await setUpTrial(app, session);
    const { paymentId } = await pay(app, session, checkoutSessionId);
    await deliverWebhook(app, paymentId);

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/me/notification-preferences',
      headers: session.headers,
      payload: { delivery: false },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json<{ error: { message: string } }>().error.message).toContain('upcoming meals');

    // And the stored value is untouched.
    expect((await get(session, '/v1/me/notification-preferences')).json<{ delivery: boolean }>().delivery).toBe(
      true,
    );
  });

  it('allows disabling delivery alerts once nothing is scheduled', async () => {
    const session = await signIn(app);
    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/me/notification-preferences',
      headers: session.headers,
      payload: { delivery: false },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ delivery: boolean }>().delivery).toBe(false);
  });
});

describe('notification centre', () => {
  it('surfaces what the outbox produced, and marks it read', async () => {
    const session = await signIn(app);
    const { checkoutSessionId } = await setUpTrial(app, session);
    const { paymentId } = await pay(app, session, checkoutSessionId);
    await deliverWebhook(app, paymentId);

    // The worker runs this on a timer in production; drive it directly here.
    await drainOutbox();

    const listed = (await get(session, '/v1/me/notifications')).json<{
      unread: number;
      notifications: Array<{ title: string; category: string }>;
    }>();
    expect(listed.unread).toBeGreaterThan(0);
    expect(listed.notifications.map((n) => n.title)).toContain('Your trial is confirmed');

    const marked = await app.inject({
      method: 'POST',
      url: '/v1/me/notifications/read',
      headers: session.headers,
      payload: {},
    });
    expect(marked.json<{ marked: number }>().marked).toBe(listed.unread);

    expect((await get(session, '/v1/me/notifications')).json<{ unread: number }>().unread).toBe(0);
  });
});

describe('transactions', () => {
  async function paidTrial() {
    const session = await signIn(app);
    const { checkoutSessionId } = await setUpTrial(app, session);
    const { paymentId } = await pay(app, session, checkoutSessionId);
    await deliverWebhook(app, paymentId);
    return { session, paymentId };
  }

  it('groups payments by month with a formatted amount', async () => {
    const { session } = await paidTrial();
    const body = (await get(session, '/v1/me/transactions')).json<{
      groups: Array<{ label: string; transactions: Array<{ displayAmount: string; title: string }> }>;
    }>();

    expect(body.groups).toHaveLength(1);
    expect(body.groups[0]!.transactions[0]).toMatchObject({
      title: 'Five-day trial',
      displayAmount: '₹899',
      status: 'succeeded',
    });
  });

  it('filters to rewards, which carry a label instead of an amount', async () => {
    const { session } = await paidTrial();
    await db
      .insertInto('transactions')
      .values({
        user_id: session.userId,
        type: 'reward',
        title: 'Healthy Streak reward',
        amount_paise: null,
        display_amount: 'Free meal day',
        status: 'credited',
      })
      .execute();

    const rewards = (await get(session, '/v1/me/transactions?filter=rewards')).json<{
      groups: Array<{ transactions: Array<{ amountPaise: number | null; displayAmount: string }> }>;
    }>();
    expect(rewards.groups[0]!.transactions[0]).toMatchObject({
      amountPaise: null,
      displayAmount: 'Free meal day',
    });

    const payments = (await get(session, '/v1/me/transactions?filter=payments')).json<{
      groups: Array<{ transactions: Array<{ type: string }> }>;
    }>();
    expect(payments.groups[0]!.transactions.every((t) => t.type === 'payment')).toBe(true);
  });

  it('returns a receipt with the breakdown and a status timeline', async () => {
    const { session } = await paidTrial();
    const list = (await get(session, '/v1/me/transactions')).json<{
      groups: Array<{ transactions: Array<{ id: string }> }>;
    }>();
    const id = list.groups[0]!.transactions[0]!.id;

    const detail = (await get(session, `/v1/me/transactions/${id}`)).json<{
      paymentMethod: string | null;
      priceBreakdown: { totalPayablePaise: number } | null;
      timeline: Array<{ label: string }>;
      reference: string | null;
    }>();

    expect(detail.paymentMethod).toBe('upi');
    expect(detail.priceBreakdown?.totalPayablePaise).toBe(89_900);
    expect(detail.timeline.map((step) => step.label)).toEqual(['Initiated', 'Completed']);
    expect(detail.reference).toMatch(/^TRIAL-/);
  });

  it('does not leak another user\'s receipt', async () => {
    const { session } = await paidTrial();
    const list = (await get(session, '/v1/me/transactions')).json<{
      groups: Array<{ transactions: Array<{ id: string }> }>;
    }>();
    const id = list.groups[0]!.transactions[0]!.id;

    const other = await signIn(app);
    await addAddress(app, other);
    const response = await get(other, `/v1/me/transactions/${id}`);
    expect(response.statusCode).toBe(404);
  });
});

describe('coupon usage limits are actually enforced', () => {
  /**
   * Regression: coupon_redemptions.consumed_at was never set, and the usage
   * counter only counts consumed rows — so per-user limits silently did nothing.
   * The eligibility unit tests could not catch it, because they are handed the
   * usage count rather than deriving it.
   */
  async function weeklyCheckout(session: Session): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/subscriptions/checkout',
      headers: { ...session.headers, 'idempotency-key': `k-${Math.round(performance.now() * 1000)}` },
      payload: {
        planCode: 'weekly',
        mealPreference: 'lunch',
        foodPreference: 'vegetarian',
        breadPreference: 'bhakri',
        ricePreference: 'jeera_rice',
      },
    });
    return response.json<{ checkoutSessionId: string }>().checkoutSessionId;
  }

  it('marks a redemption consumed once the payment captures', async () => {
    const session = await signIn(app);
    await addAddress(app, session);
    const checkoutId = await weeklyCheckout(session);

    await app.inject({
      method: 'POST',
      url: `/v1/me/checkout/${checkoutId}/apply-coupon`,
      headers: session.headers,
      payload: { code: 'WELCOME10' },
    });

    const before = await db
      .selectFrom('coupon_redemptions')
      .select('consumed_at')
      .where('checkout_session_id', '=', checkoutId)
      .executeTakeFirstOrThrow();
    expect(before.consumed_at).toBeNull();

    const { paymentId } = await pay(app, session, checkoutId);
    await deliverWebhook(app, paymentId);

    const after = await db
      .selectFrom('coupon_redemptions')
      .select('consumed_at')
      .where('checkout_session_id', '=', checkoutId)
      .executeTakeFirstOrThrow();
    expect(after.consumed_at).not.toBeNull();
  });

  it('refuses the same coupon a second time for that user', async () => {
    const session = await signIn(app);
    await addAddress(app, session);

    const first = await weeklyCheckout(session);
    await app.inject({
      method: 'POST',
      url: `/v1/me/checkout/${first}/apply-coupon`,
      headers: session.headers,
      payload: { code: 'WELCOME10' },
    });
    const { paymentId } = await pay(app, session, first);
    await deliverWebhook(app, paymentId);

    // Terminate the paid subscription so a second checkout is allowed.
    await db.updateTable('subscriptions').set({ status: 'terminated' }).where('user_id', '=', session.userId).execute();

    const second = await weeklyCheckout(session);
    const retry = await app.inject({
      method: 'POST',
      url: `/v1/me/checkout/${second}/apply-coupon`,
      headers: session.headers,
      payload: { code: 'WELCOME10' },
    });

    expect(retry.json()).toMatchObject({
      couponStatus: 'already_used',
      message: 'This coupon has already been used.',
    });
  });

  it('leaves the coupon reusable when the payment fails', async () => {
    const session = await signIn(app);
    await addAddress(app, session);
    const checkoutId = await weeklyCheckout(session);

    await app.inject({
      method: 'POST',
      url: `/v1/me/checkout/${checkoutId}/apply-coupon`,
      headers: session.headers,
      payload: { code: 'WELCOME10' },
    });
    const { paymentId } = await pay(app, session, checkoutId);
    await deliverWebhook(app, paymentId, { status: 'failed', failureCode: 'card_declined' });

    const row = await db
      .selectFrom('coupon_redemptions')
      .select('consumed_at')
      .where('checkout_session_id', '=', checkoutId)
      .executeTakeFirstOrThrow();
    expect(row.consumed_at).toBeNull();
  });
});
