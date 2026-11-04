import { describe, expect, it } from 'vitest';
import { PLATFORMS, platformStyle, prettyProblem } from '../src/lib/platforms';

describe('platform identity', () => {
  it('gives every platform a unique monogram', () => {
    const monos = Object.values(PLATFORMS).map((p) => p.mono);
    expect(new Set(monos).size).toBe(monos.length);
  });

  it('scopes CSS variables to the platform', () => {
    expect(platformStyle('leetcode')).toEqual({ '--p': 'var(--plat-leetcode)', '--p-fg': 'var(--plat-leetcode-fg)' });
  });

  it('formats problem keys for the current-tab banner', () => {
    expect(prettyProblem('leetcode:two-sum')).toBe('Two Sum');
    expect(prettyProblem('gfg:kadanes-algorithm')).toBe('Kadanes Algorithm');
    expect(prettyProblem('codeforces:1843C')).toBe('Problem 1843C');
    expect(prettyProblem('codechef:FLOW001')).toBe('Problem FLOW001');
    expect(prettyProblem('atcoder:abc300_a')).toBe('ABC300 A');
    expect(prettyProblem('leetcode:3sum')).toBe('3sum');
  });
});
