import React, { useState } from 'react';
import { Bookmark, Star, Search, Tag, ChevronRight, Trash2 } from 'lucide-react';
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
    Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-md">
            <Bookmark className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Bookmarked Questions</h2>
            <p className="text-xs text-slate-400">
              Quick access to your high-priority and revision problems
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          <span>{filtered.length} bookmarks saved</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0D1527] border border-slate-800 rounded-2xl p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in bookmarks..."
            className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Solved">Solved</option>
            <option value="In Progress">In Progress</option>
            <option value="Needs Revision">Needs Revision</option>
            <option value="Not Started">Not Started</option>
          </select>
        </div>
      </div>

      {/* Bookmarks List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-[#0D1527] border border-slate-800 rounded-2xl">
          <Star className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-300">No bookmarks found</h3>
          <p className="text-xs text-slate-500 mt-1">
            Click the star icon on any question to bookmark it for revision.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((q) => (
            <div
              key={q.id}
              onClick={() => onSelectQuestion(q.id)}
              className="bg-[#0D1527] border border-slate-800 hover:border-blue-500/40 rounded-2xl p-5 shadow-lg shadow-black/20 hover:shadow-blue-500/5 cursor-pointer transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                      difficultyColors[q.difficulty] || 'text-slate-400'
                    }`}
                  >
                    {q.difficulty}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBookmark(q.id);
                    }}
                    className="p-1.5 rounded-lg text-amber-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    title="Remove bookmark"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="font-bold text-base text-white group-hover:text-blue-300 transition mb-1 leading-snug">
                  {q.title}
                </h3>

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
