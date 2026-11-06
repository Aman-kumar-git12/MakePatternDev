import { describe, expect, it } from 'vitest';
import { analyzeHeuristically, guessLanguage, stripNoise } from '../src/agents/codeAnalysis/heuristics';

const names = (code: string, lang?: string) => analyzeHeuristically(code, lang).algorithms.map((a) => a.name);

const BINARY_SEARCH_CPP = `
class Solution {
public:
    int search(vector<int>& nums, int target) {
        int lo = 0, hi = nums.size() - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }
};`;

const SLIDING_WINDOW_PY = `
class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        seen = {}
        left = 0
        best = 0
        for right, ch in enumerate(s):
            while ch in seen and seen[ch] > 0:
                seen[s[left]] -= 1
                left += 1
            seen[ch] = seen.get(ch, 0) + 1
            best = max(best, right - left + 1)
        return best
`;

const BFS_GRID_JAVA = `
class Solution {
    public int orangesRotting(int[][] grid) {
        int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}};
        Queue<int[]> q = new ArrayDeque<>();
        int minutes = 0;
        while (!q.isEmpty()) {
            int size = q.size();
            for (int i = 0; i < size; i++) {
                int[] cur = q.poll();
                for (int[] d : dirs) { grid[cur[0] + d[0]][cur[1] + d[1]] = 2; }
            }
            minutes++;
        }
        return minutes;
    }
}`;

const DP_CPP = `
int coinChange(vector<int>& coins, int amount) {
    vector<int> dp(amount + 1, INT_MAX);
    dp[0] = 0;
    for (int a = 1; a <= amount; a++)
        for (int c : coins)
            if (c <= a && dp[a - c] != INT_MAX) dp[a] = min(dp[a], dp[a - c] + 1);
    return dp[amount] == INT_MAX ? -1 : dp[amount];
}`;

const BACKTRACK_PY = `
def subsets(nums):
    res, cur = [], []
    def go(i):
        if i == len(nums):
            res.append(cur[:])
            return
        cur.append(nums[i])
        go(i + 1)
        cur.pop()
        go(i + 1)
    go(0)
    return res
`;

const DSU_CPP = `
int parent[200005];
int find(int x) { return parent[x] == x ? x : parent[x] = find(parent[x]); }
void unite(int a, int b) { parent[find(a)] = find(b); }
`;

describe('algorithm detection', () => {
  it('binary search', () => {
    expect(names(BINARY_SEARCH_CPP)).toContain('Binary Search');
    expect(analyzeHeuristically(BINARY_SEARCH_CPP).complexity.time).toMatch(/log n/);
  });

  it('sliding window (supersedes two pointers) with linear time', () => {
    const r = analyzeHeuristically(SLIDING_WINDOW_PY);
    expect(r.language).toBe('python');
    expect(r.algorithms.map((a) => a.name)).toContain('Sliding Window');
    expect(r.algorithms.map((a) => a.name)).not.toContain('Two Pointers');
    expect(r.complexity.time).toBe('O(n)');
  });

  it('BFS on a grid', () => {
    const n = names(BFS_GRID_JAVA, 'Java');
    expect(n).toContain('Breadth-First Search');
    expect(n).toContain('Grid Traversal');
  });

  it('dynamic programming with nested brace-less loops', () => {
    const r = analyzeHeuristically(DP_CPP, 'C++');
    expect(r.algorithms.map((a) => a.name)).toContain('Dynamic Programming');
    expect(r.complexity.time).toBe('O(n^2)');
  });

  it('backtracking replaces plain recursion', () => {
    const n = names(BACKTRACK_PY);
    expect(n).toContain('Backtracking');
    expect(n).not.toContain('Recursion');
  });

  it('union-find', () => {
    expect(names(DSU_CPP)).toContain('Union-Find (DSU)');
  });

  it('ignores patterns that only appear in comments and strings', () => {
    const code = `// use a priority_queue and dp[i] here\nint main() { string s = "heapq lower_bound"; return 0; }`;
    const n = names(code, 'cpp');
    expect(n).not.toContain('Heap / Priority Queue');
    expect(n).not.toContain('Binary Search');
    expect(n).not.toContain('Dynamic Programming');
  });

  it('does not treat C++ stream operators or nested templates as bit manipulation', () => {
    const code = `int main(){ vector<vector<int>> g; int n; cin >> n; cout << n << endl; }`;
    expect(names(code, 'cpp')).not.toContain('Bit Manipulation');
  });
});

describe('readability', () => {
  it('scores clean code higher than cramped code', () => {
    const clean = analyzeHeuristically(BINARY_SEARCH_CPP).readability.score;
    const cramped = analyzeHeuristically(
      `#define a1 1\n#define b2 2\n#define c3 3\n#define d4 4\n#define e5 5\n#define f6 6\nint f(int qq){int zz=0;int ww=1;int pp2=3;for(int i=0;i<qq;i++){if(i>1){if(i>2){if(i>3){if(i>4){if(i>5){zz+=12345;ww+=67890;pp2+=55555;zz++;ww++;pp2++;}}}}}}return zz;}`,
      'cpp',
    ).readability;
    expect(clean).toBeGreaterThanOrEqual(85);
    expect(cramped.score).toBeLessThan(clean);
    expect(cramped.issues.join(' ')).toMatch(/nesting/i);
  });

  it('reports metrics', () => {
    const m = analyzeHeuristically(BINARY_SEARCH_CPP).readability.metrics;
    expect(m.maxNesting).toBeGreaterThanOrEqual(3);
    expect(m.codeLines).toBeGreaterThan(5);
  });
});

describe('language + noise helpers', () => {
  it('guesses languages', () => {
    expect(guessLanguage('#include <bits/stdc++.h>')).toBe('cpp');
    expect(guessLanguage('def f(x):\n    return x')).toBe('python');
    expect(guessLanguage('x', 'python3')).toBe('python');
    expect(guessLanguage('x', 'javascript')).toBe('javascript');
  });

  it('strips comments but keeps preprocessor lines', () => {
    const { clean, commentLines } = stripNoise('#include <x>\nint a; // note\n/* block\ncomment */', 'cpp');
    expect(clean).toContain('#include');
    expect(clean).not.toContain('note');
    expect(commentLines).toBe(3);
  });
});
