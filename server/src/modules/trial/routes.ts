import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../../http/auth-plugin.js';
import { todayIn } from '../../platform/time.js';
import {
  ensureDraft,
  reviewTrial,
  updateAddress,
  updateDates,
  updatePreferences,
} from './service.js';

const PlainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const FoodType = z.enum(['vegetarian', 'non_vegetarian']);

const TrialSummary = z.object({
  id: z.string().uuid(),
  status: z.string(),
  serviceDates: z.array(z.string()),
  foodPreference: z.string().nullable(),
  mealPreference: z.string().nullable(),
  breadPreference: z.string().nullable(),
  ricePreference: z.string().nullable(),
  addressId: z.string().uuid().nullable(),
  pricePaise: z.number().int(),
});

type TrialRow = Awaited<ReturnType<typeof ensureDraft>>;
const toSummary = (trial: TrialRow) => ({
  id: trial.id,
  status: trial.status,
  serviceDates: trial.service_dates,
  foodPreference: trial.food_preference,
  mealPreference: trial.meal_preference,
  breadPreference: trial.bread_preference,
  ricePreference: trial.rice_preference,
  addressId: trial.address_id,
  pricePaise: trial.price_paise,
});

export async function trialRoutes(app: FastifyInstance): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.post(
    '/me/trial/draft',
    {
      schema: {
        tags: ['trial'],
        summary: 'Create or fetch the in-progress trial',
        response: { 200: TrialSummary },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return toSummary(await ensureDraft(auth.userId));
    },
  );

  route.patch(
    '/me/trial/preferences',
    {
      schema: {
        tags: ['trial'],
        summary: 'Set food, meal, bread and rice preferences',
        body: z.object({
          foodPreference: z.enum(['vegetarian', 'non_vegetarian', 'mix']),
          mealPreference: z.enum(['lunch', 'dinner', 'both']),
          breadPreference: z.enum(['chapati', 'bhakri', 'paratha', 'any']),
          ricePreference: z.enum(['plain_rice', 'jeera_rice', 'brown_rice', 'any']),
          dailyMeals: z
            .array(z.object({ lunch: FoodType.nullable(), dinner: FoodType.nullable() }))
            .optional(),
        }),
        response: { 200: TrialSummary },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return toSummary(await updatePreferences(auth.userId, request.body));
    },
  );

  route.patch(
    '/me/trial/dates',
    {
      schema: {
        tags: ['trial'],
        summary: 'Choose exactly five future delivery dates',
        body: z.object({ dates: z.array(PlainDate).min(1).max(14) }),
        response: { 200: TrialSummary },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const trial = await updateDates(auth.userId, request.body.dates, todayIn(new Date()));
      return toSummary(trial);
    },
  );

  route.patch(
    '/me/trial/address',
    {
      schema: {
        tags: ['trial'],
        summary: 'Attach a serviceable delivery address',
        body: z.object({ addressId: z.string().uuid() }),
        response: { 200: TrialSummary },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return toSummary(await updateAddress(auth.userId, request.body.addressId));
    },
  );

  route.get(
    '/me/trial/review',
    {
      schema: {
        tags: ['trial'],
        summary: 'Everything the review screen needs, plus what is still missing',
        response: {
          200: z.object({
            trialId: z.string().uuid(),
            status: z.string(),
            serviceDates: z.array(z.string()),
            mealPreference: z.string().nullable(),
            foodPreference: z.string().nullable(),
            breadPreference: z.string().nullable(),
            ricePreference: z.string().nullable(),
            address: z
              .object({
                id: z.string().uuid(),
                line1: z.string(),
                pincode: z.string(),
                label: z.string(),
              })
              .nullable(),
            pricePaise: z.number().int(),
            totalPayablePaise: z.number().int(),
            ready: z.boolean(),
            missing: z.array(z.string()),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return reviewTrial(auth.userId);
    },
  );
}
