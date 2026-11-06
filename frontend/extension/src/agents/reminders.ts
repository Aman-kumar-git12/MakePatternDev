import { browser } from 'wxt/browser';
import { PLATFORMS } from '../lib/platforms';
import { getItem, getSettings } from '../lib/storage';
import type { Contest } from '../lib/types';

const PREFIX = 'remind|';

export function isLive(c: Contest, now = Date.now()) {
  return c.start <= now && now < c.start + c.durationSec * 1000;
}

/** Don't schedule reminders closer than this to now. */
const MIN_LEAD_MS = 5_000;
/** A reminder delivered later than this (e.g. Chrome catching up after sleep) is dropped. */
const MAX_LATE_MS = 2 * 60_000;

/** Alarm times for one contest: one per offset, never in the past. */
export function reminderTimes(c: Contest, offsets: number[], now = Date.now()): { offset: number; when: number }[] {
  return offsets.map((offset) => ({ offset, when: c.start - offset * 60_000 })).filter((r) => r.when > now + MIN_LEAD_MS);
}

/** Re-creates every contest reminder alarm from the cached contest list. */
export async function scheduleReminders(): Promise<number> {
  const [{ items }, settings, overrides] = await Promise.all([
    getItem('contests'),
    getSettings(),
    getItem('reminderOverrides'),
  ]);
  const existing = await browser.alarms.getAll();
  await Promise.all(existing.filter((a) => a.name.startsWith(PREFIX)).map((a) => browser.alarms.clear(a.name)));

  const now = Date.now();
  let count = 0;
  for (const c of items) {
    if (!settings.contestPlatforms[c.platform]) continue;
    if (!(overrides[c.id] ?? settings.remindersEnabled)) continue;
    for (const { offset, when } of reminderTimes(c, settings.reminderOffsets, now)) {
      await browser.alarms.create(`${PREFIX}${c.id}|${offset}`, { when });
      count++;
    }
  }
  return count;
}

/**
 * Whether a reminder alarm should still notify. Chrome delivers missed alarms on wake, so a
 * reminder can arrive after the contest started or long after it was due — skip those.
 */
export function shouldNotify(c: Contest, offsetMinutes: number, now = Date.now()): boolean {
  if (c.start <= now) return false;
  const due = c.start - offsetMinutes * 60_000;
  return Number.isNaN(due) || now - due <= MAX_LATE_MS;
}

export async function handleReminderAlarm(name: string): Promise<boolean> {
  if (!name.startsWith(PREFIX)) return false;
  const [contestId, offset] = name.slice(PREFIX.length).split('|');
  const { items } = await getItem('contests');
  const c = items.find((x) => x.id === contestId);
  const now = Date.now();
  if (!c || !shouldNotify(c, Number(offset), now)) return true;
  const minutes = Math.max(1, Math.round((c.start - now) / 60_000));
  await browser.notifications.create(`contest|${c.id}|${offset}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: `${PLATFORMS[c.platform].name} contest in ${minutes} min`,
    message: c.name,
    contextMessage: 'Click to open the contest page',
    priority: 2,
  });
  return true;
}

export async function handleNotificationClick(notificationId: string) {
  if (notificationId.startsWith('contest|')) {
    const contestId = notificationId.split('|')[1];
    const { items } = await getItem('contests');
    const c = items.find((x) => x.id === contestId);
    if (c) await browser.tabs.create({ url: c.url });
  } else if (notificationId.startsWith('weekly|')) {
    await browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}#stats` });
  }
  await browser.notifications.clear(notificationId);
}

/** Badge: number of contests in the next 24h; red when one starts within the hour or is live. */
export async function updateBadge() {
  const [{ items }, settings] = await Promise.all([getItem('contests'), getSettings()]);
  const now = Date.now();
  const visible = items.filter((c) => settings.contestPlatforms[c.platform]);
  const soon = visible.filter((c) => c.start > now && c.start - now < 86_400_000);
  const urgent = visible.some((c) => isLive(c, now) || (c.start > now && c.start - now < 3_600_000));
  // MV2 builds (Firefox) only have `browserAction`.
  const action = browser.action ?? (browser as unknown as { browserAction?: typeof browser.action }).browserAction;
  if (!action) return;
  await action.setBadgeText({ text: soon.length ? String(soon.length) : '' });
  await action.setBadgeBackgroundColor({ color: urgent ? '#d03b3b' : '#2a78d6' });
}
