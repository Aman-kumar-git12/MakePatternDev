import { browser } from 'wxt/browser';
import { DEFAULT_AGENT_URL } from './complexityAgent';
import type { NewtonQotdError, NewtonQotdState } from './newtonQotd';
import type {
  AgentStatus,
  Analysis,
  Contest,
  ContestCache,
  Cursors,
  DayTime,
  PlatformProfile,
  PotdCache,
  Settings,
  Submission,
} from './types';

export const DEFAULT_SETTINGS: Settings = {
  contestPlatforms: { leetcode: true, codeforces: true, codechef: true, atcoder: true },
  potdSources: { leetcode: true, gfg: true, tuf: true, newton: true },
  remindersEnabled: true,
  reminderOffsets: [60, 10],
  handles: { codeforces: '', atcoder: '', leetcode: '', codechef: '', gfg: '', tuf: '' },
  dailyGoalMinutes: 90,
  idleSeconds: 120,
  weeklyReport: true,
  agent: { url: DEFAULT_AGENT_URL, provider: 'groq', keys: {}, models: {} },
};

export interface StorageSchema {
  settings: Settings;
  contests: ContestCache;
  potd: PotdCache;
  /** localDate -> problem keys of POTDs completed that day. */
  potdDone: Record<string, string[]>;
  /** contestId -> explicit reminder on/off (otherwise `settings.remindersEnabled`). */
  reminderOverrides: Record<string, boolean>;
  /** contestId -> end time (epoch ms) for contests that have a reminder override; used for pruning. */
  contestEnds: Record<string, number>;
  /** localDate -> per-platform time. */
  time: Record<string, DayTime>;
  submissions: Submission[];
  cursors: Cursors;
  analyses: Record<string, Analysis>;
  agentStatus: Record<string, AgentStatus>;
  /**
   * lastWeeklyReport: week key (Monday date) of the last report sent.
   * weeklyBaseline: week key from which reports are owed (set on the first run, so a fresh install isn't sent an empty report).
   */
  meta: { lastWeeklyReport?: string; weeklyBaseline?: string };
  /** Latest public profile per platform (currently GeeksforGeeks). */
  profiles: Partial<Record<'gfg', PlatformProfile>>;
  /** Newton School's featured Question of the Day, as last read from the page (title + link together). */
  newtonQotd: NewtonQotdState | null;
  /** The last failed read of the Newton School page (cleared by a successful read). */
  newtonQotdError: NewtonQotdError | null;
}

const DEFAULTS: StorageSchema = {
  settings: DEFAULT_SETTINGS,
  contests: { items: [], fetchedAt: 0, errors: {} },
  potd: { localDate: '', items: [], fetchedAt: 0, errors: {} },
  potdDone: {},
  reminderOverrides: {},
  contestEnds: {},
  time: {},
  submissions: [],
  cursors: {},
  analyses: {},
  agentStatus: {},
  meta: {},
  profiles: {},
  newtonQotd: null,
  newtonQotdError: null,
};

export type StorageKey = keyof StorageSchema;

export function withDefaults<K extends StorageKey>(key: K, value: unknown): StorageSchema[K] {
  if (value === undefined || value === null) return structuredClone(DEFAULTS[key]);
  if (key === 'settings') {
    // Merge so settings added in later versions get their defaults.
    const v = value as Partial<Settings> & { cfPickRating?: unknown; ai?: { apiKey?: unknown } };
    // Drop settings that no longer exist: the removed Codeforces problem-of-the-day, and the old
    // direct Claude review (`ai`), whose Anthropic key moves to the agent's key list below.
    const { cfPickRating: _removed, ai: legacyAi, ...rest } = v;
    void _removed;
    const legacyKey = typeof legacyAi?.apiKey === 'string' ? legacyAi.apiKey.trim() : '';
    const knownPotd = Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS.potdSources).map((k) => [k, (v.potdSources as Record<string, boolean> | undefined)?.[k] ?? true]),
    ) as Settings['potdSources'];
    return {
      ...DEFAULT_SETTINGS,
      ...rest,
      contestPlatforms: { ...DEFAULT_SETTINGS.contestPlatforms, ...v.contestPlatforms },
      potdSources: knownPotd,
      handles: { ...DEFAULT_SETTINGS.handles, ...v.handles },
      agent: {
        ...DEFAULT_SETTINGS.agent,
        ...v.agent,
        keys: { ...(legacyKey ? { anthropic: legacyKey } : {}), ...v.agent?.keys },
        models: { ...v.agent?.models },
      },
    } as StorageSchema[K];
  }
  return value as StorageSchema[K];
}

