import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '../platform/db/index.js';
import { AppError } from '../platform/errors.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';

export type AuthContext = {
  userId: string;
  sessionId: string;
  phoneVerified: boolean;
  status: 'active' | 'blocked' | 'deleted';
};

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

/**
 * Populates `request.auth` when a valid bearer token is present. Deliberately does
 * NOT reject blocked accounts — the lifecycle resolver turns that into the
 * ACCOUNT_BLOCKED condition so the client gets a routable state rather than a 403
 * it has no screen for.
 */
async function loadAuth(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return;

  const claims = await verifyAccessToken(header.slice('Bearer '.length).trim());

  const session = await db
    .selectFrom('sessions')
    .innerJoin('users', 'users.id', 'sessions.user_id')
    .select(['sessions.id as session_id', 'users.id as user_id', 'users.status'])
    .where('sessions.id', '=', claims.sid)
    .where('sessions.revoked_at', 'is', null)
    .executeTakeFirst();

  if (!session) {
    throw new AppError('UNAUTHENTICATED', 'Your session has ended. Please sign in again.');
  }

  request.auth = {
    userId: session.user_id,
    sessionId: session.session_id,
    phoneVerified: claims.phoneVerified,
    status: session.status,
  };
}

export function requireAuth(request: FastifyRequest, _reply: FastifyReply): AuthContext {
  if (!request.auth) {
    throw new AppError('UNAUTHENTICATED', 'Sign in to continue.');
  }
  return request.auth;
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest('auth', undefined);
  app.addHook('preHandler', loadAuth);
});
