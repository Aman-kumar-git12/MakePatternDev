/**
 * j/k list navigation. Any element rendered inside <main> with `data-nav-id="<question id>"`
 * becomes navigable; views only need to add that attribute to their rows.
 */

let selectedId: string | null = null;

function navItems(): HTMLElement[] {
  const all = Array.from(document.querySelectorAll<HTMLElement>('main [data-nav-id]'));
  // Only rows that are actually visible (collapsed folders / hidden tabs are skipped).
  return all.filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
}

function paint(): void {
  document.querySelectorAll('[data-nav-selected]').forEach((el) => el.removeAttribute('data-nav-selected'));
  if (!selectedId) return;
  const el = navItems().find((e) => e.dataset.navId === selectedId);
  if (!el) {
    selectedId = null;
    return;
  }
  el.setAttribute('data-nav-selected', 'true');
  el.scrollIntoView({ block: 'nearest', behavior: document.documentElement.classList.contains('mp-reduce-motion') ? 'auto' : 'smooth' });
}

/** Move the selection by +1 (j) / -1 (k). Returns the newly selected id. */
export function moveNavSelection(delta: 1 | -1): string | null {
  const items = navItems();
  if (items.length === 0) {
    selectedId = null;
    return null;
  }
  const idx = items.findIndex((e) => e.dataset.navId === selectedId);
  let next: number;
  if (idx === -1) next = delta === 1 ? 0 : items.length - 1;
  else next = Math.min(items.length - 1, Math.max(0, idx + delta));
  selectedId = items[next].dataset.navId ?? null;
  paint();
  return selectedId;
}

export function getNavSelection(): string | null {
  if (selectedId && !navItems().some((e) => e.dataset.navId === selectedId)) selectedId = null;
  return selectedId;
}

export function clearNavSelection(): void {
  selectedId = null;
  paint();
}
