import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { handleReminderAlarm, reminderTimes, scheduleReminders, shouldNotify, updateBadge } from '../src/agents/reminders';
import { DEFAULT_SETTINGS, setItem } from '../src/lib/storage';
import type { Contest } from '../src/lib/types';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));

const NOW = Date.parse('2026-11-04T12:00:00Z');
const MIN = 60_000;
const contest = (startInMin: number, id = 'codeforces:1'): Contest => ({
  id,
  platform: 'codeforces',
  name: 'Round',
  url: 'https://codeforces.com/contest/1',
  start: NOW + startInMin * MIN,
  durationSec: 7200,
});

beforeEach(async () => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await setItem('settings', { ...DEFAULT_SETTINGS, reminderOffsets: [60, 10] });
});
afterEach(() => vi.useRealTimers());

describe('reminderTimes', () => {
  it('never schedules in the past', () => {
    expect(reminderTimes(contest(120), [60, 10], NOW).map((r) => r.offset)).toEqual([60, 10]);
    expect(reminderTimes(contest(30), [60, 10], NOW).map((r) => r.offset)).toEqual([10]);
    expect(reminderTimes(contest(5), [60, 10], NOW)).toEqual([]);
  });
});

describe('shouldNotify', () => {
  it('skips contests that already started and reminders delivered late', () => {
    expect(shouldNotify(contest(10), 10, NOW)).toBe(true);
    expect(shouldNotify(contest(9), 10, NOW)).toBe(true); // 1 min late is fine
    expect(shouldNotify(contest(5), 10, NOW)).toBe(false); // 5 min late (woke from sleep)
    expect(shouldNotify(contest(-1), 10, NOW)).toBe(false);
  });
});

describe('scheduleReminders / handleReminderAlarm', () => {
  it('creates alarms only for future reminder times', async () => {
    await setItem('contests', { items: [contest(30), contest(120, 'codeforces:2')], fetchedAt: NOW, errors: {} });
    expect(await scheduleReminders()).toBe(3);
    const alarms = await fakeBrowser.alarms.getAll();
    expect(alarms.every((a) => a.scheduledTime > NOW)).toBe(true);
  });

  it('does not notify for a missed alarm after the contest started', async () => {
    await setItem('contests', { items: [contest(-3)], fetchedAt: NOW, errors: {} });
    await handleReminderAlarm('remind|codeforces:1|10');
    expect(fakeBrowser.notifications.getAllCreateOptions()).toEqual({});
  });

  it('notifies on time', async () => {
    await setItem('contests', { items: [contest(10)], fetchedAt: NOW, errors: {} });
    await handleReminderAlarm('remind|codeforces:1|10');
    const n = Object.values(fakeBrowser.notifications.getAllCreateOptions());
    expect(n).toHaveLength(1);
    expect(n[0]!.title).toContain('in 10 min');
  });
});

describe('updateBadge', () => {
  it('falls back to browserAction on MV2 (Firefox)', async () => {
    await setItem('contests', { items: [contest(30)], fetchedAt: NOW, errors: {} });
    const setBadgeText = vi.fn(async () => undefined);
    const setBadgeBackgroundColor = vi.fn(async () => undefined);
    const b = fakeBrowser as unknown as Record<string, unknown>;
    const action = b.action;
    b.action = undefined;
    b.browserAction = { setBadgeText, setBadgeBackgroundColor };
    try {
      await updateBadge();
    } finally {
      b.action = action;
    }
    expect(setBadgeText).toHaveBeenCalledWith({ text: '1' });
    expect(setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#d03b3b' });
  });
});
