import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../../http/auth-plugin.js';
import { buildHome } from '../../lifecycle/home.js';
import { loadSnapshot } from '../../lifecycle/load.js';
import { resolveCondition } from '../../lifecycle/rules.js';
import { AppError } from '../../platform/errors.js';
import { reportIssue, submitFeedback } from './feedback.js';
import {
  changeMealAddress,
  changeMealDate,
  changeMealPreferences,
  getMealDetail,
  selectableDates,
} from './service.js';

const PlainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Version = z.object({ expectedScheduleVersion: z.number().int().nonnegative().optional() });

const ChangeResult = z.object({
  mealOrderId: z.string().uuid(),
  scheduleVersion: z.number().int(),
});

/**
 * A 409 carries a fresh Home payload. The client's whole week is stale at that
 * point, so returning it here saves a second round trip on the one path where the
 * user is already confused.
 */
async function conflictWithFreshHome(request: FastifyRequest, error: unknown): Promise<never> {
  if (!(error instanceof AppError) || error.code !== 'SCHEDULE_CONFLICT') throw error;
  const snapshot = await loadSnapshot(request.auth);
  const resolution = resolveCondition(snapshot);
  throw new AppError('SCHEDULE_CONFLICT', error.message, {
    ...(error.details as Record<string, unknown>),
    home: buildHome(snapshot, resolution.condition),
  });
}

export async function mealRoutes(app: FastifyInstance): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get(
    '/me/meals/:mealOrderId',
    {
      schema: {
        tags: ['meals'],
        summary: 'One meal, with what may still be changed about it and why not',
        params: z.object({ mealOrderId: z.string().uuid() }),
        response: {
          200: z.object({
            id: z.string().uuid(),
            serviceDate: z.string(),
            dateLabel: z.string(),
            dayLabel: z.string(),
            slot: z.enum(['lunch', 'dinner']),
            foodType: z.string(),
            breadPreference: z.string(),
            ricePreference: z.string(),
            status: z.string(),
            deliveryWindowStart: z.string(),
            deliveryWindowEnd: z.string(),
            address: z.object({
              id: z.string().uuid(),
              label: z.string(),
              line1: z.string(),
              pincode: z.string(),
            }),
            rescheduledFrom: z.string().nullable(),
            scheduleVersion: z.number().int(),
            canChangeDate: z.boolean(),
            canChangeAddress: z.boolean(),
            canChangePreference: z.boolean(),
            lockedReason: z.string().nullable(),
            cutoffAt: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return getMealDetail(auth.userId, request.params.mealOrderId);
    },
  );

  route.get(
    '/me/meals/:mealOrderId/selectable-dates',
    {
      schema: {
        tags: ['meals'],
        summary: 'Dates this meal can move to, including ones it previously vacated',
        params: z.object({ mealOrderId: z.string().uuid() }),
        response: { 200: z.object({ dates: z.array(z.string()) }) },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return { dates: await selectableDates(auth.userId, request.params.mealOrderId) };
    },
  );

  route.patch(
    '/me/meals/:mealOrderId/date',
    {
      schema: {
        tags: ['meals'],
        summary: 'Move a meal to another date, keeping its status',
        params: z.object({ mealOrderId: z.string().uuid() }),
        body: Version.extend({ newDate: PlainDate }),
        response: {
          200: ChangeResult.extend({ from: z.string(), to: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      try {
        return await changeMealDate(auth.userId, request.params.mealOrderId, request.body);
      } catch (error) {
        return conflictWithFreshHome(request, error);
      }
    },
  );

  route.patch(
    '/me/meals/:mealOrderId/address',
    {
      schema: {
        tags: ['meals'],
        summary: 'Redirect one delivery to another serviceable address',
        params: z.object({ mealOrderId: z.string().uuid() }),
        body: Version.extend({ addressId: z.string().uuid() }),
        response: { 200: ChangeResult.extend({ addressId: z.string().uuid() }) },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      try {
        return await changeMealAddress(
          auth.userId,
          request.params.mealOrderId,
          request.body.addressId,
          request.body.expectedScheduleVersion,
        );
      } catch (error) {
        return conflictWithFreshHome(request, error);
      }
    },
  );

  route.post(
    '/me/meals/:mealOrderId/feedback',
    {
      schema: {
        tags: ['meals'],
        summary: 'Rate a delivered meal. Scores leaderboard points exactly once.',
        params: z.object({ mealOrderId: z.string().uuid() }),
        body: z.object({
          rating: z.number().int().min(1).max(5),
          tags: z.array(z.string().max(40)).max(8).optional(),
          note: z.string().max(500).optional(),
        }),
        response: {
          200: z.object({
            mealOrderId: z.string().uuid(),
            rating: z.number().int(),
            pointsAwarded: z.boolean(),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return submitFeedback(auth.userId, request.params.mealOrderId, request.body);
    },
  );

  route.post(
    '/me/meals/:mealOrderId/report-issue',
    {
      schema: {
        tags: ['meals'],
        summary: 'Raise a support issue about a delivery',
        params: z.object({ mealOrderId: z.string().uuid() }),
        body: z.object({
          category: z.string().min(2).max(60),
          description: z.string().max(1000).optional(),
        }),
        response: {
          200: z.object({
            issueId: z.string().uuid(),
            status: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return reportIssue(auth.userId, request.params.mealOrderId, request.body);
    },
  );

  route.patch(
    '/me/meals/:mealOrderId/preferences',
    {
      schema: {
        tags: ['meals'],
        summary: 'Change this meal only — plan-wide defaults live elsewhere',
        params: z.object({ mealOrderId: z.string().uuid() }),
        body: Version.extend({
          foodType: z.enum(['vegetarian', 'non_vegetarian']).optional(),
          breadPreference: z.enum(['chapati', 'bhakri', 'paratha', 'any']).optional(),
          ricePreference: z.enum(['plain_rice', 'jeera_rice', 'brown_rice', 'any']).optional(),
        }),
        response: { 200: ChangeResult },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      try {
        return await changeMealPreferences(auth.userId, request.params.mealOrderId, request.body);
      } catch (error) {
        return conflictWithFreshHome(request, error);
      }
    },
  );
}
