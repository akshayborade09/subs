import { buildApp } from './http/app.js';
import { env } from './platform/config/env.js';
import { closeDb } from './platform/db/index.js';
import { logger } from './platform/logger.js';

async function main(): Promise<void> {
  const app = await buildApp();

  await app.listen({ port: env.PORT, host: env.HOST });
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, devEndpoints: env.ENABLE_DEV_ENDPOINTS },
    'Healthy Tiffins API listening',
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    await app.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'failed to start');
  process.exit(1);
});
