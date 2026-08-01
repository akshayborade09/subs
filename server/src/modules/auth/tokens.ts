import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../platform/config/env.js';
import { AppError } from '../../platform/errors.js';

const SECRET = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = 'healthy-tiffins';

export type AccessClaims = {
  sub: string;
  sid: string;
  phoneVerified: boolean;
};

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid, phoneVerified: claims.phoneVerified })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { issuer: ISSUER });
    if (!payload.sub || typeof payload.sid !== 'string') {
      throw new AppError('UNAUTHENTICATED', 'Malformed access token');
    }
    return {
      sub: payload.sub,
      sid: payload.sid,
      phoneVerified: payload.phoneVerified === true,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
  }
}

/**
 * Refresh tokens are stored only as SHA-256 hashes, so a database leak cannot be
 * replayed against the API.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
