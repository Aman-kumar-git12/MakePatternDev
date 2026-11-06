import { describe, expect, it } from 'vitest';
import { backspace, closeBracket, detectIndent, indent, newline, type Edit, type EditorState } from '../src/lib/codeEditing';

/** `|` marks the cursor; `[` … `]` marks a selection. */
function state(marked: string): EditorState {
  if (marked.includes('|')) {
    const i = marked.indexOf('|');
    return { value: marked.replace('|', ''), start: i, end: i };
  }
  const a = marked.indexOf('[');
  const b = marked.indexOf(']') - 1;
  return { value: marked.replace('[', '').replace(']', ''), start: a, end: b };
}

function run(s: EditorState, edit: Edit | null): string {
  if (!edit) return 'unchanged';
  const value = s.value.slice(0, edit.from) + edit.text + s.value.slice(edit.to);
  if (edit.selStart === edit.selEnd) return value.slice(0, edit.selStart) + '|' + value.slice(edit.selStart);
  return value.slice(0, edit.selStart) + '[' + value.slice(edit.selStart, edit.selEnd) + ']' + value.slice(edit.selEnd);
}

describe('detectIndent', () => {
  it('finds 2 spaces, 4 spaces or tabs', () => {
    expect(detectIndent('int f() {\n  if (x) {\n    y();\n  }\n}')).toBe('  ');
    expect(detectIndent('def f():\n    if x:\n        y()\n')).toBe('    ');
    expect(detectIndent('func f() {\n\tif x {\n\t\ty()\n\t}\n}')).toBe('\t');
    expect(detectIndent('')).toBe('    ');
  });
});

describe('indent (Tab / Shift+Tab)', () => {
  it('inserts one indent at the cursor', () => {
    const s = state('a|b');
    expect(run(s, indent(s, '    ', false))).toBe('a    |b');
  });

  it('indents and outdents every selected line', () => {
    const s = state('[x = 1\ny = 2]');
    expect(run(s, indent(s, '  ', false))).toBe('  [x = 1\n  y = 2]');
    const back = state('  [x = 1\n  y = 2]');
    expect(run(back, indent(back, '  ', true))).toBe('[x = 1\ny = 2]');
  });

  it('leaves blank lines alone when indenting a block', () => {
    const s = state('[a\n\nb]');
    expect(run(s, indent(s, '  ', false))).toBe('  [a\n\n  b]');
  });

  it('outdents the current line with Shift+Tab and never past column 0', () => {
    const s = state('    ret|urn x');
    expect(run(s, indent(s, '    ', true))).toBe('ret|urn x');
    const flat = state('ret|urn');
    expect(run(flat, indent(flat, '    ', true))).toBe('ret|urn');
    const tab = state('\t\tx|');
    expect(run(tab, indent(tab, '\t', true))).toBe('\tx|');
  });
});

describe('newline (Enter)', () => {
  it('keeps the current indent', () => {
    const s = state('    x = 1|');
    expect(run(s, newline(s, '    '))).toBe('    x = 1\n    |');
  });

  it('indents one more level after an opener or a colon', () => {
    const c = state('if (x) {|');
    expect(run(c, newline(c, '  '))).toBe('if (x) {\n  |');
    const py = state('for i in range(n):|');
    expect(run(py, newline(py, '    '))).toBe('for i in range(n):\n    |');
  });

  it('splits a bracket pair over three lines', () => {
    const s = state('  void f() {|}');
    expect(run(s, newline(s, '  '))).toBe('  void f() {\n    |\n  }');
  });
});

describe('closeBracket', () => {
  it('dedents a closer typed on a blank indented line', () => {
    const s = state('if (x) {\n    y();\n    |');
    expect(run(s, closeBracket(s, '}', '    '))).toBe('if (x) {\n    y();\n}|');
  });

  it('does nothing mid-line or for other characters', () => {
    const s = state('  a|');
    expect(closeBracket(s, '}', '  ')).toBeNull();
    const blank = state('    |');
    expect(closeBracket(blank, 'x', '  ')).toBeNull();
  });
});

describe('backspace', () => {
  it('removes a whole indent level inside leading spaces', () => {
    const s = state('        |x');
    expect(run(s, backspace(s, '    '))).toBe('    |x');
    const odd = state('      |');
    expect(run(odd, backspace(odd, '    '))).toBe('    |');
  });

  it('behaves normally elsewhere', () => {
    expect(backspace(state('  a|'), '  ')).toBeNull();
    expect(backspace(state(' |'), '  ')).toBeNull();
    expect(backspace(state('\t|'), '\t')).toBeNull();
  });
});
