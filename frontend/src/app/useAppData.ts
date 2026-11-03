import { useState, useEffect, useCallback } from 'react';
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
  // Bumped whenever activity-affecting data changes so the heatmap refetches.
  const [activityKey, setActivityKey] = useState(0);
  const reviews = useReviewQueue();
  const refreshReviews = reviews.refresh;

  // Initial Data Fetch
  const loadInitialData = useCallback(async () => {
    try {
      const [treeData, summaryData, listData] = await Promise.all([
        api.getFolderTree(),
        api.getProgressSummary(),
        api.listQuestions(),
      ]);

      setFolders(treeData);
      setSummary(summaryData);
      setQuestions(listData);
      // Only after a successful load: a failed (e.g. offline) load must not show "workspace empty".
      setIsLoaded(true);
    } catch (err) {
      console.error('Failed to load initial curriculum data:', err);
    }
  }, []);

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
      setFolders(treeData);
      setSummary(summaryData);
      setQuestions(listData);
      setIsLoaded(true);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
    void refreshReviews();
    setActivityKey((k) => k + 1);
  }, [refreshReviews]);

  return {
    isLoaded,
    folders,
    setFolders,
    questions,
    setQuestions,
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
