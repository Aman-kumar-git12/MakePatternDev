/**
 * Temporary ids for things created on screen before the server has saved them.
 *
 * A new topic or problem appears at once under a temporary id. Anything that needs the server
 * id meanwhile (opening it, adding a subtopic inside it, dragging it, renaming it) simply waits:
 * the API client swaps every temporary id in a request for the real one before sending it.
 */

const TEMP_ID_PATTERN = /mptmp-[0-9a-z]+-[0-9a-z]+/g;

const pending = new Map<string, Promise<string>>();
const realByTemp = new Map<string, string>();
const tempByReal = new Map<string, string>();

let counter = 0;

export interface PendingId {
  id: string;
  /** The server saved it: from now on the temporary id stands for `realId`. */
  saved: (realId: string) => void;
  /** The save failed: requests that use the temporary id fail too. */
  failed: (err: unknown) => void;
}

export function startPendingId(): PendingId {
  counter += 1;
  const id = `mptmp-${Date.now().toString(36)}-${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let resolve!: (realId: string) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // Nobody may ever ask for this id; a failed save must not become an unhandled rejection.
  promise.catch(() => undefined);
  pending.set(id, promise);
  return {
    id,
    saved: (realId) => {
      realByTemp.set(id, realId);
      tempByReal.set(realId, id);
      resolve(realId);
    },
    failed: (err) => reject(err),
  };
}

export function isTempId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('mptmp-');
}

/** The temporary id an item had before it was saved (keeps UI state such as "expanded"). */
export function tempIdFor(realId: string): string | undefined {
  return tempByReal.get(realId);
}

/** Replace every known temporary id in `text` with its real id, waiting for saves still in flight. */
export async function resolveTempIds(text: string): Promise<string> {
  const found = [...new Set(text.match(TEMP_ID_PATTERN) || [])].filter((id) => pending.has(id));
  if (found.length === 0) return text;
  let out = text;
  for (const tempId of found) {
    let realId: string;
    try {
      realId = realByTemp.get(tempId) ?? (await pending.get(tempId)!);
    } catch {
      throw new Error("This item couldn't be saved, so the change was not applied.");
    }
    out = out.split(tempId).join(realId);
  }
  return out;
}
