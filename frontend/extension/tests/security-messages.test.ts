import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', async () => ({ browser: (await import('wxt/testing/fake-browser')).fakeBrowser }));

const { authorize, classifySender, parseMessage, validateCapture, MAX_CAPTURE_CODE } = await import('../src/lib/messages');

const EXT_ID = 'test-extension-id';
const BASE = `chrome-extension://${EXT_ID}/`;
const page = { id: EXT_ID, url: `${BASE}popup.html`, origin: `chrome-extension://${EXT_ID}` };
const optionsTab = { id: EXT_ID, url: `${BASE}options.html`, tab: { id: 7, url: `${BASE}options.html` }, frameId: 0 };
const lcContent = { id: EXT_ID, url: 'https://leetcode.com/problems/two-sum/', tab: { id: 3 }, frameId: 0 };

const capture = {
  submissionId: '1234567',
  slug: 'two-sum',
  statusMsg: 'Accepted',
  lang: 'python3',
  code: 'class Solution: pass',
  runtime: '3 ms',
  memory: '17.2 MB',
  totalCorrect: 63,
  totalTestcases: 63,
};

describe('classifySender', () => {
  it('recognises extension pages, including the options page opened in a tab', () => {
    expect(classifySender(page, EXT_ID, BASE)).toBe('extension-page');
    expect(classifySender(optionsTab, EXT_ID, BASE)).toBe('extension-page');
  });

  it('recognises our content script in the top frame of leetcode.com only', () => {
    expect(classifySender(lcContent, EXT_ID, BASE)).toBe('leetcode-content');
    expect(classifySender({ ...lcContent, frameId: 2 }, EXT_ID, BASE)).toBe('untrusted');
    expect(classifySender({ ...lcContent, tab: undefined }, EXT_ID, BASE)).toBe('untrusted');
    expect(classifySender({ ...lcContent, url: 'https://leetcode.com.evil.io/x' }, EXT_ID, BASE)).toBe('untrusted');
    expect(classifySender({ ...lcContent, url: 'http://leetcode.com/x' }, EXT_ID, BASE)).toBe('untrusted');
    expect(classifySender({ ...lcContent, url: 'https://codeforces.com/' }, EXT_ID, BASE)).toBe('untrusted');
  });

  it('rejects other extensions and spoofed origins', () => {
    expect(classifySender({ ...page, id: 'someone-else' }, EXT_ID, BASE)).toBe('untrusted');
    expect(classifySender({ ...page, origin: 'https://leetcode.com' }, EXT_ID, BASE)).toBe('untrusted');
    expect(classifySender({ id: EXT_ID }, EXT_ID, BASE)).toBe('untrusted');
  });
});

describe('authorize', () => {
  it('allows privileged messages only from extension pages', () => {
    expect(authorize({ type: 'clearData' }, page, EXT_ID, BASE)).toEqual({ type: 'clearData' });
    for (const msg of [
      { type: 'clearData' },
      { type: 'analyzeComplexity', analysisId: 'x' },
      { type: 'runAgent', id: 'contests' },
      { type: 'settingsChanged' },
      { type: 'togglePotdDone', date: '2026-11-04', key: 'leetcode:two-sum' },
      { type: 'setReminder', contestId: 'codeforces:1', on: true },
      { type: 'deleteAnalysis', analysisId: 'x' },
    ]) {
      expect(() => authorize(msg, lcContent, EXT_ID, BASE)).toThrow(/Forbidden/);
    }
  });

  it('allows captures only from the leetcode content script', () => {
    expect(authorize({ type: 'lcSubmission', payload: capture }, lcContent, EXT_ID, BASE)).toMatchObject({ type: 'lcSubmission' });
    expect(() => authorize({ type: 'lcSubmission', payload: capture }, page, EXT_ID, BASE)).toThrow(/Forbidden/);
    expect(() => authorize({ type: 'lcSubmission', payload: capture }, { ...lcContent, id: 'other' }, EXT_ID, BASE)).toThrow(/Forbidden/);
  });

  it('rejects malformed and unknown messages', () => {
    expect(() => authorize(null, page, EXT_ID, BASE)).toThrow(/Malformed/);
    expect(() => authorize({ type: 'nope' }, page, EXT_ID, BASE)).toThrow(/Unknown message type/);
    expect(() => authorize({ type: 'runAgent', id: 42 }, page, EXT_ID, BASE)).toThrow(/Malformed/);
    expect(() => authorize({ type: 'togglePotdDone', date: 'today', key: 'k' }, page, EXT_ID, BASE)).toThrow(/Malformed/);
    expect(() => authorize({ type: 'analyze', code: 42 }, page, EXT_ID, BASE)).toThrow(/Malformed/);
    expect(() => authorize({ type: 'analyzeAi', analysisId: 'x' }, page, EXT_ID, BASE)).toThrow(/Unknown message type/);
  });

  it('strips unknown fields', () => {
    expect(parseMessage({ type: 'runAgent', id: 'potd', extra: 1 })).toEqual({ type: 'runAgent', id: 'potd' });
  });
});

describe('validateCapture', () => {
  it('accepts a genuine-looking capture', () => {
    const r = validateCapture(capture);
    expect(r.ok && r.capture).toEqual(capture);
  });

  it.each([
    ['non-numeric id', { submissionId: '12a' }],
    ['id with path', { submissionId: '../1' }],
    ['slug with uppercase/specials', { slug: 'Two_Sum' }],
    ['slug with slash', { slug: 'two-sum/../x' }],
    ['unknown verdict', { statusMsg: 'Accepted!!' }],
    ['verdict wrong type', { statusMsg: 1 }],
    ['huge code', { code: 'x'.repeat(MAX_CAPTURE_CODE + 1) }],
    ['code wrong type', { code: { evil: true } }],
    ['negative counts', { totalCorrect: -1 }],
    ['fractional counts', { totalTestcases: 1.5 }],
    ['more correct than total', { totalCorrect: 10, totalTestcases: 5 }],
    ['oversized runtime', { runtime: 'x'.repeat(100) }],
  ])('rejects %s', (_label, patch) => {
    expect(validateCapture({ ...capture, ...patch }).ok).toBe(false);
  });

  it('rejects non-objects', () => {
    for (const v of [null, undefined, 'x', 1, [capture]]) expect(validateCapture(v).ok).toBe(false);
  });

  it('drops unknown languages and junk stats instead of failing', () => {
    const r = validateCapture({ ...capture, lang: 'brainfuck', runtime: '<img src=x>', memory: '12 parsecs' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.capture.lang).toBeUndefined();
      expect(r.capture.runtime).toBeUndefined();
      expect(r.capture.memory).toBeUndefined();
    }
  });
});
