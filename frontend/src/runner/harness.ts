/**
 * Pure, dependency-free helpers for the LeetCode-style test harness.
 * No browser APIs here so it can be self-checked with plain Node
 * (see frontend/scripts/runner-selfcheck.ts).
 */

export interface InputArg {
  name: string | null;
  raw: string;
  value: unknown;
}

export type CaseOutcome = 'pass' | 'fail' | 'error' | 'timeout' | 'ran';

/** Sentinel for values that could not be parsed as JSON / Python literals. */
export interface Unparsed {
  __unparsed: string;
}

export const isUnparsed = (v: unknown): v is Unparsed =>
  typeof v === 'object' && v !== null && '__unparsed' in (v as Record<string, unknown>);

const OPEN = '[{(';
const CLOSE = ']})';
const IDENT_ASSIGN = /^\s*([A-Za-z_$][\w$]*)\s*=(?!=)\s*([\s\S]*)$/;

/**
 * Split raw test-case input into top-level segments.
 * Accepts "nums = [2,7,11,15], target = 9", multi-line "name = value" pairs,
 * and LeetCode's one-value-per-line format ("[2,7,11,15]\n9").
 */
export function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let buf = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      buf += ch;
      if (ch === '\\' && i + 1 < input.length) {
        buf += input[++i];
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ',' || ch === '\n' || ch === ';')) {
      if (buf.trim()) parts.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());

  // Re-join segments that were split on a top-level comma but don't start a new "name =" pair
  // when the input clearly uses named arguments (e.g. "x = 1, 2" is unusual but keep it together).
  const named = parts.some((p) => IDENT_ASSIGN.test(p));
  if (!named) return parts;
  const merged: string[] = [];
  for (const p of parts) {
    if (IDENT_ASSIGN.test(p) || merged.length === 0) merged.push(p);
    else merged[merged.length - 1] += `, ${p}`;
  }
  return merged;
}

/** Convert Python-ish literal syntax to JSON: True/False/None, single quotes, tuples. */
export function pythonToJson(src: string): string {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      let s = '';
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\' && i + 1 < src.length) {
          const nxt = src[i + 1];
          s += nxt === q ? q : `\\${nxt}`;
          i += 2;
          continue;
        }
        s += src[i] === '"' ? '\\"' : src[i];
        i++;
      }
      out += `"${s}"`;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let word = ch;
      while (i + 1 < src.length && /\w/.test(src[i + 1])) word += src[++i];
      out += word === 'True' ? 'true' : word === 'False' ? 'false' : word === 'None' ? 'null' : word;
      continue;
    }
    out += ch === '(' ? '[' : ch === ')' ? ']' : ch;
  }
  // Trailing commas: [1,2,] -> [1,2]
  return out.replace(/,\s*([\]}])/g, '$1');
}

/** Parse a single literal value. Returns an Unparsed sentinel if it isn't JSON-like. */
export function parseLiteral(raw: string): unknown {
  const text = raw.trim();
  if (text === '') return { __unparsed: '' } as Unparsed;
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  try {
    return JSON.parse(pythonToJson(text));
  } catch {
    return { __unparsed: text } as Unparsed;
  }
}

export function parseInput(input: string): InputArg[] {
  return splitTopLevel(input).map((seg) => {
    const m = IDENT_ASSIGN.exec(seg);
    if (m) {
      const value = parseLiteral(m[2]);
      return { name: m[1], raw: m[2].trim(), value: isUnparsed(value) ? value.__unparsed : value };
    }
    const value = parseLiteral(seg);
    return { name: null, raw: seg, value: isUnparsed(value) ? value.__unparsed : value };
  });
}

/**
 * Deep equality. Integers must match exactly; a tolerance applies only when a float is involved
 * (absolute 1e-5, or relative for large-magnitude floats), as LeetCode does for float answers.
 */
export function deepEqual(a: unknown, b: unknown, tol = 1e-5): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    if (Number.isInteger(a) && Number.isInteger(b)) return a === b;
    const diff = Math.abs(a - b);
    return diff <= tol || diff <= tol * Math.max(Math.abs(a), Math.abs(b)) * 1e-4;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i], tol));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    return (
      deepEqual(ka, kb, tol) &&
      ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], tol))
    );
  }
  return a === b;
}

/**
 * Compare a runtime result (JSON-safe value) with the saved expected output text.
 * Returns 'ran' when there is no expected output to compare against.
 */
export function compareOutput(actual: unknown, expectedRaw: string | null | undefined): 'pass' | 'fail' | 'ran' {
  const expectedText = (expectedRaw ?? '').trim();
  if (!expectedText) return 'ran';
  const expected = parseLiteral(expectedText);
  if (isUnparsed(expected)) {
    const actualText = typeof actual === 'string' ? actual : formatValue(actual);
    return actualText.trim() === expected.__unparsed.trim() ? 'pass' : 'fail';
  }
  if (deepEqual(actual, expected)) return 'pass';
  // "Expected: 3" vs actual "3" printed as a string by a stdout-based program.
  if (typeof actual === 'string') {
    const parsedActual = parseLiteral(actual);
    if (!isUnparsed(parsedActual) && deepEqual(parsedActual, expected)) return 'pass';
  }
  return 'fail';
}

