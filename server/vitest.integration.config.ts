import { defineConfig } from 'vitest/config';

/**
 * Integration tests hit a real Postgres and share one Fastify instance, so they
 * run single-file, single-fork. Point DATABASE_URL at a throwaway database —
 * `resetData()` truncates between tests.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
