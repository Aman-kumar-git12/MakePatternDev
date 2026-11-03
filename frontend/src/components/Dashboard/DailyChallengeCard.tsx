import React, { useEffect, useState } from 'react';
import { CalendarCheck, ExternalLink, Loader2, Plus, ArrowRight } from 'lucide-react';
import { api, ApiError } from '../../services/api';
import type { LeetCodeDaily, Question } from '../../types/dsa';

interface DailyChallengeCardProps {
  onOpenQuestion: (questionId: string) => void;
  onTracked: (question: Question) => void | Promise<void>;
}

/** Today's LeetCode daily challenge with one-click tracking. */
export const DailyChallengeCard: React.FC<DailyChallengeCardProps> = ({ onOpenQuestion, onTracked }) => {
  const [daily, setDaily] = useState<LeetCodeDaily | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getLeetCodeDaily()
      .then((d) => alive && setDaily(d))
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'Daily challenge unavailable'));
    return () => {
      alive = false;
    };
  }, []);

  const track = async () => {
    if (!daily) return;
    setBusy(true);
    setError(null);
    try {
      const q = await api.importLeetCode(daily.problem.slug, null, 'In Progress');
      setDaily({ ...daily, already_tracked: true, question_id: q.id });
      await onTracked(q);
      onOpenQuestion(q.id);
    } catch (err) {
      const detail = err instanceof ApiError ? (err.data as { detail?: { question_id?: string } } | null)?.detail : null;
      if (err instanceof ApiError && err.status === 409 && detail && typeof detail === 'object' && detail.question_id) {
        setDaily({ ...daily, already_tracked: true, question_id: detail.question_id });
        onOpenQuestion(detail.question_id);
      } else {
        setError(err instanceof Error ? err.message : 'Could not track the daily challenge');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mp-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" aria-label="LeetCode daily challenge">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: 'rgba(250,204,21,0.15)', color: '#facc15' }}>
          <CalendarCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider mp-faint">LeetCode daily challenge</div>
          {daily ? (
            <>
              <div className="text-sm font-bold truncate">
                <span className="mp-faint font-mono mr-1">{daily.problem.frontend_id}.</span>
                {daily.problem.title}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className={`mp-chip mp-diff-${daily.problem.difficulty}`}>{daily.problem.difficulty}</span>
                {daily.problem.tags.slice(0, 3).map((t) => (
                  <span key={t} className="mp-chip">
                    {t}
                  </span>
                ))}
              </div>
            </>
          ) : error ? (
            <div className="text-xs mp-muted">{error}</div>
          ) : (
            <div className="flex items-center gap-2 text-xs mp-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading today's problem…
            </div>
          )}
        </div>
      </div>
      {daily && (
        <div className="flex items-center gap-2 shrink-0">
          <a href={daily.problem.url} target="_blank" rel="noopener noreferrer" className="mp-btn">
            <ExternalLink className="w-3.5 h-3.5" /> Solve
          </a>
          {daily.already_tracked && daily.question_id ? (
            <button type="button" className="mp-btn mp-btn-primary" onClick={() => onOpenQuestion(daily.question_id!)}>
              Open <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button type="button" className="mp-btn mp-btn-primary" onClick={track} disabled={busy}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Track it
            </button>
          )}
        </div>
      )}
    </section>
  );
};
