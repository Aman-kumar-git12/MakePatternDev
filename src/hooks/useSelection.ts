import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Multi-select over an ordered list of visible ids: click toggles, shift-click selects the range
 * from the last clicked item, "select all" covers the visible ids. Ids that disappear from the
 * list (filtered out or deleted) are dropped from the selection automatically.
 */
export function useSelection(visibleIds: string[]) {
  const [raw, setRaw] = useState<Set<string>>(() => new Set());
  const anchorRef = useRef<string | null>(null);

  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);
  const selected = useMemo(() => {
    const out = new Set<string>();
    raw.forEach((id) => {
      if (visibleSet.has(id)) out.add(id);
    });
    return out;
  }, [raw, visibleSet]);

  const toggle = useCallback(
    (id: string, shiftKey = false) => {
      setRaw((prev) => {
        const next = new Set(prev);
        const anchor = anchorRef.current;
        if (shiftKey && anchor && anchor !== id) {
          const a = visibleIds.indexOf(anchor);
          const b = visibleIds.indexOf(id);
          if (a !== -1 && b !== -1) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            // Range takes the anchor's state (select or deselect the whole span).
            const selectRange = prev.has(anchor);
            for (let i = lo; i <= hi; i++) {
              if (selectRange) next.add(visibleIds[i]);
              else next.delete(visibleIds[i]);
            }
            return next;
          }
        }
        if (next.has(id)) next.delete(id);
        else next.add(id);
        anchorRef.current = id;
        return next;
      });
    },
    [visibleIds]
  );

  const allSelected = visibleIds.length > 0 && selected.size === visibleIds.length;

  const toggleAll = useCallback(() => {
    setRaw(allSelected ? new Set() : new Set(visibleIds));
    anchorRef.current = null;
  }, [allSelected, visibleIds]);

  const clear = useCallback(() => {
    setRaw(new Set());
    anchorRef.current = null;
  }, []);

  return {
    selected,
    selectedIds: useMemo(() => visibleIds.filter((id) => selected.has(id)), [visibleIds, selected]),
    count: selected.size,
    isSelected: (id: string) => selected.has(id),
    toggle,
    toggleAll,
    allSelected,
    someSelected: selected.size > 0 && !allSelected,
    clear,
  };
}
