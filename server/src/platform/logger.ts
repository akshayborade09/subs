import pino from 'pino';
import { env, isDev } from './config/env.js';

/**
 * OTP codes, tokens and payment credentials must never reach a log line
 * (handoff §5.2, §19.1). Redaction is central rather than per-call-site so a new
 * route cannot forget it.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["idempotency-key"]',
  '*.otp',
  '*.code',
  '*.codeHash',
  '*.code_hash',
  '*.password',
  '*.refreshToken',
  '*.refresh_token',
  '*.accessToken',
  '*.access_token',
  '*.cardNumber',
  '*.upiId',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  ...(isDev
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }
    : {}),
});
