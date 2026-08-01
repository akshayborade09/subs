import { describe, expect, it } from 'vitest';
import { maskPhone, normalizeIndianPhone } from './phone.js';

describe('normalizeIndianPhone', () => {
  it('accepts the formats the app produces', () => {
    for (const input of [
      '8655309919',
      '+91 86553 09919',
      '+91-86553-09919',
      '918655309919',
      '+918655309919',
      '  8655309919  ',
      '0918655309919',
    ]) {
      expect(normalizeIndianPhone(input), input).toBe('8655309919');
    }
  });

  it('accepts every valid leading digit', () => {
    for (const lead of ['6', '7', '8', '9']) {
      expect(normalizeIndianPhone(`${lead}123456789`)).toBe(`${lead}123456789`);
    }
  });

  it('rejects numbers that are not Indian mobiles', () => {
    for (const input of [
      '5123456789', // leading digit below 6
      '123456789', // too short
      '86553099190', // too long after normalization
      '',
      'not a phone',
      '+1 415 555 0123',
    ]) {
      expect(normalizeIndianPhone(input), input).toBeNull();
    }
  });

  it('is idempotent', () => {
    const once = normalizeIndianPhone('+91 86553 09919')!;
    expect(normalizeIndianPhone(once)).toBe(once);
  });
});

describe('maskPhone', () => {
  it('matches the profile screen format', () => {
    expect(maskPhone('8655309919')).toBe('+91 ••••••9919');
  });
});
