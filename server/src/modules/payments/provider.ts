import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../../platform/config/env.js';
import { AppError } from '../../platform/errors.js';
import { logger } from '../../platform/logger.js';
import type { PaymentStatus } from '../../platform/db/types.js';

export type NormalizedEvent = {
  providerEventId: string;
  kind: 'payment.pending' | 'payment.captured' | 'payment.failed' | 'refund.processed';
  providerPaymentId: string;
  providerOrderId: string;
  amountPaise: number;
  status: PaymentStatus;
  failureCode?: string;
  occurredAt: string;
};

export type CreateOrderInput = {
  paymentId: string;
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
};

/**
 * Core never sees a provider-specific shape. Swapping in Razorpay means
 * implementing these four methods; `clientPayload` is the opaque blob its SDK needs.
 */
export interface PaymentProvider {
  readonly name: 'mock' | 'razorpay';
  createOrder(input: CreateOrderInput): Promise<{ providerOrderId: string; clientPayload: unknown }>;
  verifyAndParseWebhook(raw: Buffer, headers: Record<string, string | string[] | undefined>): NormalizedEvent;
}

export const MOCK_SCENARIOS = [
  'success_immediate',
  'pending_then_success',
  'pending_forever',
  'fail_after_2s',
  'duplicate_webhook',
  'out_of_order',
  'webhook_before_response',
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export function signMockPayload(raw: string): string {
  return createHmac('sha256', env.MOCK_WEBHOOK_SECRET).update(raw).digest('hex');
}

/**
 * The mock does NOT shortcut to a final state. It posts real, signed webhooks back
 * to the same endpoint a real provider would hit, so demos exercise signature
 * verification, dedupe and the out-of-order rank guard rather than bypassing them.
 *
 * Scheduling is in-process (setTimeout). That is the one deliberate shortcut: a
 * production provider owns retry and durability, so there is nothing here worth
 * making durable.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;

  async createOrder(input: CreateOrderInput) {
    const providerOrderId = `order_mock_${randomUUID().slice(0, 12)}`;
    return {
      providerOrderId,
      clientPayload: { provider: 'mock', providerOrderId, amountPaise: input.amountPaise },
    };
  }

  verifyAndParseWebhook(
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedEvent {
    const signature = headers['x-mock-signature'];
    if (typeof signature !== 'string') {
      throw new AppError('FORBIDDEN', 'Missing webhook signature');
    }
    const expected = signMockPayload(raw.toString('utf8'));
    const provided = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) {
      throw new AppError('FORBIDDEN', 'Invalid webhook signature');
    }

    const parsed = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    return {
      providerEventId: String(parsed['providerEventId']),
      kind: parsed['kind'] as NormalizedEvent['kind'],
      providerPaymentId: String(parsed['providerPaymentId']),
      providerOrderId: String(parsed['providerOrderId']),
      amountPaise: Number(parsed['amountPaise']),
      status: parsed['status'] as PaymentStatus,
      ...(parsed['failureCode'] ? { failureCode: String(parsed['failureCode']) } : {}),
      occurredAt: String(parsed['occurredAt']),
    };
  }

  /** Fire the webhook sequence a given scenario implies. */
  schedule(scenario: MockScenario, ctx: { providerPaymentId: string; providerOrderId: string; amountPaise: number }): void {
    const send = (
      kind: NormalizedEvent['kind'],
      status: PaymentStatus,
      delayMs: number,
      extra: Partial<NormalizedEvent> = {},
    ) => {
      setTimeout(() => {
        void this.post({
          providerEventId: `evt_mock_${randomUUID().slice(0, 12)}`,
          kind,
          status,
          providerPaymentId: ctx.providerPaymentId,
          providerOrderId: ctx.providerOrderId,
          amountPaise: ctx.amountPaise,
          occurredAt: new Date().toISOString(),
          ...extra,
        });
      }, delayMs);
    };

    switch (scenario) {
      case 'success_immediate':
        send('payment.captured', 'captured', 200);
        break;
      case 'pending_then_success':
        send('payment.pending', 'pending', 200);
        send('payment.captured', 'captured', 2200);
        break;
      case 'pending_forever':
        send('payment.pending', 'pending', 200);
        break;
      case 'fail_after_2s':
        send('payment.pending', 'pending', 200);
        send('payment.failed', 'failed', 2000, { failureCode: 'insufficient_funds' });
        break;
      case 'duplicate_webhook': {
        // Same providerEventId twice: the provider_events primary key must absorb it.
        const eventId = `evt_mock_${randomUUID().slice(0, 12)}`;
        const body = {
          providerEventId: eventId,
          kind: 'payment.captured' as const,
          status: 'captured' as const,
          providerPaymentId: ctx.providerPaymentId,
          providerOrderId: ctx.providerOrderId,
          amountPaise: ctx.amountPaise,
          occurredAt: new Date().toISOString(),
        };
        setTimeout(() => void this.post(body), 200);
        setTimeout(() => void this.post(body), 700);
        break;
      }
      case 'out_of_order':
        // Captured first, then a stale pending. status_rank must refuse the downgrade.
        send('payment.captured', 'captured', 200);
        send('payment.pending', 'pending', 900);
        break;
      case 'webhook_before_response':
        send('payment.captured', 'captured', 0);
        break;
    }
  }

  private async post(body: Record<string, unknown>): Promise<void> {
    const raw = JSON.stringify(body);
    try {
      const response = await fetch(`${env.PUBLIC_BASE_URL}/v1/webhooks/payments/mock`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mock-signature': signMockPayload(raw) },
        body: raw,
      });
      if (!response.ok) {
        logger.warn({ status: response.status, body: await response.text() }, 'mock webhook rejected');
      }
    } catch (error) {
      logger.error({ err: error }, 'mock webhook delivery failed');
    }
  }
}

export const mockProvider = new MockPaymentProvider();

export function getProvider(): PaymentProvider {
  // Only the mock exists today; Razorpay slots in here behind the same interface.
  return mockProvider;
}
