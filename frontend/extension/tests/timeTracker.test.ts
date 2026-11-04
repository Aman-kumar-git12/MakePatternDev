import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { creditableMs, MAX_GAP_MS, onIdleStateChanged, TICK_MS, trackNow } from '../src/agents/timeTracker';
import { DEFAULT_SETTINGS, getItem, setItem } from '../src/lib/storage';
import { localDate } from '../src/lib/time';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));

const START = new Date('2026-11-04T10:00:00').getTime();
const SEC = 1000;
let activeUrl = '';

async function seconds(): Promise<number> {
  const time = await getItem('time');
  return time[localDate(START)]?.leetcode?.total ?? 0;
}

async function problemSeconds(): Promise<number> {
  const time = await getItem('time');
  return time[localDate(START)]?.leetcode?.problems['leetcode:two-sum'] ?? 0;
}

/** Advances the clock and runs the 1-minute tick (what the background `tick` alarm does). */
async function tickAt(ms: number) {
  vi.setSystemTime(START + ms);
  await trackNow();
}

beforeEach(async () => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  await setItem('settings', { ...DEFAULT_SETTINGS, idleSeconds: 120 });
  activeUrl = 'https://leetcode.com/problems/two-sum/';
  vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation((async () => [{ url: activeUrl }]) as never);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('creditableMs', () => {
  it('credits a normal tick and nothing across a sleep gap', () => {
    expect(creditableMs(0, TICK_MS)).toBe(TICK_MS);
    expect(creditableMs(0, MAX_GAP_MS)).toBe(MAX_GAP_MS);
    expect(creditableMs(0, MAX_GAP_MS + 1)).toBe(0);
    expect(creditableMs(10, 5)).toBe(0);
  });
});

describe('time tracker', () => {
  it('credits active time tick by tick', async () => {
    await trackNow();
    await tickAt(60 * SEC);
    await tickAt(120 * SEC);
    expect(await seconds()).toBe(120);
    expect(await problemSeconds()).toBe(120);
  });

  it('does not credit a sleep/wake gap', async () => {
    await trackNow();
    await tickAt(60 * SEC);
    // Laptop sleeps; the next tick only fires 40 minutes later.
    await tickAt(41 * 60 * SEC);
    expect(await seconds()).toBe(60);
    // Tracking resumes normally afterwards.
    await tickAt(42 * 60 * SEC);
    expect(await seconds()).toBe(120);
  });

  it('takes back the idle-detection window when the user goes idle', async () => {
    await trackNow();
    for (let m = 1; m <= 5; m++) await tickAt(m * 60 * SEC);
    expect(await seconds()).toBe(300);
    // Input stopped at 3:30; Chrome reports idle 120 s later, at 5:30.
    vi.setSystemTime(START + 330 * SEC);
    await onIdleStateChanged('idle');
    expect(await seconds()).toBe(210);
    expect(await problemSeconds()).toBe(210);
    // Nothing is credited while idle.
    await tickAt(10 * 60 * SEC);
    expect(await seconds()).toBe(210);
    // Back to work.
    vi.setSystemTime(START + 11 * 60 * SEC);
    await onIdleStateChanged('active');
    await tickAt(12 * 60 * SEC);
    expect(await seconds()).toBe(270);
  });

  it('a screen lock stops counting without taking time back', async () => {
    await trackNow();
    await tickAt(60 * SEC);
    vi.setSystemTime(START + 90 * SEC);
    await onIdleStateChanged('locked');
    expect(await seconds()).toBe(90);
  });

  it('ignores non-coding tabs', async () => {
    activeUrl = 'https://example.com/';
    await trackNow();
    await tickAt(60 * SEC);
    expect(await seconds()).toBe(0);
  });
});