/** Compare raw program stdout (Judge0 / custom programs) with expected output text. */
export function compareStdout(stdout: string, expectedRaw: string | null | undefined): 'pass' | 'fail' | 'ran' {
  const expectedText = (expectedRaw ?? '').trim();
  if (!expectedText) return 'ran';
  const out = stdout.replace(/\r\n/g, '\n').trim();
  if (out === expectedText) return 'pass';
  const norm = (s: string) => s.split('\n').map((l) => l.trim()).join('\n');
  if (norm(out) === norm(expectedText)) return 'pass';
  const pa = parseLiteral(out);
  const pe = parseLiteral(expectedText);
  if (!isUnparsed(pa) && !isUnparsed(pe) && deepEqual(pa, pe)) return 'pass';
  return 'fail';
}

export function formatValue(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// ---------------------------------------------------------------------------
// JavaScript signature detection
// ---------------------------------------------------------------------------

export interface JsSignature {
  name: string;
  params: string[];
  paramTypes: Record<string, string>;
  returnType: string | null;
}

const JS_FN_PATTERNS: RegExp[] = [
  /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\*?\s*[\w$]*\s*\(([^)]*)\)/g,
  /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
  /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/g,
  /(?:^|[^.\w$])function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g,
];

const HELPER_NAMES = new Set(['ListNode', 'TreeNode', 'Node']);

function parseParams(list: string): string[] {
  return list
    .split(',')
    .map((p) => p.replace(/=.*$/, '').replace(/^\.\.\./, '').trim())
    .filter(Boolean);
}

/** Find the entry function of LeetCode-style JS code, preferring the last JSDoc'd top-level function. */
export function detectJsSignature(code: string): JsSignature | { design: true } | null {
  const hasClass = /^\s*class\s+(?!ListNode\b|TreeNode\b)\w+/m.test(code);
  const found: { name: string; params: string[]; index: number }[] = [];
  for (const re of JS_FN_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
      if (!HELPER_NAMES.has(m[1])) found.push({ name: m[1], params: parseParams(m[2]), index: m.index });
    }
  }
  if (found.length === 0) return hasClass ? { design: true } : null;
  // Top-level functions only: those not nested inside braces.
  const depthAt = (idx: number) => {
    let d = 0;
    for (let i = 0; i < idx; i++) {
      if (code[i] === '{') d++;
      else if (code[i] === '}') d--;
    }
    return d;
  };
  const top = found.filter((f) => depthAt(f.index) === 0).sort((a, b) => a.index - b.index);
  // A design problem: methods attached to a constructor (`MinStack.prototype.push = function`).
  // A helper class (heap, trie, DSU) next to a plain solution function is NOT a design problem.
  const ctorNames = new Set([...code.matchAll(/([A-Za-z_$][\w$]*)\.prototype\.[A-Za-z_$][\w$]*\s*=\s*function/g)].map((m) => m[1]));
  const entries = top.filter((f) => !ctorNames.has(f.name));
  if (ctorNames.size && entries.length === 0) return { design: true };
  const candidates = entries.length ? entries : top.length ? top : found;
  // LeetCode's template puts a JSDoc @param/@return block right above the entry point; helpers
  // (gcd, dfs…) usually don't have one. Otherwise take the last top-level function.
  const docAbove = (idx: number) => /\/\*\*(?:(?!\*\/)[\s\S])*@(?:param|returns?)\b(?:(?!\*\/)[\s\S])*\*\/\s*$/.test(code.slice(0, idx));
  const pick = candidates.find((f) => docAbove(f.index)) ?? candidates[candidates.length - 1];

  // JSDoc block immediately before the function.
  const before = code.slice(0, pick.index);
  const docStart = before.lastIndexOf('/**');
  const docEnd = before.lastIndexOf('*/');
  const paramTypes: Record<string, string> = {};
  let returnType: string | null = null;
  if (docStart !== -1 && docEnd > docStart && before.slice(docEnd + 2).trim() === '') {
    const doc = before.slice(docStart, docEnd);
    const paramRe = /@param\s+\{([^}]+)\}\s+\[?([A-Za-z_$][\w$]*)/g;
    let pm: RegExpExecArray | null;
    while ((pm = paramRe.exec(doc))) paramTypes[pm[2]] = pm[1];
    const rm = /@returns?\s+\{([^}]+)\}/.exec(doc);
    if (rm) returnType = rm[1];
  }
  return { name: pick.name, params: pick.params, paramTypes, returnType };
}

/** Order provided args for a positional call: by name when all names match, else as given. */
export function orderArgs(params: string[], args: InputArg[]): { values: unknown[]; warning: string | null } {
  const names = args.map((a) => a.name);
  if (args.length && names.every((n) => n && params.includes(n))) {
    return { values: params.filter((p) => names.includes(p)).map((p) => args.find((a) => a.name === p)!.value), warning: null };
  }
  const warning =
    names.some(Boolean) && params.length
      ? `Input names (${names.filter(Boolean).join(', ')}) don't match parameters (${params.join(', ')}); passing values in order.`
      : null;
  return { values: args.map((a) => a.value), warning };
}
