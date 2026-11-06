import { errorMessage } from '../../lib/http';
import { getItem, getSettings, pruneContestData, updateItem } from '../../lib/storage';
import type { Contest, ContestPlatform } from '../../lib/types';
import { scheduleReminders, updateBadge } from '../reminders';
import type { Agent } from '../types';
import { CONTEST_FETCHERS } from './fetchers';

async function run(): Promise<string> {
  const settings = await getSettings();
  const previous = await getItem('contests');
  const platforms = (Object.keys(CONTEST_FETCHERS) as ContestPlatform[]).filter((p) => settings.contestPlatforms[p]);

  const results = await Promise.allSettled(platforms.map((p) => CONTEST_FETCHERS[p]()));
  const now = Date.now();
  const errors: Partial<Record<ContestPlatform, string>> = {};
  const items: Contest[] = [];

  results.forEach((r, i) => {
    const p = platforms[i]!;
    if (r.status === 'fulfilled') items.push(...r.value);
    else {
      errors[p] = errorMessage(r.reason);
      // Keep the last good data for a failing platform rather than showing nothing.
      items.push(...previous.items.filter((c) => c.platform === p));
    }
  });

  const unique = new Map(items.map((c) => [c.id, c]));
  const upcoming = [...unique.values()]
    .filter((c) => c.start + c.durationSec * 1000 > now)
    .sort((a, b) => a.start - b.start);

  await updateItem('contests', () => ({ items: upcoming, fetchedAt: now, errors }));
  // Forget reminder overrides of contests that ended over a day ago (only judged on fresh data).
  await pruneContestData(upcoming, new Set(platforms.filter((p) => !errors[p])), now);
  const reminders = await scheduleReminders();
  await updateBadge();

  const failed = Object.keys(errors);
  const base = `${upcoming.length} contests, ${reminders} reminders scheduled`;
  if (failed.length === platforms.length && platforms.length) throw new Error(`All sources failed: ${Object.values(errors).join('; ')}`);
  return failed.length ? `${base} (failed: ${failed.join(', ')})` : base;
}

export const contestsAgent: Agent = {
  id: 'contests',
  name: 'Contest agent',
  description: 'Fetches upcoming contests from LeetCode, Codeforces, CodeChef and AtCoder, schedules reminders and updates the badge.',
  trigger: 'schedule',
  periodMinutes: 180,
  run,
};
