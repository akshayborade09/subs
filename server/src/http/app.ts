import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { env, isDev } from '../platform/config/env.js';
import { AppError } from '../platform/errors.js';
import { logger, REDACT_PATHS } from '../platform/logger.js';
import { registerRoutes } from './routes.js';

// Return type is inferred: withTypeProvider() narrows the instance, and annotating
// it as a bare FastifyInstance discards the Zod route typing.
export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: false,
    // The mock webhook signature is computed over the exact bytes we received.
    bodyLimit: 1_048_576,
    ajv: { customOptions: { removeAdditional: false } },
    genReqId: () => crypto.randomUUID(),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: isDev ? true : false });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Healthy Tiffins API',
        version: '1.0.0',
        description:
          'Backend for the Healthy Tiffins meal-subscription app. The client renders ' +
          'whatever GET /v1/me/app-state returns; lifecycle state is derived here.',
      },
      servers: [{ url: env.PUBLIC_BASE_URL }],
    },
    transform: jsonSchemaTransform,
  });

  // Raw body retained for webhook signature verification.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body: Buffer, done) => {
      (req as { rawBody?: Buffer }).rawBody = body;
      if (body.length === 0) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(body.toString('utf8')));
      } catch {
        done(new AppError('VALIDATION_FAILED', 'Request body is not valid JSON'), undefined);
      }
    },
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) request.log.error({ err: error }, 'request failed');
      return reply.status(error.statusCode).send(error.toBody());
    }

    if (error instanceof ZodError || (error as { validation?: unknown }).validation) {
      const details =
        error instanceof ZodError
          ? error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
          : (error as { validation?: unknown }).validation;
      return reply.status(422).send({
        error: { code: 'VALIDATION_FAILED', message: 'Request validation failed', details },
      });
    }

    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply
        .status(429)
        .send({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } });
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } }),
  );

  await app.register(registerRoutes, { prefix: '/v1' });

  return app;
}

export { REDACT_PATHS };
