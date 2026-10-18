import React from 'react';
import { Zap, FileCode, ChevronRight } from 'lucide-react';
import type { QuestionListItem } from '../../types/dsa';

interface ContinueLearningProps {
  questions: QuestionListItem[];
  onSelectQuestion: (questionId: string) => void;
  onViewAll: () => void;
}

export const ContinueLearning: React.FC<ContinueLearningProps> = ({
  questions,
  onSelectQuestion,
  onViewAll,
}) => {
  const difficultyColors = {
    Easy: 'text-[#34D399] bg-[#0A3326] border-[#10B981]/40',
    Medium: 'text-[#FBBF24] bg-[#3B230B] border-[#F59E0B]/40',
    Hard: 'text-[#F87171] bg-[#421319] border-[#EF4444]/40',
  };

  return (
    <div className="bg-[#0D1527] border border-slate-800/90 rounded-2xl p-5 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-blue-400 fill-blue-400" />
          <h3 className="text-sm font-bold text-white">Continue Learning</h3>
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
            No questions in progress yet. Pick a question to begin practice!
          </div>
        ) : (
          questions.slice(0, 4).map((q) => (
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

              <div className="flex items-center space-x-3 flex-shrink-0 ml-3">
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    difficultyColors[q.difficulty] || 'text-slate-400'
                  }`}
                >
                  {q.difficulty}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
