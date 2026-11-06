/**
 * Newton School "Question of the Day".
 *
 * my.newtonschool.co renders the featured question in the browser (the initial HTML is an empty
 * shell and the data comes from their /api, which robots.txt disallows for automated clients).
 * So the extension never fetches it in the background: a content script reads the card from the
 * page the user is already viewing, and the popup shows the last pair it read.
 */

export const NEWTON_ORIGIN = 'https://my.newtonschool.co';
export const NEWTON_SOURCE_URL = `${NEWTON_ORIGIN}/question-of-the-day`;
export const NEWTON_QUESTION_PATH = '/question-of-the-day/question/';
const MAX_TITLE = 200;
/** How far up from the "Solve Now" link the featured card can be (it is 2 levels today). */
const MAX_DEPTH = 8;

/** A title and (optional) link that were read from the same featured card. */
export interface NewtonQotdPair {
  title: string;
  /**
   * The card's own link, when it has one: a public question page, or (when signed in) the user's
   * personal code playground. Null when the card has no usable link. The popup always opens the
   * Question of the Day page itself.
   */
  problemUrl: string | null;
}

/** What the extension stores; `fetchedAt` is when it was read, NOT when it was published. */
export interface NewtonQotdState extends NewtonQotdPair {
  sourceUrl: string;
  fetchedAt: string;
  /** True when a later read of the page failed, so this pair may be out of date. */
  stale: boolean;
  lastError?: string;
}

export type ExtractResult = { ok: true; value: NewtonQotdPair } | { ok: false; error: string };

const PLAYGROUND_PATH = '/playground/code/';

/**
 * Returns the canonical URL if `raw` (absolute or site-relative) is an https link on
 * my.newtonschool.co to a question page or a code playground; otherwise null. Query strings and
 * fragments are dropped.
 */
export function validateNewtonUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 500) return null;
  let u: URL;
  try {
    u = new URL(raw.trim(), NEWTON_ORIGIN);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.hostname !== 'my.newtonschool.co' || u.username || u.password || u.port) return null;
  for (const base of [NEWTON_QUESTION_PATH, PLAYGROUND_PATH]) {
    if (!u.pathname.startsWith(base)) continue;
    const id = u.pathname.slice(base.length).replace(/\/+$/, '');
    return /^[A-Za-z0-9][A-Za-z0-9_-]{0,150}$/.test(id) ? `${NEWTON_ORIGIN}${base}${id}` : null;
  }
  return null;
}

/**
 * Stable id for completion tracking: the public question slug when there is one, otherwise the
 * question name (playground links are personal, so they aren't used as ids).
 */
export function newtonKey(pair: Pick<NewtonQotdPair, 'title' | 'problemUrl'>): string {
  if (pair.problemUrl?.startsWith(`${NEWTON_ORIGIN}${NEWTON_QUESTION_PATH}`)) {
    return `newton:${pair.problemUrl.slice(pair.problemUrl.lastIndexOf('/') + 1).toLowerCase()}`;
  }
  const slug = pair.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `newton:${slug || 'question'}`;
}

export function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  return t && t.length <= MAX_TITLE ? t : null;
}

/** Links that can belong to a featured card: question pages and code playgrounds. */
const cardLinks = (root: ParentNode) =>
  Array.from(root.querySelectorAll('a[href]')).filter((a) => validateNewtonUrl(a.getAttribute('href')) !== null);

/** The card's label: "Question of the Day" in any case, possibly with a short prefix like "Today's". */
const isLabel = (n: Element) => {
  if (n.children.length !== 0) return false;
  const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= 40 && /question of the day/i.test(t);
};

/** True when `el` contains an element whose own text is exactly the "Question of the Day" label. */
function hasLabel(el: Element): boolean {
  return Array.from(el.querySelectorAll('*')).some(isLabel);
}

const titledDivs = (el: Element) => Array.from(el.querySelectorAll('div[title]')).filter((d) => (d.getAttribute('title') ?? '').trim());

/** Text that is a button, counter or status rather than a question name. */
const NOT_A_NAME = /^(solve now|continue|solved|attempted|view|start|resume|retry|submit|question of the day)\b|people have attempted|^\d[\d,./: %-]*$/i;

/**
 * The question name inside `card`: the titled div the site uses today, or else the first short
 * piece of text after the label that isn't a button, counter or status.
 */
function nameElements(card: Element): Element[] {
  const titled = titledDivs(card);
  if (titled.length) return titled;
  const all = Array.from(card.querySelectorAll('*'));
  const labelAt = all.findIndex(isLabel);
  if (labelAt < 0) return [];
  const next = all.slice(labelAt + 1).find((n) => {
    if (n.children.length !== 0 || n.closest('a,button')) return false;
    const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
    return t.length >= 3 && t.length <= MAX_TITLE && !NOT_A_NAME.test(t);
  });
  return next ? [next] : [];
}

