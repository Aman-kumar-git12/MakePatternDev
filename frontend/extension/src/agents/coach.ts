import { browser } from 'wxt/browser';
import { PLATFORMS } from '../lib/platforms';
import { getItem, getSettings, updateItem } from '../lib/storage';
import { activityByDay, currentStreak, isActiveDay, summarize, tagStats, timeTotals } from '../lib/stats';
import { addDays, formatDuration, localDate, weekKey } from '../lib/time';
import type { Agent } from './types';

/** Reports go out on Sunday from this local hour. */
const REPORT_HOUR = 18;

/** The most recent Sunday 18:00 (local) at or before `now`. */
export function lastReportBoundary(now: number = Date.now()): number {
  const d = new Date(now);
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay(), REPORT_HOUR);
  if (sunday.getTime() > now) sunday.setDate(sunday.getDate() - 7);
  return sunday.getTime();
}

/**
 * Whether a weekly report is due. The report for a week is due from its Sunday 18:00; if the
 * browser wasn't running then, it is sent on the next run (catch-up). A first-ever report is only
 * sent on the Sunday evening itself, so a fresh install doesn't get an empty "last week" report.
 */
export function weeklyReportDue(now: number, lastWeek: string | undefined): { due: boolean; week: string; boundary: number } {
  const boundary = lastReportBoundary(now);
  const week = weekKey(boundary);
  if (lastWeek && lastWeek >= week) return { due: false, week, boundary };
  if (!lastWeek && localDate(now) !== localDate(boundary)) return { due: false, week, boundary };
  return { due: true, week, boundary };
}

/**
 * Builds the weekly summary text (also used by the options page): the 7 days ending on the
 * local date of `end` (default: now).
 */
export async function weeklySummary(end: number = Date.now()): Promise<{ title: string; message: string }> {
  const [allSubs, allTime, allPotd] = await Promise.all([getItem('submissions'), getItem('time'), getItem('potdDone')]);
  const to = localDate(end);
  const from = addDays(to, -6);
  const fromTs = new Date(`${from}T00:00:00`).getTime();
  const toTs = new Date(`${addDays(to, 1)}T00:00:00`).getTime();
  // Leave out anything after the reported week (matters when a report is sent late).
  const subs = allSubs.filter((x) => x.ts < toTs);
  const time = Object.fromEntries(Object.entries(allTime).filter(([d]) => d <= to));
  const potdDone = Object.fromEntries(Object.entries(allPotd).filter(([d]) => d <= to));
  const s = summarize(subs, fromTs);
  const t = timeTotals(time, from);
  const potd = Object.entries(potdDone).filter(([d]) => d >= from).reduce((n, [, k]) => n + k.length, 0);
  const days = activityByDay(subs, time, potdDone);
  const streak = currentStreak((d) => isActiveDay(days.get(d)), to);
  const weak = tagStats(subs.filter((x) => x.ts >= fromTs), 2)[0];
  const top = t.perPlatform[0];

  const parts = [
    `${formatDuration(t.total)} coding${top ? ` (most on ${PLATFORMS[top.platform].name})` : ''}`,
    `${s.solved} solved, ${s.wrongSubs} wrong submissions`,
    `${potd} POTD`,
  ];
  if (weak) parts.push(`weakest topic: ${weak.tag} (${Math.round(weak.rate * 100)}% solved)`);
  return { title: `Your week: ${s.solved} solved · 🔥 ${streak}-day streak`, message: parts.join(' · ') };
}

async function run(): Promise<string> {
  const settings = await getSettings();
  const meta = await getItem('meta');
  const now = Date.now();
  const { due, week, boundary } = weeklyReportDue(now, meta.lastWeeklyReport ?? meta.weeklyBaseline);
  if (!due && !meta.lastWeeklyReport && !meta.weeklyBaseline) {
    // First run: owe reports from the next Sunday on (caught up if the browser is closed then).
    await updateItem('meta', (m) => ({ ...m, weeklyBaseline: week }));
  }
  if (!settings.weeklyReport || !due) {
    return meta.lastWeeklyReport ? `Last weekly report: week of ${meta.lastWeeklyReport}` : 'Weekly report goes out Sunday evening';
  }
  // Sent on the Sunday itself: cover up to now. Caught up later: cover the week that ended on that Sunday.
  const { title, message } = await weeklySummary(localDate(now) === localDate(boundary) ? now : boundary);
  await browser.notifications.create(`weekly|${week}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title,
    message,
    priority: 1,
  });
  await updateItem('meta', (m) => ({ ...m, lastWeeklyReport: week }));
  return `Sent weekly report: ${message}`;
}

export const coachAgent: Agent = {
  id: 'coach',
  name: 'Coach agent',
  description:
    "Sends a weekly progress report every Sunday evening (or on the next run if the browser wasn't open): time, solved, POTDs, streak and weakest topic.",
  trigger: 'schedule',
  periodMinutes: 60,
  run,
};
