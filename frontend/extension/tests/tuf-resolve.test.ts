import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Potd } from '../src/lib/types';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

const real: Potd = {
  source: 'tuf',
  platform: 'tuf',
  key: "tuf:find-row-with-maximum-1's",
  title: "Find row with maximum 1's",
  url: "https://takeuforward.org/practice/dsa/find-row-with-maximum-1's",
  tags: [],
  date: '2026-11-04',
  fetchedAt: 1_000,
};
const fresh = { ...real, title: 'Next question', url: 'https://takeuforward.org/practice/dsa/next', key: 'tuf:next', fetchedAt: 9_999_999, solved: true };

describe('resolveTufPotd', () => {
  it('uses a fresh read and clears any outdated flag', async () => {
    const { resolveTufPotd } = await import('../src/agents/potd/index');
    const r = await resolveTufPotd({ ...real, outdated: true }, async () => fresh, 9_999_999);
    expect(r.item.title).toBe('Next question');
    expect(r.item.outdated).toBeUndefined();
    expect(r.solvedOnSite).toBe(true);
    expect(r.error).toBeUndefined();
  });

  it('reuses a recent good read without fetching', async () => {
    const { resolveTufPotd } = await import('../src/agents/potd/index');
    const fetchFresh = vi.fn(async () => fresh);
    const r = await resolveTufPotd(real, fetchFresh, 1_000 + 60_000);
    expect(fetchFresh).not.toHaveBeenCalled();
    expect(r.item).toBe(real);
  });

  it('serves the last real question marked outdated when a refresh fails', async () => {
    const { resolveTufPotd } = await import('../src/agents/potd/index');
    const r = await resolveTufPotd(real, async () => Promise.reject(new Error('TUF: public page: request failed: timed out after 20s')), 10_000_000);
    expect(r.item).toMatchObject({ title: "Find row with maximum 1's", url: real.url, outdated: true });
    expect(r.error).toMatch(/timed out/);
  });

  it('never substitutes a question: with nothing real cached, the failure propagates (card shows unavailable)', async () => {
    const { resolveTufPotd } = await import('../src/agents/potd/index');
    const standIn: Potd = { ...real, platform: 'leetcode', title: 'Longest Increasing Subsequence', url: 'https://leetcode.com/problems/longest-increasing-subsequence/' };
    await expect(resolveTufPotd(standIn, async () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    await expect(resolveTufPotd(undefined, async () => Promise.reject(new Error('down')))).rejects.toThrow('down');
  });
});
