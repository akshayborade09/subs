import { sql } from 'kysely';
import { buildApp } from '../http/app.js';
import { db } from '../platform/db/index.js';
import { env } from '../platform/config/env.js';
import { signMockPayload, type MockScenario } from '../modules/payments/provider.js';

/**
 * Integration harness. Boots the real Fastify app in-process via `inject`, so the
 * whole stack — validation, auth, transactions, webhooks — is exercised without a
 * listening server or Docker.
 *
 * Requires a Postgres to point at:
 *   DATABASE_URL=postgres://tiffins:tiffins@localhost:5432/tiffins_test pnpm test:integration
 */
export type App = Awaited<ReturnType<typeof buildApp>>;

let cached: App | null = null;

export async function getApp(): Promise<App> {
  if (!cached) {
    cached = await buildApp();
    await cached.ready();
  }
  return cached;
}

/**
 * Refuses to run against anything that is not obviously a throwaway database.
 *
 * This exists because it already went wrong: the unit-test glob matched
 * `*.integration.test.ts`, so `resetData()` ran with the default .env and
 * TRUNCATEd the development database. The vitest config now excludes them, but a
 * config is easy to get wrong twice — making the destructive statement itself
 * refuse is the guarantee that actually holds.
 */
function assertThrowawayDatabase(): void {
  const url = env.DATABASE_URL;
  const database = (url.slice(url.lastIndexOf('/') + 1).split('?')[0] ?? '').trim();
  if (!/(test|_ci|scratch)/i.test(database)) {
    throw new Error(
      `Refusing to TRUNCATE "${database}": integration tests must point at a database ` +
        `whose name contains "test". e.g. ` +
        `DATABASE_URL=postgres://tiffins:tiffins@localhost:5432/tiffins_test`,
    );
  }
}

/**
 * Wipes user-owned data between tests while leaving seeded reference data (plans,
 * pincodes, coupons) intact. TRUNCATE ... CASCADE on users pulls everything that
 * hangs off a user; the rest are standalone ledgers.
 */
export async function resetData(): Promise<void> {
  assertThrowawayDatabase();
  await sql`
    TRUNCATE users, otp_challenges, provider_events, outbox_events,
             outbox_deliveries, audit_logs, leaderboard_periods
    RESTART IDENTITY CASCADE
  `.execute(db);
}

export type Session = { token: string; userId: string; headers: Record<string, string> };

export async function signIn(app: App, phone = randomPhone()): Promise<Session> {
  const start = await app.inject({
    method: 'POST',
    url: '/v1/auth/otp/start',
    payload: { phone },
  });
  const { devCode } = start.json<{ devCode: string }>();

  const verify = await app.inject({
    method: 'POST',
    url: '/v1/auth/otp/verify',
    payload: { phone, code: devCode },
  });
  const body = verify.json<{ accessToken: string; userId: string }>();

  return {
    token: body.accessToken,
    userId: body.userId,
    headers: { authorization: `Bearer ${body.accessToken}`, 'content-type': 'application/json' },
  };
}

let phoneSeq = 0;
export function randomPhone(): string {
  phoneSeq += 1;
  // Deterministic within a run and unique across it, so a failure is reproducible.
  return `9${String(100000000 + phoneSeq).slice(0, 9)}`;
}

export function uniqueKey(): string {
  phoneSeq += 1;
  return `idem-${Date.now()}-${phoneSeq}`;
}

export async function addAddress(
  app: App,
  session: Session,
  pincode = '411045',
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/me/addresses',
    headers: session.headers,
    payload: {
      label: 'home',
      line1: 'B-704, Green View Apartments',
      city: 'Pune',
      state: 'Maharashtra',
      pincode,
    },
  });
  return response.json<{ id: string }>().id;
}

/** Five future weekdays, optionally skipping ahead so the first is still editable. */
export function futureWeekdays(count = 5, startOffset = 1): string[] {
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() + startOffset - 1);
  while (dates.length < count) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

