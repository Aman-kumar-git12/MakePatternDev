import { describe, expect, it } from 'vitest';
import { MAX_CAPTURE_AGE_MS, verifyLeetCodeCapture, type VerifyDeps } from '../src/lib/leetcodeVerify';
import type { LeetCodeCapture } from '../src/lib/messages';

const NOW = 1_800_000_000_000;
const capture: LeetCodeCapture = { submissionId: '1234567', slug: 'two-sum', statusMsg: 'Accepted', lang: 'python3', code: 'forged code' };

const details = (over: Record<string, unknown> = {}) => ({
  submissionDetails: {
    statusCode: 10,
    timestamp: NOW / 1000 - 5,
    code: 'real code',
    lang: { name: 'python3' },
    question: { titleSlug: 'two-sum' },
    ...over,
  },
});

const offline = async () => {
  throw new Error('offline');
};

function deps(graphql: () => Promise<unknown>, fetchJson: () => Promise<unknown> = offline): Partial<VerifyDeps> {
  return { graphql: graphql as VerifyDeps['graphql'], fetchJson: fetchJson as VerifyDeps['fetchJson'], now: () => NOW };
}

describe('verifyLeetCodeCapture', () => {
  it('verifies against submissionDetails and prefers LeetCode’s code', async () => {
    const v = await verifyLeetCodeCapture(capture, deps(async () => details()));
    expect(v.status).toBe('verified');
    if (v.status === 'verified') expect(v.capture.code).toBe('real code');
  });

  it('rejects a capture for another problem', async () => {
    const v = await verifyLeetCodeCapture(capture, deps(async () => details({ question: { titleSlug: 'three-sum' } })));
    expect(v).toMatchObject({ status: 'rejected' });
  });

  it('rejects a forged verdict', async () => {
    const v = await verifyLeetCodeCapture(capture, deps(async () => details({ statusCode: 11 })));
    expect(v).toMatchObject({ status: 'rejected', reason: expect.stringMatching(/Verdict/) });
  });

  it('rejects a replayed old submission', async () => {
    const old = NOW / 1000 - MAX_CAPTURE_AGE_MS / 1000 - 60;
    const v = await verifyLeetCodeCapture(capture, deps(async () => details({ timestamp: old })));
    expect(v).toMatchObject({ status: 'rejected', reason: expect.stringMatching(/recent/) });
  });

  it('falls back to the recent-submissions list when GraphQL fails', async () => {
    const list = async () => ({
      submissions_dump: [{ id: 1234567, title_slug: 'two-sum', status_display: 'Accepted', lang: 'python3', code: 'listed code', timestamp: NOW / 1000 }],
    });
    const v = await verifyLeetCodeCapture(capture, deps(offline, list));
    expect(v.status).toBe('verified');
    if (v.status === 'verified') expect(v.capture.code).toBe('listed code');
  });

  it('rejects an id that is not among the user’s recent submissions', async () => {
    const list = async () => ({ submissions_dump: [{ id: 1, title_slug: 'two-sum', status_display: 'Accepted', timestamp: NOW / 1000 }] });
    const v = await verifyLeetCodeCapture(capture, deps(async () => ({ submissionDetails: null }), list));
    expect(v).toMatchObject({ status: 'rejected' });
  });

  it('accepts but flags unverified when LeetCode cannot be reached', async () => {
    const v = await verifyLeetCodeCapture(capture, deps(offline, offline));
    expect(v).toEqual({ status: 'unverified', capture });
  });

  it('treats a logged-out list response as inconclusive', async () => {
    const v = await verifyLeetCodeCapture(capture, deps(offline, async () => ({ detail: 'login required' })));
    expect(v.status).toBe('unverified');
  });
});
