import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../platform/config/env.js';
import { AppError } from '../../platform/errors.js';
import { logger } from '../../platform/logger.js';
import type {
  CreateOrderInput,
  NormalizedEvent,
  PaymentProvider,
} from './provider.js';

/**
 * ============================================================================
 * SCAFFOLD — NOT YET LIVE. Blocked on the commercial agreement with Razorpay.
 * ============================================================================
 *
 * This compiles and is wired into `getProvider()`, but every method that talks
 * to Razorpay throws until the credentials exist. That is deliberate: a silently
 * half-working payment provider is worse than one that refuses loudly.
 *
 * The shapes below are written from Razorpay's public Orders and Webhooks API.
 * VERIFY EACH AGAINST THEIR CURRENT DOCS BEFORE GOING LIVE — field names and
 * event names are the sort of thing that changes, and getting one wrong here
 * means silently mis-parsing money.
 *
 * What has to be done to finish this:
 *   1. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET.
 *   2. Fill in `createOrder` — either raw fetch (sketched) or their SDK.
 *   3. Confirm the webhook event names and payload paths in `parseEvent`.
 *   4. Register the webhook URL in the Razorpay dashboard, pointing at
 *      POST {PUBLIC_BASE_URL}/v1/webhooks/payments/razorpay, subscribed to
 *      payment.captured, payment.failed, payment.authorized, refund.processed.
 *   5. Add 'razorpay' to the provider enum on the webhook route's params schema.
 *
 * What does NOT need doing, because it is provider-agnostic and already tested:
 *   dedupe on provider_events, the status_rank out-of-order guard, the capture
 *   transaction, idempotency, and the outbox. Razorpay inherits all of it.
 */

const RAZORPAY_API = 'https://api.razorpay.com/v1';

/** Razorpay payment states → our normalized vocabulary. */
const STATUS_MAP: Record<string, NormalizedEvent['status']> = {
  created: 'created',
  authorized: 'authorized',
  captured: 'captured',
  refunded: 'refunded',
  failed: 'failed',
};

/** Razorpay webhook event names → our normalized kinds. */
const EVENT_MAP: Record<string, NormalizedEvent['kind']> = {
  'payment.authorized': 'payment.pending',
  'payment.captured': 'payment.captured',
  'payment.failed': 'payment.failed',
  'refund.processed': 'refund.processed',
};

/**
 * Minimal shape of the webhook body we depend on. Razorpay sends a great deal
 * more; deliberately narrow so an unrelated change on their side cannot break
 * parsing.
 */
type RazorpayWebhookBody = {
  event?: string;
  created_at?: number;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number; // already in paise — no conversion, which is why we store paise
        status?: string;
        error_code?: string | null;
        error_description?: string | null;
      };
    };
    refund?: {
      entity?: { id?: string; payment_id?: string; amount?: number };
    };
  };
};

