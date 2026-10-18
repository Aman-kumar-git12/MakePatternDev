import React from 'react';
import { Clock, FileCode, ChevronRight } from 'lucide-react';
import type { QuestionListItem } from '../../types/dsa';

interface RecentListProps {
  questions: QuestionListItem[];
  onSelectQuestion: (questionId: string) => void;
  onViewAll: () => void;
}

export const RecentList: React.FC<RecentListProps> = ({
  questions,
  onSelectQuestion,
  onViewAll,
}) => {
  // Format relative timestamp
  const getRelativeTime = (isoString: string): string => {
    try {
      const now = new Date();
      const updated = new Date(isoString);
      const diffMs = now.getTime() - updated.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return 'recently';
    }
  };

  return (
    <div className="bg-[#0D1527] border border-slate-800/90 rounded-2xl p-5 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Recent</h3>
        </div>
        <button
          onClick={onViewAll}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1 transition"
        >
          <span>View All</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2.5">
        {questions.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No recently opened questions.
          </div>
        ) : (
          questions.slice(0, 4).map((q, idx) => {
            const mockTimes = ['2h ago', '1d ago', '2d ago', '3d ago'];
            const displayTime = mockTimes[idx] || getRelativeTime(q.updated_at);
            return (
              <div
                key={q.id}
                onClick={() => onSelectQuestion(q.id)}
                className="p-3.5 rounded-xl bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/70 hover:border-slate-700 cursor-pointer transition flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="p-2.5 rounded-xl bg-[#14234B] text-blue-400 flex items-center justify-center flex-shrink-0">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 transition truncate">
                      {q.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {q.folder_path ? q.folder_path.replace(/^DSA \/ /, '') : 'Arrays'}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] text-slate-400 font-normal flex-shrink-0 ml-3">
                  {displayTime}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
