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
  ...over,
});

beforeEach(() => {
  fakeBrowser.reset();
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('network disabled in tests'))));
});

describe('AI review status recovery', () => {
  it('marks reviews left running by a dead worker as interrupted', async () => {
    await storage.setItem('analyses', {
      a: base('a', { complexityAiStatus: 'running' }),
      b: base('b', { complexityAiStatus: 'running' }),
      c: base('c', { complexityAiStatus: 'done' }),
      d: base('d'),
    });
    expect(await ca.recoverInterruptedAnalyses()).toBe(2);
    const all = await storage.getItem('analyses');
    expect(all.a).toMatchObject({ complexityAiStatus: 'error', complexityAiError: ca.AI_INTERRUPTED });
    expect(all.b).toMatchObject({ complexityAiStatus: 'error', complexityAiError: ca.AI_INTERRUPTED });
    expect(all.c!.complexityAiStatus).toBe('done');
    expect(all.d!.complexityAiStatus).toBeUndefined();
  });

  it('skips the write when nothing was interrupted', async () => {
    await storage.setItem('analyses', { c: base('c', { complexityAiStatus: 'done' }) });
    expect(await ca.recoverInterruptedAnalyses()).toBe(0);
  });
});

describe('old direct-Claude settings', () => {
  it('moves a saved Anthropic key into the agent keys and drops the old block', async () => {
    await fakeBrowser.storage.local.set({
      settings: { ...storage.DEFAULT_SETTINGS, ai: { apiKey: ' sk-ant-old ', model: 'claude-opus-5-5' } },
    });
    expect(await storage.migrateLegacySettings()).toBe(true);
    const raw = (await fakeBrowser.storage.local.get('settings')).settings as Record<string, unknown>;
    expect(raw).not.toHaveProperty('ai');
    expect((await storage.getSettings()).agent.keys.anthropic).toBe('sk-ant-old');
    expect(await storage.migrateLegacySettings()).toBe(false);
  });

  it('keeps an agent Anthropic key that is already set', async () => {
    await fakeBrowser.storage.local.set({
      settings: {
        ...storage.DEFAULT_SETTINGS,
        ai: { apiKey: 'old', model: 'x' },
        agent: { ...storage.DEFAULT_SETTINGS.agent, keys: { anthropic: 'new' } },
      },
    });
    expect((await storage.getSettings()).agent.keys.anthropic).toBe('new');
  });
});
