import { browser } from 'wxt/browser';
import { cleanTitle, validateNewtonUrl } from './newtonQotd';

/** Raw LeetCode submission captured by the content script. */
export interface LeetCodeCapture {
  submissionId: string;
  slug: string;
  statusMsg: string;
  lang?: string;
  code?: string;
  runtime?: string;
  memory?: string;
  totalCorrect?: number;
  totalTestcases?: number;
}

export type Message =
  | { type: 'runAgent'; id: string }
  | { type: 'togglePotdDone'; date: string; key: string }
  | { type: 'setReminder'; contestId: string; on: boolean }
  | { type: 'settingsChanged' }
  | { type: 'lcSubmission'; payload: LeetCodeCapture }
  | { type: 'newtonQotd'; result: NewtonQotdResult }
  | { type: 'analyze'; submissionId?: string; code?: string; lang?: string; title?: string; withAi: boolean }
  | { type: 'analyzeAi'; analysisId: string }
  | { type: 'deleteAnalysis'; analysisId: string }
  | { type: 'clearData' };

/** What the Newton School content script read from the Question of the Day page. */
export type NewtonQotdResult = { ok: true; title: string; problemUrl: string | null } | { ok: false; error: string };

export interface Reply<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function send<T = unknown>(msg: Message): Promise<T> {
  const reply = (await browser.runtime.sendMessage(msg)) as Reply<T> | undefined;
  if (!reply?.ok) throw new Error(reply?.error ?? 'Background did not respond');
  return reply.data as T;
}

// ---------------------------------------------------------------------------------------
// LeetCode capture validation. Runs in the bridge content script (first filter) and again
// in the background (authoritative). Anything that doesn't look exactly like what the
// LeetCode judge returns is rejected.
// ---------------------------------------------------------------------------------------

/** Final judge states LeetCode reports in `status_msg`. */
export const LC_VERDICTS = [
  'Accepted',
  'Wrong Answer',
  'Time Limit Exceeded',
  'Memory Limit Exceeded',
  'Output Limit Exceeded',
  'Runtime Error',
  'Compile Error',
  'Internal Error',
  'Timeout',
] as const;

/** LeetCode `lang` slugs. Unknown languages are dropped (not rejected) so new ones still capture. */
export const LC_LANGS = new Set([
  'c', 'cpp', 'csharp', 'java', 'python', 'python3', 'javascript', 'typescript', 'php', 'swift',
  'kotlin', 'dart', 'golang', 'ruby', 'scala', 'rust', 'racket', 'erlang', 'elixir', 'cangjie',
  'mysql', 'mssql', 'oraclesql', 'postgresql', 'pythondata', 'pandas', 'bash',
]);

/** Captures carrying more code than this are treated as malformed (ingest stores at most 20k chars). */
export const MAX_CAPTURE_CODE = 100_000;

const SUBMISSION_ID = /^\d{1,20}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STAT = /^(?:N\/A|\d{1,7}(?:\.\d{1,3})? ?(?:ms|s|B|KB|MB|GB))$/;

export type CaptureCheck = { ok: true; capture: LeetCodeCapture } | { ok: false; error: string };

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100_000;

/** Strictly validates (and normalises) an untrusted capture payload. */
export function validateCapture(raw: unknown): CaptureCheck {
  const fail = (error: string): CaptureCheck => ({ ok: false, error: `Rejected LeetCode capture: ${error}` });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('not an object');
  const p = raw as Record<string, unknown>;
  if (typeof p.submissionId !== 'string' || !SUBMISSION_ID.test(p.submissionId)) return fail('bad submissionId');
  if (typeof p.slug !== 'string' || p.slug.length > 120 || !SLUG.test(p.slug)) return fail('bad slug');
  if (typeof p.statusMsg !== 'string' || !(LC_VERDICTS as readonly string[]).includes(p.statusMsg)) return fail('unknown verdict');
  if (p.code !== undefined && (typeof p.code !== 'string' || p.code.length > MAX_CAPTURE_CODE)) return fail('bad code');
  if (p.lang !== undefined && typeof p.lang !== 'string') return fail('bad lang');
  for (const k of ['runtime', 'memory'] as const) {
    if (p[k] !== undefined && (typeof p[k] !== 'string' || (p[k] as string).length > 32)) return fail(`bad ${k}`);
  }
  for (const k of ['totalCorrect', 'totalTestcases'] as const) {
    if (p[k] !== undefined && p[k] !== null && !isCount(p[k])) return fail(`bad ${k}`);
  }
  const totalCorrect = isCount(p.totalCorrect) ? p.totalCorrect : undefined;
  const totalTestcases = isCount(p.totalTestcases) ? p.totalTestcases : undefined;
  if (totalCorrect !== undefined && totalTestcases !== undefined && totalCorrect > totalTestcases) return fail('more correct than total tests');

  const capture: LeetCodeCapture = { submissionId: p.submissionId, slug: p.slug, statusMsg: p.statusMsg };
  if (typeof p.lang === 'string' && LC_LANGS.has(p.lang)) capture.lang = p.lang;
  if (typeof p.code === 'string' && p.code.length) capture.code = p.code;
  if (typeof p.runtime === 'string' && STAT.test(p.runtime)) capture.runtime = p.runtime;
  if (typeof p.memory === 'string' && STAT.test(p.memory)) capture.memory = p.memory;
  if (totalCorrect !== undefined) capture.totalCorrect = totalCorrect;
  if (totalTestcases !== undefined) capture.totalTestcases = totalTestcases;
  return { ok: true, capture };
}

// ---------------------------------------------------------------------------------------
// Message shape validation and sender authorisation (background side).
// ---------------------------------------------------------------------------------------

