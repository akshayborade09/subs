import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../../http/auth-plugin.js';
import {
  getNotificationPreferences,
  getProfileHub,
  listNotifications,
  markNotificationsRead,
  updateNotificationPreferences,
} from './service.js';
import { getTransaction, listTransactions, type TransactionFilter } from '../transactions/service.js';

const Preferences = z.object({
  delivery: z.boolean(),
  payment: z.boolean(),
  reminders: z.boolean(),
  nutrition: z.boolean(),
  rewards: z.boolean(),
  offers: z.boolean(),
  leaderboardOptIn: z.boolean(),
  appearance: z.enum(['system', 'light', 'dark']),
  /** Which rows the UI must render as locked-on. */
  operationalChannels: z.array(z.string()),
});

type PreferenceRow = Awaited<ReturnType<typeof getNotificationPreferences>>;
const toPreferences = (row: PreferenceRow) => ({
  delivery: row.delivery,
  payment: row.payment,
  reminders: row.reminders,
  nutrition: row.nutrition,
  rewards: row.rewards,
  offers: row.offers,
  leaderboardOptIn: row.leaderboard_opt_in,
  appearance: row.appearance,
  operationalChannels: ['delivery', 'payment'],
});

const TransactionRow = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  amountPaise: z.number().int().nullable(),
  displayAmount: z.string(),
  status: z.string(),
  reference: z.string().nullable(),
  occurredAt: z.string(),
});

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get(
    '/me/profile-hub',
    {
      schema: {
        tags: ['profile'],
        summary: 'Profile landing: identity, lifecycle label and destination badges',
        response: {
          200: z.object({
            name: z.string().nullable(),
            phoneNumberMasked: z.string(),
            lifecycleLabel: z.string(),
            planDestination: z.string(),
            referralCode: z.string().nullable(),
            unreadNotifications: z.number().int(),
            savedAddresses: z.number().int(),
            availableRewards: z.number().int(),
          }),
        },
      },
    },
    async (request, reply) => getProfileHub(requireAuth(request, reply)),
  );

  route.get(
    '/me/notification-preferences',
    {
      schema: {
        tags: ['settings'],
        summary: 'Notification and appearance preferences',
        response: { 200: Preferences },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return toPreferences(await getNotificationPreferences(auth.userId));
    },
  );

  route.patch(
    '/me/notification-preferences',
    {
      schema: {
        tags: ['settings'],
        summary: 'Update preferences',
        description:
          'Delivery and payment are operational channels and cannot be turned off ' +
          'while upcoming deliveries depend on them.',
        body: z.object({
          delivery: z.boolean().optional(),
          payment: z.boolean().optional(),
          reminders: z.boolean().optional(),
          nutrition: z.boolean().optional(),
          rewards: z.boolean().optional(),
          offers: z.boolean().optional(),
          leaderboardOptIn: z.boolean().optional(),
          appearance: z.enum(['system', 'light', 'dark']).optional(),
        }),
        response: { 200: Preferences },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return toPreferences(await updateNotificationPreferences(auth.userId, request.body));
    },
  );

  route.get(
    '/me/notifications',
    {
      schema: {
        tags: ['settings'],
        summary: 'In-app notification centre',
        response: {
          200: z.object({
            unread: z.number().int(),
            notifications: z.array(
              z.object({
                id: z.string().uuid(),
                category: z.string(),
                title: z.string(),
                body: z.string(),
                deepLink: z.string().nullable(),
                readAt: z.string().nullable(),
                createdAt: z.string(),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      const rows = await listNotifications(auth.userId);
      return {
        unread: rows.filter((row) => row.read_at === null).length,
        notifications: rows.map((row) => ({
          id: row.id,
          category: row.category,
          title: row.title,
          body: row.body,
          deepLink: row.deep_link,
          readAt: row.read_at?.toISOString() ?? null,
          createdAt: row.created_at.toISOString(),
        })),
      };
    },
  );

  route.post(
    '/me/notifications/read',
    {
      schema: {
        tags: ['settings'],
        summary: 'Mark notifications read. Omit ids to mark all.',
        body: z.object({ ids: z.array(z.string().uuid()).optional() }),
        response: { 200: z.object({ marked: z.number().int() }) },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return { marked: await markNotificationsRead(auth.userId, request.body.ids) };
    },
  );

  route.get(
    '/me/transactions',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Payments, refunds, credits and rewards, grouped by month',
        querystring: z.object({
          filter: z.enum(['all', 'payments', 'refunds_credits', 'rewards']).default('all'),
        }),
        response: {
          200: z.object({
            groups: z.array(
              z.object({
                month: z.string(),
                label: z.string(),
                transactions: z.array(TransactionRow),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return {
        groups: await listTransactions(auth.userId, request.query.filter as TransactionFilter),
      };
    },
  );

  route.get(
    '/me/transactions/:transactionId',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Receipt detail with breakdown, coupon and status timeline',
        params: z.object({ transactionId: z.string().uuid() }),
        response: {
          200: TransactionRow.extend({
            subtitleLabel: z.string(),
            paymentMethod: z.string().nullable(),
            purchaseKind: z.string().nullable(),
            failureReason: z.string().nullable(),
            priceBreakdown: z
              .object({
                planPricePaise: z.number().int(),
                deliveryChargesPaise: z.number().int(),
                taxesPaise: z.number().int(),
                discountPaise: z.number().int(),
                trialCreditPaise: z.number().int(),
                rewardCreditPaise: z.number().int(),
                totalPayablePaise: z.number().int(),
              })
              .nullable(),
            coupon: z.object({ code: z.string(), title: z.string() }).nullable(),
            timeline: z.array(z.object({ label: z.string(), at: z.string() })),
          }),
        },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      return getTransaction(auth.userId, request.params.transactionId);
    },
  );
}
