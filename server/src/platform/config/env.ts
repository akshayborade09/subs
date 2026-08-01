import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Resolved relative to this file, not the shell's cwd, so scripts and tests behave
// the same however they are invoked.
loadDotenv({ path: new URL('../../../.env', import.meta.url).pathname, quiet: true });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),

  /** Public base URL the mock payment provider posts webhooks back to. */
  PUBLIC_BASE_URL: z.string().url().default('http://127.0.0.1:4000'),

  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(60),

  MOCK_WEBHOOK_SECRET: z.string().min(16).default('mock-webhook-secret-dev-only'),

  /**
   * Enables ?simulateState=, mock payment scenario overrides and OTP echo.
   * Must never be true in production; enforced below.
   */
  ENABLE_DEV_ENDPOINTS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

function load(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const value = parsed.data;
  if (value.NODE_ENV === 'production' && value.ENABLE_DEV_ENDPOINTS) {
    throw new Error('ENABLE_DEV_ENDPOINTS must be false when NODE_ENV=production');
  }
  return value;
}

export const env: Env = load();
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