export class MessageError extends Error {}

const str = (v: unknown, max: number, re?: RegExp): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max && (!re || re.test(v));
const optStr = (v: unknown, max: number) => v === undefined || (typeof v === 'string' && v.length <= max);

/** Parses an untrusted runtime message into a `Message`, throwing `MessageError` if malformed. */
export function parseMessage(raw: unknown): Message {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new MessageError('Malformed message');
  const m = raw as Record<string, unknown>;
  const bad = () => new MessageError(`Malformed "${String(m.type)}" message`);
  switch (m.type) {
    case 'runAgent':
      if (!str(m.id, 40, /^[A-Za-z0-9_-]+$/)) throw bad();
      return { type: 'runAgent', id: m.id };
    case 'togglePotdDone':
      if (!str(m.date, 10, /^\d{4}-\d{2}-\d{2}$/) || !str(m.key, 300)) throw bad();
      return { type: 'togglePotdDone', date: m.date, key: m.key };
    case 'setReminder':
      if (!str(m.contestId, 300) || typeof m.on !== 'boolean') throw bad();
      return { type: 'setReminder', contestId: m.contestId, on: m.on };
    case 'settingsChanged':
    case 'clearData':
      return { type: m.type };
    case 'lcSubmission': {
      const check = validateCapture(m.payload);
      if (!check.ok) throw new MessageError(check.error);
      return { type: 'lcSubmission', payload: check.capture };
    }
    case 'newtonQotd': {
      // Re-validated here: the page (and so the content script's input) is untrusted.
      const r = m.result as Record<string, unknown> | null;
      if (!r || typeof r !== 'object' || typeof r.ok !== 'boolean') throw bad();
      if (r.ok) {
        const title = cleanTitle(r.title);
        // The link is optional (signed-in cards may have none); if present it must be canonical.
        const problemUrl = r.problemUrl === null ? null : validateNewtonUrl(r.problemUrl);
        if (!title || (r.problemUrl !== null && (!problemUrl || problemUrl !== r.problemUrl))) throw bad();
        return { type: 'newtonQotd', result: { ok: true, title, problemUrl } };
      }
      if (!str(r.error, 200)) throw bad();
      return { type: 'newtonQotd', result: { ok: false, error: r.error } };
    }
    case 'analyze':
      if (
        typeof m.withAi !== 'boolean' ||
        !optStr(m.submissionId, 100) ||
        !optStr(m.code, 200_000) ||
        !optStr(m.lang, 40) ||
        !optStr(m.title, 300)
      )
        throw bad();
      return {
        type: 'analyze',
        withAi: m.withAi,
        submissionId: m.submissionId as string | undefined,
        code: m.code as string | undefined,
        lang: m.lang as string | undefined,
        title: m.title as string | undefined,
      };
    case 'analyzeAi':
    case 'deleteAnalysis':
      if (!str(m.analysisId, 200)) throw bad();
      return { type: m.type, analysisId: m.analysisId };
    default:
      throw new MessageError('Unknown message type');
  }
}

/** The subset of `runtime.MessageSender` the checks below rely on (same in Chrome and Firefox). */
export interface SenderInfo {
  id?: string;
  url?: string;
  origin?: string;
  frameId?: number;
  tab?: { id?: number; url?: string };
}

export type SenderKind = 'extension-page' | 'leetcode-content' | 'newton-content' | 'untrusted';

/** Hosts the live-capture content scripts run on (see leetcode-*.content.ts). */
export const CAPTURE_HOSTS = new Set(['leetcode.com']);

/**
 * Classifies who sent a runtime message.
 * - `extension-page`: our popup/options (or any page served from the extension origin, even
 *   when it is open in a tab — the options page uses `open_in_tab`).
 * - `leetcode-content`: our content script in the top frame of a leetcode.com tab.
 * Everything else (other extensions, other hosts, sub-frames) is `untrusted`.
 */
export function classifySender(sender: SenderInfo, extId: string, extBaseUrl: string): SenderKind {
  if (!sender || sender.id !== extId || typeof sender.url !== 'string') return 'untrusted';
  if (sender.url.startsWith(extBaseUrl)) {
    if (sender.origin !== undefined && !extBaseUrl.startsWith(sender.origin)) return 'untrusted';
    return 'extension-page';
  }
  if (!sender.tab || (sender.frameId !== undefined && sender.frameId !== 0)) return 'untrusted';
  let url: URL;
  try {
    url = new URL(sender.url);
  } catch {
    return 'untrusted';
  }
  if (url.protocol === 'https:' && CAPTURE_HOSTS.has(url.hostname)) return 'leetcode-content';
  if (url.protocol === 'https:' && url.hostname === 'my.newtonschool.co') return 'newton-content';
  return 'untrusted';
}

/** Which sender kind may send which message type. */
export function isAllowed(type: Message['type'], kind: SenderKind): boolean {
  if (type === 'lcSubmission') return kind === 'leetcode-content';
  if (type === 'newtonQotd') return kind === 'newton-content';
  // A content script may only send its own message type.
  return kind === 'extension-page';
}

/** Validates both the sender and the message; throws `MessageError` with a user-facing reason. */
export function authorize(raw: unknown, sender: SenderInfo, extId: string, extBaseUrl: string): Message {
  const kind = classifySender(sender, extId, extBaseUrl);
  if (kind === 'untrusted') throw new MessageError('Forbidden: message from an untrusted context');
  const type = (raw as { type?: unknown } | null)?.type;
  if (typeof type === 'string' && !isAllowed(type as Message['type'], kind)) {
    throw new MessageError(`Forbidden: "${type}" is not allowed from this context`);
  }
  return parseMessage(raw);
}
