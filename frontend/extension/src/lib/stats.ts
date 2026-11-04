import { addDays, localDate } from './time';
import type { DayTime, PlatformId, Submission, Verdict } from './types';

export const VERDICTS: Verdict[] = ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'OTHER'];
export const VERDICT_LABEL: Record<Verdict, string> = {
  AC: 'Accepted',
  WA: 'Wrong answer',
  TLE: 'Time limit',
  MLE: 'Memory limit',
  RE: 'Runtime error',
  CE: 'Compile error',
  OTHER: 'Other',
};

export interface Summary {
  attempted: number;
  solved: number;
  totalSubs: number;
  acceptedSubs: number;
  wrongSubs: number;
  acceptanceRate: number;
  verdicts: Record<Verdict, number>;
  perPlatform: { platform: PlatformId; attempted: number; solved: number; subs: number }[];
}

export function summarize(subs: Submission[], sinceTs = 0): Summary {
  const inRange = subs.filter((s) => s.ts >= sinceTs);
  const verdicts = Object.fromEntries(VERDICTS.map((v) => [v, 0])) as Record<Verdict, number>;
  const attempted = new Set<string>();
  const solved = new Set<string>();
  const platforms = new Map<PlatformId, { attempted: Set<string>; solved: Set<string>; subs: number }>();

  for (const s of inRange) {
    verdicts[s.verdict]++;
    attempted.add(s.problemKey);
    if (s.verdict === 'AC') solved.add(s.problemKey);
    const p = platforms.get(s.platform) ?? { attempted: new Set(), solved: new Set(), subs: 0 };
    p.attempted.add(s.problemKey);
    if (s.verdict === 'AC') p.solved.add(s.problemKey);
    p.subs++;
    platforms.set(s.platform, p);
  }

  const totalSubs = inRange.length;
  const acceptedSubs = verdicts.AC;
  // Compile errors don't count as "wrong" — the solution never ran.
  const wrongSubs = totalSubs - acceptedSubs - verdicts.CE - verdicts.OTHER;
  return {
    attempted: attempted.size,
    solved: solved.size,
    totalSubs,
    acceptedSubs,
    wrongSubs,
    acceptanceRate: totalSubs ? acceptedSubs / totalSubs : 0,
    verdicts,
    perPlatform: [...platforms.entries()]
      .map(([platform, p]) => ({ platform, attempted: p.attempted.size, solved: p.solved.size, subs: p.subs }))
      .sort((a, b) => b.subs - a.subs),
  };
}

export interface ProblemRecord {
  problemKey: string;
  title: string;
  url: string;
  platform: PlatformId;
  tags: string[];
  attempts: number;
  /** Non-AC, non-compile-error submissions before the first AC (or in total if unsolved). */
  wrongBeforeAc: number;
  solved: boolean;
  firstAcTs?: number;
  lastTs: number;
}

export function problemRecords(subs: Submission[]): ProblemRecord[] {
  const byKey = new Map<string, ProblemRecord>();
  for (const s of [...subs].sort((a, b) => a.ts - b.ts)) {
    const r =
      byKey.get(s.problemKey) ??
      ({
        problemKey: s.problemKey,
        title: s.title,
        url: s.url,
        platform: s.platform,
        tags: s.tags,
        attempts: 0,
        wrongBeforeAc: 0,
        solved: false,
        lastTs: s.ts,
      } satisfies ProblemRecord);
    r.attempts++;
    r.lastTs = s.ts;
    if (s.tags.length && !r.tags.length) r.tags = s.tags;
    if (s.verdict === 'AC') {
      if (!r.solved) r.firstAcTs = s.ts;
      r.solved = true;
    } else if (!r.solved && s.verdict !== 'CE' && s.verdict !== 'OTHER') {
      r.wrongBeforeAc++;
    }
    byKey.set(s.problemKey, r);
  }
  return [...byKey.values()];
}

/** Problems worth revisiting: never solved, or solved only after a struggle. */
export function revisitList(subs: Submission[], limit = 20): (ProblemRecord & { reason: string })[] {
  return problemRecords(subs)
    .filter((r) => !r.solved || r.wrongBeforeAc >= 3)
    .map((r) => ({
      ...r,
      reason: r.solved
        ? `Solved after ${r.wrongBeforeAc} wrong attempts`
        : `Unsolved · ${r.attempts} attempt${r.attempts === 1 ? '' : 's'}`,
    }))
    .sort((a, b) => Number(a.solved) - Number(b.solved) || b.wrongBeforeAc - a.wrongBeforeAc || b.lastTs - a.lastTs)
    .slice(0, limit);
}

export interface TagStat {
  tag: string;
  attempted: number;
  solved: number;
  /** Solved problems / attempted problems. */
  rate: number;
  /** Average wrong attempts before AC on this tag. */
  avgWrong: number;
}

