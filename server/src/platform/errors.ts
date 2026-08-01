/**
 * One error envelope for the whole API:
 *   { error: { code, message, details? } }
 * `code` is a stable machine string the client switches on; `message` is safe to
 * show a user. Never put provider errors or stack traces in either.
 */
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'PHONE_INVALID'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_ATTEMPTS_EXCEEDED'
  | 'OTP_RESEND_TOO_SOON'
  | 'RATE_LIMITED'
  | 'PINCODE_NOT_SERVICEABLE'
  | 'CUTOFF_PASSED'
  | 'SCHEDULE_CONFLICT'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'CHECKOUT_INVALID_STATE'
  | 'COUPON_INVALID'
  | 'PAYMENT_FAILED'
  | 'ACCOUNT_BLOCKED'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  PHONE_INVALID: 422,
  OTP_INVALID: 422,
  OTP_EXPIRED: 422,
  OTP_ATTEMPTS_EXCEEDED: 429,
  OTP_RESEND_TOO_SOON: 429,
  RATE_LIMITED: 429,
  PINCODE_NOT_SERVICEABLE: 422,
  CUTOFF_PASSED: 422,
  SCHEDULE_CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 422,
  IDEMPOTENCY_IN_PROGRESS: 409,
  CHECKOUT_INVALID_STATE: 409,
  COUPON_INVALID: 422,
  PAYMENT_FAILED: 402,
  ACCOUNT_BLOCKED: 403,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS[code];
    this.details = details;
  }

  toBody() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export const fail = (code: ErrorCode, message: string, details?: unknown): never => {
  throw new AppError(code, message, details);
};
