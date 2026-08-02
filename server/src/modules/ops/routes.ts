import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../platform/db/index.js';
import { env } from '../../platform/config/env.js';
import { AppError } from '../../platform/errors.js';
import { todayIn } from '../../platform/time.js';
import {
  deliveryBoard,
  productionSchedule,
  recordRefund,
  resolveSupportIssue,
  updateDeliveryStatus,
} from './service.js';

/**
 * Shared-key auth. Explicitly a stopgap — real staff accounts with per-operator
 * identity and roles are their own piece of work. Until then every mutation
 * carries an operator name that lands in audit_logs, so actions stay attributable
 * even though the key itself is shared.
 */
function requireAdmin(request: FastifyRequest): string {
  const key = request.headers['x-admin-key'];
  const operator = request.headers['x-operator'];

  if (typeof key !== 'string') throw new AppError('FORBIDDEN', 'Admin key required.');
  const provided = Buffer.from(key);
  const expected = Buffer.from(env.ADMIN_API_KEY);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new AppError('FORBIDDEN', 'Invalid admin key.');
  }
  if (typeof operator !== 'string' || operator.trim().length < 2) {
    throw new AppError('FORBIDDEN', 'X-Operator header is required so actions are attributable.');
  }
  return operator.trim();
}

const PlainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function opsRoutes(app: FastifyInstance): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.patch(
    '/ops/meals/:mealOrderId/status',
    {
      schema: {
        tags: ['ops'],
        summary: 'Record a delivery status. Drives Home states Q and R and loyalty progress.',
        params: z.object({ mealOrderId: z.string().uuid() }),
        body: z.object({
          status: z.enum([
            'preparing',
            'out_for_delivery',
            'delivered',
            'delayed',
            'delivery_failed',
            'cancelled',
            'skipped',
          ]),
          note: z.string().max(500).optional(),
        }),
        response: {
          200: z.object({
            mealOrderId: z.string().uuid(),
            status: z.string(),
            changed: z.boolean(),
          }),
        },
      },
    },
    async (request) => {
      const operator = requireAdmin(request);
      return updateDeliveryStatus({
        mealOrderId: request.params.mealOrderId,
        status: request.body.status,
        ...(request.body.note ? { note: request.body.note } : {}),
        operator,
      });
    },
  );

  route.get(
    '/ops/production',
    {
      schema: {
        tags: ['ops'],
        summary: 'What the kitchen must cook for a date',
        querystring: z.object({ date: PlainDate.optional() }),
        response: {
          200: z.object({
            serviceDate: z.string(),
            totalMeals: z.number().int(),
            breakdown: z.array(
              z.object({
                slot: z.string(),
                foodType: z.string(),
                breadPreference: z.string(),
                ricePreference: z.string(),
                count: z.number().int(),
              }),
            ),
            byPincode: z.array(z.object({ pincode: z.string(), count: z.number().int() })),
          }),
        },
      },
    },
    async (request) => {
      requireAdmin(request);
      return productionSchedule(request.query.date ?? todayIn(new Date()));
    },
  );

  route.get(
    '/ops/deliveries',
    {
      schema: {
        tags: ['ops'],
        summary: 'Delivery board for a date',
        querystring: z.object({ date: PlainDate.optional() }),
        response: {
          200: z.object({
            serviceDate: z.string(),
            deliveries: z.array(
              z.object({
                mealOrderId: z.string().uuid(),
                slot: z.string(),
                status: z.string(),
                foodType: z.string(),
                customer: z.string(),
                address: z.string(),
              }),
            ),
          }),
        },
      },
    },
    async (request) => {
      requireAdmin(request);
      return deliveryBoard(request.query.date ?? todayIn(new Date()));
    },
  );

  route.post(
    '/ops/refunds',
    {
      schema: {
        tags: ['ops'],
        summary: 'Issue a refund or service credit',
        description: 'Reversing money also reverses any leaderboard points it earned.',
        body: z.object({
          userId: z.string().uuid(),
          paymentId: z.string().uuid().optional(),
          amountPaise: z.number().int().positive(),
          reason: z.string().min(3).max(300),
          reversePointsFor: z
            .object({ sourceType: z.string(), sourceId: z.string().uuid() })
            .optional(),
        }),
        response: {
          200: z.object({
            transactionId: z.string().uuid(),
            amountPaise: z.number().int(),
            pointsReversed: z.number().int(),
          }),
        },
      },
    },
    async (request) => {
      const operator = requireAdmin(request);
      return recordRefund({ ...request.body, operator });
    },
  );

  route.get(
    '/ops/support-issues',
    {
      schema: {
        tags: ['ops'],
        summary: 'Open support issues',
        response: {
          200: z.object({
            issues: z.array(
              z.object({
                id: z.string().uuid(),
                userId: z.string().uuid(),
                mealOrderId: z.string().uuid().nullable(),
                category: z.string(),
                description: z.string().nullable(),
                status: z.string(),
                createdAt: z.string(),
              }),
            ),
          }),
        },
      },
    },
    async (request) => {
      requireAdmin(request);
      const rows = await db
        .selectFrom('support_issues')
        .selectAll()
        .where('status', 'in', ['open', 'investigating'])
        .orderBy('created_at')
        .execute();
      return {
        issues: rows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          mealOrderId: row.meal_order_id,
          category: row.category,
          description: row.description,
          status: row.status,
          createdAt: row.created_at.toISOString(),
        })),
      };
    },
  );

  route.post(
    '/ops/support-issues/:issueId/resolve',
    {
      schema: {
        tags: ['ops'],
        summary: 'Resolve a support issue, optionally with a credit',
        params: z.object({ issueId: z.string().uuid() }),
        body: z.object({
          status: z.enum(['resolved', 'rejected']),
          resolution: z.string().min(3).max(500),
          creditPaise: z.number().int().nonnegative().optional(),
        }),
        response: {
          200: z.object({
            issueId: z.string().uuid(),
            status: z.string(),
            creditPaise: z.number().int(),
          }),
        },
      },
    },
    async (request) => {
      const operator = requireAdmin(request);
      return resolveSupportIssue(request.params.issueId, { ...request.body, operator });
    },
  );

  route.post(
    '/ops/pincodes',
    {
      schema: {
        tags: ['ops'],
        summary: 'Add or update a serviceable PIN code',
        body: z.object({
          pincode: z.string().regex(/^[1-9][0-9]{5}$/),
          city: z.string().min(1),
          state: z.string().min(1),
          zone: z.string().optional(),
          isActive: z.boolean().default(true),
        }),
        response: { 200: z.object({ pincode: z.string(), isActive: z.boolean() }) },
      },
    },
    async (request) => {
      const operator = requireAdmin(request);
      const { pincode, city, state, zone, isActive } = request.body;
      const row = await db
        .insertInto('serviceable_pincodes')
        .values({ pincode, city, state, zone: zone ?? null, is_active: isActive })
        .onConflict((oc) =>
          oc.column('pincode').doUpdateSet({ city, state, zone: zone ?? null, is_active: isActive }),
        )
        .returningAll()
        .executeTakeFirstOrThrow();

      await db
        .insertInto('audit_logs')
        .values({
          actor_type: 'ops',
          actor_id: operator,
          action: 'pincode.upserted',
          entity_type: 'serviceable_pincode',
          after: { pincode, isActive },
        })
        .execute();

      return { pincode: row.pincode, isActive: row.is_active };
    },
  );

  route.post(
    '/ops/coupons',
    {
      schema: {
        tags: ['ops'],
        summary: 'Create a coupon',
        body: z.object({
          code: z.string().min(3).max(40),
          title: z.string().min(1),
          description: z.string().min(1),
          kind: z.enum(['flat', 'percent']),
          valuePaise: z.number().int().nonnegative().optional(),
          percentBps: z.number().int().min(0).max(10_000).optional(),
          maxDiscountPaise: z.number().int().nonnegative().optional(),
          minOrderPaise: z.number().int().nonnegative().default(0),
          appliesToPlanCodes: z.array(z.string()).default([]),
          newUsersOnly: z.boolean().default(false),
          usageLimitPerUser: z.number().int().positive().default(1),
          usageLimitTotal: z.number().int().positive().optional(),
          expiresAt: z.string().datetime().optional(),
        }),
        response: { 200: z.object({ id: z.string().uuid(), code: z.string() }) },
      },
    },
    async (request) => {
      const operator = requireAdmin(request);
      const body = request.body;
      if (body.kind === 'flat' && body.valuePaise === undefined) {
        throw new AppError('VALIDATION_FAILED', 'A flat coupon needs valuePaise.');
      }
      if (body.kind === 'percent' && body.percentBps === undefined) {
        throw new AppError('VALIDATION_FAILED', 'A percent coupon needs percentBps.');
      }

      const row = await db
        .insertInto('coupons')
        .values({
          code: body.code.toUpperCase(),
          title: body.title,
          description: body.description,
          kind: body.kind,
          value_paise: body.valuePaise ?? null,
          percent_bps: body.percentBps ?? null,
          max_discount_paise: body.maxDiscountPaise ?? null,
          min_order_paise: body.minOrderPaise,
          applies_to_plan_codes: body.appliesToPlanCodes,
          applies_to_kinds: ['trial', 'subscription', 'renewal', 'resubscription'],
          new_users_only: body.newUsersOnly,
          usage_limit_per_user: body.usageLimitPerUser,
          usage_limit_total: body.usageLimitTotal ?? null,
          expires_at: body.expiresAt ? new Date(body.expiresAt) : null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await db
        .insertInto('audit_logs')
        .values({
          actor_type: 'ops',
          actor_id: operator,
          action: 'coupon.created',
          entity_type: 'coupon',
          entity_id: row.id,
          after: { code: row.code },
        })
        .execute();

      return { id: row.id, code: row.code };
    },
  );
}
