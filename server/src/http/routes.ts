import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sql } from 'kysely';
import { db } from '../platform/db/index.js';
import { appStateRoutes } from '../modules/appstate/routes.js';
import { authRoutes } from '../modules/auth/routes.js';
import { checkoutRoutes } from '../modules/checkout/routes.js';
import { mealRoutes } from '../modules/meals/routes.js';
import { meRoutes } from '../modules/me/routes.js';
import { subscriptionRoutes } from '../modules/subscription/routes.js';
import { trialRoutes } from '../modules/trial/routes.js';
import { authPlugin } from './auth-plugin.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(authPlugin);

  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get(
    '/health',
    {
      schema: {
        tags: ['platform'],
        summary: 'Liveness and database connectivity',
        response: {
          200: z.object({ status: z.literal('ok'), database: z.literal('reachable') }),
        },
      },
    },
    async () => {
      await sql`select 1`.execute(db);
      return { status: 'ok' as const, database: 'reachable' as const };
    },
  );

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(trialRoutes);
  await app.register(mealRoutes);
  await app.register(subscriptionRoutes);
  await app.register(checkoutRoutes);
  await app.register(appStateRoutes);
}
