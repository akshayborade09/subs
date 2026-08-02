import { describe, expect, it } from 'vitest';
import { evaluateQualification, type QualificationInput } from './qualification.js';

const START = '2026-07-01';

const dates = (from: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
  );

const input = (overrides: Partial<QualificationInput> = {}): QualificationInput => ({
  periodStart: START,
  today: '2026-07-28', // day 28
  pausedDates: [],
  fulfilledDates: dates(START, 20),
  paymentsHealthy: true,
  accountActive: true,
  ...overrides,
});

describe('Healthy Streak qualification', () => {
  it('qualifies on exactly 28 active days with 20 delivered meal days', () => {
    const result = evaluateQualification(input());
    expect(result.status).toBe('qualified');
    expect(result.activeDays).toBe(28);
    expect(result.fulfilledMealDays).toBe(20);
  });

  it('is still in progress one day short', () => {
    const result = evaluateQualification(input({ today: '2026-07-27' }));
    expect(result.status).toBe('in_progress');
    expect(result.activeDays).toBe(27);
  });

  it('is still in progress with enough days but too few delivered meals', () => {
    const result = evaluateQualification(input({ fulfilledDates: dates(START, 19) }));
    expect(result.status).toBe('in_progress');
    expect(result.fulfilledMealDays).toBe(19);
  });

  it('states the exact rule it is applying', () => {
    expect(evaluateQualification(input()).ruleStatement).toBe(
      '28 continuous active days with at least 20 delivered meal days.',
    );
  });

  it('reports the expected qualification date', () => {
    expect(evaluateQualification(input()).expectedQualificationDate).toBe('2026-07-28');
  });
});

describe('pauses extend rather than reset', () => {
  const paused = ['2026-07-10', '2026-07-11', '2026-07-12'];

  it('does not count paused days toward the streak', () => {
    const result = evaluateQualification(input({ pausedDates: paused }));
    expect(result.activeDays).toBe(25);
    expect(result.status).toBe('in_progress');
  });

  it('pushes the finish line out by the number of paused days', () => {
    const result = evaluateQualification(input({ pausedDates: paused }));
    expect(result.expectedQualificationDate).toBe('2026-07-31');
  });

  it('qualifies once the extended window completes', () => {
    const result = evaluateQualification(
      input({ pausedDates: paused, today: '2026-07-31' }),
    );
    expect(result.activeDays).toBe(28);
    expect(result.status).toBe('qualified');
  });

  it('never loses progress already earned', () => {
    const before = evaluateQualification(input({ today: '2026-07-20' }));
    const after = evaluateQualification(input({ today: '2026-07-20', pausedDates: ['2026-07-21'] }));
    expect(after.activeDays).toBe(before.activeDays);
  });
});

describe('interruptions', () => {
  it('freezes while a payment is unresolved, keeping the progress', () => {
    const result = evaluateQualification(input({ paymentsHealthy: false }));
    expect(result.status).toBe('frozen');
    expect(result.activeDays).toBe(28);
  });

  it('expires for a suspended account', () => {
    const result = evaluateQualification(input({ accountActive: false }));
    expect(result.status).toBe('expired');
  });

  it('treats a suspended account as terminal even mid-freeze', () => {
    const result = evaluateQualification(input({ accountActive: false, paymentsHealthy: false }));
    expect(result.status).toBe('expired');
  });
});

describe('counting', () => {
  it('caps active days at the requirement rather than running away', () => {
    const result = evaluateQualification(input({ today: '2026-09-01' }));
    expect(result.activeDays).toBe(28);
  });

  it('counts distinct delivered dates, not deliveries', () => {
    // Two meals on the same day is one fulfilled meal DAY.
    const result = evaluateQualification({
      ...input(),
      fulfilledDates: [...dates(START, 20), ...dates(START, 20)],
    });
    expect(result.fulfilledMealDays).toBe(20);
  });

  it('reports zero on the period start day having elapsed nothing before it', () => {
    const result = evaluateQualification(input({ today: '2026-06-30' }));
    expect(result.activeDays).toBe(0);
    expect(result.status).toBe('in_progress');
  });
});
