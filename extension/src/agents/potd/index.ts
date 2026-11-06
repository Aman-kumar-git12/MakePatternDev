import { errorMessage } from '../../lib/http';
import { getItem, getSettings, updateItem } from '../../lib/storage';
import { localDate } from '../../lib/time';
import type { FetchedPotdSource, Potd, Submission } from '../../lib/types';
import type { Agent } from '../types';
import { applyPotdMarks, computePotdMarks } from './done';
import { fetchGfgPotd, fetchLeetCodePotd } from './fetchers';
import { fetchTufPotd, resetTufCache, TUF_CACHE_MS } from './tuf';

const ORDER: FetchedPotdSource[] = ['leetcode', 'gfg', 'tuf'];

async function run(): Promise<string> {
  const [settings, cache, submissions] = await Promise.all([getSettings(), getItem('potd'), getItem('submissions')]);
  const today = localDate();
  // Only current sources (a Codeforces pick saved by an older version is dropped).
  const previous = new Map(cache.items.filter((p) => (ORDER as string[]).includes(p.source)).map((p) => [p.source, p]));
  const solvedOnSite: string[] = [];
  let tufError: string | undefined;

  const jobs: Record<FetchedPotdSource, () => Promise<Potd>> = {
    // LeetCode and GFG roll over at their own midnight, so re-check them every run.
    leetcode: fetchLeetCodePotd,
    gfg: fetchGfgPotd,
    // Striver's real problem of the day from takeuforward.org/potd. Reuse it for ~30 min
    // (also across service-worker restarts); if the page can't be read, keep the last real
    // one. Never substitute a different question: with nothing real, the card says unavailable.
    tuf: async () => {
      const r = await resolveTufPotd(previous.get('tuf'), () => fetchTufPotd());
      if (r.error) tufError = r.error;
      if (r.solvedOnSite) solvedOnSite.push(r.item.key);
      return r.item;
    },
  };

  const sources = ORDER.filter((s) => settings.potdSources[s]);
  const results = await Promise.allSettled(sources.map((s) => jobs[s]()));
  const items: Potd[] = [];
  const errors: Partial<Record<FetchedPotdSource, string>> = {};
  results.forEach((r, i) => {
    const s = sources[i]!;
    if (r.status === 'fulfilled') items.push(r.value);
    else {
      errors[s] = errorMessage(r.reason);
      const stale = previous.get(s);
      // Old TUF stand-ins (LeetCode A2Z picks) are not the real problem of the day: drop them.
      if (stale && !(s === 'tuf' && stale.platform !== 'tuf')) items.push(stale);
    }
  });

  if (tufError && settings.potdSources.tuf) errors.tuf = tufError;

  await updateItem('potd', () => ({ localDate: today, items, fetchedAt: Date.now(), errors }));
  if (solvedOnSite.length) {
    await updateItem('potdDone', (done) => ({ ...done, [today]: [...new Set([...(done[today] ?? []), ...solvedOnSite])] }));
  }
  await markPotdsFromSubmissions(submissions);
  const failed = Object.keys(errors);
  return `${items.length} problems of the day${failed.length ? ` (failed: ${failed.join(', ')})` : ''}`;
}

/**
 * Auto-completes POTD cards from accepted submissions made inside each POTD's own day window
 * (see `computePotdMarks` for which local date a completion is recorded under).
 */
/**
 * Decides what the TUF card shows: a fresh read (reused for ~30 min), else the last real
 * question marked `outdated`, else an error (the card then says "unavailable"). Never a
 * substitute question.
 */
export async function resolveTufPotd(
  previous: Potd | undefined,
  fetchFresh: () => Promise<Potd & { solved: boolean }>,
  now = Date.now(),
): Promise<{ item: Potd; solvedOnSite: boolean; error?: string }> {
  const real = previous?.platform === 'tuf' ? previous : undefined;
  if (real?.fetchedAt && !real.outdated && now - real.fetchedAt < TUF_CACHE_MS) return { item: real, solvedOnSite: false };
  try {
    const { solved, ...item } = await fetchFresh();
    return { item: { ...item, outdated: undefined }, solvedOnSite: solved };
  } catch (e) {
    const error = errorMessage(e);
    if (real) return { item: { ...real, outdated: true }, solvedOnSite: false, error };
    throw e;
  }
}

/**
 * Forced re-read of takeuforward.org/potd right after the user leaves the TUF question page,
 * so a solve shows up in seconds instead of at the next hourly run. Updates the TUF card and
 * ticks it when TUF reports the question solved (needs the user's takeuforward.org login).
 * Returns whether it is now marked done.
 */
export async function recheckTufPotd(now = Date.now()): Promise<boolean> {
  resetTufCache();
  const { solved, ...fresh } = await fetchTufPotd(now);
  await updateItem('potd', (cache) => ({
    ...cache,
    items: cache.items.map((p) => (p.source === 'tuf' ? { ...fresh, outdated: undefined } : p)),
  }));
  if (!solved) return false;
  const today = localDate(now);
  await updateItem('potdDone', (done) => ({ ...done, [today]: [...new Set([...(done[today] ?? []), fresh.key])] }));
  return true;
}

export async function markPotdsFromSubmissions(subs: Submission[], now = Date.now()) {
  const { items } = await getItem('potd');
  const marks = computePotdMarks(items, subs, now);
  if (!marks.length) return;
  const done = await getItem('potdDone');
  if (applyPotdMarks(done, marks) === done) return; // nothing new: skip the write
  await updateItem('potdDone', (d) => applyPotdMarks(d, marks));
}

export const potdAgent: Agent = {
  id: 'potd',
  name: 'Problem-of-the-day agent',
  description: "Fetches the LeetCode, GFG and takeUforward (Striver) problems of the day.",
  trigger: 'schedule',
  periodMinutes: 60,
  run,
};
