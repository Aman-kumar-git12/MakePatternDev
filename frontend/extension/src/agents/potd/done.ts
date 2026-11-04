import { localDate } from '../../lib/time';
import type { Potd, Submission } from '../../lib/types';

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

/** Maps an epoch ms to the user's calendar date (YYYY-MM-DD). Injectable so tests can pick a timezone. */
export type DateOf = (ts: number) => string;

function utcMidnight(date: string): number | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function localMidnight(date: string): number | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
}

/**
 * The time window [start, end) in which solving a POTD counts for it, in the platform's own clock:
 * LeetCode's daily rolls over at 00:00 UTC, GFG and takeUforward at 00:00 IST. Our own picks
 * (TUF sheet, Codeforces) are made per local day. Returns null when the date is unknown.
 */
export function potdWindow(p: Potd): [number, number] | null {
  let start: number | null;
  if (p.source === 'leetcode') start = utcMidnight(p.date);
  else if (p.source === 'gfg' || (p.source === 'tuf' && p.platform === 'tuf')) {
    const utc = utcMidnight(p.date);
    start = utc === null ? null : utc - IST_OFFSET_MS;
  } else start = localMidnight(p.date);
  return start === null ? null : [start, start + DAY_MS];
}

export interface PotdMark {
  key: string;
  /** Local date the POTD is recorded under. */
  date: string;
  /** Other local dates covered by the same POTD window: the key is removed there so one solve counts once. */
  clear: string[];
}

/**
 * Which POTD cards an accepted submission completes. A submission counts when it falls inside the
 * POTD's own window. While that window overlaps the user's local today, the mark goes under today —
 * the date the Daily tab reads (`potdDone[localDate(now)]`), even when the solve happened late the
 * previous local evening (e.g. a US user solving the next UTC day's LeetCode daily). Otherwise (a
 * stale POTD list) it goes under the local date of the solve. Activity/streaks never read this
 * date for auto-marked POTDs: `activityByDay` counts the accepted submission on the day it happened.
 */
export function computePotdMarks(items: Potd[], subs: Submission[], now = Date.now(), dateOf: DateOf = localDate): PotdMark[] {
  const today = dateOf(now);
  const marks: PotdMark[] = [];
  for (const p of items) {
    const win = potdWindow(p);
    if (!win) continue;
    const [start, end] = win;
    const hit = subs.find((s) => s.verdict === 'AC' && s.problemKey === p.key && s.ts >= start && s.ts < end && s.ts <= now);
    if (!hit) continue;
    const first = dateOf(start);
    const last = dateOf(end - 1);
    const current = first <= today && today <= last;
    const date = current ? today : dateOf(hit.ts);
    const clear = [...new Set([first, last])].filter((d) => d !== date);
    marks.push({ key: p.key, date, clear });
  }
  return marks;
}

/** Applies marks to the `potdDone` map; returns the same object when nothing changes. */
export function applyPotdMarks(done: Record<string, string[]>, marks: PotdMark[]): Record<string, string[]> {
  let next = done;
  const edit = (date: string, fn: (keys: string[]) => string[]) => {
    const before = next[date] ?? [];
    const after = fn(before);
    if (after.length === before.length && after.every((k, i) => k === before[i])) return;
    if (next === done) next = { ...done };
    if (after.length) next[date] = after;
    else delete next[date];
  };
  for (const m of marks) {
    for (const d of m.clear) edit(d, (keys) => keys.filter((k) => k !== m.key));
    edit(m.date, (keys) => (keys.includes(m.key) ? keys : [...keys, m.key]));
  }
  return next;
}
