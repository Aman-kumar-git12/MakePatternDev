import { useEffect, useRef } from 'react';
import { api } from '../services/api';
import type { Folder, QuestionListItem } from '../types/dsa';
import type { AppData } from './useAppData';
import { pushToast } from '../hooks/useUndoToasts';

const DEFAULT_FAIL_MESSAGE = "Couldn't save the new order — it has been restored.";

interface SaveOptions {
  /** Re-read the server copy once every queued save is done. */
  reconcile?: boolean;
  /** Toast shown when this save fails (the screen is then restored from the server). */
  failMessage?: (err: unknown) => string;
}

/**
 * Optimistic changes: the screen updates at once and the save runs in the background.
 *
 * Saves run one at a time, in the order they were made, so quick successive changes (create a
 * topic, add a subtopic inside it, drag it) reach the server in the same order and a refresh shows
 * exactly what was on screen. When the last save finishes the server copy is re-read quietly; if a
 * save failed, the screen is restored from the server and a toast explains what happened.
 */
export function useSyncQueue(data: AppData) {
  const { setFolders, setQuestions, setSummary, refreshData } = data;

  const latest = useRef({ folders: data.folders, questions: data.questions });
  useEffect(() => {
    latest.current = { folders: data.folders, questions: data.questions };
  }, [data.folders, data.questions]);

  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingSaves = useRef(0);
  const failMessage = useRef<string | null>(null);
  const needsReconcile = useRef(false);
  /** Bumped on every optimistic change, so a background re-sync never overwrites a newer one. */
  const localVersion = useRef(0);

  const applyLocal = (folders: Folder[], questions?: QuestionListItem[]) => {
    localVersion.current += 1;
    latest.current = { folders, questions: questions ?? latest.current.questions };
    setFolders(folders);
    if (questions) setQuestions(questions);
  };

  const reconcile = async () => {
    const version = localVersion.current;
    try {
      const [tree, list, summary] = await Promise.all([
        api.getFolderTree(),
        api.listQuestions(),
        api.getProgressSummary(),
      ]);
      if (version === localVersion.current && pendingSaves.current === 0) {
        latest.current = { folders: tree, questions: list };
        setFolders(tree);
        setQuestions(list);
        setSummary(summary);
      }
    } catch {
      // Offline or the server is waking up: the optimistic state stays; the next load corrects it.
    }
  };

  const enqueueSave = (save: () => Promise<unknown>, opts: SaveOptions = {}) => {
    pendingSaves.current += 1;
    if (opts.reconcile) needsReconcile.current = true;
    saveQueue.current = saveQueue.current
      .then(save)
      .then(
        () => undefined,
        (err) => {
          console.error('Background save failed:', err);
          // Keep the first failure's message: later saves usually fail only because of it.
          failMessage.current ??= opts.failMessage ? opts.failMessage(err) : DEFAULT_FAIL_MESSAGE;
        }
      )
      .finally(() => {
        pendingSaves.current -= 1;
        if (pendingSaves.current > 0) return;
        if (failMessage.current) {
          const message = failMessage.current;
          failMessage.current = null;
          needsReconcile.current = false;
          pushToast({ message, tone: 'error' });
          void refreshData().catch(() => undefined);
        } else if (needsReconcile.current) {
          needsReconcile.current = false;
          void reconcile();
        }
      });
  };

  return { latest, applyLocal, enqueueSave };
}

export type SyncQueue = ReturnType<typeof useSyncQueue>;
