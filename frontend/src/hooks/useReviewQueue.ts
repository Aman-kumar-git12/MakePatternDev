import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { QuestionListItem, ReviewQueue, ReviewRating } from '../types/dsa';

const EMPTY: ReviewQueue = { due: [], upcoming: [], due_count: 0, reviewed_today: 0 };

/** Spaced-repetition queue state, shared by the sidebar badge and the review page. */
export function useReviewQueue() {
  const [queue, setQueue] = useState<ReviewQueue>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getDueReviews();
      setQueue({
        due: data.due || [],
        upcoming: data.upcoming || [],
        due_count: data.due_count ?? (data.due || []).length,
        reviewed_today: data.reviewed_today ?? 0,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Rate a review; optimistically removes the card from the due list. */
  const rate = useCallback(
    async (questionId: string, rating: ReviewRating): Promise<QuestionListItem> => {
      const updated = await api.submitReview(questionId, rating);
      setQueue((prev) => {
        const due = prev.due.filter((q) => q.id !== questionId);
        return {
          ...prev,
          due,
          due_count: Math.max(0, prev.due_count - (due.length < prev.due.length ? 1 : 0)),
          reviewed_today: prev.reviewed_today + 1,
        };
      });
      // Re-sync in the background ("again" may keep a card due today).
      void refresh();
      return updated;
    },
    [refresh]
  );

  return { queue, loading, error, refresh, rate };
}

export type ReviewQueueState = ReturnType<typeof useReviewQueue>;
