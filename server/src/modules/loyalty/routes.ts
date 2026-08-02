import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../../http/auth-plugin.js';
import { eligibleRedemptionDates, getProgress, listRewards, redeemReward } from './service.js';
import { applyReferralCode, getReferralOverview } from '../referral/service.js';
import { currentPeriod, getLeaderboard } from '../leaderboard/service.js';

const PlainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function loyaltyRoutes(app: FastifyInstance): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get(
    '/me/loyalty/progress',
    {
      schema: {
        tags: ['loyalty'],
        summary: 'Healthy Streak progress',
        description:
          'ruleStatement is the exact rule being applied and must be rendered verbatim — ' +
          'the spec forbids claiming "one month" while computing something else.',
        response: {
          200: z
            .object({
              status: z.enum(['in_progress', 'qualified', 'frozen', 'expired']),
              activeDays: z.number().int(),
              requiredActiveDays: z.number().int(),
              fulfilledMealDays: z.number().int(),
              requiredFulfilledMealDays: z.number().int(),
              expectedQualificationDate: z.string(),
              ruleStatement: z.string(),
              periodStart: z.string(),
              rewardId: z.string().uuid().nullable(),
            })
            .nullable(),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return getProgress(auth.userId);
    },
  );

  route.get(
    '/me/rewards',
    {
      schema: {
        tags: ['loyalty'],
        summary: 'Earned, redeemed and expired rewards',
        response: {
          200: z.object({
            rewards: z.array(
              z.object({
                id: z.string().uuid(),
                type: z.string(),
                source: z.string(),
                status: z.string(),
                earnedAt: z.string(),
                expiresOn: z.string(),
                redeemedServiceDate: z.string().nullable(),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const rewards = await listRewards(auth.userId);
      return {
        rewards: rewards.map((reward) => ({
          id: reward.id,
          type: reward.type,
          source: reward.source,
          status: reward.status,
          earnedAt: reward.earned_at.toISOString(),
          expiresOn: reward.expires_on,
          redeemedServiceDate: reward.redeemed_service_date,
        })),
      };
    },
  );

  route.get(
    '/me/rewards/eligible-dates',
    {
      schema: {
        tags: ['loyalty'],
        summary: 'Dates a free meal day can be taken on',
        response: { 200: z.object({ dates: z.array(z.string()) }) },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return { dates: await eligibleRedemptionDates(auth.userId) };
    },
  );

  route.post(
    '/me/rewards/:rewardId/redeem',
    {
      schema: {
        tags: ['loyalty'],
        summary: 'Redeem a free meal day onto a chosen date',
        params: z.object({ rewardId: z.string().uuid() }),
        body: z.object({ serviceDate: PlainDate }),
        response: {
          200: z.object({
            rewardId: z.string().uuid(),
            serviceDate: z.string(),
            mealsCreated: z.number().int(),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return redeemReward(auth.userId, request.params.rewardId, request.body.serviceDate);
    },
  );

  route.get(
    '/me/referrals',
    {
      schema: {
        tags: ['referrals'],
        summary: 'Referral code, share copy and privacy-safe history',
        response: {
          200: z.object({
            code: z.string().nullable(),
            shareMessage: z.string(),
            howItWorks: z.array(z.string()),
            qualifiedCount: z.number().int(),
            referrals: z.array(
              z.object({
                id: z.string().uuid(),
                friend: z.string(),
                status: z.string(),
                qualifiedAt: z.string().nullable(),
                createdAt: z.string(),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return getReferralOverview(auth.userId);
    },
  );

  route.post(
    '/me/referrals/apply',
    {
      schema: {
        tags: ['referrals'],
        summary: 'Attach a referral code before the first payment',
        body: z.object({ code: z.string().min(4).max(20) }),
        response: { 200: z.object({ status: z.literal('attributed') }) },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return applyReferralCode(auth.userId, request.body.code);
    },
  );

  route.get(
    '/loyalty/leaderboard',
    {
      schema: {
        tags: ['loyalty'],
        summary: 'Monthly leaderboard. Recognition only — it does not gate the reward.',
        querystring: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
        response: {
          200: z.object({
            period: z.string(),
            daysUntilReset: z.number().int(),
            top: z.array(
              z.object({
                rank: z.number().int(),
                displayName: z.string(),
                points: z.number().int(),
                isCurrentUser: z.boolean(),
              }),
            ),
            me: z.object({
              rank: z.number().int().nullable(),
              points: z.number().int(),
              optedIn: z.boolean(),
              pinned: z.boolean(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const period = request.query.month ? `${request.query.month}-01` : currentPeriod();
      return getLeaderboard(auth.userId, period);
    },
  );
}
