/**
 * Registry of in-memory pending writes (autosaves, preference syncs). Logout awaits them
 * before dropping the token, so the last edits made just before signing out aren't lost.
 */
const flushers = new Set<() => Promise<unknown>>();

export function registerPendingWrites(flush: () => Promise<unknown>): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

/** Sends every pending write; resolves when all settle or after `timeoutMs`. */
export async function flushPendingWrites(timeoutMs = 3000): Promise<void> {
  if (!flushers.size) return;
  const all = Promise.allSettled([...flushers].map((f) => f()));
  await Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))]);
}
