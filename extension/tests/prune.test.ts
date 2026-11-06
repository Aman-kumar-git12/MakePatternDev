import { describe, expect, it, vi } from 'vitest';
import { pruneAnalyses, pruneReminderOverrides } from '../src/lib/storage';
import type { Analysis, Contest } from '../src/lib/types';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));

const NOW = Date.parse('2026-11-04T12:00:00Z');
const DAY = 86_400_000;
const contest = (id: string, start: number): Contest => ({ id, platform: 'codeforces', name: id, url: '', start, durationSec: 3600 });

describe('pruneReminderOverrides', () => {
  const checked = new Set(['codeforces']);

  it('keeps overrides of listed contests and records their end', () => {
    const r = pruneReminderOverrides({ 'codeforces:1': false }, {}, [contest('codeforces:1', NOW + DAY)], checked, NOW);
    expect(r.overrides).toEqual({ 'codeforces:1': false });
    expect(r.ends['codeforces:1']).toBe(NOW + DAY + 3_600_000);
  });

  it('drops overrides of contests that ended over a day ago', () => {
    const r = pruneReminderOverrides({ 'codeforces:1': true, 'codeforces:2': false }, { 'codeforces:1': NOW - 2 * DAY, 'codeforces:2': NOW - DAY / 2 }, [], checked, NOW);
    expect(r.overrides).toEqual({ 'codeforces:2': false });
  });

  it('starts the clock for unknown missing contests, but not for unchecked platforms', () => {
    const r = pruneReminderOverrides({ 'codeforces:9': true, 'atcoder:x': true }, {}, [], checked, NOW);
    expect(r.overrides).toEqual({ 'codeforces:9': true, 'atcoder:x': true });
    expect(r.ends).toEqual({ 'codeforces:9': NOW });
    const later = pruneReminderOverrides(r.overrides, r.ends, [], checked, NOW + 2 * DAY);
    expect(later.overrides).toEqual({ 'atcoder:x': true });
  });
});

describe('pruneAnalyses', () => {
  const a = (id: string, ageDays: number) => ({ id, createdAt: NOW - ageDays * DAY }) as Analysis;

  it('drops only old analyses whose submission is gone', () => {
    const all = { 'leetcode:1': a('leetcode:1', 200), 'leetcode:2': a('leetcode:2', 200), 'leetcode:3': a('leetcode:3', 10), 'paste:1': a('paste:1', 400) };
    expect(Object.keys(pruneAnalyses(all, new Set(['leetcode:2']), NOW)).sort()).toEqual(['leetcode:2', 'leetcode:3', 'paste:1']);
  });
});
