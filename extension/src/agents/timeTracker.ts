import { browser } from 'wxt/browser';
import { detectPage } from '../lib/platforms';
import { getSettings, updateItem } from '../lib/storage';
import { addDays, localDate } from '../lib/time';
import type { DayTime, PlatformId } from '../lib/types';
import type { Agent } from './types';

/**
 * Counts time only while a coding-platform tab is the focused tab of a focused window
 * and the user is not idle. State lives in storage.session because the MV3 service
 * worker can be stopped at any time; a 1-minute tick flushes it.
 */
interface Session {
  current: { platform: PlatformId; problemKey: string | null; since: number } | null;
  idle: boolean;
  focused: boolean;
  /** Recently credited slices, so time inside the idle-detection window can be taken back. */
  recent?: Credit[];
}

interface Credit {
  date: string;
  platform: PlatformId;
  problemKey: string | null;
  start: number;
  end: number;
  sec: number;
}

/** Period of the background `tick` alarm that calls `trackNow()`. */
export const TICK_MS = 60_000;
/**
 * A slice longer than this means ticks were missed (sleep/suspend, worker killed): we can't
 * tell how much of it was spent coding, so none of it is credited.
 */
export const MAX_GAP_MS = 2 * TICK_MS;
const KEEP_DAYS = 400;

/** Milliseconds of the slice [since, end] to credit. */
export function creditableMs(since: number, end: number): number {
  const elapsed = end - since;
  return elapsed < 0 || elapsed > MAX_GAP_MS ? 0 : elapsed;
}

async function getSession(): Promise<Session> {
  const res = await browser.storage.session.get('tracker');
  return (res.tracker as Session | undefined) ?? { current: null, idle: false, focused: true };
}

async function setSession(s: Session) {
  await browser.storage.session.set({ tracker: s });
}

let queue: Promise<void> = Promise.resolve();
/** Events arrive in bursts (activate + update + focus); process them one at a time. */
function serial(fn: () => Promise<void>) {
  queue = queue.then(fn).catch((e) => console.warn('[time-tracker]', e));
  return queue;
}

/** Adds (or, with negative `sec`, removes) time for one platform/problem on one day. */
function addTime(time: Record<string, DayTime>, date: string, platform: PlatformId, problemKey: string | null, sec: number) {
  const day = { ...(time[date] ?? {}) };
  const p = day[platform] ?? { total: 0, problems: {} };
  const problems = { ...p.problems };
  if (problemKey) problems[problemKey] = Math.max(0, (problems[problemKey] ?? 0) + sec);
  day[platform] = { total: Math.max(0, p.total + sec), problems };
  time[date] = day;
}

/** Credits the current slice up to `end`; returns the credit recorded (if any). */
async function flush(s: Session, end: number): Promise<Credit | null> {
  if (!s.current) return null;
  const ms = creditableMs(s.current.since, end);
  if (ms < 1000) return null;
  const sec = Math.round(ms / 1000);
  const { platform, problemKey } = s.current;
  const date = localDate(end);
  await updateItem('time', (time) => {
    const next = { ...time };
    addTime(next, date, platform, problemKey, sec);
    const cutoff = addDays(date, -KEEP_DAYS);
    for (const d of Object.keys(next)) if (d < cutoff) delete next[d];
    return next;
  });
  return { date, platform, problemKey, start: s.current.since, end, sec };
}

/**
 * The idle event fires `idleMs` after the last input, so time credited after `idleStart` was
 * not really active: take it back. Returns the credits that remain.
 */
async function retract(recent: Credit[], idleStart: number): Promise<Credit[]> {
  const keep: Credit[] = [];
  const undo: { c: Credit; sec: number }[] = [];
  for (const c of recent) {
    if (c.end <= idleStart) {
      keep.push(c);
      continue;
    }
    const overlapMs = c.end - Math.max(c.start, idleStart);
    const sec = Math.min(c.sec, Math.round(overlapMs / 1000));
    if (sec > 0) undo.push({ c, sec });
    if (c.start < idleStart) keep.push({ ...c, end: idleStart, sec: c.sec - sec });
  }
  if (undo.length) {
    await updateItem('time', (time) => {
      const next = { ...time };
      for (const { c, sec } of undo) if (next[c.date]) addTime(next, c.date, c.platform, c.problemKey, -sec);
      return next;
    });
  }
  return keep;
}

type Patch = Partial<Pick<Session, 'idle' | 'focused'>> & {
  /** Set when the browser reported `idle` (as opposed to `locked`): input stopped `idleSeconds` ago. */
  idleDetected?: boolean;
};

async function evaluate({ idleDetected, ...patch }: Patch = {}) {
  const now = Date.now();
  const prev = await getSession();
  const s: Session = { ...prev, ...patch };
  const settings = await getSettings();
  const idleMs = Math.max(15, settings.idleSeconds) * 1000;
  let recent = (prev.recent ?? []).filter((c) => c.end >= now - idleMs - MAX_GAP_MS);

  let end = now;
  let idleStart: number | null = null;
  if (idleDetected && !prev.idle) {
    idleStart = now - idleMs;
    end = s.current ? Math.max(s.current.since, idleStart) : now;
  }
  const credit = await flush(s, end);
  if (credit) recent.push(credit);
  if (idleStart !== null) recent = await retract(recent, idleStart);

  let current: Session['current'] = null;
  if (!s.idle && s.focused) {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    const page = detectPage(tab?.url);
    if (page) current = { platform: page.platform, problemKey: page.problemKey, since: now };
  }
  await setSession({ ...s, current, recent });
}

export const trackNow = (patch?: Partial<Pick<Session, 'idle' | 'focused'>>) => serial(() => evaluate(patch));

/** Handles `idle.onStateChanged`. Exported for tests. */
export const onIdleStateChanged = (state: string) =>
  serial(() => evaluate({ idle: state !== 'active', idleDetected: state === 'idle' }));

/** Must be called synchronously at service-worker start so events wake the worker. */
export function registerTimeTracker() {
  browser.tabs.onActivated.addListener(() => void trackNow());
  browser.tabs.onUpdated.addListener((_id, info, tab) => {
    if (tab.active && (info.url || info.status === 'complete')) void trackNow();
  });
  browser.windows.onFocusChanged.addListener((windowId) => {
    void trackNow({ focused: windowId !== browser.windows.WINDOW_ID_NONE });
  });
  browser.idle.onStateChanged.addListener((state) => void onIdleStateChanged(state));
  void getSettings().then((s) => browser.idle.setDetectionInterval(Math.max(15, s.idleSeconds)));
}

export async function applyIdleSetting() {
  const s = await getSettings();
  browser.idle.setDetectionInterval(Math.max(15, s.idleSeconds));
}

export const timeTrackerAgent: Agent = {
  id: 'time',
  name: 'Time-tracking agent',
  description: 'Measures active time per platform and per problem; pauses when you are idle or the browser is not focused.',
  trigger: 'event',
  run: async () => {
    await trackNow();
    const s = await getSession();
    return s.current ? `Tracking ${s.current.platform}${s.current.problemKey ? ` · ${s.current.problemKey}` : ''}` : 'Idle — no coding tab focused';
  },
};
