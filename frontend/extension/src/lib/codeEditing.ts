/**
 * Indentation-aware editing for the code box. Every function takes the current text and
 * selection and returns one replacement (`from`..`to` becomes `text`) plus the new selection,
 * or null when the key should behave normally. Pure, so it can be tested without a DOM.
 */

export interface EditorState {
  value: string;
  start: number;
  end: number;
}

export interface Edit {
  from: number;
  to: number;
  text: string;
  selStart: number;
  selEnd: number;
}

const OPENERS: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
const CLOSERS = new Set(['}', ')', ']']);

const lineStart = (v: string, i: number) => v.lastIndexOf('\n', i - 1) + 1;
const lineEnd = (v: string, i: number) => {
  const e = v.indexOf('\n', i);
  return e === -1 ? v.length : e;
};
const leading = (line: string) => /^[ \t]*/.exec(line)![0];

/** The indent unit used by the code: a tab, or the smallest common run of leading spaces (2 or 4). */
export function detectIndent(value: string): string {
  let tabs = 0;
  let spaced = 0;
  const widths = new Map<number, number>();
  let prev = 0;
  for (const line of value.split('\n')) {
    if (!line.trim()) continue;
    const ws = leading(line);
    if (ws.startsWith('\t')) {
      tabs++;
      continue;
    }
    const n = ws.length;
    if (n > 0) spaced++;
    const diff = Math.abs(n - prev);
    if (diff === 2 || diff === 4) widths.set(diff, (widths.get(diff) ?? 0) + 1);
    prev = n;
  }
  if (tabs > spaced) return '\t';
  return (widths.get(2) ?? 0) > (widths.get(4) ?? 0) ? '  ' : '    ';
}

/** Tab / Shift+Tab: indent or outdent the selected lines (or insert one indent at the cursor). */
export function indent(s: EditorState, unit: string, outdent: boolean): Edit {
  const { value, start, end } = s;
  const multiLine = value.slice(start, end).includes('\n');
  if (!outdent && !multiLine) {
    return { from: start, to: end, text: unit, selStart: start + unit.length, selEnd: start + unit.length };
  }
  const from = lineStart(value, start);
  // A selection ending at the very start of a line doesn't include that line.
  const lastChar = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const to = lineEnd(value, lastChar);
  const lines = value.slice(from, to).split('\n');
  let firstDelta = 0;
  let total = 0;
  const out = lines.map((line, i) => {
    let next: string;
    if (outdent) {
      const ws = leading(line);
      const remove = ws.startsWith('\t') ? 1 : Math.min(ws.length, unit === '\t' ? 4 : unit.length);
      next = line.slice(remove);
    } else {
      next = line.trim() || lines.length === 1 ? unit + line : line; // don't indent blank lines in a block
    }
    const delta = next.length - line.length;
    if (i === 0) firstDelta = delta;
    total += delta;
    return next;
  });
  const text = out.join('\n');
  const selStart = Math.max(from, start + firstDelta);
  const selEnd = multiLine ? end + total : Math.max(from, end + firstDelta);
  return { from, to, text, selStart, selEnd };
}

/** Enter: keep the current indent; add one level after an opener or `:`; split `{|}` over three lines. */
export function newline(s: EditorState, unit: string): Edit {
  const { value, start, end } = s;
  const ls = lineStart(value, start);
  const before = value.slice(ls, start);
  const ws = leading(before);
  const lastChar = before.trimEnd().slice(-1);
  const opens = lastChar in OPENERS || (lastChar === ':' && !before.trimStart().startsWith('//'));
  const inner = opens ? ws + unit : ws;
  const nextChar = value.slice(end, lineEnd(value, end)).trimStart()[0];
  if (nextChar && lastChar in OPENERS && nextChar === OPENERS[lastChar]) {
    // Skip spaces between the cursor and the closer so they don't end up on the inner line.
    const closer = value.indexOf(nextChar, end);
    const text = `\n${inner}\n${ws}`;
    const caret = start + 1 + inner.length;
    return { from: start, to: closer, text, selStart: caret, selEnd: caret };
  }
  const text = `\n${inner}`;
  return { from: start, to: end, text, selStart: start + text.length, selEnd: start + text.length };
}

/** Typing a closer on a whitespace-only line: drop one indent level first. */
export function closeBracket(s: EditorState, ch: string, unit: string): Edit | null {
  if (!CLOSERS.has(ch) || s.start !== s.end) return null;
  const ls = lineStart(s.value, s.start);
  const before = s.value.slice(ls, s.start);
  if (!before || before.trim()) return null;
  const remove = before.endsWith('\t') ? 1 : Math.min(before.length, unit === '\t' ? 4 : unit.length);
  const from = s.start - remove;
  return { from, to: s.start, text: ch, selStart: from + 1, selEnd: from + 1 };
}

/** Backspace inside leading spaces: delete back to the previous indent stop. */
export function backspace(s: EditorState, unit: string): Edit | null {
  if (s.start !== s.end || unit === '\t') return null;
  const ls = lineStart(s.value, s.start);
  const before = s.value.slice(ls, s.start);
  if (before.length < 2 || /[^ ]/.test(before)) return null;
  const size = unit.length;
  const remove = before.length % size || size;
  const from = s.start - remove;
  return { from, to: s.start, text: '', selStart: from, selEnd: from };
}
