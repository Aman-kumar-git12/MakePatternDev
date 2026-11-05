import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Potd } from '../src/lib/types';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

const tuf: Potd = {
  source: 'tuf',
  platform: 'tuf',
  key: "tuf:find-row-with-maximum-1's",
  title: "Find row with maximum 1's",
  url: "https://takeuforward.org/practice/dsa/find-row-with-maximum-1's",
  tags: [],
  date: '2026-11-06',
};
let solved = true;
vi.mock('../src/agents/potd/tuf', async (orig) => ({
  ...(await orig<object>()),
  fetchTufPotd: async () => ({ ...tuf, title: 'Fresh title', solved, fetchedAt: 5 }),
  resetTufCache: () => {},
}));

describe('recheckTufPotd', () => {
  it('refreshes the TUF card and ticks it when TUF reports it solved; other cards untouched', async () => {
    fakeBrowser.reset();
    const lc: Potd = { source: 'leetcode', platform: 'leetcode', key: 'leetcode:x', title: 'X', url: 'https://leetcode.com/problems/x/', tags: [], date: '' };
    await fakeBrowser.storage.local.set({ potd: { localDate: '', items: [lc, { ...tuf, outdated: true }], fetchedAt: 1, errors: {} } });
    const { recheckTufPotd } = await import('../src/agents/potd/index');
    const { localDate } = await import('../src/lib/time');
    const now = Date.now();
    expect(await recheckTufPotd(now)).toBe(true);
    const { potd, potdDone } = await fakeBrowser.storage.local.get(['potd', 'potdDone']);
    expect((potdDone as Record<string, string[]>)[localDate(now)]).toContain(tuf.key);
    const items = (potd as { items: Potd[] }).items;
    expect(items.find((p) => p.source === 'tuf')).toMatchObject({ title: 'Fresh title' });
    expect(items.find((p) => p.source === 'tuf')!.outdated).toBeUndefined();
    expect(items.find((p) => p.source === 'leetcode')).toEqual(lc);
  });

  it('does not tick when TUF says not solved yet', async () => {
    fakeBrowser.reset();
    solved = false;
    await fakeBrowser.storage.local.set({ potd: { localDate: '', items: [tuf], fetchedAt: 1, errors: {} } });
    const { recheckTufPotd } = await import('../src/agents/potd/index');
    expect(await recheckTufPotd()).toBe(false);
    const { potdDone } = await fakeBrowser.storage.local.get('potdDone');
    expect(potdDone).toBeUndefined();
    solved = true;
  });
});