const nameOf = (el: Element) => cleanTitle(el.getAttribute('title') || el.textContent);

const distinctLinks = (el: Element) => new Set(cardLinks(el).map((a) => validateNewtonUrl(a.getAttribute('href')))).size;

/**
 * The featured card around `start`: first the nearest ancestor holding both the label and a
 * titled name, then widened while the box still holds exactly one name and at most one
 * question/playground link (so it takes in the card's button but never the archive list).
 */
function cardAround(start: Element): Element | null {
  let el: Element | null = start;
  let depth = 0;
  for (; el && depth < MAX_DEPTH; depth++, el = el.parentElement) {
    if (hasLabel(el) && nameElements(el).length) break;
  }
  if (!el || depth >= MAX_DEPTH) return null;
  let card: Element = el;
  for (let up = card.parentElement; up && depth < MAX_DEPTH; depth++, up = up.parentElement) {
    if (nameElements(up).length !== 1 || nameOf(nameElements(up)[0]!) !== nameOf(nameElements(card)[0]!) || distinctLinks(up) > 1) break;
    card = up;
  }
  return card;
}

/**
 * Reads the featured question from a rendered Question-of-the-Day page. It never relies on
 * generated class names, and it fails rather than guessing when the card can't be identified
 * unambiguously (so an archive question is never shown as the featured one).
 *
 * Signed out, the card's button is a "Solve Now" link to the public question page. Signed in,
 * it may point to the user's own code playground, say something else, or have no link at all,
 * so the card is found from its "Question of the Day" label and its titled question name.
 */
export function extractNewtonQotd(root: ParentNode): ExtractResult {
  const solve = cardLinks(root).filter((a) => (a.textContent ?? '').includes('Solve Now'));
  if (solve.length > 1) return { ok: false, error: 'More than one "Solve Now" link; the featured card is ambiguous' };
  if (solve.length === 1) {
    const card = cardAround(solve[0]!.parentElement ?? solve[0]!);
    if (card) return readCard(card);
  }

  const labels = Array.from(root.querySelectorAll('*')).filter(isLabel);
  if (!labels.length) return { ok: false, error: 'No "Question of the Day" card on the page yet (still loading, or not signed in?)' };
  const cards = [...new Set(labels.map((l) => cardAround(l)).filter((c): c is Element => !!c))];
  // A name the site marks with a title attribute beats a plain-text guess (e.g. near a page heading).
  const marked = cards.filter((c) => titledDivs(c).length > 0);
  const read = (marked.length ? marked : cards).map(readCard).filter((r): r is { ok: true; value: NewtonQotdPair } => r.ok);
  const byTitle = [...new Map(read.map((r) => [r.value.title, r])).values()];
  if (byTitle.length === 1) return byTitle[0]!;
  if (byTitle.length > 1) return { ok: false, error: 'Several possible featured questions; the page layout changed' };
  return { ok: false, error: 'Couldn’t find the featured question name (the page layout may have changed)' };
}

/** Reads one featured card: exactly one titled name, and at most one question/playground link. */
function readCard(card: Element): ExtractResult {
  const names = nameElements(card);
  if (names.length !== 1) return { ok: false, error: 'The featured card has no single question name' };
  const title = nameOf(names[0]!);
  if (!title) return { ok: false, error: 'The featured question has no usable title' };
  // Title and link must belong to this one card: a container with several question links is
  // not a card (it is the archive list, or the whole page).
  const links = [...new Set(cardLinks(card).map((a) => validateNewtonUrl(a.getAttribute('href'))!))];
  if (links.length > 1) return { ok: false, error: 'The featured card links to more than one question' };
  return { ok: true, value: { title, problemUrl: links[0] ?? null } };
}

/** Applies a successful read: title and link are always replaced together. */
export function applyNewtonRead(pair: NewtonQotdPair, now: Date = new Date()): NewtonQotdState {
  return { title: pair.title, problemUrl: pair.problemUrl, sourceUrl: NEWTON_SOURCE_URL, fetchedAt: now.toISOString(), stale: false };
}

/** Why the most recent read failed (shown while nothing has been read successfully). */
export interface NewtonQotdError {
  error: string;
  at: string;
}

/** Applies a failed read: keeps the last good pair (marked stale), or stays empty. */
export function applyNewtonFailure(prev: NewtonQotdState | null, error: string): NewtonQotdState | null {
  return prev ? { ...prev, stale: true, lastError: error.slice(0, 200) } : null;
}
