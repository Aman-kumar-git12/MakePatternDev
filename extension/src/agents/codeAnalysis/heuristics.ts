import type { Algorithm, HeuristicReport } from '../../lib/types';

/**
 * Offline, instant code analysis: readability metrics, algorithm/pattern detection and a
 * rough complexity estimate from loop nesting. Works on C++, Java, Python, JS/TS, Go, C#
 * and Kotlin-style code. It is pattern matching, not parsing — the Claude review is the
 * deep version.
 */

export function guessLanguage(code: string, hint?: string): string {
  const h = (hint ?? '').toLowerCase();
  if (h) {
    if (h.includes('python')) return 'python';
    if (h.includes('c++') || h === 'cpp' || h.includes('g++') || h.includes('clang')) return 'cpp';
    if (h.includes('java') && !h.includes('script')) return 'java';
    if (h.includes('typescript')) return 'typescript';
    if (h.includes('javascript') || h.includes('node')) return 'javascript';
    if (h.includes('go')) return 'go';
    if (h.includes('kotlin')) return 'kotlin';
    if (h.includes('c#') || h.includes('csharp')) return 'csharp';
    if (h.includes('rust')) return 'rust';
    if (h === 'c' || h.includes('gnu c11')) return 'c';
  }
  if (/#include\s*</.test(code)) return 'cpp';
  // `def name(...):` is unique to Python; otherwise require Python-style headers and no `;` line endings.
  if (/^\s*def \w+\s*\(.*\)\s*(->[^:]*)?:\s*$/m.test(code)) return 'python';
  if (/^\s*(class \w+(\(.*\))?:|from [\w.]+ import|import \w+$)/m.test(code) && !/;\s*$/m.test(code)) return 'python';
  if (/\bpublic\s+(static\s+)?(class|int|void|long|boolean|String)\b/.test(code)) return 'java';
  if (/\bfunc\s+\w+\(|package main/.test(code)) return 'go';
  if (/\bfn\s+\w+\(|let mut\b/.test(code)) return 'rust';
  if (/:\s*(number|string|boolean)\b|interface \w+ \{/.test(code)) return 'typescript';
  if (/\b(const|let|var)\s+\w+\s*=|=>|function\s+\w+\(/.test(code)) return 'javascript';
  return 'unknown';
}

/** Removes comments and string literals so they don't trigger pattern matches. */
export function stripNoise(code: string, lang: string): { clean: string; commentLines: number } {
  let commentLines = 0;
  let out = code.replace(/\/\*[\s\S]*?\*\//g, (m) => {
    commentLines += m.split('\n').length;
    return '\n'.repeat(m.split('\n').length - 1);
  });
  if (lang === 'python') {
    out = out.replace(/("""|''')[\s\S]*?\1/g, (m) => {
      commentLines += m.split('\n').length;
      return '""' + '\n'.repeat(m.split('\n').length - 1);
    });
  }
  const lineComment = lang === 'python' ? /#.*$/ : /\/\/.*$/;
  out = out
    .split('\n')
    .map((line) => {
      // Strings first so "//" or "#" inside a string literal isn't treated as a comment.
      const noStrings = line.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, '""');
      if (lang !== 'python' && /^\s*#\s*(include|define|pragma|ifdef|ifndef|endif|undef)/.test(noStrings)) return noStrings;
      const m = noStrings.match(lineComment);
      if (m) {
        commentLines++;
        return noStrings.slice(0, m.index);
      }
      return noStrings;
    })
    .join('\n');
  return { clean: out, commentLines };
}

interface Rule {
  name: string;
  test: (c: string, ctx: Ctx) => string | null;
}

interface Ctx {
  lang: string;
  recursive: string[];
  has: (re: RegExp) => boolean;
}


/** Names of functions that call themselves. */
function recursiveFunctions(code: string, lang: string): string[] {
  const names = new Set<string>();
  const decl =
    lang === 'python'
      ? /^\s*def\s+(\w+)\s*\(/gm
      : /(?:^|[\s*&>])(\w+)\s*\([^()]*\)\s*(?:const\s*)?(?:->\s*[\w<>:,\s]+)?\{|function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)|\bfunc\s+(\w+)\s*\(/gm;
  const keywords = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'sizeof', 'main']);
  for (const m of code.matchAll(decl)) {
    const name = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (!name || keywords.has(name)) continue;
    const start = (m.index ?? 0) + m[0].length;
    const body = functionBody(code, start, lang);
    if (new RegExp(`\\b${name}\\s*\\(`).test(body)) names.add(name);
  }
  // Lambdas: function<int(int)> dfs = [&](...) and `auto dfs = [&](auto&& self, ...)`
  for (const m of code.matchAll(/(?:function<[^>]*>|auto)\s+(\w+)\s*=\s*\[[^\]]*\]/g)) {
    const rest = code.slice((m.index ?? 0) + m[0].length);
    if (m[1] && new RegExp(`\\b(${m[1]}|self)\\s*\\(`).test(rest.slice(0, 4000))) names.add(m[1]);
  }
  return [...names];
}

function functionBody(code: string, start: number, lang: string): string {
  if (lang === 'python') {
    const lines = code.slice(start).split('\n');
    const body: string[] = [];
    let indent = -1;
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const ind = line.match(/^\s*/)![0].length;
      if (indent < 0) indent = ind;
      if (ind < indent) break;
      body.push(line);
    }
    return body.join('\n');
  }
  let depth = 1;
  for (let i = start; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return code.slice(start, i);
  }
  return code.slice(start);
}

const RULES: Rule[] = [
  {
    name: 'Binary Search',
    test: (c) => {
      if (/\b(lower_bound|upper_bound|bisect(_left|_right)?|binary_search|Arrays\.binarySearch|Collections\.binarySearch|sort\.Search)\b/.test(c))
        return 'uses a library binary search';
      if (/\bmid\b\s*=/.test(c) && /\b(lo|low|l|left|start|beg)\b\s*<=?\s*\b(hi|high|r|right|end)\b/.test(c))
        return 'computes `mid` while lo/hi bounds converge';
      return null;
    },
  },
  {
    name: 'Sliding Window',
    test: (c) =>
      /\bfor\b[^\n]*\b(r|right|end|j|hi)\b/.test(c) &&
      /\bwhile\b[^\n]*[\s\S]{0,300}?\b(l|left|start|i|lo)\s*(\+\+|\+=\s*1)/.test(c) &&
      /\b(window|count|freq|cnt|seen|sum|mp|map)\b/i.test(c)
        ? 'expands a right pointer and shrinks the left one inside a loop'
        : null,
  },
  {
    name: 'Two Pointers',
    test: (c) =>
      /\bwhile\s*\(?\s*(i|l|left|lo|start|low)\s*<\s*(j|r|right|hi|end|high)\b/.test(c) &&
      /\b(j|r|right|hi|end|high)\s*(--|-=\s*1)/.test(c)
        ? 'two indices move towards each other'
        : /\b(slow|fast)\b/.test(c) && /\bfast\b\s*=\s*\bfast\b[.\->]+next[.\->]+next|fast\s*\+=\s*2/.test(c)
          ? 'fast/slow pointers (Floyd)'
          : null,
  },
  {
    name: 'Breadth-First Search',
    test: (c) =>
      /\b(queue<|deque|ArrayDeque|LinkedList<|Queue<|popleft|collections\.deque)\b|\.poll\(\)|\.front\(\)|q\.pop\(0\)|\.shift\(\)/.test(c) &&
      /\b(while)\b/.test(c)
        ? 'processes nodes level by level from a queue'
        : null,
  },
  {
    name: 'Depth-First Search',
    test: (c, ctx) =>
      ctx.recursive.length && /\b(vis|visited|seen|adj|graph|grid|children|left|right)\b/.test(c)
        ? `recursive \`${ctx.recursive[0]}\` explores neighbours/children`
        : /\b(stack<|Stack<|Deque<)/.test(c) && /\b(adj|graph|visited|vis)\b/.test(c)
          ? 'explicit stack over a graph'
          : null,
  },
  {
    name: 'Backtracking',
    test: (c, ctx) =>
      ctx.recursive.length && /(\.pop_back\(\)|\.pop\(\)|\.removeLast\(\)|\.remove\(\s*\w+\.size\(\)\s*-\s*1\s*\))/.test(c) &&
      /(\.push_back\(|\.append\(|\.add\(|\.push\()/.test(c)
        ? 'choose → recurse → un-choose'
        : null,
  },
  {
    name: 'Dynamic Programming',
    test: (c) =>
      /\b(dp|memo|cache|tab)\s*\[/.test(c) || /\bvector<\s*vector<\s*(long long|int|ll)\s*>\s*>\s*dp\b/.test(c) || /dp\s*=\s*\[/.test(c)
        ? 'fills a dp/memo table from smaller sub-problems'
        : /@(functools\.)?(lru_)?cache\b/.test(c)
          ? 'memoised recursion (@cache)'
          : null,
  },
  {
    name: 'Greedy',
    test: (c) =>
      /\b(sort|sorted|Arrays\.sort|Collections\.sort|\.sort)\s*\(/.test(c) && !/\bdp\b/.test(c) && /\b(max|min|ans|res|count)\b/.test(c)
        ? 'sorts, then makes one locally optimal pass (possible greedy)'
        : null,
  },
  {
    name: 'Sorting',
    test: (c) => (/\b(sort|sorted|stable_sort|Arrays\.sort|Collections\.sort)\s*\(|\.sort\(/.test(c) ? 'sorts the input' : null),
  },
  {
    name: 'Hashing',
    test: (c) =>
      /\b(unordered_map|unordered_set|HashMap|HashSet|LinkedHashMap|defaultdict|Counter|dict\(|set\(\)|new Map\(|new Set\(|map<|set<|map\[)/.test(c) ||
      /=\s*\{\s*\}/.test(c)
        ? 'hash map / set for O(1) lookups'
        : null,
  },
  {
    name: 'Heap / Priority Queue',
    test: (c) => (/\b(priority_queue|heapq|PriorityQueue|heappush|heappop|MinPriorityQueue|MaxPriorityQueue|container\/heap)\b/.test(c) ? 'priority queue' : null),
  },
  {
    name: 'Monotonic Stack',
    test: (c) =>
      /while\s*\(?\s*[^\n]*(\.empty\(\)|\.length|\.size\(\)|\bst\b|\bstack\b|\bstk\b)[^\n]*(&&|\band\b)[^\n]*(\.top\(\)|\[-1\]|\.peek\(\)|\.back\(\)|\.at\(-1\))\s*[<>]=?/.test(c)
        ? 'pops while the top breaks monotonic order'
        : null,
  },
  {
    name: 'Union-Find (DSU)',
    test: (c) => (/\b(parent|par|root)\s*\[/.test(c) && /\b(find|findParent|findUPar|union|unite|merge)\s*\(/.test(c) ? 'parent array with find/union' : null),
  },
  {
    name: "Dijkstra's Shortest Path",
    test: (c) =>
      /\b(priority_queue|heapq|PriorityQueue)\b/.test(c) && /\bdist\b/.test(c) && /dist\s*\[[^\]]+\]\s*[<>]\s*[^;\n]*\+/.test(c)
        ? 'relaxes edges in order of distance from a heap'
        : null,
  },
  {
    name: 'Topological Sort',
    test: (c) => (/\b(indegree|inDegree|in_degree|indeg|inDeg)\b/.test(c) ? "Kahn's algorithm with in-degrees" : null),
  },
  {
    name: 'Prefix Sum',
    test: (c) =>
      /\b(prefix|pref|psum|pre)\s*\[\s*\w+\s*(\+\s*1)?\s*\]\s*=\s*(prefix|pref|psum|pre)\s*\[/.test(c) || /\b(accumulate|partial_sum|itertools\.accumulate)\b/.test(c)
        ? 'cumulative sums for O(1) range queries'
        : null,
  },
  {
    name: 'Bit Manipulation',
    test: (c) =>
      /\b\w+\s*(<<|>>>?)\s*\w+/.test(c.replace(/\b(cin|cout|cerr)\b[^;]*;/g, ';').replace(/>>(?=\s*[\w(]*\s*[=;,)])/g, '')) ||
      /&\s*1\b|\^=|__builtin_popcount|bit_count\(|Integer\.bitCount|&\s*\(\s*\w+\s*-\s*1\s*\)/.test(c)
        ? 'bitwise operations'
        : null,
  },
  {
    name: 'Trie',
    test: (c) => (/\b(TrieNode|Trie)\b|children\s*\[\s*26\s*\]|children\s*=\s*\{\}/.test(c) ? 'prefix tree' : null),
  },
  {
    name: 'Segment Tree / Fenwick Tree',
    test: (c) =>
      /\b(seg|segtree|tree)\s*\[\s*2\s*\*\s*\w+\s*(\+\s*1)?\s*\]|\b(fenwick|BIT)\b|\w+\s*&\s*\(?-\w+\)?|\b(\w+)\s*\+=\s*\2\s*&\s*-\2/.test(c)
        ? 'range-query tree'
        : null,
  },
  {
    name: 'Linked List',
    test: (c) => (/(->|\.)next\b/.test(c) && /\bListNode\b|\bNode\b|->next/.test(c) ? 'pointer manipulation on list nodes' : null),
  },
  {
    name: 'Tree Traversal',
    test: (c) => (/\bTreeNode\b|(->|\.)(left|right)\b/.test(c) && /\b(root|node)\b/.test(c) ? 'walks a binary tree' : null),
  },
  {
    name: 'Grid Traversal',
    test: (c) => (/\b(dx|dy|dirs|directions|drow|dcol|dr|dc)\b/.test(c) ? 'direction arrays over a 2D grid' : null),
  },
  {
    name: 'Number Theory',
    test: (c) => (/\b(gcd|__gcd|lcm|sieve|isPrime|modpow|binpow|power|1000000007|1e9\s*\+\s*7|998244353)\b/.test(c) ? 'gcd / primes / modular arithmetic' : null),
  },
  {
    name: 'String Matching',
    test: (c) => (/\b(lps|kmp|zfunc|z_function|rabin|rolling|prefix_function)\b/i.test(c) ? 'KMP / Z / rolling hash' : null),
  },
  {
    name: 'Recursion',
    test: (_c, ctx) => (ctx.recursive.length ? `\`${ctx.recursive.join('`, `')}\` calls itself` : null),
  },
];

/** Patterns that make a weaker detection redundant. */
const SUPERSEDES: Record<string, string[]> = {
  'Depth-First Search': ['Recursion'],
  Backtracking: ['Recursion'],
  'Dynamic Programming': ['Recursion', 'Greedy'],
  "Dijkstra's Shortest Path": ['Heap / Priority Queue', 'Breadth-First Search'],
  'Topological Sort': ['Breadth-First Search'],
  'Monotonic Stack': [],
  'Sliding Window': ['Two Pointers'],
  Greedy: ['Sorting'],
};

const STRONG = new Set(['Binary Search', "Dijkstra's Shortest Path", 'Union-Find (DSU)', 'Topological Sort', 'Trie', 'Dynamic Programming', 'Monotonic Stack']);
const WEAK = new Set(['Greedy', 'Recursion', 'Hashing', 'Sorting', 'Bit Manipulation']);

function maxLoopNesting(lines: string[], lang: string): number {
  let max = 0;
  if (lang === 'python') {
    const stack: number[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const ind = line.match(/^\s*/)![0].length;
      while (stack.length && stack[stack.length - 1]! >= ind) stack.pop();
      if (/^\s*(for|while)\b/.test(line)) {
        stack.push(ind);
        max = Math.max(max, stack.length);
      }
    }
    return max;
  }
  // Brace languages: each open block records how many loop headers it is the body of,
  // so brace-less nested loops (`for (...)\n  for (...)\n    x++;`) are counted too.
  const stack: number[] = [];
  let pending = 0;
  const depth = () => stack.reduce((a, b) => a + b, 0);
  for (const line of lines) {
    // `} while (cond);` closes a do-while — not a new loop.
    if (!/^\s*}\s*while\s*\(.*\)\s*;/.test(line)) {
      pending += (line.match(/\b(?:for|while)\s*\(|\.forEach\(|^\s*do\b/g) ?? []).length;
    }
    for (const ch of line) {
      if (ch === '{') {
        stack.push(pending);
        pending = 0;
        max = Math.max(max, depth());
      } else if (ch === '}') stack.pop();
    }
    // A statement ends the bodies of all pending brace-less loops.
    if (pending && /;\s*$/.test(line) && !/\bfor\s*\([^)]*$/.test(line)) {
      max = Math.max(max, depth() + pending);
      pending = 0;
    }
  }
  return max;
}

function maxBlockNesting(lines: string[], lang: string): number {
  if (lang === 'python') {
    const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].replace(/\t/g, '    ').length);
    const unit = Math.min(...indents.filter((i) => i > 0), 4) || 4;
    return Math.max(0, ...indents.map((i) => Math.round(i / unit)));
  }
  let depth = 0;
  let max = 0;
  for (const ch of lines.join('\n')) {
    if (ch === '{') max = Math.max(max, ++depth);
    else if (ch === '}') depth--;
  }
  return max;
}

function longestFunction(clean: string, lang: string): number {
  const lines = clean.split('\n');
  let longest = 0;
  if (lang === 'python') {
    lines.forEach((line, i) => {
      if (/^\s*def\s/.test(line)) longest = Math.max(longest, functionBody(lines.slice(i).join('\n'), 0, lang).split('\n').length);
    });
    return longest;
  }
  const re = /\b\w+\s*\([^()]*\)\s*(const\s*)?(->\s*[\w<>:,\s]+)?\{|=>\s*\{|function\s*\w*\s*\([^)]*\)\s*\{/g;
  for (const m of clean.matchAll(re)) {
    const body = functionBody(clean, (m.index ?? 0) + m[0].length, lang);
    longest = Math.max(longest, body.split('\n').filter((l) => l.trim()).length);
  }
  return longest;
}

const OK_SHORT = new Set(['i', 'j', 'k', 'n', 'm', 'x', 'y', 'u', 'v', 'l', 'r', 'dp', 'id', 'ok', 'lo', 'hi', 'it', 'to', 'q', 'pq', 'st', 'mp', 'ans', 'res', 'sum', 'cnt', 'idx', 'adj', 'vis', 'mid', 'dx', 'dy', 'w', 's', 't', 'a', 'b', 'c', 'e', 'p', '_']);

function declaredNames(clean: string, lang: string): string[] {
  const names = new Set<string>();
  const patterns =
    lang === 'python'
      ? [/^\s*([a-zA-Z_]\w*)\s*(?:,\s*[a-zA-Z_]\w*\s*)*=(?!=)/gm, /\bfor\s+([a-zA-Z_]\w*)\s+in\b/g, /\bdef\s+\w+\s*\(([^)]*)\)/g]
      : [
          /\b(?:int|long|ll|double|float|char|bool|boolean|string|String|auto|var|let|const|size_t|unsigned)\s+([a-zA-Z_]\w*)/g,
          /\b(?:vector|map|set|List|Map|Set|ArrayList|HashMap|HashSet|unordered_map|unordered_set|queue|stack|deque|priority_queue|pair)\s*<[^;=(){}]*>\s+([a-zA-Z_]\w*)/g,
          /\b([a-zA-Z_]\w*)\s*:=/g,
        ];
  for (const re of patterns) {
    for (const m of clean.matchAll(re)) {
      for (const part of (m[1] ?? '').split(',')) {
        const name = part.trim().replace(/[:=].*$/, '').trim().split(/\s+/).pop()!;
        if (/^[a-zA-Z_]\w*$/.test(name) && name !== 'self') names.add(name);
      }
    }
  }
  return [...names];
}

export function analyzeHeuristically(code: string, langHint?: string): HeuristicReport {
  const lang = guessLanguage(code, langHint);
  const { clean, commentLines } = stripNoise(code, lang);
  const rawLines = code.split('\n');
  const lines = clean.split('\n');
  const codeLines = lines.filter((l) => l.trim()).length;
  const nonEmptyRaw = rawLines.filter((l) => l.trim());
  const avgLineLength = nonEmptyRaw.length ? nonEmptyRaw.reduce((s, l) => s + l.trimEnd().length, 0) / nonEmptyRaw.length : 0;
  const maxLineLength = Math.max(0, ...rawLines.map((l) => l.trimEnd().length));
  const maxNesting = maxBlockNesting(lines, lang);
  const longestFn = longestFunction(clean, lang);
  const names = declaredNames(clean, lang);
  const shortNames = names.filter((n) => n.length <= 2 && !OK_SHORT.has(n));
  const magicNumbers = (clean.match(/(?<![\w.])\d{3,}(?![\w.])/g) ?? []).filter(
    (n) => !['1000000007', '998244353', '100000', '1000000', '100005', '200005', '1000005'].includes(n),
  ).length;
  const defines = (clean.match(/^\s*#define\b/gm) ?? []).length;
  const multiStatement = lines.filter((l) => !/\bfor\s*\(/.test(l) && (l.match(/;/g) ?? []).length >= 3).length;

  // ----- readability score -----
  const issues: string[] = [];
  let score = 100;
  const penalize = (points: number, issue: string) => {
    score -= points;
    issues.push(issue);
  };
  if (maxNesting > 4) penalize(Math.min(24, (maxNesting - 4) * 8), `Deep nesting (${maxNesting} levels) — extract helpers or use early returns.`);
  if (longestFn > 60) penalize(10, `A function is ${longestFn} lines long — split it into named steps.`);
  else if (longestFn > 40) penalize(5, `Longest function is ${longestFn} lines — consider splitting it.`);
  if (avgLineLength > 90) penalize(8, `Average line is ${Math.round(avgLineLength)} chars — lines are dense.`);
  if (maxLineLength > 140) penalize(5, `Longest line is ${maxLineLength} chars.`);
  if (names.length >= 4 && shortNames.length / names.length > 0.4)
    penalize(12, `Many cryptic names (${shortNames.slice(0, 5).join(', ')}) — use descriptive names.`);
  else if (shortNames.length >= 3) penalize(5, `Some cryptic names: ${shortNames.slice(0, 5).join(', ')}.`);
  if (magicNumbers > 3) penalize(5, `${magicNumbers} magic numbers — name them as constants.`);
  if (defines > 5) penalize(6, `${defines} #define macros — a heavy template hides intent.`);
  if (multiStatement > 2) penalize(6, `${multiStatement} lines pack several statements — one per line reads better.`);
  if (codeLines > 50 && commentLines === 0) penalize(4, 'No comments in a long solution — note the key idea/invariant.');
  if (/\bgoto\b/.test(clean)) penalize(8, 'Uses goto.');
  const dup = duplicateLines(lines);
  if (dup) penalize(5, `Repeated line "${dup.slice(0, 40)}" — factor out duplication.`);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';

  // ----- algorithm detection -----
  const recursive = recursiveFunctions(clean, lang);
  const ctx: Ctx = { lang, recursive, has: (re) => re.test(clean) };
  const found: Algorithm[] = [];
  for (const rule of RULES) {
    const evidence = rule.test(clean, ctx);
    if (evidence) {
      found.push({
        name: rule.name,
        evidence,
        confidence: STRONG.has(rule.name) ? 'high' : WEAK.has(rule.name) ? 'low' : 'medium',
      });
    }
  }
  const names2 = new Set(found.map((a) => a.name));
  const algorithms = found.filter((a) => !Object.entries(SUPERSEDES).some(([strong, weak]) => names2.has(strong) && weak.includes(a.name)));

  // ----- complexity estimate -----
  const depth = maxLoopNesting(lines, lang);
  const has = (n: string) => names2.has(n);
  let time: string;
  let reason: string;
  if (depth === 0 && !recursive.length) {
    time = has('Sorting') ? 'O(n log n)' : 'O(1)';
    reason = has('Sorting') ? 'no explicit loops; dominated by the sort' : 'no loops or recursion found';
  } else if (depth === 0) {
    time = has('Dynamic Programming') ? 'O(states × transitions)' : has('Backtracking') ? 'exponential' : 'O(n)';
    reason = has('Backtracking') ? 'recursion explores all choices' : 'recursion visits each state once (if memoised)';
  } else {
    const nPart = depth === 1 ? 'n' : `n^${depth}`;
    if (has('Binary Search') && depth >= 1) {
      time = depth === 1 ? 'O(log n) – O(n log n)' : `O(n^${depth - 1} log n)`;
      reason = `${depth} nested loop${depth > 1 ? 's' : ''}, one of which is a binary search`;
    } else if (has('Heap / Priority Queue') || has("Dijkstra's Shortest Path")) {
      time = has("Dijkstra's Shortest Path") ? 'O((V + E) log V)' : `O(${nPart} log n)`;
      reason = 'heap operations add a log factor';
    } else if (has('Sorting') && depth <= 1) {
      time = 'O(n log n)';
      reason = 'sort followed by a linear pass';
    } else if (has('Sliding Window') || has('Two Pointers')) {
      time = 'O(n)';
      reason = 'each pointer moves across the input at most once (amortised)';
    } else {
      time = `O(${nPart})`;
      reason = `${depth} level${depth > 1 ? 's' : ''} of nested loops`;
    }
  }

  return {
    language: lang,
    readability: {
      score,
      grade,
      issues,
      metrics: {
        lines: rawLines.length,
        codeLines,
        commentRatio: codeLines ? commentLines / (codeLines + commentLines) : 0,
        avgLineLength: Math.round(avgLineLength),
        maxLineLength,
        maxNesting,
        longestFunction: longestFn,
        shortNames,
        magicNumbers,
      },
    },
    algorithms,
    complexity: { time, reason: `${reason} (estimate)` },
  };
}

function duplicateLines(lines: string[]): string | null {
  const counts = new Map<string, number>();
  for (const l of lines) {
    const t = l.trim();
    if (t.length < 25) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  for (const [line, n] of counts) if (n >= 3) return line;
  return null;
}