export async function setUpTrial(
  app: App,
  session: Session,
  options: { startOffset?: number; mealPreference?: 'lunch' | 'dinner' | 'both' } = {},
): Promise<{ addressId: string; dates: string[]; checkoutSessionId: string }> {
  const addressId = await addAddress(app, session);

  await app.inject({ method: 'POST', url: '/v1/me/trial/draft', headers: session.headers });
  await app.inject({
    method: 'PATCH',
    url: '/v1/me/trial/preferences',
    headers: session.headers,
    payload: {
      foodPreference: 'vegetarian',
      mealPreference: options.mealPreference ?? 'lunch',
      breadPreference: 'bhakri',
      ricePreference: 'jeera_rice',
    },
  });

  const dates = futureWeekdays(5, options.startOffset ?? 1);
  await app.inject({
    method: 'PATCH',
    url: '/v1/me/trial/dates',
    headers: session.headers,
    payload: { dates },
  });
  await app.inject({
    method: 'PATCH',
    url: '/v1/me/trial/address',
    headers: session.headers,
    payload: { addressId },
  });

  const checkout = await app.inject({
    method: 'POST',
    url: '/v1/me/trial/checkout',
    headers: { ...session.headers, 'idempotency-key': uniqueKey() },
    payload: { paymentMethod: 'upi' },
  });

  return {
    addressId,
    dates,
    checkoutSessionId: checkout.json<{ checkoutSessionId: string }>().checkoutSessionId,
  };
}

export async function pay(
  app: App,
  session: Session,
  checkoutSessionId: string,
  scenario: MockScenario = 'success_immediate',
): Promise<{ paymentId: string }> {
  const response = await app.inject({
    method: 'POST',
    url: `/v1/me/checkout/${checkoutSessionId}/pay`,
    headers: { ...session.headers, 'idempotency-key': uniqueKey() },
    payload: { scenario },
  });
  return response.json<{ paymentId: string }>();
}

/**
 * Delivers a signed webhook straight to the endpoint.
 *
 * The mock provider posts over real HTTP to PUBLIC_BASE_URL, which `inject` does
 * not serve — and racing its timers would make these tests flaky anyway. Driving
 * the webhook directly still exercises everything that matters: signature
 * verification, the provider_events dedupe, the status_rank ordering guard and
 * the whole capture transaction. Only the mock's scheduling is bypassed, and that
 * is a dev affordance rather than production behaviour.
 */
export async function deliverWebhook(
  app: App,
  paymentId: string,
  options: {
    status?: 'pending' | 'captured' | 'failed';
    eventId?: string;
    occurredAt?: string;
    failureCode?: string;
    signature?: string;
  } = {},
): Promise<{ statusCode: number; outcome: string }> {
  const payment = await db
    .selectFrom('payments')
    .select(['provider_payment_id', 'provider_order_id', 'amount_paise'])
    .where('id', '=', paymentId)
    .executeTakeFirstOrThrow();

  const status = options.status ?? 'captured';
  const body = {
    providerEventId: options.eventId ?? `evt_test_${paymentId.slice(0, 8)}_${status}`,
    kind: `payment.${status}`,
    providerPaymentId: payment.provider_payment_id,
    providerOrderId: payment.provider_order_id,
    amountPaise: payment.amount_paise,
    status,
    occurredAt: options.occurredAt ?? new Date().toISOString(),
    ...(options.failureCode ? { failureCode: options.failureCode } : {}),
  };

  const raw = JSON.stringify(body);
  const response = await app.inject({
    method: 'POST',
    url: '/v1/webhooks/payments/mock',
    headers: {
      'content-type': 'application/json',
      'x-mock-signature': options.signature ?? signMockPayload(raw),
    },
    payload: raw,
  });

  return {
    statusCode: response.statusCode,
    outcome: response.statusCode === 200 ? response.json<{ outcome: string }>().outcome : '',
  };
}

export async function appState(app: App, session: Session) {
  const response = await app.inject({
    method: 'GET',
    url: '/v1/me/app-state',
    headers: session.headers,
  });
  return response.json<{
    lifecycleState: string;
    legacyStateId: string | null;
    route: string;
    home: {
      variant: string;
      week: Array<{
        date: string;
        isDisabled: boolean;
        markers: Array<{ mealOrderId: string; slot: string; status: string; showRipple: boolean }>;
      }>;
    } | null;
  }>();
}
