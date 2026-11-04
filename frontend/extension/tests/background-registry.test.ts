import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));

const { fakeBrowser } = await import('wxt/testing/fake-browser');
const registry = await import('../src/agents/registry');
const router = await import('../src/agents/router');
const storage = await import('../src/lib/storage');
import type { Agent } from '../src/agents/types';

const { AGENTS, AGENT_ALARM, TICK } = registry;
const realAgents = [...AGENTS];

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const agent = (id: string, run: () => Promise<string>, extra: Partial<Agent> = {}): Agent => ({
  id,
  name: id,
  description: '',
  trigger: 'on-demand',
  run,
  ...extra,
});

const EXT = () => fakeBrowser.runtime.getURL('/');
const pageSender = () => ({ id: fakeBrowser.runtime.id, url: `${EXT()}options.html`, tab: { id: 1, url: `${EXT()}options.html` } });
const lcSender = () => ({ id: fakeBrowser.runtime.id, url: 'https://leetcode.com/problems/two-sum/', tab: { id: 2 }, frameId: 0 });

beforeEach(() => {
  fakeBrowser.reset();
  // No network in tests: anything that slips through fails fast.
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('network disabled in tests'))));
  AGENTS.splice(0, AGENTS.length); // only the test agents below
});

afterEach(() => {
  AGENTS.splice(0, AGENTS.length, ...realAgents);
  vi.unstubAllGlobals();
});

describe('clearData', () => {
  it('waits for in-flight agents, blocks new runs, then clears', async () => {
    const gate = deferred();
    let laterRan = false;
    AGENTS.push(
      agent('slow', async () => {
        await gate.promise;
        await storage.updateItem('potdDone', (d) => ({ ...d, '2026-11-04': ['leetcode:two-sum'] }));
        return 'slow done';
      }),
      agent('later', async () => {
        laterRan = true;
        await storage.updateItem('potdDone', (d) => ({ ...d, '2026-11-05': ['written-after-clear'] }));
        return 'later done';
      }),
    );
    await storage.setItem('settings', { ...storage.DEFAULT_SETTINGS, dailyGoalMinutes: 42 });
    await storage.setItem('reminderOverrides', { 'codeforces:1': true });

    const slow = registry.runAgent('slow');
    await vi.waitFor(async () => expect((await storage.getItem('agentStatus')).slow?.running).toBe(true));

    let clearDone = false;
    const clearing = router.handleMessage({ type: 'clearData' }, pageSender()).then(() => {
      clearDone = true;
    });
    await vi.waitFor(() => expect(registry.isPaused()).toBe(true));

    const later = registry.runAgent('later');
    await new Promise((r) => setTimeout(r, 20));
    expect(clearDone).toBe(false); // still waiting for the slow agent
    expect(laterRan).toBe(false); // blocked during the clear

    gate.resolve();
    await expect(slow).resolves.toBe('slow done');
    await clearing;
    await expect(later).resolves.toBe('later done');

    // The slow agent's write landed before the clear (wiped); the blocked run wrote after it.
    expect(await storage.getItem('potdDone')).toEqual({ '2026-11-05': ['written-after-clear'] });
    expect(await storage.getItem('reminderOverrides')).toEqual({});
    expect((await storage.getItem('settings')).dailyGoalMinutes).toBe(42);
    expect((await fakeBrowser.alarms.getAll()).map((a) => a.name)).toContain(TICK);
  });
});

