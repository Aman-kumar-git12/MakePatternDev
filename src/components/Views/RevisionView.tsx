import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  CheckCircle2,
  Clock,
  Circle,
  ExternalLink,
  ArrowRight,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import type { QuestionListItem, Difficulty } from '../../types/dsa';

interface RevisionViewProps {
  questions: QuestionListItem[];
  onSelectQuestion: (questionId: string) => void;
  onToggleRevision: (questionId: string, isChecked: boolean) => Promise<void> | void;
  onToggleBookmark?: (questionId: string) => void;
}

export const RevisionView: React.FC<RevisionViewProps> = ({
  questions,
  onSelectQuestion,
  onToggleRevision,
}) => {
  const [search, setSearch] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'flagged' | 'unflagged'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Live Counts for Revision KPIs
  const revisionQuestions = useMemo(
    () => questions.filter((q) => q.status === 'Needs Revision'),
    [questions]
  );

  const totalCount = questions.length;
  const revisionCount = revisionQuestions.length;
  const unflaggedCount = Math.max(0, totalCount - revisionCount);

  // Filtered List
  const filtered = useMemo(() => {
    return questions.filter((q) => {
      // Search
      const query = search.toLowerCase();
      const matchesSearch =
        !search.trim() ||
        q.title.toLowerCase().includes(query) ||
        (q.folder_path && q.folder_path.toLowerCase().includes(query)) ||
        q.tags?.some((t) => t.toLowerCase().includes(query));

      // Difficulty
      const matchesDiff = filterDifficulty === 'all' || q.difficulty === filterDifficulty;

      // Tab filter
      const isRevision = q.status === 'Needs Revision';
      const matchesTab =
        activeTab === 'all'
          ? true
          : activeTab === 'flagged'
          ? isRevision
          : !isRevision;

      return matchesSearch && matchesDiff && matchesTab;
    });
  }, [questions, search, filterDifficulty, activeTab]);

  const handleCheckboxClick = async (e: React.MouseEvent, q: QuestionListItem) => {
    e.stopPropagation();
    const isCurrentlyRevision = q.status === 'Needs Revision';
    setUpdatingId(q.id);
    try {
      await onToggleRevision(q.id, !isCurrentlyRevision);
    } finally {
      setUpdatingId(null);
    }
  };

  const difficultyColors: Record<Difficulty, string> = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  const renderStatusBadge = (q: QuestionListItem) => {
    if (q.status === 'Needs Revision') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <RotateCcw className="w-3 h-3 text-amber-400 animate-spin-slow" />
          <span>Needs Revision</span>
        </span>
      );
    }
    if (q.status === 'Solved') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" />
          <span>Solved</span>
        </span>
      );
    }
    if (q.status === 'In Progress') {
      return (
        <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Clock className="w-3 h-3" />
          <span>In Progress</span>
        </span>
      );
    }
    return (
      <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700/50">
        <Circle className="w-3 h-3" />
        <span>Not Started</span>
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in font-sans">
      {/* 1. VIEW HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="flex items-center space-x-4 relative z-10">
          <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/35 text-amber-400 shadow-lg shadow-amber-500/10">
            <RotateCcw className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Revision Center
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Active Recall
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Tick the checkbox on any question to mark it for revision. Live KPIs update instantly across your dashboard and curriculum.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0 relative z-10">
          <div className="px-4 py-2.5 rounded-xl bg-[#0A0F1D] border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Revision Queue
            </div>
            <div className="text-xl font-extrabold text-amber-300 font-mono">
              {revisionCount}
            </div>
          </div>
        </div>
      </div>



      {/* 3. FILTER, SEARCH & TAB CONTROLS */}
      <div className="space-y-3 bg-[#0D1527] border border-slate-800 rounded-2xl p-4 shadow-lg">
        {/* Top Control Bar: Tabs + Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Quick Filter Tabs */}
          <div className="flex items-center space-x-1 p-1 rounded-xl bg-[#0A0F1D] border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              All Questions ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab('flagged')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'flagged'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/30'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-amber-950/20'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Flagged ({revisionCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('unflagged')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'unflagged'
                  ? 'bg-slate-700 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Unflagged ({unflaggedCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, topic, or tag..."
              className="w-full bg-[#0A0F1D] border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition"
            />
          </div>
        </div>

        {/* Bottom Sub-Filters: Difficulty Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center space-x-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 text-[11px] font-medium mr-1">Difficulty:</span>
            {['all', 'Easy', 'Medium', 'Hard'].map((diff) => (
              <button
                key={diff}
                onClick={() => setFilterDifficulty(diff)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  filterDifficulty === diff
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {diff === 'all' ? 'All' : diff}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Showing {filtered.length} of {totalCount} questions
          </div>
        </div>
      </div>

      {/* 4. QUESTIONS LIST WITH CHECKBOXES */}
      <div className="space-y-2.5">
        {filtered.map((q) => {
          const isRevision = q.status === 'Needs Revision';
          const isUpdating = updatingId === q.id;

          return (
            <div
              key={q.id}
              onClick={() => onSelectQuestion(q.id)}
              className={`p-3.5 sm:p-4 rounded-2xl bg-[#0D1527] border transition-all duration-150 flex items-center justify-between gap-3 group cursor-pointer ${
                isRevision
                  ? 'border-amber-500/40 bg-amber-950/[0.08] shadow-[0_0_15px_rgba(245,158,11,0.06)]'
                  : 'border-slate-800/80 hover:border-slate-700 hover:bg-[#10182C]'
              }`}
            >
              {/* Left Column: Interactive Revision Checkbox & Question Details */}
              <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                {/* Dedicated Revision Checkbox */}
                <button
                  type="button"
                  onClick={(e) => handleCheckboxClick(e, q)}
                  disabled={isUpdating}
                  title={isRevision ? 'Uncheck to remove from Revision' : 'Check to mark for Revision'}
                  className={`p-1.5 rounded-xl transition-all duration-150 shrink-0 cursor-pointer ${
                    isRevision
                      ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/30'
                      : 'bg-[#0A0F1D] text-slate-500 border border-slate-700 hover:border-amber-400 hover:text-amber-400'
                  } ${isUpdating ? 'opacity-50 animate-pulse' : ''}`}
                >
                  {isRevision ? (
                    <CheckSquare className="w-5 h-5 stroke-[2.4]" />
                  ) : (
                    <Square className="w-5 h-5 stroke-[1.8]" />
                  )}
                </button>

                {/* Question Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-sm font-semibold truncate transition ${
                        isRevision
                          ? 'text-white group-hover:text-amber-300'
                          : 'text-slate-200 group-hover:text-white'
                      }`}
                    >
                      {q.title}
                    </span>
                    {q.folder_path && (
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#0A0F1D] text-slate-400 border border-slate-800 truncate max-w-[200px]">
                        {q.folder_path}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {q.tags && q.tags.length > 0 && (
                    <div className="flex items-center space-x-1.5 mt-1">
                      {q.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.2 rounded text-[10px] font-mono text-slate-500 bg-slate-800/60"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Difficulty, Status Badge & Action */}
              <div className="flex items-center space-x-3 shrink-0">
                {/* Difficulty */}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    difficultyColors[q.difficulty] || 'text-slate-400 bg-slate-800 border-slate-700'
                  }`}
                >
                  {q.difficulty}
                </span>

                {/* Status Badge */}
                <div className="hidden sm:block">
                  {renderStatusBadge(q)}
                </div>

                {/* External URL if any */}
                {q.problem_url && (
                  <a
                    href={q.problem_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800 transition"
                    title="Open external problem link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {/* Solve/Practice Button */}
                <button
                  onClick={() => onSelectQuestion(q.id)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white transition shadow-sm active:scale-95"
                >
                  <span>Practice</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center bg-[#0D1527] border border-slate-800 rounded-2xl p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No questions found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {activeTab === 'flagged'
                ? 'No questions are currently checked for revision. Tick the checkbox on any question to add it to your revision queue!'
                : 'No questions match your current search or filter criteria.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
