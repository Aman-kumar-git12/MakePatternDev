import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useReviewQueue } from '../hooks/useReviewQueue';
import type { Folder, QuestionListItem, ProgressSummary } from '../types/dsa';

/** Core workspace data: folder tree, question list, progress summary, review queue, heatmap key. */
export function useAppData() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  // False until the first load settles, so empty states don't flash while data is in flight.
  const [isLoaded, setIsLoaded] = useState(false);
  // True when the first load failed (offline / server down), so loading placeholders stop.
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumped whenever activity-affecting data changes so the heatmap refetches.
  const [activityKey, setActivityKey] = useState(0);
  const reviews = useReviewQueue();

  /*
   * Background saves (creates, moves, rearranging) still in flight. While there are any, a server
   * copy fetched for some other reason is older than what's on screen, so it is not applied; the
   * save queue re-reads the server once its last save lands instead (see useSyncQueue).
   */
  const pendingSaves = useRef(0);
  const deferredServerSync = useRef(false);
  const setServerFolders = useCallback((tree: Folder[]) => {
    if (pendingSaves.current > 0) deferredServerSync.current = true;
    else setFolders(tree);
  }, []);
  const setServerQuestions = useCallback((list: QuestionListItem[]) => {
    if (pendingSaves.current > 0) deferredServerSync.current = true;
    else setQuestions(list);
  }, []);
  /** Used by the save queue: count saves in flight, and collect a skipped server copy afterwards. */
  const [saveTracker] = useState(() => ({
    started: () => {
      pendingSaves.current += 1;
    },
    /** Returns how many saves are still in flight. */
    finished: () => {
      pendingSaves.current -= 1;
      return pendingSaves.current;
    },
    hasPending: () => pendingSaves.current > 0,
    /** True (once) when a server copy was skipped while saves were in flight. */
    takeDeferredSync: () => {
      const deferred = deferredServerSync.current;
      deferredServerSync.current = false;
      return deferred;
    },
  }));
  const refreshReviews = reviews.refresh;

  // Initial Data Fetch
  const loadInitialData = useCallback(async () => {
    try {
      const [treeData, summaryData, listData] = await Promise.all([
        api.getFolderTree(),
        api.getProgressSummary(),
        api.listQuestions(),
      ]);

      setServerFolders(treeData);
      setSummary(summaryData);
      setServerQuestions(listData);
      // Only after a successful load: a failed (e.g. offline) load must not show "workspace empty".
      setIsLoaded(true);
      setLoadFailed(false);
    } catch (err) {
      console.error('Failed to load initial curriculum data:', err);
      setLoadFailed(true);
    }
  }, [setServerFolders, setServerQuestions]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  /** Re-sync everything derived from questions: tree, summary, list, review queue, heatmap. */
  const refreshData = useCallback(async () => {
    try {
      const [treeData, summaryData, listData] = await Promise.all([
        api.getFolderTree(),
        api.getProgressSummary(),
        api.listQuestions(),
      ]);
      setServerFolders(treeData);
      setSummary(summaryData);
      setServerQuestions(listData);
      setIsLoaded(true);
      setLoadFailed(false);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
    void refreshReviews();
    setActivityKey((k) => k + 1);
  }, [refreshReviews, setServerFolders, setServerQuestions]);

  return {
    isLoaded,
    loadFailed,
    folders,
    setFolders,
    questions,
    setQuestions,
    setServerFolders,
    setServerQuestions,
    saveTracker,
    summary,
    setSummary,
    activityKey,
    setActivityKey,
    reviews,
    refreshReviews,
    loadInitialData,
    refreshData,
  };
}

export type AppData = ReturnType<typeof useAppData>;