export function tagStats(subs: Submission[], minAttempted = 3): TagStat[] {
  const tags = new Map<string, { attempted: number; solved: number; wrong: number }>();
  for (const r of problemRecords(subs)) {
    for (const raw of r.tags) {
      const tag = raw.toLowerCase();
      const t = tags.get(tag) ?? { attempted: 0, solved: 0, wrong: 0 };
      t.attempted++;
      if (r.solved) t.solved++;
      t.wrong += r.wrongBeforeAc;
      tags.set(tag, t);
    }
  }
  return [...tags.entries()]
    .filter(([, t]) => t.attempted >= minAttempted)
    .map(([tag, t]) => ({ tag, ...t, rate: t.solved / t.attempted, avgWrong: t.wrong / t.attempted }))
    .sort((a, b) => a.rate - b.rate || b.avgWrong - a.avgWrong);
}

export interface DayActivity {
  /** Distinct problems accepted that day. */
  solved: number;
  submissions: number;
  seconds: number;
  /**
   * POTDs completed that day that are NOT already counted in `solved` — i.e. marked done
   * without an accepted submission that day (or the previous day: an auto-marked POTD can be
   * recorded the local day after the solve, see `computePotdMarks`). Safe to add to `solved`.
   */
  potd: number;
  /** Every POTD recorded as done that day (raw `potdDone[date].length`), for display only. */
  potdTotal: number;
  /** Deduplicated problems solved that day: `solved + potd`. Use this for heatmaps/totals. */
  total: number;
}

export function activityByDay(
  subs: Submission[],
  time: Record<string, DayTime>,
  potdDone: Record<string, string[]> = {},
): Map<string, DayActivity> {
  const days = new Map<string, DayActivity>();
  const get = (d: string) => {
    let a = days.get(d);
    if (!a) days.set(d, (a = { solved: 0, submissions: 0, seconds: 0, potd: 0, potdTotal: 0, total: 0 }));
    return a;
  };
  const solvedPerDay = new Map<string, Set<string>>();
  for (const s of subs) {
    const d = localDate(s.ts);
    get(d).submissions++;
    if (s.verdict === 'AC') {
      const set = solvedPerDay.get(d) ?? new Set();
      set.add(s.problemKey);
      solvedPerDay.set(d, set);
    }
  }
  for (const [d, set] of solvedPerDay) get(d).solved = set.size;
  for (const [d, platforms] of Object.entries(time)) {
    get(d).seconds = Object.values(platforms).reduce((sum, p) => sum + (p?.total ?? 0), 0);
  }
  for (const [d, keys] of Object.entries(potdDone)) {
    const unique = [...new Set(keys)];
    if (!unique.length) continue;
    const a = get(d);
    a.potdTotal = unique.length;
    const sameDay = solvedPerDay.get(d);
    const dayBefore = solvedPerDay.get(addDays(d, -1));
    a.potd = unique.filter((k) => !sameDay?.has(k) && !dayBefore?.has(k)).length;
  }
  for (const a of days.values()) a.total = a.solved + a.potd;
  return days;
}

/** A day counts towards the streak if something was solved (any AC or a POTD). */
export function isActiveDay(a: DayActivity | undefined): boolean {
  return !!a && (a.solved > 0 || a.potd > 0);
}

/** Consecutive active days ending today — or yesterday, so the streak isn't "lost" before you code today. */
export function currentStreak(isActive: (date: string) => boolean, today = localDate()): number {
  let day = isActive(today) ? today : addDays(today, -1);
  let n = 0;
  while (isActive(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(activeDates: string[]): number {
  const sorted = [...new Set(activeDates)].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function timeTotals(time: Record<string, DayTime>, fromDate: string): {
  total: number;
  perPlatform: { platform: PlatformId; seconds: number }[];
  topProblems: { key: string; platform: PlatformId; seconds: number }[];
} {
  const per = new Map<PlatformId, number>();
  const problems = new Map<string, { platform: PlatformId; seconds: number }>();
  for (const [date, day] of Object.entries(time)) {
    if (date < fromDate) continue;
    for (const [platform, t] of Object.entries(day) as [PlatformId, DayTime[PlatformId]][]) {
      if (!t) continue;
      per.set(platform, (per.get(platform) ?? 0) + t.total);
      for (const [key, sec] of Object.entries(t.problems)) {
        const p = problems.get(key) ?? { platform, seconds: 0 };
        p.seconds += sec;
        problems.set(key, p);
      }
    }
  }
  const perPlatform = [...per.entries()]
    .map(([platform, seconds]) => ({ platform, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
  return {
    total: perPlatform.reduce((s, p) => s + p.seconds, 0),
    perPlatform,
    topProblems: [...problems.entries()]
      .map(([key, p]) => ({ key, ...p }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5),
  };
}
