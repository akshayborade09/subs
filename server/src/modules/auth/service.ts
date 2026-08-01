import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { sql } from 'kysely';
import { db, type Tx } from '../../platform/db/index.js';
import { env } from '../../platform/config/env.js';
import { policy } from '../../platform/config/policy.js';
import { AppError } from '../../platform/errors.js';
import { generateRefreshToken, hashToken, signAccessToken } from './tokens.js';

const COUNTRY_CODE = '+91';

/** Hashed with the app secret so a database dump does not reveal live codes. */
function hashOtp(phone: string, code: string): string {
  return createHash('sha256').update(`${phone}:${code}:${env.JWT_SECRET}`).digest('hex');
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function generateCode(): string {
  const max = 10 ** policy.otp.length;
  return String(randomInt(0, max)).padStart(policy.otp.length, '0');
}

export type StartOtpResult = {
  challengeId: string;
  resendAvailableInSeconds: number;
  expiresAt: Date;
  /** Only ever populated when ENABLE_DEV_ENDPOINTS is on. Never logged. */
  devCode?: string;
};

export async function startOtp(phone: string, deviceId: string | null): Promise<StartOtpResult> {
  const now = new Date();

  const recent = await db
    .selectFrom('otp_challenges')
    .select(['id', 'created_at'])
    .where('phone_country_code', '=', COUNTRY_CODE)
    .where('phone_number', '=', phone)
    .where('created_at', '>', new Date(now.getTime() - 60 * 60 * 1000))
    .orderBy('created_at', 'desc')
    .execute();

  if (recent.length >= policy.otp.maxRequestsPerPhonePerHour) {
    throw new AppError('RATE_LIMITED', 'Too many verification requests. Please try again later.');
  }

  const last = recent[0];
  if (last) {
    const elapsed = (now.getTime() - last.created_at.getTime()) / 1000;
    if (elapsed < policy.otp.resendCooldownSeconds) {
      throw new AppError(
        'OTP_RESEND_TOO_SOON',
        `Please wait ${Math.ceil(policy.otp.resendCooldownSeconds - elapsed)}s before requesting another code.`,
      );
    }
  }

  const code = generateCode();
  const expiresAt = new Date(now.getTime() + policy.otp.expirySeconds * 1000);

  // One live challenge per phone: superseding the previous one keeps the partial
  // unique index satisfied and stops an old code from remaining valid.
  const challenge = await db.transaction().execute(async (tx) => {
    await tx
      .updateTable('otp_challenges')
      .set({ consumed_at: now })
      .where('phone_country_code', '=', COUNTRY_CODE)
      .where('phone_number', '=', phone)
      .where('consumed_at', 'is', null)
      .execute();

    return tx
      .insertInto('otp_challenges')
      .values({
        phone_country_code: COUNTRY_CODE,
        phone_number: phone,
        code_hash: hashOtp(phone, code),
        expires_at: expiresAt,
        max_attempts: policy.otp.maxAttempts,
        device_id: deviceId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
  });

  return {
    challengeId: challenge.id,
    resendAvailableInSeconds: policy.otp.resendCooldownSeconds,
    expiresAt,
    ...(env.ENABLE_DEV_ENDPOINTS ? { devCode: code } : {}),
  };
}

export type VerifyOtpResult = {
  userId: string;
  isNewUser: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export async function verifyOtp(
  phone: string,
  code: string,
  deviceId: string | null,
  userAgent: string | null,
): Promise<VerifyOtpResult> {
  const now = new Date();

  return db.transaction().execute(async (tx) => {
    const challenge = await tx
      .selectFrom('otp_challenges')
      .selectAll()
      .where('phone_country_code', '=', COUNTRY_CODE)
      .where('phone_number', '=', phone)
      .where('consumed_at', 'is', null)
      .orderBy('created_at', 'desc')
      .forUpdate()
      .executeTakeFirst();

    if (!challenge) {
      throw new AppError('OTP_INVALID', 'Request a new verification code.');
    }
    if (challenge.expires_at <= now) {
      throw new AppError('OTP_EXPIRED', 'That code has expired. Request a new one below.');
    }
    if (challenge.attempts >= challenge.max_attempts) {
      throw new AppError('OTP_ATTEMPTS_EXCEEDED', 'Too many attempts. Request a new code.');
    }

    if (!constantTimeEquals(challenge.code_hash, hashOtp(phone, code))) {
      await tx
        .updateTable('otp_challenges')
        .set({ attempts: challenge.attempts + 1 })
        .where('id', '=', challenge.id)
        .execute();
      throw new AppError('OTP_INVALID', 'That code is not correct.');
    }

    await tx
      .updateTable('otp_challenges')
      .set({ consumed_at: now })
      .where('id', '=', challenge.id)
      .execute();

    const existing = await tx
      .selectFrom('users')
      .selectAll()
      .where('phone_country_code', '=', COUNTRY_CODE)
      .where('phone_number', '=', phone)
      .executeTakeFirst();

    const user = existing ?? (await createUser(tx, phone, now));

    if (user.status !== 'active') {
      throw new AppError('ACCOUNT_BLOCKED', 'This account is not available. Please contact support.');
    }

    if (!user.phone_verified_at) {
      await tx.updateTable('users').set({ phone_verified_at: now }).where('id', '=', user.id).execute();
    }

    if (!existing) {
      await tx
        .insertInto('notification_preferences')
        .values({ user_id: user.id })
        .onConflict((oc) => oc.column('user_id').doNothing())
        .execute();
      await tx
        .insertInto('onboarding_drafts')
        .values({ user_id: user.id, resume_step: 'personal' })
        .onConflict((oc) => oc.column('user_id').doNothing())
        .execute();
    }

    const refresh = generateRefreshToken();
    const session = await tx
      .insertInto('sessions')
      .values({
        user_id: user.id,
        refresh_token_hash: refresh.hash,
        device_id: deviceId,
        user_agent: userAgent,
        expires_at: new Date(now.getTime() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const accessToken = await signAccessToken({
      sub: user.id,
      sid: session.id,
      phoneVerified: true,
    });

    return {
      userId: user.id,
      isNewUser: !existing,
      accessToken,
      refreshToken: refresh.token,
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    };
  });
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes

/** Users read these aloud, so the alphabet excludes O/0 and I/1. */
function referralCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return `HT${code}`;
}

/**
 * `users.referral_code` is UNIQUE. A collision is unlikely but not impossible, and
 * an unhandled one would surface as a 500 on someone's very first sign-in — so
 * retry a few times before giving up.
 */
async function createUser(tx: Tx, phone: string, now: Date) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inserted = await tx
      .insertInto('users')
      .values({
        phone_country_code: COUNTRY_CODE,
        phone_number: phone,
        phone_verified_at: now,
        referral_code: referralCode(),
      })
      .onConflict((oc) => oc.column('referral_code').doNothing())
      .returningAll()
      .executeTakeFirst();
    if (inserted) return inserted;
  }
  throw new AppError('INTERNAL', 'Could not allocate a referral code. Please try again.');
}

export async function refreshSession(refreshToken: string): Promise<VerifyOtpResult> {
  const now = new Date();
  const hash = hashToken(refreshToken);

  return db.transaction().execute(async (tx) => {
    const session = await tx
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .select([
        'sessions.id as session_id',
        'sessions.user_id',
        'sessions.expires_at',
        'sessions.revoked_at',
        'users.status',
        'users.phone_verified_at',
      ])
      .where('sessions.refresh_token_hash', '=', hash)
      .forUpdate()
      .executeTakeFirst();

    if (!session || session.revoked_at || session.expires_at <= now) {
      throw new AppError('UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
    }
    if (session.status !== 'active') {
      throw new AppError('ACCOUNT_BLOCKED', 'This account is not available. Please contact support.');
    }

    // Rotate: the presented token is retired the moment it is used.
    const next = generateRefreshToken();
    await tx
      .updateTable('sessions')
      .set({ refresh_token_hash: next.hash, last_used_at: now })
      .where('id', '=', session.session_id)
      .execute();

    const accessToken = await signAccessToken({
      sub: session.user_id,
      sid: session.session_id,
      phoneVerified: session.phone_verified_at !== null,
    });

    return {
      userId: session.user_id,
      isNewUser: false,
      accessToken,
      refreshToken: next.token,
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    };
  });
}

export async function logout(sessionId: string): Promise<void> {
  await db
    .updateTable('sessions')
    .set({ revoked_at: sql`now()` })
    .where('id', '=', sessionId)
    .where('revoked_at', 'is', null)
    .execute();
}
