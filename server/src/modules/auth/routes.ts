import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from '../../platform/config/env.js';
import { requireAuth } from '../../http/auth-plugin.js';
import { requireIndianPhone } from './phone.js';
import { logout, refreshSession, startOtp, verifyOtp } from './service.js';

const PhoneBody = z.object({
  phone: z.string().min(1),
  deviceId: z.string().max(128).optional(),
});

const SessionResponse = z.object({
  userId: z.string().uuid(),
  isNewUser: z.boolean(),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const route = app.withTypeProvider<ZodTypeProvider>();

  route.post(
    '/auth/otp/start',
    {
      schema: {
        tags: ['auth'],
        summary: 'Send a verification code to an Indian mobile number',
        body: PhoneBody,
        response: {
          200: z.object({
            challengeId: z.string().uuid(),
            resendAvailableInSeconds: z.number().int(),
            expiresAt: z.string(),
            devCode: z.string().optional(),
          }),
        },
      },
    },
    async (request) => {
      const phone = requireIndianPhone(request.body.phone);
      const result = await startOtp(phone, request.body.deviceId ?? null);
      return {
        challengeId: result.challengeId,
        resendAvailableInSeconds: result.resendAvailableInSeconds,
        expiresAt: result.expiresAt.toISOString(),
        ...(result.devCode ? { devCode: result.devCode } : {}),
      };
    },
  );

  route.post(
    '/auth/otp/verify',
    {
      schema: {
        tags: ['auth'],
        summary: 'Exchange a verification code for a session',
        body: PhoneBody.extend({ code: z.string().regex(/^\d{6}$/) }),
        response: { 200: SessionResponse },
      },
    },
    async (request) => {
      const phone = requireIndianPhone(request.body.phone);
      return verifyOtp(
        phone,
        request.body.code,
        request.body.deviceId ?? null,
        request.headers['user-agent'] ?? null,
      );
    },
  );

  route.post(
    '/auth/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Rotate a refresh token for a new session',
        body: z.object({ refreshToken: z.string().min(1) }),
        response: { 200: SessionResponse },
      },
    },
    async (request) => refreshSession(request.body.refreshToken),
  );

  route.post(
    '/auth/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Revoke the current session',
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request, reply) => {
      const auth = requireAuth(request, reply);
      await logout(auth.sessionId);
      return { ok: true as const };
    },
  );

  if (env.ENABLE_DEV_ENDPOINTS) {
    route.get(
      '/dev/config',
      {
        schema: {
          tags: ['dev'],
          summary: 'Confirms dev affordances are on (OTP echo, state forcing, mock scenarios)',
          response: { 200: z.object({ devEndpoints: z.boolean(), env: z.string() }) },
        },
      },
      async () => ({ devEndpoints: true, env: env.NODE_ENV }),
    );
  }
}