/**
 * Rewrites stored settings that still carry the old direct-Claude `ai` block, so its Anthropic
 * key lives only in `agent.keys` from now on. Returns whether anything changed.
 */
export async function migrateLegacySettings(): Promise<boolean> {
  const raw = (await browser.storage.local.get('settings')).settings as Record<string, unknown> | undefined;
  if (!raw || !('ai' in raw)) return false;
  await browser.storage.local.set({ settings: withDefaults('settings', raw) });
  return true;
}

export async function getItem<K extends StorageKey>(key: K): Promise<StorageSchema[K]> {
  const res = await browser.storage.local.get(key);
  return withDefaults(key, res[key]);
}

export async function setItem<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

const locks = new Map<StorageKey, Promise<unknown>>();

/**
 * Serialised read-modify-write. Only the background service worker writes the keys it
 * owns; UI pages send messages instead, so this per-context lock is enough.
 */
export function updateItem<K extends StorageKey>(
  key: K,
  fn: (value: StorageSchema[K]) => StorageSchema[K] | Promise<StorageSchema[K]>,
): Promise<StorageSchema[K]> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(async () => {
    const value = await fn(await getItem(key));
    await setItem(key, value);
    return value;
  });
  locks.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

export const getSettings = () => getItem('settings');

// --- Pruning -----------------------------------------------------------------------------
// Storage is capped (~10 MB without unlimitedStorage), so drop data that can no longer matter.

const DAY_MS = 86_400_000;
const ANALYSIS_KEEP_MS = 90 * DAY_MS;

/**
 * Keeps reminder overrides only for contests that haven't been over for more than a day.
 * A contest missing from the (upcoming-only) list is assumed to have ended when it was first
 * seen missing; ids of platforms not in `checkedPlatforms` (fetch failed / disabled) are left alone.
 */
export function pruneReminderOverrides(
  overrides: Record<string, boolean>,
  ends: Record<string, number>,
  contests: Contest[],
  checkedPlatforms: Set<string>,
  now = Date.now(),
): { overrides: Record<string, boolean>; ends: Record<string, number> } {
  const known = new Map(contests.map((c) => [c.id, c.start + c.durationSec * 1000]));
  const nextOverrides: Record<string, boolean> = {};
  const nextEnds: Record<string, number> = {};
  for (const [id, on] of Object.entries(overrides)) {
    const platform = id.split(':')[0]!;
    const end = known.get(id) ?? ends[id] ?? (checkedPlatforms.has(platform) ? now : undefined);
    if (end !== undefined && end < now - DAY_MS) continue;
    nextOverrides[id] = on;
    if (end !== undefined) nextEnds[id] = end;
  }
  return { overrides: nextOverrides, ends: nextEnds };
}

/** Drops analyses of submissions that no longer exist once they are older than 90 days (pasted code is kept). */
export function pruneAnalyses(analyses: Record<string, Analysis>, submissionIds: Set<string>, now = Date.now()): Record<string, Analysis> {
  const next: Record<string, Analysis> = {};
  for (const [id, a] of Object.entries(analyses)) {
    const orphan = !id.startsWith('paste:') && !submissionIds.has(id);
    if (orphan && a.createdAt < now - ANALYSIS_KEEP_MS) continue;
    next[id] = a;
  }
  return next;
}

/** Called by the contests agent after each refresh. */
export async function pruneContestData(contests: Contest[], checkedPlatforms: Set<string>, now = Date.now()): Promise<void> {
  const ends = await getItem('contestEnds');
  let prunedEnds = ends;
  await updateItem('reminderOverrides', (overrides) => {
    const r = pruneReminderOverrides(overrides, ends, contests, checkedPlatforms, now);
    prunedEnds = r.ends;
    return r.overrides;
  });
  await setItem('contestEnds', prunedEnds);
}

/** Called by the submissions agent after each sync. */
export async function pruneOrphanAnalyses(submissionIds: Set<string>, now = Date.now()): Promise<number> {
  const current = await getItem('analyses');
  if (Object.keys(pruneAnalyses(current, submissionIds, now)).length === Object.keys(current).length) return 0; // skip the write
  let removed = 0;
  await updateItem('analyses', (all) => {
    const next = pruneAnalyses(all, submissionIds, now);
    removed = Object.keys(all).length - Object.keys(next).length;
    return removed ? next : all;
  });
  return removed;
}