describe('recoverAgentStatus', () => {
  it('clears running flags left by a dead worker', async () => {
    AGENTS.push(agent('contests', async () => 'ok', { timeoutMs: 60_000 }));
    const now = Date.now();
    await storage.setItem('agentStatus', {
      contests: { running: true, startedAt: now - 10 * 60_000, lastRun: now - 3600_000, ok: true },
      potd: { running: true }, // legacy entry without startedAt
      submissions: { running: false, ok: true, lastRun: now },
    });
    expect(await registry.recoverAgentStatus(now)).toBe(2);
    const s = await storage.getItem('agentStatus');
    expect(s.contests).toMatchObject({ running: false, ok: false, message: expect.stringMatching(/Timed out/) });
    expect(s.potd).toMatchObject({ running: false, ok: false, message: expect.stringMatching(/Interrupted/) });
    expect(s.submissions).toEqual({ running: false, ok: true, lastRun: now });
  });

  it('keeps the flag of a run that is live in this worker', async () => {
    const gate = deferred();
    AGENTS.push(agent('live', () => gate.promise.then(() => 'ok')));
    const run = registry.runAgent('live');
    await vi.waitFor(async () => expect((await storage.getItem('agentStatus')).live?.running).toBe(true));
    expect(await registry.recoverAgentStatus()).toBe(0);
    const s = (await storage.getItem('agentStatus')).live!;
    expect(s.running).toBe(true);
    expect(typeof s.startedAt).toBe('number');
    gate.resolve();
    await run;
  });

  it('fails a run that exceeds the agent timeout', async () => {
    AGENTS.push(agent('hang', () => new Promise(() => undefined), { timeoutMs: 20 }));
    await expect(registry.runAgent('hang')).rejects.toThrow(/timed out/);
    expect((await storage.getItem('agentStatus')).hang).toMatchObject({ running: false, ok: false });
  });
});

describe('ensureAlarms', () => {
  it('creates missing alarms and recreates ones whose period changed', async () => {
    AGENTS.push(agent('contests', async () => 'ok', { trigger: 'schedule', periodMinutes: 30 }));
    await fakeBrowser.alarms.create(AGENT_ALARM + 'contests', { periodInMinutes: 180 });
    await fakeBrowser.alarms.create(AGENT_ALARM + 'removed', { periodInMinutes: 60 });
    await fakeBrowser.alarms.create('remind|codeforces:1|10', { when: Date.now() + 60_000 });

    await registry.ensureAlarms();

    const alarms = await fakeBrowser.alarms.getAll();
    const byName = new Map(alarms.map((a) => [a.name, a]));
    expect(byName.get(AGENT_ALARM + 'contests')?.periodInMinutes).toBe(30);
    expect(byName.get(TICK)?.periodInMinutes).toBe(1);
    expect(byName.has(AGENT_ALARM + 'removed')).toBe(false);
    expect(byName.has('remind|codeforces:1|10')).toBe(true); // reminders are not ours to touch
  });
});

describe('handleMessage', () => {
  it('rejects privileged messages from content scripts', async () => {
    await expect(router.handleMessage({ type: 'clearData' }, lcSender())).rejects.toThrow(/Forbidden/);
    await expect(router.handleMessage({ type: 'runAgent', id: 'contests' }, { ...pageSender(), id: 'evil' })).rejects.toThrow(/Forbidden/);
  });

  it('rejects malformed captures from the content script', async () => {
    await expect(
      router.handleMessage({ type: 'lcSubmission', payload: { submissionId: '1; drop', slug: 'two-sum', statusMsg: 'Accepted' } }, lcSender()),
    ).rejects.toThrow(/Rejected LeetCode capture/);
  });

  it('stores captures LeetCode could not confirm as unverified', async () => {
    const sub = await router.ingestVerifiedCapture(
      { submissionId: '99', slug: 'two-sum', statusMsg: 'Accepted', code: 'x' },
      { graphql: (() => Promise.reject(new Error('offline'))) as never, fetchJson: (() => Promise.reject(new Error('offline'))) as never },
    );
    expect(sub.unverified).toBe(true);
    const stored = (await storage.getItem('submissions')).find((s) => s.id === 'leetcode:99');
    expect(stored?.unverified).toBe(true);
  });

  it('refuses captures LeetCode contradicts', async () => {
    const graphql = (async () => ({
      submissionDetails: { statusCode: 11, timestamp: Date.now() / 1000, code: 'c', lang: { name: 'cpp' }, question: { titleSlug: 'two-sum' } },
    })) as never;
    await expect(
      router.ingestVerifiedCapture({ submissionId: '100', slug: 'two-sum', statusMsg: 'Accepted' }, { graphql }),
    ).rejects.toThrow(/Verdict/);
    expect(await storage.getItem('submissions')).toEqual([]);
  });
});
