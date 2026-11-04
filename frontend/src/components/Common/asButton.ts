import type { KeyboardEvent } from 'react';

/**
 * Props that make a clickable non-button element (a row or tab rendered as a <div>) usable
 * from the keyboard: focusable, announced as a button, activated with Enter or Space.
 */
export function asButton(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return; // keys inside nested controls aren't ours
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
