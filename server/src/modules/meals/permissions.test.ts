import { describe, expect, it } from 'vitest';
import { derivePermissions } from './permissions.js';
import type { OpsStatus } from '../../platform/db/types.js';

/** 2026-08-05 is a Wednesday. Cutoff for it is 2026-08-04 20:00 IST. */
const SERVICE_DATE = '2026-08-05';
const ist = (iso: string): Date => new Date(iso);

const at = (iso: string, opsStatus: OpsStatus | null = null) =>
  derivePermissions({ serviceDate: SERVICE_DATE, slot: 'lunch', opsStatus }, ist(iso));

describe('the 8 PM previous-day cutoff', () => {
  it('is open well before the cutoff', () => {
    const p = at('2026-08-04T10:00:00+05:30');
    expect(p).toMatchObject({
      canChangeDate: true,
      canChangeAddress: true,
      canChangePreference: true,
      lockedReason: null,
    });
  });

  it('is still open one minute before', () => {
    expect(at('2026-08-04T19:59:00+05:30').canChangePreference).toBe(true);
  });

  it('closes exactly at 20:00 IST', () => {
    expect(at('2026-08-04T20:00:00+05:30').canChangePreference).toBe(false);
  });

  it('explains itself when locked', () => {
    expect(at('2026-08-04T20:30:00+05:30').lockedReason).toBe(
      'Changes for this meal are locked after 8:00 PM the previous day.',
    );
  });

  it('reports the cutoff instant so the client can show it in advance', () => {
    // 20:00 IST on 4 Aug is 14:30 UTC.
    expect(at('2026-08-01T09:00:00+05:30').cutoffAt).toBe('2026-08-04T14:30:00.000Z');
  });

  it('uses IST, not the server timezone', () => {
    // 14:29 UTC is 19:59 IST — still open, even though UTC "looks" past 14:00.
    expect(at('2026-08-04T14:29:00Z').canChangePreference).toBe(true);
    expect(at('2026-08-04T14:31:00Z').canChangePreference).toBe(false);
  });
});

describe('same-day and past dates', () => {
  it('refuses same-day changes', () => {
    const p = at('2026-08-05T06:00:00+05:30');
    expect(p.canChangePreference).toBe(false);
    expect(p.lockedReason).toBe('Same-day changes are not available.');
  });

  it('refuses changes to a date that has passed', () => {
    expect(at('2026-08-06T09:00:00+05:30').lockedReason).toBe('This delivery date has passed.');
  });
});

describe('operational facts override the clock', () => {
  const early = '2026-08-01T09:00:00+05:30'; // comfortably before any cutoff

  it('locks a delivered meal even though the cutoff has not passed', () => {
    const p = at(early, 'delivered');
    expect(p.canChangeDate).toBe(false);
    expect(p.lockedReason).toBe('This meal has already been delivered.');
  });

  it('locks a meal that is already being prepared', () => {
    expect(at(early, 'preparing').lockedReason).toBe('This meal is already being prepared.');
    expect(at(early, 'out_for_delivery').canChangePreference).toBe(false);
  });

  it('treats cancelled and skipped as not scheduled', () => {
    for (const status of ['cancelled', 'skipped'] as const) {
      expect(at(early, status).lockedReason, status).toBe('This meal is not scheduled.');
    }
  });

  it('locks a delayed delivery rather than letting it be rescheduled mid-flight', () => {
    expect(at(early, 'delayed').canChangeDate).toBe(false);
  });

  it('still allows an address fix after a failed delivery — that is the whole action', () => {
    const p = at(early, 'delivery_failed');
    expect(p.canChangeAddress).toBe(true);
    expect(p.canChangeDate).toBe(false);
    expect(p.canChangePreference).toBe(false);
    expect(p.lockedReason).toContain('Check the address');
  });
});

describe('invariants', () => {
  it('always explains a lock', () => {
    const cases: Array<[string, OpsStatus | null]> = [
      ['2026-08-04T20:30:00+05:30', null],
      ['2026-08-05T06:00:00+05:30', null],
      ['2026-08-06T09:00:00+05:30', null],
      ['2026-08-01T09:00:00+05:30', 'delivered'],
      ['2026-08-01T09:00:00+05:30', 'delayed'],
    ];
    for (const [when, status] of cases) {
      const p = at(when, status);
      const anyLocked = !p.canChangeDate || !p.canChangeAddress || !p.canChangePreference;
      expect(anyLocked && p.lockedReason !== null, `${when} ${status}`).toBe(true);
    }
  });

  it('never reports a reason while everything is still open', () => {
    const p = at('2026-08-03T12:00:00+05:30');
    expect(p.lockedReason).toBeNull();
  });
});
