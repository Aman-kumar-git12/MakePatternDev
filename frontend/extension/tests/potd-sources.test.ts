import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));
const { withDefaults, DEFAULT_SETTINGS } = await import('../src/lib/storage');

describe('problem-of-the-day sources', () => {
  it('no longer includes Codeforces (Newton School added)', () => {
    expect(Object.keys(DEFAULT_SETTINGS.potdSources).sort()).toEqual(['gfg', 'leetcode', 'newton', 'tuf']);
  });

  it('drops the removed Codeforces option from settings saved by older versions', () => {
    const old = { potdSources: { leetcode: false, gfg: true, tuf: true, codeforces: true }, cfPickRating: 1500 };
    const s = withDefaults('settings', old) as unknown as Record<string, unknown> & { potdSources: Record<string, boolean> };
    expect(Object.keys(s.potdSources).sort()).toEqual(['gfg', 'leetcode', 'newton', 'tuf']);
    expect(s.potdSources.leetcode).toBe(false); // the user's other choices are kept
    expect('cfPickRating' in s).toBe(false);
  });
});
