import React, { useState } from 'react';
import { Brain, ExternalLink, ArrowRight, CalendarClock, CheckCircle2, Loader2, RefreshCw, CloudOff, CloudUpload } from 'lucide-react';
import { usePendingReviewCount } from '../../offline/useOffline';
import type { QuestionListItem, ReviewRating } from '../../types/dsa';
import type { ReviewQueueState } from '../../hooks/useReviewQueue';
import { relativeDays } from '../../utils/dates';

interface ReviewQueueViewProps {
  reviews: ReviewQueueState;
  onSelectQuestion: (questionId: string) => void;
  onReviewed?: () => void;
}

const RATINGS: Array<{ rating: ReviewRating; label: string; hint: string; className: string }> = [
  { rating: 'again', label: 'Again', hint: 'Forgot it — see it again soon', className: 'mp-btn-danger' },
  { rating: 'hard', label: 'Hard', hint: 'Recalled with real effort', className: '' },
  { rating: 'good', label: 'Good', hint: 'Recalled the approach', className: '' },
  { rating: 'easy', label: 'Easy', hint: 'Instant recall', className: 'mp-btn-primary' },
];

/** Rough preview of the next interval; the server's answer is authoritative. */
const estimateInterval = (q: QuestionListItem, rating: ReviewRating): string => {
  const current = Math.max(0, q.review_interval_days || 0);
  let next: number;
  switch (rating) {
    case 'again':
      return '1d';
    case 'hard':
      next = Math.max(1, Math.round(current * 1.2) || 1);
      break;
    case 'good':
      next = current === 0 ? 3 : Math.round(current * 2.5);
      break;
    case 'easy':
      next = current === 0 ? 7 : Math.round(current * 3.5);
      break;
  }
  return `≈${next}d`;
};

const problemHref = (q: QuestionListItem) => {
  if (q.problem_url) {
    return /^https?:\/\//.test(q.problem_url) ? q.problem_url : `https://${q.problem_url}`;
  }
  if (q.leetcode_slug) return `https://leetcode.com/problems/${q.leetcode_slug}/`;
  return '';
};

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({ reviews, onSelectQuestion, onReviewed }) => {
  const { queue, loading, error, rate, refresh, offline, cachedAt } = reviews;
  const pending = usePendingReviewCount();
  // Every card with a rating in flight stays disabled, so no card can be rated twice.
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);

  const handleRate = async (q: QuestionListItem, rating: ReviewRating) => {
    if (busyIds.has(q.id)) return;
    setBusyIds((prev) => new Set(prev).add(q.id));
    try {
      const updated = await rate(q.id, rating);
      setToast(
        updated.queued
          ? `"${q.title}" saved offline — it will sync when you're back online`
          : `"${q.title}" — next review ${relativeDays(updated.next_review_at)}`
      );
      setTimeout(() => setToast(null), 2500);
      onReviewed?.();
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Could not save review');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(q.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="mp-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(250,204,21,0.15)', color: '#facc15' }}>
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Due today</h2>
            <p className="text-xs mp-muted">
              Spaced repetition: rate how well you recalled the approach. Solved problems come back after 1, 3, 7, 21… days.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="mp-chip">{queue.due_count} due</span>
          <span className="mp-chip">{queue.reviewed_today} reviewed today</span>
          <button type="button" className="mp-btn !px-2" onClick={() => void refresh()} title="Refresh queue">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {offline && (
        <div className="mp-card p-3 text-xs flex items-start gap-2" role="status" style={{ borderColor: 'rgba(250,204,21,0.35)' }}>
          <CloudOff className="w-4 h-4 shrink-0 text-yellow-300" />
          <span>
            Offline — showing your saved queue{cachedAt ? ` from ${new Date(cachedAt).toLocaleString()}` : ''}. Reviews you rate now
            will sync automatically when you reconnect.
          </span>
        </div>
      )}
      {pending > 0 && (
        <div className="mp-card p-3 text-xs flex items-center gap-2" role="status">
          <CloudUpload className="w-4 h-4 shrink-0 text-sky-400" />
          <span>
            {pending} {pending === 1 ? 'review' : 'reviews'} waiting to sync
          </span>
        </div>
      )}

      {error && (
        <div className="mp-card p-3 text-xs text-rose-400" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mp-card p-8 flex items-center justify-center gap-2 text-sm mp-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading review queue…
        </div>
      ) : queue.due.length === 0 ? (
        <div className="mp-card p-8 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
          <p className="text-sm font-semibold">You're all caught up.</p>
          <p className="text-xs mp-muted">
            Mark problems as Solved to schedule them for review, or flag one as "Needs Revision" to review it now.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {queue.due.map((q) => {
            const href = problemHref(q);
            const busy = busyIds.has(q.id);
            return (
              <li key={q.id} className="mp-card p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectQuestion(q.id)}
                      className="text-sm font-bold text-left hover:underline break-words"
                    >
                      {q.leetcode_id ? `${q.leetcode_id}. ` : ''}
                      {q.title}
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] mp-faint">
                      <span className={`mp-chip mp-diff-${q.difficulty}`}>{q.difficulty}</span>
                      {q.folder_path && <span className="truncate max-w-[220px]">{q.folder_path}</span>}
                      <span>· reviewed {q.review_count ?? 0}×</span>
                      {q.last_reviewed_at && <span>· last {relativeDays(q.last_reviewed_at)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {href && (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="mp-btn !py-1">
                        <ExternalLink className="w-3.5 h-3.5" /> Problem
                      </a>
                    )}
                    <button type="button" className="mp-btn !py-1" onClick={() => onSelectQuestion(q.id)}>
                      Notes <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {RATINGS.map((r) => (
                    <button
                      key={r.rating}
                      type="button"
                      disabled={busy}
                      onClick={() => handleRate(q, r.rating)}
                      className={`mp-btn flex-col !gap-0 !py-1.5 ${r.className}`}
                      title={r.hint}
                    >
                      <span>{r.label}</span>
                      <span className="text-[10px] font-normal opacity-75">{estimateInterval(q, r.rating)}</span>
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {queue.upcoming.length > 0 && (
        <div className="mp-card p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider mp-muted flex items-center gap-1.5 mb-2">
            <CalendarClock className="w-3.5 h-3.5" /> Coming up this week
          </h3>
          <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {queue.upcoming.map((q) => (
              <li key={q.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                <button type="button" onClick={() => onSelectQuestion(q.id)} className="truncate text-left hover:underline">
                  {q.title}
                </button>
                <span className="mp-faint shrink-0">{relativeDays(q.next_review_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg max-w-[90vw] text-center"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-hover)', color: 'var(--text-primary)' }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
};
