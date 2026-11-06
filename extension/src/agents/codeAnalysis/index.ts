import { browser } from 'wxt/browser';
import { errorMessage } from '../../lib/http';
import { getItem, getSettings, updateItem } from '../../lib/storage';
import { hash } from '../../lib/time';
import type { Analysis } from '../../lib/types';
import type { Agent } from '../types';
import { analyzeWithClaude } from './claude';
import { analyzeHeuristically } from './heuristics';

const MAX_ANALYSES = 100;

interface Request {
  submissionId?: string;
  code?: string;
  lang?: string;
  title?: string;
  withAi: boolean;
}

/** Runs the instant heuristic analysis and, if asked, starts the Claude review in the background. */
export async function analyze(req: Request): Promise<Analysis> {
  let code = req.code ?? '';
  let lang = req.lang;
  let title = req.title || 'Pasted code';
  let url: string | undefined;
  let id: string;

  if (req.submissionId) {
    const sub = (await getItem('submissions')).find((s) => s.id === req.submissionId);
    if (!sub?.code) throw new Error('That submission has no captured code.');
    code = sub.code;
    lang = sub.lang;
    title = `${sub.title} · ${sub.rawVerdict}`;
    url = sub.url;
    id = sub.id;
  } else {
    if (!code.trim()) throw new Error('Paste some code first.');
    id = `paste:${hash(code)}`;
  }

  const existing = (await getItem('analyses'))[id];
  const analysis: Analysis = existing && existing.code === code
    ? existing
    : {
        id,
        createdAt: Date.now(),
        title,
        url,
        lang,
        code,
        heuristic: analyzeHeuristically(code, lang),
        aiStatus: 'idle',
      };

  await save(analysis);
  if (req.withAi) startAi(analysis.id).catch(() => undefined);
  return analysis;
}

async function save(a: Analysis) {
  await updateItem('analyses', (all) => {
    const next = { ...all, [a.id]: a };
    const ids = Object.values(next).sort((x, y) => y.createdAt - x.createdAt).map((x) => x.id);
    for (const old of ids.slice(MAX_ANALYSES)) delete next[old];
    return next;
  });
}

async function patch(id: string, fields: Partial<Analysis>) {
  await updateItem('analyses', (all) => (all[id] ? { ...all, [id]: { ...all[id], ...fields } } : all));
}

/** A review still `running` this long after `aiStartedAt` is stale: the UI offers Retry. */
export const AI_STALE_MS = 3 * 60_000;
/** Hard deadline for one review, kept below `AI_STALE_MS` so a live review never looks stale. */
export const AI_DEADLINE_MS = AI_STALE_MS - 30_000;
export const AI_INTERRUPTED = 'Interrupted — retry';

/** Reviews running in this service worker. A fresh worker has none, whatever storage says. */
const aiJobs = new Map<string, Promise<void>>();

export function isAiStale(a: Pick<Analysis, 'aiStatus' | 'aiStartedAt'>, now = Date.now()): boolean {
  return a.aiStatus === 'running' && (a.aiStartedAt === undefined || now - a.aiStartedAt > AI_STALE_MS);
}

/**
 * Starts (or retries) the Claude review in the background and resolves once it has started.
 * Rejects only if the analysis doesn't exist. A review already running in this worker is
 * joined, not duplicated; a `running` status with no live job (worker died, or stale) is
 * restarted — so Retry works both for `error` and for stale `running`.
 */
export async function startAi(id: string): Promise<void> {
  if (!(await getItem('analyses'))[id]) throw new Error('Analysis not found');
  if (aiJobs.has(id)) return;
  const job = runAi(id)
    .catch(async (e) => {
      // runAi records its own API errors; this catches anything unexpected (storage, deleted mid-run).
      await patch(id, { aiStatus: 'error', aiError: errorMessage(e) }).catch(() => undefined);
    })
    .finally(() => aiJobs.delete(id));
  aiJobs.set(id, job);
}

/** Runs the review and records the outcome on the analysis. Prefer `startAi`. */
export async function runAi(id: string): Promise<void> {
  const a = (await getItem('analyses'))[id];
  if (!a) throw new Error('Analysis not found');
  const settings = await getSettings();
  if (!settings.ai.apiKey.trim()) {
    await patch(id, { aiStatus: 'error', aiError: 'Add your Anthropic API key in settings to enable the Claude review.' });
    return;
  }
  await patch(id, { aiStatus: 'running', aiError: undefined, aiStartedAt: Date.now() });
  const sub = (await getItem('submissions')).find((s) => s.id === id);
  // A long API call alone doesn't keep an MV3 service worker alive; extension API calls do.
  const keepAlive = setInterval(() => void browser.runtime.getPlatformInfo(), 20_000);
  const ctrl = new AbortController();
  const deadline = setTimeout(() => ctrl.abort(), AI_DEADLINE_MS);
  try {
    const ai = await analyzeWithClaude({
      apiKey: settings.ai.apiKey.trim(),
      model: settings.ai.model,
      code: a.code,
      lang: a.lang ?? a.heuristic.language,
      title: sub?.title ?? (a.title === 'Pasted code' ? undefined : a.title),
      url: a.url,
      verdict: sub?.rawVerdict,
      signal: ctrl.signal,
    });
    await patch(id, { ai, aiModel: settings.ai.model, aiStatus: 'done', aiError: undefined });
  } catch (e) {
    const message = ctrl.signal.aborted ? 'The Claude review took too long — retry.' : errorMessage(e);
    await patch(id, { aiStatus: 'error', aiError: message });
  } finally {
    clearTimeout(deadline);
    clearInterval(keepAlive);
  }
}

/**
 * On service-worker start: any review persisted as `running` that isn't running in this
 * worker was killed with the previous worker. Mark it as an error the UI can retry.
 */
export async function recoverInterruptedAnalyses(): Promise<number> {
  const dead = (a: Analysis) => a.aiStatus === 'running' && !aiJobs.has(a.id);
  if (!Object.values(await getItem('analyses')).some(dead)) return 0; // skip the write
  let fixed = 0;
  await updateItem('analyses', (all) => {
    const next = { ...all };
    for (const a of Object.values(all)) {
      if (!dead(a)) continue;
      next[a.id] = { ...a, aiStatus: 'error', aiError: AI_INTERRUPTED };
      fixed++;
    }
    return next;
  });
  return fixed;
}

export async function deleteAnalysis(id: string) {
  await updateItem('analyses', (all) => {
    const next = { ...all };
    delete next[id];
    return next;
  });
}

export const codeAnalysisAgent: Agent = {
  id: 'analysis',
  name: 'Code-analysis agent',
  description:
    'Rates readability, detects algorithms and data structures and estimates complexity — instantly offline, or in depth with Claude (your API key).',
  trigger: 'on-demand',
  run: async () => {
    // On a manual run, analyse the latest captured submission that has code.
    const subs = await getItem('submissions');
    const latest = [...subs].reverse().find((s) => s.code);
    if (!latest) return 'No captured code yet — submit on LeetCode or paste code in the Analyze tab.';
    const a = await analyze({ submissionId: latest.id, withAi: false });
    return `Analysed "${latest.title}": readability ${a.heuristic.readability.score}/100, ${a.heuristic.algorithms.map((x) => x.name).join(', ') || 'no patterns detected'}`;
  },
};
