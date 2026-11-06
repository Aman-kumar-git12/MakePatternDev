import { getItem, updateItem } from '../../lib/storage';
import { hash } from '../../lib/time';
import type { Analysis } from '../../lib/types';
import type { Agent } from '../types';
import { analyzeHeuristically } from './heuristics';
import { isComplexityRunning } from './complexity';
export { analyzeComplexityFor } from './complexity';

const MAX_ANALYSES = 100;

interface Request {
  submissionId?: string;
  code?: string;
  lang?: string;
  title?: string;
}

/** Runs the instant, offline heuristic analysis. The AI complexity review is requested separately. */
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
      };

  await save(analysis);
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

export const AI_INTERRUPTED = 'Interrupted — retry';

/**
 * On service-worker start: any AI review persisted as `running` that isn't running in this
 * worker was killed with the previous worker. Mark it as an error the UI can retry.
 */
export async function recoverInterruptedAnalyses(): Promise<number> {
  const dead = (a: Analysis) => a.complexityAiStatus === 'running' && !isComplexityRunning(a.id);
  if (!Object.values(await getItem('analyses')).some(dead)) return 0; // skip the write
  let fixed = 0;
  await updateItem('analyses', (all) => {
    const next = { ...all };
    for (const a of Object.values(all)) {
      if (!dead(a)) continue;
      next[a.id] = { ...a, complexityAiStatus: 'error', complexityAiError: AI_INTERRUPTED };
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
    'Rates readability, detects algorithms and estimates complexity instantly offline, plus an AI complexity review through your local agent (your own API key, any provider).',
  trigger: 'on-demand',
  run: async () => {
    // On a manual run, analyse the latest captured submission that has code.
    const subs = await getItem('submissions');
    const latest = [...subs].reverse().find((s) => s.code);
    if (!latest) return 'No captured code yet — submit on LeetCode or paste code in the Analyze tab.';
    const a = await analyze({ submissionId: latest.id });
    return `Analysed "${latest.title}": readability ${a.heuristic.readability.score}/100, ${a.heuristic.algorithms.map((x) => x.name).join(', ') || 'no patterns detected'}`;
  },
};
