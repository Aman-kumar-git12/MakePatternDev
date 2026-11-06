import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { backspace, closeBracket, detectIndent, indent, newline, type Edit } from '../lib/codeEditing';
import { cx } from './ui';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}

/**
 * A lightweight code box: line numbers, Tab / Shift+Tab indenting, auto-indent on Enter and
 * smart dedent for closing brackets. Edits go through the browser's undo stack, so Ctrl/Cmd+Z
 * works. Esc then Tab moves focus out of the editor (Tab is otherwise used for indenting).
 */
export function CodeEditor({ value, onChange, placeholder, ariaLabel, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const [tabMovesFocus, setTabMovesFocus] = useState(false);
  const unit = useMemo(() => detectIndent(value), [value]);
  const lines = Math.max(1, value.split('\n').length);

  const apply = (edit: Edit) => {
    const ta = ref.current!;
    ta.setSelectionRange(edit.from, edit.to);
    // execCommand keeps the edit in the undo history; fall back when it's unavailable.
    const ok = edit.text
      ? document.execCommand('insertText', false, edit.text)
      : document.execCommand('delete', false);
    if (!ok) {
      ta.setRangeText(edit.text, edit.from, edit.to, 'end');
      onChange(ta.value);
    }
    ta.setSelectionRange(edit.selStart, edit.selEnd);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      setTabMovesFocus(true);
      return;
    }
    const ta = e.currentTarget;
    const state = { value: ta.value, start: ta.selectionStart, end: ta.selectionEnd };
    let edit: Edit | null = null;
    if (e.key === 'Tab') {
      if (tabMovesFocus) return; // let the browser move focus
      edit = indent(state, unit, e.shiftKey);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      edit = newline(state, unit);
    } else if (e.key === 'Backspace') {
      edit = backspace(state, unit);
    } else if (e.key.length === 1) {
      edit = closeBracket(state, e.key, unit);
    }
    if (tabMovesFocus) setTabMovesFocus(false);
    if (!edit) return;
    e.preventDefault();
    apply(edit);
  };

  return (
    <div className={cx('relative flex overflow-hidden bg-surface-2 focus-within:bg-card', className)}>
      <div
        aria-hidden
        className="pointer-events-none w-8 shrink-0 select-none overflow-hidden border-r border-line py-3 pr-1.5 text-right font-mono text-[11px] leading-relaxed text-ink-3"
      >
        <div ref={gutter}>
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setTabMovesFocus(false)}
        onScroll={(e) => {
          if (gutter.current) gutter.current.style.transform = `translateY(${-e.currentTarget.scrollTop}px)`;
        }}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        aria-label={ariaLabel}
        aria-describedby="code-editor-help"
        className="scroll-thin block min-w-0 flex-1 resize-none bg-transparent p-3 pl-2 font-mono text-[11px] leading-relaxed outline-none placeholder:text-ink-3"
        style={{ tabSize: 4 }}
      />
      <span id="code-editor-help" className="sr-only">
        Tab indents and Shift+Tab outdents. Press Escape, then Tab, to move focus out of the editor.
      </span>
    </div>
  );
}
