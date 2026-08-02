import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Integration tests need a real database and run serially against a throwaway
    // one — `pnpm test:integration`. Without this exclusion the unit glob picks
    // them up and they fail for want of isolation.
    exclude: ['**/node_modules/**', 'src/**/*.integration.test.ts'],
    passWithNoTests: false,
  },
});
