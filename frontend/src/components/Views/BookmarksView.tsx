import React, { useState } from 'react';
import {
  Bookmark,
  Star,
  Search,
  Tag,
  ChevronRight,
  Trash2,
  List,
  LayoutGrid,
  CheckCircle2,
  Clock,
  RotateCcw,
  Circle,
  ExternalLink,
} from 'lucide-react';
import type { QuestionListItem } from '../../types/dsa';

interface BookmarksViewProps {
  questions: QuestionListItem[];
  onSelectQuestion: (questionId: string) => void;
  onRemoveBookmark: (questionId: string) => void;
}

export const BookmarksView: React.FC<BookmarksViewProps> = ({
  questions,
  onSelectQuestion,
  onRemoveBookmark,
}) => {
  const [search, setSearch] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  // Default view is 'list' as requested
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  const filtered = questions.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      (q.folder_path && q.folder_path.toLowerCase().includes(search.toLowerCase())) ||
      q.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesDiff = filterDifficulty === 'all' || q.difficulty === filterDifficulty;
    const matchesStatus = filterStatus === 'all' || q.status === filterStatus;

    return matchesSearch && matchesDiff && matchesStatus;
  });

  const difficultyColors = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-yellow-300 bg-[#fef08a]/15 border border-[#fef08a]/30',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'Solved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'In Progress':
        return <Clock className="w-4 h-4 text-yellow-300" />;
      case 'Needs Revision':
        return <RotateCcw className="w-4 h-4 text-yellow-300" />;
      default:
        return <Circle className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in font-sans">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-[#fef08a]/20 border border-[#fef08a]/35 text-yellow-300 shadow-md">
            <Bookmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Bookmarked Questions</h2>
            <p className="text-xs text-slate-400">
              Quick access to your high-priority and revision problems
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-slate-400 font-mono">
            {filtered.length} {filtered.length === 1 ? 'bookmark' : 'bookmarks'} saved
          </span>
        </div>
      </div>

      {/* Filter & Search Bar with View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0D1527] border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in bookmarks..."
            className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-inner"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty Filter */}
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer hover:border-slate-600 transition"
          >
            <option value="all">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer hover:border-slate-600 transition"
          >
            <option value="all">All Statuses</option>
            <option value="Solved">Solved</option>
            <option value="In Progress">In Progress</option>
            <option value="Needs Revision">Needs Revision</option>
            <option value="Not Started">Not Started</option>
          </select>

          {/* List View vs Card View Toggle Buttons (Default: List View) */}
          <div className="flex items-center p-1 bg-[#0A0F1D] border border-slate-700/80 rounded-xl space-x-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-[#fef08a] text-[#18181b] shadow-md shadow-yellow-200/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Switch to List View"
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'card'
                  ? 'bg-[#fef08a] text-[#18181b] shadow-md shadow-yellow-200/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Switch to Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bookmarks Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-[#0D1527] border border-slate-800 rounded-2xl shadow-xl">
          <Star className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-300">No bookmarks found</h3>
          <p className="text-xs text-slate-500 mt-1">
            Click the bookmark icon on any question to add it here.
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* 1. LIST VIEW (Default) */
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Showing {filtered.length} bookmarked items</span>
            <span className="text-[11px] text-slate-500">Click any row to open workspace</span>
          </div>

          <div className="divide-y divide-slate-800/70">
            {filtered.map((q) => (
              <div
                key={q.id}
                onClick={() => onSelectQuestion(q.id)}
                className="p-4 hover:bg-slate-800/40 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                {/* Left: Status icon, Title, Path */}
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <div className="flex-shrink-0" title={`Status: ${q.status}`}>
                    {renderStatusIcon(q.status)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h4 className="font-semibold text-sm text-slate-100 group-hover:text-yellow-300 transition truncate">
                        {q.title}
                      </h4>
                      {/* Difficulty tag right to question title */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider text-center shrink-0 ${
                          difficultyColors[q.difficulty] || 'text-slate-400'
                        }`}
                      >
                        {q.difficulty}
                      </span>
                      <Star className="w-3.5 h-3.5 text-yellow-300 fill-[#fef08a] flex-shrink-0" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span className="text-slate-500 truncate max-w-xs">{q.folder_path || 'DSA'}</span>
                      {q.tags && q.tags.length > 0 && (
                        <div className="hidden md:flex items-center space-x-1">
                          <span className="text-slate-600">•</span>
                          {q.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions and right side link */}
                <div className="flex items-center space-x-2.5 sm:space-x-3 flex-shrink-0">

                  {/* Status text (Fixed width prevents tag jumping) */}
                  <div className="w-28 hidden sm:flex items-center text-xs text-slate-400 shrink-0">
                    <span className="truncate">{q.status}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBookmark(q.id);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
                    title="Remove from bookmarks"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Right side: Link */}
                  <div className="w-7 flex items-center justify-center shrink-0">
                    {q.problem_url && q.problem_url.trim() ? (
                      <a
                        href={q.problem_url.trim()}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition flex items-center justify-center"
                        title={`Open problem link: ${q.problem_url}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span
                        className="p-1 text-slate-700/40 cursor-not-allowed flex items-center justify-center"
                        title="No problem link provided"
                      >
                        <ExternalLink className="w-3.5 h-3.5 opacity-20" />
                      </span>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* 2. CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((q) => (
            <div
              key={q.id}
              onClick={() => onSelectQuestion(q.id)}
              className="bg-[#0D1527] border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 hover:shadow-blue-500/5 cursor-pointer transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {q.status}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBookmark(q.id);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    title="Remove bookmark"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center space-x-2 flex-wrap gap-y-1 mb-1">
                  <h3 className="font-bold text-base text-white group-hover:text-blue-300 transition leading-snug">
                    {q.title}
                  </h3>
                  {/* Difficulty tag right to question title */}
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${
                      difficultyColors[q.difficulty] || 'text-slate-400'
                    }`}
                  >
                    {q.difficulty}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-4 truncate">
                  {q.folder_path || 'DSA'}
                </p>

                {/* Tags */}
                {q.tags && q.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {q.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-400"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span>{t}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium text-slate-300">{q.status}</span>
                <span className="text-blue-400 group-hover:translate-x-1 transition flex items-center space-x-1">
                  <span>Open</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
