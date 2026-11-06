import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));

const { fakeBrowser } = await import('wxt/testing/fake-browser');
const ca = await import('../src/agents/codeAnalysis');
const storage = await import('../src/lib/storage');
import type { Analysis } from '../src/lib/types';

const base = (id: string, over: Partial<Analysis> = {}): Analysis => ({
  id,
  createdAt: Date.now(),
  title: 'Pasted code',
  code: 'print(1)',
  heuristic: {
    language: 'python',
    readability: {
      score: 90,
      grade: 'A',
      issues: [],
      metrics: { lines: 1, codeLines: 1, commentRatio: 0, avgLineLength: 8, maxLineLength: 8, maxNesting: 0, longestFunction: 0, shortNames: [], magicNumbers: 0 },
    },
    algorithms: [],
    complexity: { time: 'O(1)', reason: '' },
  },
  aiStatus: 'idle',
  ...over,
});

beforeEach(() => {
  fakeBrowser.reset();
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('network disabled in tests'))));
});

describe('AI review status recovery', () => {
  it('marks reviews left running by a dead worker as interrupted', async () => {
    await storage.setItem('analyses', {
      a: base('a', { aiStatus: 'running', aiStartedAt: Date.now() - 1000 }),
      b: base('b', { aiStatus: 'running' }),
      c: base('c', { aiStatus: 'done' }),
    });
    expect(await ca.recoverInterruptedAnalyses()).toBe(2);
    const all = await storage.getItem('analyses');
    expect(all.a).toMatchObject({ aiStatus: 'error', aiError: ca.AI_INTERRUPTED });
    expect(all.b).toMatchObject({ aiStatus: 'error', aiError: ca.AI_INTERRUPTED });
    expect(all.c!.aiStatus).toBe('done');
  });

  it('considers running older than 3 minutes stale', () => {
    const now = Date.now();
    expect(ca.isAiStale({ aiStatus: 'running', aiStartedAt: now - ca.AI_STALE_MS - 1 }, now)).toBe(true);
    expect(ca.isAiStale({ aiStatus: 'running', aiStartedAt: now - 1000 }, now)).toBe(false);
    expect(ca.isAiStale({ aiStatus: 'running' }, now)).toBe(true);
    expect(ca.isAiStale({ aiStatus: 'error', aiStartedAt: 0 }, now)).toBe(false);
    expect(ca.AI_DEADLINE_MS).toBeLessThan(ca.AI_STALE_MS);
  });

  it('startAi reports a missing analysis instead of an unhandled rejection', async () => {
    await expect(ca.startAi('nope')).rejects.toThrow('Analysis not found');
  });

  it('retries a stale running review (no live job in this worker)', async () => {
    await storage.setItem('analyses', { a: base('a', { aiStatus: 'running', aiStartedAt: Date.now() - 10 * 60_000 }) });
    await ca.startAi('a');
    // No API key in default settings: the retry runs and records a clear error (no network).
    await vi.waitFor(async () => expect((await storage.getItem('analyses')).a!.aiStatus).toBe('error'));
    expect((await storage.getItem('analyses')).a!.aiError).toMatch(/API key/);
  });
});
