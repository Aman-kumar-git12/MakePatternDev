import { browser } from 'wxt/browser';
import { analyzeComplexity, selection, type ComplexityResult } from '../../lib/complexityAgent';
import { errorMessage } from '../../lib/http';
import { getItem, getSettings, updateItem } from '../../lib/storage';
import type { Analysis } from '../../lib/types';

async function patch(id: string, fields: Partial<Analysis>) {
  await updateItem('analyses', (all) => (all[id] ? { ...all, [id]: { ...all[id], ...fields } } : all));
}

/** Calls in flight in this worker, so a double click joins the running call. */
const jobs = new Map<string, Promise<ComplexityResult>>();

/** Whether a complexity call for this analysis is running in this service worker. */
export const isComplexityRunning = (id: string) => jobs.has(id);

/**
 * Asks the local complexity agent for an analysis's time and space complexity, with the
 * provider, key and model chosen in settings. The outcome is recorded on the analysis
 * (`complexityAiStatus` running -> done | error) and the result is returned.
 */
export function analyzeComplexityFor(id: string, deps: { fetch?: typeof fetch } = {}): Promise<ComplexityResult> {
  const running = jobs.get(id);
  if (running) return running;
  const job = run(id, deps).finally(() => jobs.delete(id));
  jobs.set(id, job);
  return job;
}

async function run(id: string, deps: { fetch?: typeof fetch }): Promise<ComplexityResult> {
  const a = (await getItem('analyses'))[id];
  if (!a) throw new Error('Analysis not found');
  const settings = await getSettings();
  const { provider, apiKey, model } = selection(settings.agent);
  await patch(id, { complexityAiStatus: 'running', complexityAiError: undefined });
  // A long fetch alone doesn't keep an MV3 service worker alive; extension API calls do.
  const keepAlive = setInterval(() => void browser.runtime.getPlatformInfo(), 20_000);
  try {
    const result = await analyzeComplexity({
      url: settings.agent.url,
      provider: provider.id,
      apiKey,
      model,
      code: a.code,
      language: a.lang ?? a.heuristic.language,
      title: a.title === 'Pasted code' ? undefined : a.title,
      fetch: deps.fetch,
    });
    await patch(id, { complexityAi: result, complexityAiStatus: 'done', complexityAiError: undefined });
    return result;
  } catch (e) {
    await patch(id, { complexityAiStatus: 'error', complexityAiError: errorMessage(e) });
    throw e;
  } finally {
    clearInterval(keepAlive);
  }
}
