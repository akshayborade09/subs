import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../../http/auth-plugin.js';
import { db } from '../../platform/db/index.js';
import { withIdempotency } from '../../platform/idempotency.js';
import { todayIn } from '../../platform/time.js';
import {
  cancelSubscription,
  pauseSubscription,
  resubscribe,
  resumeSubscription,
} from './manage.js';
import {
  createSubscriptionCheckout,
  getCurrentSubscription,
  listPlans,
  quoteSubscription,
} from './service.js';

const PlanCode = z.enum(['weekly', 'monthly', 'quarterly']);

const PriceBreakdown = z.object({
  planPricePaise: z.number().int(),
  deliveryChargesPaise: z.number().int(),
  taxesPaise: z.number().int(),
  discountPaise: z.number().int(),
  trialCreditPaise: z.number().int(),
  rewardCreditPaise: z.number().int(),
  totalPayablePaise: z.number().int(),
});

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get(
    '/subscription-plans',
    {
      schema: {
        tags: ['subscription'],
        summary: 'Available plans. Prices are backend-owned.',
        response: {
          200: z.object({
            plans: z.array(
              z.object({
                code: PlanCode,
                name: z.string(),
                durationDays: z.number().int(),
                mealCount: z.number().int(),
                pricePaise: z.number().int(),
                discountPaise: z.number().int(),
                effectivePricePerMealPaise: z.number().int(),
                badge: z.string().nullable(),
              }),
            ),
          }),
        },
      },
    },
    async () => {
      const plans = await listPlans();
      return {
        plans: plans.map((plan) => ({
          code: plan.code,
          name: plan.name,
          durationDays: plan.duration_days,
          mealCount: plan.meal_count,
          pricePaise: plan.price_paise,
          discountPaise: plan.discount_paise,
          effectivePricePerMealPaise: plan.effective_price_per_meal_paise,
          badge: plan.badge,
        })),
      };
    },
  );

  route.post(
    '/me/subscriptions/quote',
    {
      schema: {
        tags: ['subscription'],
        summary: 'Price a plan for this user, including any trial credit',
        body: z.object({
          planCode: PlanCode,
          mealPreference: z.enum(['lunch', 'dinner', 'both']).default('lunch'),
        }),
        response: {
          200: z.object({
            planCode: z.string(),
            planName: z.string(),
            mealDays: z.number().int(),
            mealsIncluded: z.number().int(),
            durationDays: z.number().int(),
            startsOn: z.string(),
            endsOn: z.string(),
            effectivePricePerMealPaise: z.number().int(),
            priceBreakdown: PriceBreakdown,
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return quoteSubscription(
        auth.userId,
        request.body.planCode,
        todayIn(new Date()),
        undefined,
        request.body.mealPreference,
      );
    },
  );

  route.post(
    '/me/subscriptions/checkout',
    {
      schema: {
        tags: ['subscription'],
        summary: 'Create the subscription and its checkout session',
        headers: z.object({ 'idempotency-key': z.string().min(8).optional() }),
        body: z.object({
          planCode: PlanCode,
          mealPreference: z.enum(['lunch', 'dinner', 'both']),
          foodPreference: z.enum(['vegetarian', 'non_vegetarian', 'mix']),
          breadPreference: z.enum(['chapati', 'bhakri', 'paratha', 'any']),
          ricePreference: z.enum(['plain_rice', 'jeera_rice', 'brown_rice', 'any']),
          selectedWeekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
          addressId: z.string().uuid().optional(),
        }),
        response: {
          200: z.object({
            subscriptionId: z.string().uuid(),
            checkoutSessionId: z.string().uuid(),
            startsOn: z.string(),
            endsOn: z.string(),
            priceBreakdown: PriceBreakdown,
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const today = todayIn(new Date());
      const { value } = await withIdempotency({
        userId: auth.userId,
        key: request.headers['idempotency-key'],
        endpoint: 'POST /me/subscriptions/checkout',
        body: request.body,
        run: async (tx) => {
          const result = await createSubscriptionCheckout(tx, auth.userId, request.body, today);
          return {
            subscriptionId: result.subscription.id,
            checkoutSessionId: result.checkout.id,
            startsOn: result.subscription.starts_on,
            endsOn: result.subscription.ends_on,
            priceBreakdown: result.quote.priceBreakdown,
          };
        },
      });
      return value;
    },
  );

  route.post(
    '/me/subscriptions/cancel',
    {
      schema: {
        tags: ['subscription'],
        summary: 'Cancel at period end — already-paid meals still arrive',
        body: z.object({ reason: z.string().max(300).optional() }),
        response: {
          200: z.object({
            status: z.literal('cancelled_at_period_end'),
            activeUntil: z.string(),
            remainingMeals: z.number().int(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return cancelSubscription(auth.userId, request.body.reason);
    },
  );

  route.post(
    '/me/subscriptions/resubscribe',
    {
      schema: {
        tags: ['subscription'],
        summary: 'Reactivate a cancelled plan while its period is still running',
        response: { 200: z.object({ status: z.literal('paid'), activeUntil: z.string() }) },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return resubscribe(auth.userId);
    },
  );

  route.post(
    '/me/subscriptions/pause',
    {
      schema: {
        tags: ['subscription'],
        summary: 'Pause deliveries for a window. Paused days do not consume plan meals.',
        body: z.object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
        }),
        response: {
          200: z.object({
            pauseFrom: z.string(),
            pauseTo: z.string().nullable(),
            mealsRemoved: z.number().int(),
            resumesOn: z.string().nullable(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return pauseSubscription(auth.userId, request.body.from, request.body.to);
    },
  );

  route.post(
    '/me/subscriptions/resume',
    {
      schema: {
        tags: ['subscription'],
        summary: 'Resume paused deliveries',
        response: { 200: z.object({ status: z.literal('resumed') }) },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return resumeSubscription(auth.userId);
    },
  );

  route.get(
    '/me/subscriptions/current',
    {
      schema: {
        tags: ['subscription'],
        summary: 'The current subscription and its remaining meals',
        response: {
          200: z
            .object({
              id: z.string().uuid(),
              planCode: z.string(),
              planName: z.string(),
              status: z.string(),
              mealPreference: z.string(),
              selectedWeekdays: z.array(z.number().int()),
              startsOn: z.string(),
              endsOn: z.string(),
              mealsTotal: z.number().int(),
              mealsDelivered: z.number().int(),
              mealsRemaining: z.number().int(),
            })
            .nullable(),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const sub = await getCurrentSubscription(auth.userId);
      if (!sub) return null;

      // Meals remaining is plan arithmetic, NOT a count of meal_orders: only a
      // rolling 21-day horizon is materialized, so counting rows would understate it.
      const delivered = await db
        .selectFrom('meal_orders')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('source_type', '=', 'subscription')
        .where('source_id', '=', sub.id)
        .where('ops_status', '=', 'delivered')
        .executeTakeFirstOrThrow();

      const mealsDelivered = Number(delivered.count);
      return {
        id: sub.id,
        planCode: sub.plan_code,
        planName: sub.plan_name,
        status: sub.status,
        mealPreference: sub.meal_preference,
        selectedWeekdays: sub.selected_weekdays,
        startsOn: sub.starts_on,
        endsOn: sub.ends_on,
        mealsTotal: sub.meal_count,
        mealsDelivered,
        mealsRemaining: Math.max(0, sub.meal_count - mealsDelivered),
      };
    },
  );
}
