/**
 * Structured diagnostics for the TUF problem-of-the-day reader.
 *
 * Runs in the background service worker (the extension's "server side"). Each read records
 * every stage with its outcome, HTTP status where there is one, and elapsed time. Entries go to
 * the service-worker console and to `storage.local['tufDiagnostics']` (last 20 runs).
 * Never recorded: request headers, cookies, or page bodies.
 */
import { browser } from 'wxt/browser';

export type TufStage = 'request' | 'load' | 'extract-title' | 'find-question-link' | 'validate-url';
export type TufAttempt = 'logged-in' | 'public';

export interface TufStageLog {
  attempt: TufAttempt;
  stage: TufStage;
  ok: boolean;
  ms: number;
  status?: number;
  detail?: string;
  error?: string;
}

export interface TufRunLog {
  at: number;
  ok: boolean;
  ms: number;
  stages: TufStageLog[];
  result?: { title: string; url: string; attempt: TufAttempt };
}

export const TUF_DIAGNOSTICS_KEY = 'tufDiagnostics';
const MAX_RUNS = 20;

/** An error that remembers which stage of which attempt failed. */
export class TufStageError extends Error {
  constructor(
    readonly stage: TufStage,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'TufStageError';
  }
}

export async function recordTufRun(run: TufRunLog): Promise<void> {
  // Structured log for the service-worker console (chrome://extensions → "service worker").
  (run.ok ? console.info : console.warn)('[tuf-potd]', JSON.stringify(run));
  try {
    const prev = ((await browser.storage.local.get(TUF_DIAGNOSTICS_KEY))[TUF_DIAGNOSTICS_KEY] as TufRunLog[] | undefined) ?? [];
    await browser.storage.local.set({ [TUF_DIAGNOSTICS_KEY]: [...prev, run].slice(-MAX_RUNS) });
  } catch {
    /* diagnostics must never break the reader */
  }
}

export async function readTufDiagnostics(): Promise<TufRunLog[]> {
  try {
    return ((await browser.storage.local.get(TUF_DIAGNOSTICS_KEY))[TUF_DIAGNOSTICS_KEY] as TufRunLog[] | undefined) ?? [];
  } catch {
    return [];
  }
}

/** One-line summary of a failed run, for the card's "Reason:" line. */
export function summarizeFailure(stages: TufStageLog[]): string {
  const failed = stages.filter((s) => !s.ok);
  if (!failed.length) return 'unknown error';
  return failed
    .map((s) => `${s.attempt} page: ${s.stage} failed${s.status ? ` (HTTP ${s.status})` : ''}: ${s.error ?? 'error'}`)
    .join(' · ');
}
