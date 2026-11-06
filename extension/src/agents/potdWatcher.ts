/**
 * Ticks problem-of-the-day cards soon after you solve them, instead of at the next hourly or
 * half-hourly sync.
 *
 * When you leave a takeUforward or GeeksforGeeks problem page (navigate away, close the tab, or
 * switch tabs), we wait a few seconds for the site to record the verdict and then re-check that
 * one platform:
 *   - TUF: re-read takeuforward.org/potd, which reports "solved" when you're logged in there.
 *   - GFG: import your GFG solved list (needs your GFG username in Settings).
 * LeetCode doesn't need this: submissions are captured live on leetcode.com.
 * Newton School is intentionally not handled here (it is only read from the page you view).
 *
 * Re-checks are throttled per platform so repeated tab events never hammer the sites.
 * State lives in storage.session so it survives the service worker sleeping.
 */
import { browser } from 'wxt/browser';
import { errorMessage } from '../lib/http';
import { detectPage } from '../lib/platforms';
import { getItem } from '../lib/storage';
import { localDate } from '../lib/time';
import type { Potd } from '../lib/types';
import { recheckTufPotd } from './potd';
import { runAgent, track, whenOpen } from './registry';
import { quickSyncGfg } from './submissions';

export type WatchedPlatform = 'tuf' | 'gfg';
export interface LeftProblem {
  platform: WatchedPlatform;
  problemKey: string;
}

/** Minimum time between two re-checks of the same platform. */
export const RECHECK_GAP_MS: Record<WatchedPlatform, number> = { tuf: 2 * 60_000, gfg: 60_000 };
/** Delay after leaving the page, so the site has recorded the verdict. */
export const SETTLE_MS = 8_000;

const TABS_KEY = 'potdWatchTabs';
const LAST_RUN_KEY = 'potdWatchLastRun';
const ACTIVE_KEY = 'potdWatchActiveTab';

/** If `prevUrl` was a TUF/GFG problem page and `nextUrl` isn't the same problem, which one was left. */
export function leftProblem(prevUrl: string | undefined, nextUrl: string | undefined): LeftProblem | null {
  const prev = detectPage(prevUrl);
  if (!prev?.problemKey || (prev.platform !== 'tuf' && prev.platform !== 'gfg')) return null;
  if (detectPage(nextUrl)?.problemKey === prev.problemKey) return null; // same problem (tab/query change)
  return { platform: prev.platform, problemKey: prev.problemKey };
}

/** Whether leaving `left` should trigger a re-check now. */
export function shouldRecheck(
  left: LeftProblem,
  potdItems: Potd[],
  doneToday: Set<string>,
  lastRun: Partial<Record<WatchedPlatform, number>>,
  now: number,
): boolean {
  if (now - (lastRun[left.platform] ?? 0) < RECHECK_GAP_MS[left.platform]) return false;
  if (left.platform === 'tuf') {
    // Only today's TUF question matters, and only until it's ticked.
    const tuf = potdItems.find((p) => p.source === 'tuf' && p.platform === 'tuf');
    return !!tuf && tuf.key === left.problemKey && !doneToday.has(tuf.key);
  }
  // GFG: any problem page — the import also keeps GFG stats fresh, and it's throttled.
  return true;
}

async function session<T>(key: string, fallback: T): Promise<T> {
  try {
    return ((await browser.storage.session.get(key))[key] as T | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

async function setSession(key: string, value: unknown): Promise<void> {
  try {
    await browser.storage.session.set({ [key]: value });
  } catch {
    /* best effort */
  }
}

/** Runs the platform's re-check (after the settle delay). Exported for tests. */
export async function runRecheck(platform: WatchedPlatform): Promise<string> {
  await whenOpen(); // don't race "Clear data"
  return track(
    (async () => {
      if (platform === 'tuf') return (await recheckTufPotd()) ? 'tuf: ticked' : 'tuf: not solved yet';
      const r = await quickSyncGfg();
      if (r === 'needs-full-sync') {
        await runAgent('submissions');
        return 'gfg: full sync';
      }
      return `gfg: ${r}`;
    })(),
  );
}

let settleTimer: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms);
/** Test hook: run scheduled re-checks immediately. */
export function setSettleScheduler(fn: (cb: () => void, ms: number) => unknown): void {
  settleTimer = fn;
}

/** Handles "the tab that showed `prevUrl` now shows `nextUrl` (or closed / lost focus)". */
export async function onLeave(prevUrl: string | undefined, nextUrl: string | undefined, now = Date.now()): Promise<WatchedPlatform | null> {
  const left = leftProblem(prevUrl, nextUrl);
  if (!left) return null;
  const [potd, potdDone, lastRun] = await Promise.all([
    getItem('potd'),
    getItem('potdDone'),
    session<Partial<Record<WatchedPlatform, number>>>(LAST_RUN_KEY, {}),
  ]);
  const doneToday = new Set(potdDone[localDate(now)] ?? []);
  if (!shouldRecheck(left, potd.items, doneToday, lastRun, now)) return null;
  await setSession(LAST_RUN_KEY, { ...lastRun, [left.platform]: now });
  settleTimer(() => {
    runRecheck(left.platform)
      .then((r) => console.info('[potd-watch]', r))
      .catch((e) => console.warn('[potd-watch]', left.platform, errorMessage(e)));
  }, SETTLE_MS);
  return left.platform;
}

const watched = (url: string | undefined) => {
  const p = detectPage(url);
  return !!p?.problemKey && (p.platform === 'tuf' || p.platform === 'gfg');
};

/** Remembers (only) the tabs that are on a TUF/GFG problem page. */
async function rememberTab(tabId: number, url: string | undefined): Promise<string | undefined> {
  const tabs = await session<Record<string, string>>(TABS_KEY, {});
  const prev = tabs[tabId];
  if (watched(url)) tabs[tabId] = url!;
  else delete tabs[tabId];
  await setSession(TABS_KEY, tabs);
  return prev;
}

/** Registers the tab listeners (synchronously, so tab events can wake the worker). */
export function registerPotdWatcher(): void {
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;
    void rememberTab(tabId, changeInfo.url).then((prev) => onLeave(prev, changeInfo.url));
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void rememberTab(tabId, undefined).then((prev) => onLeave(prev, undefined));
  });
  browser.tabs.onActivated.addListener(({ tabId }) => {
    void (async () => {
      const prevActive = await session<number | null>(ACTIVE_KEY, null);
      await setSession(ACTIVE_KEY, tabId);
      if (prevActive === null || prevActive === tabId) return;
      const tabs = await session<Record<string, string>>(TABS_KEY, {});
      const prevUrl = tabs[prevActive];
      if (prevUrl) await onLeave(prevUrl, undefined); // switched away from a problem tab
    })();
  });
}
