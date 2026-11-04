import { Check, ChevronDown, Layers } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { PLATFORMS } from '../lib/platforms';
import type { PlatformId } from '../lib/types';
import { cx, PlatformIcon } from './ui';

export type PlatformChoice = PlatformId | 'all';

export interface PlatformOption {
  id: PlatformChoice;
  /** Small right-aligned hint, e.g. "12 solved · 3h". */
  hint?: string;
}

/**
 * Dropdown with platform icons: "All platforms" or one connected platform.
 * WAI-ARIA select-only combobox pattern: the listbox keeps DOM focus and marks the
 * highlighted option with aria-activedescendant; options are plain role="option" items.
 */
export function PlatformSelect({
  value,
  options,
  onChange,
}: {
  value: PlatformChoice;
  options: PlatformOption[];
  onChange: (v: PlatformChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const optionId = (i: number) => `${baseId}-opt-${i}`;
  const count = options.length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${baseId}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, baseId]);

  const openList = (at?: number) => {
    if (!count) return;
    const current = Math.max(0, options.findIndex((o) => o.id === value));
    setActive(at ?? current);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const choose = (i: number) => {
    const o = options[i];
    if (o) onChange(o.id);
    close(true);
  };

  const onTriggerKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openList();
    } else if (e.key === 'Home') {
      e.preventDefault();
      openList(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      openList(count - 1);
    }
  };

  const onListKey = (e: KeyboardEvent) => {
    if (!count) {
      if (e.key === 'Escape') close(true);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => (i - 1 + count) % count);
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(count - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Escape':
        e.preventDefault();
        close(true);
        break;
      case 'Tab':
        // Let focus move on naturally; the list closes on blur.
        setOpen(false);
        break;
    }
  };

  const label = (id: PlatformChoice) => (id === 'all' ? 'All platforms' : PLATFORMS[id].name);
  const icon = (id: PlatformChoice, size: number) =>
    id === 'all' ? (
      <span className="brand-gradient flex shrink-0 items-center justify-center rounded-full text-white" style={{ width: size, height: size }} aria-hidden>
        <Layers size={size * 0.55} />
      </span>
    ) : (
      <PlatformIcon platform={id} size={size} />
    );

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-list` : undefined}
        aria-label={`Showing stats for ${label(value)}. Change platform`}
        className="card flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition hover:brightness-[0.98]"
      >
        {icon(value, 26)}
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold text-ink-3">Showing stats for</span>
          <span className="block truncate text-[13.5px] leading-tight font-extrabold">{label(value)}</span>
        </span>
        <ChevronDown size={16} className={cx('text-ink-3 transition', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <ul
          ref={list}
          id={`${baseId}-list`}
          role="listbox"
          aria-label="Platforms"
          tabIndex={-1}
          aria-activedescendant={count ? optionId(active) : undefined}
          onKeyDown={onListKey}
          onBlur={(e) => {
            if (!root.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
          }}
          className="card absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto p-1 outline-none"
        >
          {options.map((o, i) => {
            const selected = o.id === value;
            return (
              <li
                key={o.id}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                data-active={i === active}
                onClick={() => choose(i)}
                onMouseEnter={() => setActive(i)}
                className={cx('flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left', i === active ? 'bg-surface-2' : '')}
              >
                {icon(o.id, 22)}
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{label(o.id)}</span>
                {o.hint && <span className="tabular shrink-0 text-[10.5px] text-ink-3">{o.hint}</span>}
                <Check size={14} className={cx('shrink-0 text-accent', !selected && 'invisible')} aria-hidden />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
