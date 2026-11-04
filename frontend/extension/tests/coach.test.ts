import { describe, expect, it, vi } from 'vitest';
import { lastReportBoundary, weeklyReportDue } from '../src/agents/coach';
import { weekKey } from '../src/lib/time';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));

// Local times: Sunday 2026-11-08, the week starting Monday 2026-11-02.
const at = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h).getTime();
const SUN_18 = at(2026, 11, 8, 18);
const WEEK = '2026-11-02';

describe('lastReportBoundary', () => {
  it('is the latest Sunday 18:00 at or before now', () => {
    expect(lastReportBoundary(at(2026, 11, 8, 19))).toBe(SUN_18);
    expect(lastReportBoundary(SUN_18)).toBe(SUN_18);
    expect(lastReportBoundary(at(2026, 11, 8, 17))).toBe(at(2026, 11, 1, 18));
    expect(lastReportBoundary(at(2026, 11, 11, 9))).toBe(SUN_18);
    expect(weekKey(SUN_18)).toBe(WEEK);
  });
});

describe('weeklyReportDue', () => {
  it('sends on Sunday evening once', () => {
    expect(weeklyReportDue(at(2026, 11, 8, 19), '2026-10-26')).toMatchObject({ due: true, week: WEEK });
    expect(weeklyReportDue(at(2026, 11, 8, 20), WEEK).due).toBe(false);
  });

  it('catches up when the browser was closed on Sunday evening', () => {
    expect(weeklyReportDue(at(2026, 11, 10, 9), '2026-10-26')).toMatchObject({ due: true, week: WEEK, boundary: SUN_18 });
  });

  it('is not due before Sunday 18:00', () => {
    expect(weeklyReportDue(at(2026, 11, 8, 17), '2026-10-26').due).toBe(false);
  });

  it('does not send a catch-up report on a fresh install', () => {
    expect(weeklyReportDue(at(2026, 11, 10, 9), undefined).due).toBe(false);
    expect(weeklyReportDue(at(2026, 11, 8, 19), undefined).due).toBe(true);
  });
});
