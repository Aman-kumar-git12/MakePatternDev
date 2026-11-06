import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { describe, expect, it, vi } from 'vitest';
import {
  applyNewtonFailure,
  applyNewtonRead,
  extractNewtonQotd,
  NEWTON_SOURCE_URL,
  newtonKey,
  validateNewtonUrl,
} from '../src/lib/newtonQotd';
import { detectPage } from '../src/lib/platforms';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));
const { classifySender, isAllowed, parseMessage } = await import('../src/lib/messages');

/** The featured card + archive table as rendered by my.newtonschool.co (classes stripped). */
const FIXTURE = readFileSync(new URL('./fixtures/newton-qotd.html', import.meta.url), 'utf8');
const doc = (html: string) => parseHTML(html).document;

const card = (title: string, slug: string, label = 'Question of the Day') =>
  `<div><div><div>${label}</div><div title="${title}">${title}</div></div>` +
  `<div><a href="/question-of-the-day/question/${slug}"><button><div>Solve Now</div></button></a></div></div>`;

describe('extractNewtonQotd', () => {
  it('reads the featured title and its own Solve Now link from the real page markup', () => {
    const r = extractNewtonQotd(doc(FIXTURE));
    expect(r).toEqual({
      ok: true,
      value: { title: 'Clockwise Next Peak', problemUrl: 'https://my.newtonschool.co/question-of-the-day/question/clockwise-next-peak' },
    });
  });

  it('never falls back to an archive question when the featured card is missing', () => {
    const archiveOnly = FIXTURE.replace(/<section id="featured">[\s\S]*?<\/section>/, '');
    const r = extractNewtonQotd(doc(archiveOnly));
    expect(r.ok).toBe(false);
  });

  it('fails when the label or the titled name is missing', () => {
    expect(extractNewtonQotd(doc(card('A', 'a', 'Featured')))).toMatchObject({ ok: false });
    const noTitle = card('A', 'a').replace(' title="A"', '');
    expect(extractNewtonQotd(doc(noTitle))).toMatchObject({ ok: false });
    expect(extractNewtonQotd(doc('<main>Loading…</main>'))).toMatchObject({ ok: false });
  });

  it('refuses ambiguous markup (two featured cards, or a card linking to two questions)', () => {
    expect(extractNewtonQotd(doc(card('A', 'a') + card('B', 'b')))).toMatchObject({ ok: false });
    const twoLinks = card('A', 'a').replace('</div></div>', '<a href="/question-of-the-day/question/other">Other</a></div></div>');
    expect(extractNewtonQotd(doc(twoLinks))).toMatchObject({ ok: false });
  });

  it('accepts a signed-in card whose button says something other than "Solve Now"', () => {
    const signedIn = FIXTURE.replace('Solve Now', 'Continue');
    expect(extractNewtonQotd(doc(signedIn))).toEqual({
      ok: true,
      value: { title: 'Clockwise Next Peak', problemUrl: 'https://my.newtonschool.co/question-of-the-day/question/clockwise-next-peak' },
    });
    // …but still never an archive row when there is no featured card.
    const archiveOnly = signedIn.replace(/<section id="featured">[\s\S]*?<\/section>/, '');
    expect(extractNewtonQotd(doc(archiveOnly))).toMatchObject({ ok: false });
  });

  it('signed in: reads the name when the button opens your personal playground', () => {
    const signedIn = FIXTURE.replace('href="/question-of-the-day/question/clockwise-next-peak" style', 'href="/playground/code/mt1hcca2bt6x" style').replace('Solve Now', 'Continue');
    const r = extractNewtonQotd(doc(signedIn));
    expect(r).toEqual({ ok: true, value: { title: 'Clockwise Next Peak', problemUrl: 'https://my.newtonschool.co/playground/code/mt1hcca2bt6x' } });
    // Completion is keyed by the question, not by the personal playground id.
    expect(newtonKey((r as { value: { title: string; problemUrl: string } }).value)).toBe('newton:clockwise-next-peak');
  });

  it('signed in: reads the name even when the card has no link at all', () => {
    const noLink = card('Fair Load Cap', 'x').replace(/<a [^>]*>/, '<span>').replace('</a>', '</span>');
    expect(extractNewtonQotd(doc(noLink))).toEqual({ ok: true, value: { title: 'Fair Load Cap', problemUrl: null } });
  });

  it('signed in: reads a name shown as plain text, with differently worded or cased labels', () => {
    const plain = `<main><section><div><span>Today's Question of the day</span><h3>Room Rush</h3>
      <a href="/playground/code/mt1hcca2bt6x"><button>Continue</button></a><div>154 people have attempted</div></div></section>
      <table><tr><td><a href="/question-of-the-day/question/fair-load-cap"><div>Fair Load Cap</div></a></td></tr></table></main>`;
    expect(extractNewtonQotd(doc(plain))).toEqual({
      ok: true,
      value: { title: 'Room Rush', problemUrl: 'https://my.newtonschool.co/playground/code/mt1hcca2bt6x' },
    });
  });

  it('fails rather than guessing when a page heading and the card disagree on the name', () => {
    const conflicting = `<main><header><h1>Question of the Day</h1><p>Practice daily</p></header>
      <section><div><span>Question of the Day</span><h3>Room Rush</h3></div></section></main>`;
    expect(extractNewtonQotd(doc(conflicting))).toMatchObject({ ok: false });
  });

  it('explains why nothing was read', () => {
    expect(extractNewtonQotd(doc('<main>Loading…</main>'))).toEqual({ ok: false, error: expect.stringMatching(/still loading|not signed in/) });
  });

  it('never keeps a link that is not a my.newtonschool.co question or playground page', () => {
    const offsite = card('A', 'a').replace('/question-of-the-day/question/a', '/question-of-the-day/question/../../evil');
    // The name is still read (the card opens the Question of the Day page), but the bad link is dropped.
    expect(extractNewtonQotd(doc(offsite))).toEqual({ ok: true, value: { title: 'A', problemUrl: null } });
    const elsewhere = card('A', 'a').replace('/question-of-the-day/question/a', 'https://evil.example/question-of-the-day/question/a');
    expect(extractNewtonQotd(doc(elsewhere))).toEqual({ ok: true, value: { title: 'A', problemUrl: null } });
  });
});

