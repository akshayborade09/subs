import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { buildHome } from '../../lifecycle/home.js';
import { toLegacyLifecycleId } from '../../lifecycle/legacy.js';
import { loadSnapshot } from '../../lifecycle/load.js';
import { resolveCondition } from '../../lifecycle/rules.js';
import { env, isDev } from '../../platform/config/env.js';
import { AppError } from '../../platform/errors.js';
import { CLIENT_OWNED_STATES } from '../../lifecycle/legacy.js';
import { SCENARIOS } from '../../lifecycle/scenarios.js';
import { ALL_CONDITIONS, type AccountCondition } from '../../lifecycle/types.js';

/**
 * Dev-only state forcing, so the app's 39-state selector keeps working once it is
 * pointed at the real API. Accepts either a condition name (TRIAL_ACTIVE_...) or a
 * legacy letter (G).
 */
function scenarioFor(requested: string): AccountCondition {
  const upper = requested.toUpperCase();
  const byName = ALL_CONDITIONS.find((condition) => condition === upper);
  if (byName) return byName;

  const byLetter = ALL_CONDITIONS.find(
    (condition) => toLegacyLifecycleId(condition) === upper,
  );
  if (byLetter) return byLetter;

  const reason = CLIENT_OWNED_STATES[upper];
  throw new AppError(
    'VALIDATION_FAILED',
    reason
      ? `State ${upper} is not server-derived. ${reason}`
      : `Unknown state "${requested}".`,
    { serverDerived: ALL_CONDITIONS },
  );
}

const MealMarker = z.object({
  mealOrderId: z.string(),
  slot: z.enum(['lunch', 'dinner']),
  foodType: z.enum(['vegetarian', 'non_vegetarian']),
  status: z.enum(['delivered', 'upcoming', 'paused', 'inactive', 'issue', 'delayed', 'delivery_failed']),
  showRipple: z.boolean(),
});

const WeekDay = z.object({
  date: z.string(),
  dayLabel: z.string(),
  shortDate: z.string(),
  isToday: z.boolean(),
  isSelected: z.boolean(),
  isDisabled: z.boolean(),
  markers: z.array(MealMarker),
});

const HomePayload = z.object({
  variant: z.string(),
  eyebrow: z.string(),
  title: z.string(),
  description: z.string(),
  caption: z.string().nullable(),
  selectedLabel: z.string(),
  selectedDate: z.string().nullable(),
  week: z.array(WeekDay),
  notice: z
    .object({
      title: z.string(),
      body: z.string(),
      tone: z.enum(['orange', 'red', 'blue', 'purple']),
      action: z.string().optional(),
    })
    .nullable(),
  planCard: z
    .object({ title: z.string(), description: z.string(), buttonLabel: z.string() })
    .nullable(),
});

const AppStateResponse = z.object({
  user: z.object({ id: z.string(), fullName: z.string().nullable() }).nullable(),
  lifecycleState: z.string(),
  legacyStateId: z.string().nullable(),
  route: z.string(),
  requiresAction: z.boolean(),
  resumeStep: z.string().nullable(),
  home: HomePayload.nullable(),
  debug: z.object({ firedRule: z.string(), today: z.string() }).optional(),
});

export async function appStateRoutes(app: FastifyInstance): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.get(
    '/me/app-state',
    {
      schema: {
        tags: ['app-state'],
        summary: 'Where to route the user and what Home to render',
        description:
          'The single endpoint the client renders from. Lifecycle state is derived ' +
          'here from database facts, never selected by the client.',
        querystring: z.object({
          simulateState: z
            .string()
            .optional()
            .describe('Dev only. Condition name or legacy letter, e.g. G.'),
        }),
        response: { 200: AppStateResponse },
      },
    },
    async (request) => {
      const simulate = env.ENABLE_DEV_ENDPOINTS ? request.query.simulateState : undefined;
      const snapshot = simulate
        ? SCENARIOS[scenarioFor(simulate)]()
        : await loadSnapshot(request.auth);
      const resolution = resolveCondition(snapshot);
      const home = buildHome(snapshot, resolution.condition);

      return {
        user: snapshot.user ? { id: snapshot.user.id, fullName: snapshot.user.fullName } : null,
        lifecycleState: resolution.condition,
        legacyStateId: toLegacyLifecycleId(resolution.condition),
        route: resolution.route,
        requiresAction: resolution.requiresAction,
        resumeStep:
          resolution.condition === 'ONBOARDING_INCOMPLETE'
            ? (snapshot.onboarding?.resumeStep ?? 'personal')
            : null,
        home,
        // firedRule turns "why is this user seeing this screen" into one string.
        ...(isDev ? { debug: { firedRule: resolution.firedRule, today: snapshot.today } } : {}),
      };
    },
  );
}