export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;

  private get credentials(): { keyId: string; keySecret: string } {
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new AppError(
        'INTERNAL',
        'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      );
    }
    return { keyId, keySecret };
  }

  /**
   * POST /v1/orders. Razorpay works in paise natively, which is one reason the
   * whole system stores paise — there is no conversion step to get wrong.
   *
   * `notes` carries our own paymentId so a webhook can always be traced back to
   * the row we created before calling out. Keep that.
   */
  async createOrder(input: CreateOrderInput): Promise<{ providerOrderId: string; clientPayload: unknown }> {
    const { keyId, keySecret } = this.credentials;

    /*
     * ---- IMPLEMENT ----
     *
     * const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
     * const response = await fetch(`${RAZORPAY_API}/orders`, {
     *   method: 'POST',
     *   headers: {
     *     authorization: `Basic ${auth}`,
     *     'content-type': 'application/json',
     *   },
     *   body: JSON.stringify({
     *     amount: input.amountPaise,       // paise, integer
     *     currency: 'INR',
     *     receipt: input.receipt,          // <= 40 chars per their docs — verify
     *     notes: { ...input.notes, paymentId: input.paymentId },
     *     payment_capture: 1,              // auto-capture; confirm this is wanted
     *   }),
     * });
     *
     * if (!response.ok) {
     *   const detail = await response.text();
     *   logger.error({ status: response.status, detail }, 'razorpay order creation failed');
     *   throw new AppError('PAYMENT_FAILED', 'Could not start the payment. Please try again.');
     * }
     *
     * const order = (await response.json()) as { id: string; amount: number };
     *
     * // Defensive: never let a provider hand back a different amount than we asked
     * // for without noticing. This has bitten people.
     * if (order.amount !== input.amountPaise) {
     *   throw new AppError('INTERNAL', 'Razorpay returned a different order amount.');
     * }
     *
     * return {
     *   providerOrderId: order.id,
     *   // Exactly what Razorpay Checkout needs client-side. key_secret must NEVER
     *   // appear here.
     *   clientPayload: {
     *     provider: 'razorpay',
     *     key: keyId,
     *     orderId: order.id,
     *     amount: input.amountPaise,
     *     currency: 'INR',
     *   },
     * };
     */

    void keyId;
    void keySecret;
    void input;
    void RAZORPAY_API;
    throw new AppError('INTERNAL', 'Razorpay createOrder is not implemented yet.');
  }

  /**
   * Razorpay signs the RAW request body with the webhook secret (HMAC-SHA256,
   * hex) and sends it as `x-razorpay-signature`.
   *
   * The raw bytes matter: re-serializing the parsed JSON changes key order and
   * whitespace and the signature will not match. `app.ts` already retains
   * `request.rawBody` for exactly this.
   */
  verifyAndParseWebhook(
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedEvent {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new AppError('INTERNAL', 'RAZORPAY_WEBHOOK_SECRET is not configured.');
    }

    const signature = headers['x-razorpay-signature'];
    if (typeof signature !== 'string') {
      throw new AppError('FORBIDDEN', 'Missing webhook signature');
    }

    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const provided = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) {
      throw new AppError('FORBIDDEN', 'Invalid webhook signature');
    }

    return this.parseEvent(JSON.parse(raw.toString('utf8')) as RazorpayWebhookBody, headers);
  }

  /**
   * Razorpay's body has no stable per-delivery event id in the payload, so the
   * `x-razorpay-event-id` header is what our provider_events dedupe keys on.
   * CONFIRM that header name — if it is absent, dedupe silently stops working
   * and a redelivered capture would be processed twice.
   */
  private parseEvent(
    body: RazorpayWebhookBody,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedEvent {
    const eventName = body.event ?? '';
    const kind = EVENT_MAP[eventName];
    if (!kind) {
      throw new AppError('VALIDATION_FAILED', `Unhandled Razorpay event: ${eventName}`);
    }

    const eventId = headers['x-razorpay-event-id'];
    if (typeof eventId !== 'string') {
      throw new AppError('VALIDATION_FAILED', 'Missing x-razorpay-event-id; dedupe needs it.');
    }

    const entity = body.payload?.payment?.entity;
    if (!entity?.id || !entity.order_id || typeof entity.amount !== 'number') {
      throw new AppError('VALIDATION_FAILED', 'Razorpay payload is missing payment fields.');
    }

    const status = STATUS_MAP[entity.status ?? ''];
    if (!status) {
      throw new AppError('VALIDATION_FAILED', `Unknown Razorpay status: ${entity.status}`);
    }

    return {
      providerEventId: eventId,
      kind,
      providerPaymentId: entity.id,
      providerOrderId: entity.order_id,
      amountPaise: entity.amount,
      status,
      ...(entity.error_code ? { failureCode: entity.error_code } : {}),
      // Razorpay sends created_at as unix seconds.
      occurredAt: new Date((body.created_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    };
  }

  /**
   * Not on the PaymentProvider interface yet, but worth having before launch:
   * a reconciliation sweep for payments stuck pending because a webhook was
   * never delivered. GET /v1/payments/{id} and feed the result through the same
   * handler the webhook uses.
   */
  async fetchPayment(providerPaymentId: string): Promise<never> {
    void providerPaymentId;
    void logger;
    throw new AppError('INTERNAL', 'Razorpay fetchPayment is not implemented yet.');
  }
}

export const razorpayProvider = new RazorpayProvider();
