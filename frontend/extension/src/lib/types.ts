import type { AgentSettings, ComplexityResult } from './complexityAgent';
export type PlatformId =
  | 'leetcode'
  | 'codeforces'
  | 'codechef'
  | 'atcoder'
  | 'gfg'
  | 'tuf'
  | 'hackerrank'
  | 'code360'
  | 'newton';

export type ContestPlatform = 'leetcode' | 'codeforces' | 'codechef' | 'atcoder';
export type PotdSource = 'leetcode' | 'gfg' | 'tuf' | 'newton';
/** Sources the background POTD agent fetches (Newton School is read from the page you visit). */
export type FetchedPotdSource = Exclude<PotdSource, 'newton'>;

export interface Contest {
  /** `${platform}:${nativeId}` — stable across refreshes, used for reminder overrides. */
  id: string;
  platform: ContestPlatform;
  name: string;
  url: string;
  /** Start time, epoch ms. */
  start: number;
  durationSec: number;
}

export interface Potd {
  source: PotdSource;
  /** Platform the problem is actually solved on (TUF picks are solved on LeetCode). */
  platform: PlatformId;
  /** Problem key, see `problemKeyFromUrl`. Matching submissions auto-complete the POTD. */
  key: string;
  title: string;
  url: string;
  difficulty?: string;
  tags: string[];
  /** The platform's own date for this POTD (YYYY-MM-DD). */
  date: string;
  note?: string;
  extraUrl?: string;
  /** When this item was fetched (used to reuse the TUF problem of the day for ~30 minutes). */
  fetchedAt?: number;
  /** The latest refresh failed, so this is the last successfully read question (shown as outdated). */
  outdated?: boolean;
}

export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'OTHER';

export type SubmissionSource = 'api' | 'session' | 'capture';

export interface Submission {
  /** `${platform}:${nativeSubmissionId}` */
  id: string;
  platform: PlatformId;
  problemKey: string;
  title: string;
  url: string;
  verdict: Verdict;
  rawVerdict: string;
  lang?: string;
  /** Epoch ms. */
  ts: number;
  tags: string[];
  difficulty?: string;
  /** Only present for submissions captured in the browser (LeetCode). */
  code?: string;
  /**
   * How the record was obtained: `api` = public import for `settings.handles[platform]`,
   * `session` = LeetCode logged-in history import, `capture` = seen live in the browser.
   * Missing on records stored before this field existed.
   */
  source?: SubmissionSource;
  /** Lower-cased handle / LeetCode username the record belongs to (when known). */
  account?: string;
  /**
   * Set on a live LeetCode capture that could not be cross-checked against LeetCode's own
   * record (e.g. the session request failed). Its verdict/code came only from the page.
   */
  unverified?: boolean;
}

export interface Settings {
  contestPlatforms: Record<ContestPlatform, boolean>;
  potdSources: Record<PotdSource, boolean>;
  remindersEnabled: boolean;
  /** Minutes before start. */
  reminderOffsets: number[];
  /** gfg history is imported like the others; tuf is used for profile links only. */
  handles: { codeforces: string; atcoder: string; leetcode: string; codechef: string; gfg: string; tuf: string };
  dailyGoalMinutes: number;
  idleSeconds: number;
  weeklyReport: boolean;
  /** Local complexity agent (agent/ folder). API keys are per provider and never leave this browser except to `url`. */
  agent: AgentSettings;
}

export interface ContestCache {
  /** Upcoming and live contests, soonest first. */
  items: Contest[];
  /** The latest finished contests per platform, newest first (absent in data saved by older versions). */
  past?: Contest[];
  fetchedAt: number;
  errors: Partial<Record<ContestPlatform, string>>;
}

export interface PotdCache {
  /** Local date the deterministic picks (TUF, Codeforces) were made for. */
  localDate: string;
  items: Potd[];
  fetchedAt: number;
  errors: Partial<Record<PotdSource, string>>;
}

export interface PlatformTime {
  /** Seconds. */
  total: number;
  problems: Record<string, number>;
}
export type DayTime = Partial<Record<PlatformId, PlatformTime>>;

export interface Cursors {
  codeforces?: { handle: string; lastId: number };
  atcoder?: { handle: string; fromSecond: number };
  codechef?: { handle: string; lastTs: number };
  leetcode?: { handle: string; lastTs: number };
  /** Full history (incl. wrong answers) read with the user's logged-in LeetCode session. */
  leetcodeSession?: { lastTs: number; /** Logged-in LeetCode username the history belongs to. */ username?: string };
  gfg?: { handle: string; lastTs: number };
}

/** Public profile numbers a platform reports about the user (shown in per-platform Stats). */
export interface PlatformProfile {
  handle: string;
  fetchedAt: number;
  name?: string;
  totalSolved?: number;
  score?: number;
  monthlyScore?: number;
  instituteRank?: string;
  potdCurrentStreak?: number;
  potdLongestStreak?: number;
  /** Solved count per difficulty as the platform labels it (e.g. School/Basic/Easy/Medium/Hard). */
  byDifficulty?: Record<string, number>;
  /** Problems available per difficulty (LeetCode), for "solved of total". */
  totalByDifficulty?: Record<string, number>;
  /** Global ranking on the platform (LeetCode). */
  ranking?: number;
  contestRating?: number;
  contestsAttended?: number;
  /** "Top x%" among contest participants (LeetCode). */
  contestTopPercent?: number;
  /** Days with at least one submission this year, and the current submission streak (LeetCode). */
  activeDays?: number;
  streak?: number;
}

export interface AgentStatus {
  running?: boolean;
  /** Epoch ms the current/last run started (set together with `running: true`). */
  startedAt?: number;
  lastRun?: number;
  ok?: boolean;
  message?: string;
}

export interface Algorithm {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface HeuristicReport {
  language: string;
  readability: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D';
    issues: string[];
    metrics: {
      lines: number;
      codeLines: number;
      commentRatio: number;
      avgLineLength: number;
      maxLineLength: number;
      maxNesting: number;
      longestFunction: number;
      shortNames: string[];
      magicNumbers: number;
    };
  };
  algorithms: Algorithm[];
  complexity: { time: string; reason: string };
}

export interface Analysis {
  id: string;
  createdAt: number;
  title: string;
  url?: string;
  lang?: string;
  code: string;
  heuristic: HeuristicReport;
  /** The AI review (complexity only) from the local agent, with the provider chosen in settings. */
  complexityAi?: ComplexityResult;
  complexityAiStatus?: 'running' | 'done' | 'error';
  complexityAiError?: string;
}
