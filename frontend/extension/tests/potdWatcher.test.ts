import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Potd } from '../src/lib/types';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

const recheckTufPotd = vi.fn(async () => true);
const quickSyncGfg = vi.fn(async (): Promise<'synced' | 'no-handle' | 'needs-full-sync'> => 'synced');
const runAgent = vi.fn(async (_id: string) => 'ok');
vi.mock('../src/agents/potd', async (orig) => ({ ...(await orig<object>()), recheckTufPotd: () => recheckTufPotd() }));
vi.mock('../src/agents/submissions', async (orig) => ({ ...(await orig<object>()), quickSyncGfg: () => quickSyncGfg() }));
vi.mock('../src/agents/registry', async (orig) => ({ ...(await orig<object>()), runAgent: (id: string) => runAgent(id) }));

const TUF_URL = "https://takeuforward.org/practice/dsa/find-row-with-maximum-1's";
const tuf: Potd = { source: 'tuf', platform: 'tuf', key: "tuf:find-row-with-maximum-1's", title: "Find row with maximum 1's", url: TUF_URL, tags: [], date: '2026-11-06' };

describe('leftProblem', () => {
  it('detects leaving a TUF or GFG problem page, but not staying on the same problem', async () => {
    const { leftProblem } = await import('../src/agents/potdWatcher');
    expect(leftProblem(TUF_URL, 'https://takeuforward.org/potd')).toEqual({ platform: 'tuf', problemKey: "tuf:find-row-with-maximum-1's" });
    expect(leftProblem('https://www.geeksforgeeks.org/problems/kadanes-algorithm/1', undefined)).toEqual({ platform: 'gfg', problemKey: 'gfg:kadanes-algorithm' });
    expect(leftProblem(TUF_URL, `${TUF_URL}?tab=submissions`)).toBeNull();
    expect(leftProblem('https://leetcode.com/problems/two-sum/', undefined)).toBeNull(); // LeetCode is captured live
    expect(leftProblem('https://takeuforward.org/potd', undefined)).toBeNull(); // not a problem page
    expect(leftProblem(undefined, TUF_URL)).toBeNull();
  });
});

describe('shouldRecheck', () => {
  it('re-checks TUF only for today’s unticked question, throttled', async () => {
    const { shouldRecheck, RECHECK_GAP_MS } = await import('../src/agents/potdWatcher');
    const left = { platform: 'tuf' as const, problemKey: tuf.key };
    expect(shouldRecheck(left, [tuf], new Set(), {}, 1e9)).toBe(true);
    expect(shouldRecheck(left, [tuf], new Set([tuf.key]), {}, 1e9)).toBe(false); // already ticked
    expect(shouldRecheck({ platform: 'tuf', problemKey: 'tuf:other' }, [tuf], new Set(), {}, 1e9)).toBe(false); // not today's
    expect(shouldRecheck(left, [], new Set(), {}, 1e9)).toBe(false); // no TUF card
    expect(shouldRecheck(left, [tuf], new Set(), { tuf: 1e9 - RECHECK_GAP_MS.tuf + 1 }, 1e9)).toBe(false); // throttled
    expect(shouldRecheck(left, [tuf], new Set(), { tuf: 1e9 - RECHECK_GAP_MS.tuf }, 1e9)).toBe(true);
  });

  it('re-checks GFG after any problem page, throttled to once a minute', async () => {
    const { shouldRecheck } = await import('../src/agents/potdWatcher');
    const left = { platform: 'gfg' as const, problemKey: 'gfg:anything' };
    expect(shouldRecheck(left, [], new Set(), {}, 1e9)).toBe(true);
    expect(shouldRecheck(left, [], new Set(), { gfg: 1e9 - 30_000 }, 1e9)).toBe(false);
  });
});

describe('onLeave / runRecheck', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    recheckTufPotd.mockClear();
    quickSyncGfg.mockClear();
    runAgent.mockClear();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { setSettleScheduler } = await import('../src/agents/potdWatcher');
    setSettleScheduler((cb) => cb());
  });

  it('schedules one TUF re-check after leaving today’s question, then throttles repeats', async () => {
    const { onLeave } = await import('../src/agents/potdWatcher');
    await fakeBrowser.storage.local.set({ potd: { localDate: '', items: [tuf], fetchedAt: 1, errors: {} } });
    const now = Date.now();
    expect(await onLeave(TUF_URL, 'https://example.com', now)).toBe('tuf');
    await vi.waitFor(() => expect(recheckTufPotd).toHaveBeenCalledTimes(1));
    expect(await onLeave(TUF_URL, undefined, now + 10_000)).toBeNull(); // within 2 min
    expect(recheckTufPotd).toHaveBeenCalledTimes(1);
  });

  it('falls back to the full submissions sync when GFG needs it (first sync or changed username)', async () => {
    const { runRecheck } = await import('../src/agents/potdWatcher');
    quickSyncGfg.mockResolvedValueOnce('needs-full-sync');
    expect(await runRecheck('gfg')).toBe('gfg: full sync');
    expect(runAgent).toHaveBeenCalledWith('submissions');
    expect(await runRecheck('gfg')).toBe('gfg: synced');
  });
});
