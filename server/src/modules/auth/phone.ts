import { AppError } from '../../platform/errors.js';

/**
 * Handoff §5.1 requires the client and server to apply identical rules:
 * strip +91, spaces and hyphens; keep digits; exactly 10 digits; first digit 6–9.
 *
 * Mirrors `normalizeIndianPhone` in App.tsx:328 so a number the app accepts is
 * never rejected here, and vice versa.
 */
const VALID = /^[6-9]\d{9}$/;

export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  // Peel the STD trunk prefix first ("08655309919"), then the country code, so
  // "0918655309919" — both at once — also lands on the subscriber number.
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return VALID.test(digits) ? digits : null;
}

export function requireIndianPhone(input: string): string {
  const normalized = normalizeIndianPhone(input);
  if (!normalized) {
    throw new AppError('PHONE_INVALID', 'Enter 10 digits starting with 6, 7, 8 or 9.');
  }
  return normalized;
}

/** "+91 ••••••9919" — the masked form the profile screen shows. */
export function maskPhone(phone: string, countryCode = '+91'): string {
  return `${countryCode} ${'•'.repeat(6)}${phone.slice(-4)}`;
}
