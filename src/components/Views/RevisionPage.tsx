import React, { useState } from 'react';
import { Brain, ListChecks } from 'lucide-react';
import { ReviewQueueView } from './ReviewQueueView';
import { RevisionView } from './RevisionView';
import type { QuestionListItem } from '../../types/dsa';
import type { ReviewQueueState } from '../../hooks/useReviewQueue';

interface RevisionPageProps {
  reviews: ReviewQueueState;
  questions: QuestionListItem[];
  onSelectQuestion: (questionId: string) => void;
  onToggleRevision: (questionId: string, isChecked: boolean) => Promise<void> | void;
  onToggleBookmark?: (questionId: string) => void;
  onReviewed?: () => void;
}

/** Revision hub: spaced-repetition "Due today" queue first, the classic revision list second. */
export const RevisionPage: React.FC<RevisionPageProps> = ({
  reviews,
  questions,
  onSelectQuestion,
  onToggleRevision,
  onToggleBookmark,
  onReviewed,
}) => {
  const [tab, setTab] = useState<'due' | 'list'>('due');

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
      active ? 'bg-[#fef08a] text-[#18181b]' : 'mp-muted hover:bg-[var(--bg-hover)]'
    }`;

  return (
    <div>
      <div className="px-4 sm:px-6 pt-4 max-w-6xl mx-auto">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl mp-card-alt" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'due'} className={tabClass(tab === 'due')} onClick={() => setTab('due')}>
            <Brain className="w-3.5 h-3.5" />
            Due today
            {reviews.queue.due_count > 0 && (
              <span className="ml-1 text-[10px] px-1.5 rounded-full bg-black/20">{reviews.queue.due_count}</span>
            )}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'list'} className={tabClass(tab === 'list')} onClick={() => setTab('list')}>
            <ListChecks className="w-3.5 h-3.5" />
            Revision list & random picks
          </button>
        </div>
      </div>

      {tab === 'due' ? (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <ReviewQueueView reviews={reviews} onSelectQuestion={onSelectQuestion} onReviewed={onReviewed} />
        </div>
      ) : (
        <RevisionView
          questions={questions}
          onSelectQuestion={onSelectQuestion}
          onToggleRevision={onToggleRevision}
          onToggleBookmark={onToggleBookmark}
        />
      )}
    </div>
  );
};
