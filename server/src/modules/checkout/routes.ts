import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../../http/auth-plugin.js';
import { env } from '../../platform/config/env.js';
import { withIdempotency } from '../../platform/idempotency.js';
import {
  createTrialCheckout,
  getPaymentStatus,
  payCheckout,
  scheduleMockWebhooks,
} from './service.js';
import { getProvider, MOCK_SCENARIOS, type MockScenario } from '../payments/provider.js';
import { handleProviderEvent } from '../payments/webhook.js';

const PriceBreakdown = z.object({
  planPricePaise: z.number().int(),
  deliveryChargesPaise: z.number().int(),
  taxesPaise: z.number().int(),
  discountPaise: z.number().int(),
  trialCreditPaise: z.number().int(),
  rewardCreditPaise: z.number().int(),
  totalPayablePaise: z.number().int(),
});

const CheckoutResponse = z.object({
  checkoutSessionId: z.string().uuid(),
  kind: z.string(),
  step: z.string(),
  priceBreakdown: PriceBreakdown,
  paymentMethod: z.string().nullable(),
});

export async function checkoutRoutes(app: FastifyInstance): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.post(
    '/me/trial/checkout',
    {
      schema: {
        tags: ['checkout'],
        summary: 'Open a checkout session for the trial',
        headers: z.object({ 'idempotency-key': z.string().min(8).optional() }),
        body: z.object({
          paymentMethod: z.enum(['upi', 'card', 'net_banking', 'wallet']).optional(),
        }),
        response: { 200: CheckoutResponse },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const { value } = await withIdempotency({
        userId: auth.userId,
        key: request.headers['idempotency-key'],
        endpoint: 'POST /me/trial/checkout',
        body: request.body,
        run: (tx) => createTrialCheckout(tx, auth.userId, request.body.paymentMethod ?? null),
      });
      return value;
    },
  );

  route.post(
    '/me/checkout/:checkoutSessionId/pay',
    {
      schema: {
        tags: ['checkout'],
        summary: 'Start a payment attempt',
        description:
          'One press creates one attempt. Repeating the same Idempotency-Key replays ' +
          'the original response instead of charging again.',
        params: z.object({ checkoutSessionId: z.string().uuid() }),
        headers: z.object({ 'idempotency-key': z.string().min(8).optional() }),
        body: z.object({
          scenario: z.enum(MOCK_SCENARIOS).optional(),
        }),
        response: {
          200: z.object({
            checkoutSessionId: z.string().uuid(),
            paymentId: z.string().uuid(),
            status: z.string(),
            clientPayload: z.unknown(),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      // Scenario selection is a dev affordance; production ignores whatever is sent.
      const scenario: MockScenario | undefined = env.ENABLE_DEV_ENDPOINTS
        ? request.body.scenario
        : undefined;

      const { value, replayed } = await withIdempotency({
        userId: auth.userId,
        key: request.headers['idempotency-key'],
        endpoint: 'POST /me/checkout/pay',
        body: { ...request.body, checkoutSessionId: request.params.checkoutSessionId },
        run: (tx) => payCheckout(tx, auth.userId, request.params.checkoutSessionId, scenario),
      });

      // Only after the transaction has committed, and never twice for one attempt.
      if (!replayed) await scheduleMockWebhooks(value.paymentId, value.scenario);

      const { scenario: _internal, ...response } = value;
      return response;
    },
  );

  route.get(
    '/me/checkout/:checkoutSessionId/payment-status',
    {
      schema: {
        tags: ['checkout'],
        summary: 'Poll a payment. The client animates pending → success from this.',
        params: z.object({ checkoutSessionId: z.string().uuid() }),
        response: {
          200: z.object({
            checkoutSessionId: z.string().uuid(),
            step: z.string(),
            paymentStatus: z.string(),
            amountPaise: z.number().int(),
            failureCode: z.string().nullable(),
            failureReason: z.string().nullable(),
            reference: z.string().nullable(),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return getPaymentStatus(auth.userId, request.params.checkoutSessionId);
    },
  );

  route.post(
    '/webhooks/payments/:provider',
    {
      config: { rawBody: true },
      schema: {
        tags: ['webhooks'],
        summary: 'Provider payment webhook (signed, idempotent, order-tolerant)',
        params: z.object({ provider: z.enum(['mock']) }),
        response: { 200: z.object({ outcome: z.string() }) },
      },
    },
    async (request, reply) => {
      const raw = (request as { rawBody?: Buffer }).rawBody ?? Buffer.from('');
      const event = getProvider().verifyAndParseWebhook(raw, request.headers);
      const outcome = await handleProviderEvent(
        request.params.provider,
        event,
        request.body as Record<string, unknown>,
      );
      // Always 200 once the signature validates: a permanently unprocessable event
      // must not be retried by the provider forever.
      return reply.status(200).send({ outcome });
    },
  );
}
