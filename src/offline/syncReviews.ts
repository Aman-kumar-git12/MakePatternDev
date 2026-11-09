import { api, ApiError, isNetworkError } from '../services/api';
import { queuedFor, removeQueued, userKeyFromToken } from './offlineStore';

const BATCH_SIZE = 200; // server limit per request

let inFlight: Promise<number> | null = null;

/**
 * Send queued offline reviews for the signed-in user.
 * Resolves to the number of reviews the server acknowledged (applied or already known).
 * Keeps the queue on network errors and on 401 (until the next login); drops a batch
 * the server rejects as invalid (422) so a malformed entry can't block the queue forever.
 */
export function flushQueuedReviews(): Promise<number> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const user = userKeyFromToken(api.getToken());
    if (!user) return 0;
    let acknowledged = 0;
    for (;;) {
      const batch = queuedFor(user).slice(0, BATCH_SIZE);
      if (!batch.length) break;
      try {
        const res = await api.submitReviewBatch(
          batch.map(({ client_id, question_id, rating, reviewed_at }) => ({ client_id, question_id, rating, reviewed_at }))
        );
        // applied / duplicate / not_found / stale are all final: remove exactly what the server answered.
        const done = (res.results || []).map((r) => r.client_id);
        removeQueued(done);
        acknowledged += done.length;
        if (done.length < batch.length) break; // partial answer: retry the rest later
      } catch (err) {
        if (err instanceof ApiError && err.status === 422) {
          console.warn('Dropping offline reviews the server rejected as invalid', err);
          removeQueued(batch.map((r) => r.client_id));
          continue;
        }
        if (!isNetworkError(err)) console.warn('Offline review sync failed; will retry', err);
        break;
      }
    }
    return acknowledged;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
