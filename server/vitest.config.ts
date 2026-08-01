import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Integration tests open real connections; keep them off the unit path by default.
    passWithNoTests: false,
  },
});
