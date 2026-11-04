import { fetchJson, leetcodeGraphql } from './http';
import type { LeetCodeCapture } from './messages';

/**
 * Cross-checks a live capture from the leetcode.com page against LeetCode's own record of
 * the submission, read with the user's logged-in session. The page (and anything running
 * in it) is untrusted; LeetCode's API is the source of truth.
 *
 * - `verified`: LeetCode has this submission for this problem with this verdict. Server-side
 *   fields (verdict, language, code) replace the page-supplied ones.
 * - `rejected`: LeetCode positively disagrees (other problem, other verdict, an old
 *   submission being replayed, or not among the user's recent submissions).
 * - `unverified`: LeetCode could not be asked (offline, logged out, API changed). The
 *   capture is kept but flagged so the UI can show it as unconfirmed.
 */
export type Verification =
  | { status: 'verified'; capture: LeetCodeCapture }
  | { status: 'unverified'; capture: LeetCodeCapture }
  | { status: 'rejected'; reason: string };

/** `statusCode` values of `submissionDetails`, as shown by LeetCode. */
const STATUS_BY_CODE: Record<number, string> = {
  10: 'Accepted',
  11: 'Wrong Answer',
  12: 'Memory Limit Exceeded',
  13: 'Output Limit Exceeded',
  14: 'Time Limit Exceeded',
  15: 'Runtime Error',
  16: 'Internal Error',
  20: 'Compile Error',
  30: 'Timeout',
};

/** A just-judged submission must be this recent (guards against replaying old ids). */
export const MAX_CAPTURE_AGE_MS = 60 * 60_000;

interface ServerRecord {
  slug: string;
  statusMsg?: string;
  lang?: string;
  code?: string;
  /** Epoch ms. */
  ts?: number;
}

export interface VerifyDeps {
  graphql: typeof leetcodeGraphql;
  fetchJson: typeof fetchJson;
  now: () => number;
}

const defaultDeps: VerifyDeps = { graphql: leetcodeGraphql, fetchJson, now: Date.now };

const QUERY = `query cjSubmission($id: Int!) {
  submissionDetails(submissionId: $id) { statusCode timestamp code lang { name } question { titleSlug } }
}`;

async function fromGraphql(id: string, deps: VerifyDeps): Promise<ServerRecord | null> {
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n > 2 ** 31 - 1) return null; // GraphQL Int is 32-bit
  try {
    const data = await deps.graphql<{
      submissionDetails: {
        statusCode?: number;
        timestamp?: number | string;
        code?: string;
        lang?: { name?: string } | null;
        question?: { titleSlug?: string } | null;
      } | null;
    }>(QUERY, { id: n }, { cookies: true, timeoutMs: 10_000 });
    const d = data.submissionDetails;
    if (!d?.question?.titleSlug) return null;
    return {
      slug: d.question.titleSlug,
      statusMsg: d.statusCode != null ? STATUS_BY_CODE[d.statusCode] : undefined,
      lang: d.lang?.name || undefined,
      code: typeof d.code === 'string' ? d.code : undefined,
      ts: d.timestamp != null ? Number(d.timestamp) * 1000 : undefined,
    };
  } catch {
    return null;
  }
}

/** The user's most recent submissions (same endpoint the submission agent syncs from). */
async function fromRecent(id: string, deps: VerifyDeps): Promise<ServerRecord | 'absent' | null> {
  let res: { submissions_dump?: { id: number | string; title_slug?: string; status_display?: string; lang?: string; code?: string; timestamp?: number | string }[] };
  try {
    res = await deps.fetchJson('https://leetcode.com/api/submissions/?offset=0&limit=20&lastkey=', { cookies: true, timeoutMs: 10_000 });
  } catch {
    return null; // network error, 401/403 (logged out), timeout
  }
  if (!Array.isArray(res?.submissions_dump)) return null; // logged out / API changed
  const item = res.submissions_dump.find((s) => String(s.id) === id);
  if (!item) return 'absent';
  if (!item.title_slug) return null;
  return {
    slug: item.title_slug,
    statusMsg: item.status_display,
    lang: item.lang,
    code: item.code,
    ts: item.timestamp != null ? Number(item.timestamp) * 1000 : undefined,
  };
}

export async function verifyLeetCodeCapture(c: LeetCodeCapture, deps: Partial<VerifyDeps> = {}): Promise<Verification> {
  const d = { ...defaultDeps, ...deps };
  const record = (await fromGraphql(c.submissionId, d)) ?? (await fromRecent(c.submissionId, d));
  if (record === null) return { status: 'unverified', capture: c };
  if (record === 'absent') return { status: 'rejected', reason: 'Submission not found in your recent LeetCode submissions' };
  if (record.slug.toLowerCase() !== c.slug) return { status: 'rejected', reason: 'Submission belongs to a different problem' };
  if (record.statusMsg && record.statusMsg !== c.statusMsg) return { status: 'rejected', reason: 'Verdict does not match LeetCode' };
  if (record.ts !== undefined && Number.isFinite(record.ts) && Math.abs(d.now() - record.ts) > MAX_CAPTURE_AGE_MS) {
    return { status: 'rejected', reason: 'Submission is not recent (replayed capture?)' };
  }
  return {
    status: 'verified',
    capture: {
      ...c,
      statusMsg: record.statusMsg ?? c.statusMsg,
      lang: record.lang ?? c.lang,
      // Prefer LeetCode's copy of the code: the page-supplied one is untrusted.
      code: record.code ? record.code.slice(0, 50_000) : c.code,
    },
  };
}