describe('validateNewtonUrl', () => {
  it('accepts only https question pages on my.newtonschool.co', () => {
    expect(validateNewtonUrl('/question-of-the-day/question/room-rush')).toBe('https://my.newtonschool.co/question-of-the-day/question/room-rush');
    expect(validateNewtonUrl('https://my.newtonschool.co/question-of-the-day/question/room-rush?x=1#y')).toBe(
      'https://my.newtonschool.co/question-of-the-day/question/room-rush',
    );
    for (const bad of [
      'http://my.newtonschool.co/question-of-the-day/question/a',
      'https://evil.example/question-of-the-day/question/a',
      'https://my.newtonschool.co.evil.example/question-of-the-day/question/a',
      'https://my.newtonschool.co:8443/question-of-the-day/question/a',
      'https://my.newtonschool.co/question-of-the-day/',
      'https://my.newtonschool.co/course/a',
      'https://my.newtonschool.co/playground/code/',
      'javascript:alert(1)',
      '',
      42,
    ]) {
      expect(validateNewtonUrl(bad)).toBeNull();
    }
  });
});

describe('stored pair', () => {
  const A = { title: 'Clockwise Next Peak', problemUrl: 'https://my.newtonschool.co/question-of-the-day/question/clockwise-next-peak' };
  const B = { title: 'Fair Load Cap', problemUrl: 'https://my.newtonschool.co/question-of-the-day/question/fair-load-cap' };

  it('a failed refresh keeps the last good pair, marked stale', () => {
    const prev = applyNewtonRead(A, new Date('2026-11-04T10:00:00Z'));
    const after = applyNewtonFailure(prev, 'Featured card not found')!;
    expect(after).toMatchObject({ ...A, stale: true, fetchedAt: '2026-11-04T10:00:00.000Z', sourceUrl: NEWTON_SOURCE_URL });
    expect(applyNewtonFailure(null, 'x')).toBeNull(); // nothing read yet: stays unavailable
  });

  it('switching from question A to B replaces title and link together, with separate completion keys', () => {
    const a = applyNewtonRead(A, new Date('2026-11-04T10:00:00Z'));
    const b = applyNewtonRead(B, new Date('2026-11-05T10:00:00Z'));
    expect([b.title, b.problemUrl, b.stale]).toEqual([B.title, B.problemUrl, false]);
    expect(newtonKey(a)).toBe('newton:clockwise-next-peak');
    expect(newtonKey(b)).not.toBe(newtonKey(a));
  });
});

describe('messages and pages', () => {
  const ext = 'ext-id';
  const base = 'chrome-extension://ext-id/';
  const fromNewton = { id: ext, url: 'https://my.newtonschool.co/question-of-the-day', frameId: 0, tab: { id: 1 } };

  it('only the Newton School content script may report a Question of the Day', () => {
    expect(classifySender(fromNewton, ext, base)).toBe('newton-content');
    expect(isAllowed('newtonQotd', 'newton-content')).toBe(true);
    expect(isAllowed('newtonQotd', 'leetcode-content')).toBe(false);
    expect(isAllowed('newtonQotd', 'extension-page')).toBe(false);
    expect(isAllowed('runAgent', 'newton-content')).toBe(false);
  });

  it('re-validates the reported pair', () => {
    const ok = { type: 'newtonQotd', result: { ok: true, title: '  Room Rush ', problemUrl: 'https://my.newtonschool.co/question-of-the-day/question/room-rush' } };
    expect(parseMessage(ok)).toEqual({ type: 'newtonQotd', result: { ok: true, title: 'Room Rush', problemUrl: ok.result.problemUrl } });
    expect(() => parseMessage({ type: 'newtonQotd', result: { ok: true, title: 'X', problemUrl: 'https://evil.example/question-of-the-day/question/x' } })).toThrow();
    expect(() => parseMessage({ type: 'newtonQotd', result: { ok: true, title: '', problemUrl: ok.result.problemUrl } })).toThrow();
    expect(parseMessage({ type: 'newtonQotd', result: { ok: false, error: 'no card' } })).toEqual({ type: 'newtonQotd', result: { ok: false, error: 'no card' } });
  });

  it('tracks time on Newton School question pages', () => {
    expect(detectPage('https://my.newtonschool.co/question-of-the-day/question/room-rush')).toEqual({ platform: 'newton', problemKey: 'newton:room-rush' });
  });
});
