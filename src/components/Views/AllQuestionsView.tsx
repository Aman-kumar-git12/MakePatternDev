import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Circle,
  Star,
  ChevronRight,
  Plus,
  ExternalLink,
  Trash2,
  ArrowUpDown,
  List,
  LayoutGrid,
  Tag,
} from 'lucide-react';
import type { QuestionListItem, QuestionStatus } from '../../types/dsa';

interface AllQuestionsViewProps {
  questions: QuestionListItem[];
  onSelectQuestion: (questionId: string) => void;
  onToggleBookmark: (questionId: string) => void;
  onOpenNewQuestion: () => void;
  title?: string;
  subtitle?: string;
  initialStatus?: string;
  sortBy?: 'order' | 'updated' | 'title' | 'difficulty';
  onRenameQuestion?: (questionId: string, currentTitle: string) => void;
  onMoveQuestion?: (questionId: string, questionTitle: string) => void;
  onDeleteQuestion?: (questionId: string, questionTitle: string) => void;
}

export const AllQuestionsView: React.FC<AllQuestionsViewProps> = ({
  questions,
  onSelectQuestion,
  onToggleBookmark,
  onOpenNewQuestion,
  title = 'All Questions',
  subtitle = 'Browse, filter, and track questions across your entire curriculum',
  initialStatus = 'all',
  sortBy = 'updated',
  onDeleteQuestion,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [sortOption, setSortOption] = useState<'order' | 'updated' | 'title' | 'difficulty'>(sortBy as any);
  // Default to list view as requested
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

  useEffect(() => {
    setSelectedStatus(initialStatus);
  }, [initialStatus]);

  const filtered = useMemo(() => {
    return questions
      .filter((q) => {
        const matchesSearch =
          q.title.toLowerCase().includes(search.toLowerCase()) ||
          (q.folder_path && q.folder_path.toLowerCase().includes(search.toLowerCase())) ||
          q.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));

        const matchesDifficulty =
          selectedDifficulty === 'all' || q.difficulty === selectedDifficulty;

        const matchesStatus =
          selectedStatus === 'all' || q.status === selectedStatus;

        return matchesSearch && matchesDifficulty && matchesStatus;
      })
      .sort((a, b) => {
        if (sortOption === 'order') {
          const posA = a.position ?? 0;
          const posB = b.position ?? 0;
          if (posA !== posB) return posA - posB;
          const dateA = new Date(a.created_at || a.updated_at || '').getTime();
          const dateB = new Date(b.created_at || b.updated_at || '').getTime();
          return dateA - dateB;
        }
        if (sortOption === 'title') {
          return a.title.localeCompare(b.title);
        }
        if (sortOption === 'difficulty') {
          const diffMap: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };
          return diffMap[a.difficulty] - diffMap[b.difficulty];
        }
        // Recently updated
        const dateA = new Date(a.updated_at || '').getTime();
        const dateB = new Date(b.updated_at || '').getTime();
        return dateB - dateA;
      });
  }, [questions, search, selectedDifficulty, selectedStatus, sortOption]);

  const difficultyColors = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-yellow-300 bg-[#fef08a]/15 border border-[#fef08a]/30',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  const renderStatusIcon = (status: QuestionStatus) => {
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-[#fef08a]/20 border border-[#fef08a]/35 text-yellow-300 shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>

        <button
          onClick={onOpenNewQuestion}
          className="flex items-center space-x-2 px-4 py-2.5 bg-[#fef08a] hover:bg-[#fef9c3] text-[#18181b] rounded-xl text-xs font-semibold shadow-md shadow-yellow-200/30 active:scale-95 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Question</span>
        </button>
      </div>

      {/* Filter and Search Bar with View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0D1527] border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, topic, or tag..."
            className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-inner"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty filter */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer hover:border-slate-600 transition"
          >
            <option value="all">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer hover:border-slate-600 transition"
          >
            <option value="all">All Statuses</option>
            <option value="Solved">Solved</option>
            <option value="In Progress">In Progress</option>
            <option value="Needs Revision">Needs Revision</option>
            <option value="Not Started">Not Started</option>
          </select>

          {/* Sort option */}
          <div className="flex items-center space-x-1.5 bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-2.5 py-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="order" className="bg-[#0A0F1D]">Order (First Added First)</option>
              <option value="updated" className="bg-[#0A0F1D]">Recently Updated</option>
              <option value="title" className="bg-[#0A0F1D]">Title (A-Z)</option>
              <option value="difficulty" className="bg-[#0A0F1D]">Difficulty</option>
            </select>
          </div>

          {/* List View vs Card View Toggle Buttons (Default: List View) */}
          <div className="flex items-center p-1 bg-[#0A0F1D] border border-slate-700/80 rounded-xl space-x-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === 'list'
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
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === 'card'
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

      {/* Questions Content */}
      {viewMode === 'list' ? (
        /* 1. LIST VIEW (Default) */
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/40">
            <span>Showing {filtered.length} questions</span>
            {selectedStatus !== 'all' && (
              <button
                onClick={() => setSelectedStatus('all')}
                className="text-xs text-blue-400 hover:underline"
              >
                Clear status filter
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-800/60">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No questions match your current filters.
              </div>
            ) : (
              filtered.map((q) => (
                <div
                  key={q.id}
                  onClick={() => onSelectQuestion(q.id)}
                  className="p-4 hover:bg-slate-800/40 cursor-pointer transition flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0 pr-4">
                    <div className="flex-shrink-0" title={`Status: ${q.status}`}>
                      {renderStatusIcon(q.status)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h4 className="font-semibold text-sm text-slate-100 group-hover:text-yellow-300 transition truncate">
                          {q.title}
                        </h4>
                        {/* Difficulty tag right to question title */}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                            difficultyColors[q.difficulty] || 'text-slate-400'
                          }`}
                        >
                          {q.difficulty}
                        </span>
                        {q.is_bookmarked && (
                          <Star className="w-3.5 h-3.5 text-yellow-300 fill-[#fef08a] flex-shrink-0" />
                        )}
                        {q.problem_url && (
                          <a
                            href={q.problem_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-500 hover:text-blue-400 transition"
                            title="Open problem link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 truncate mt-1">
                        <span>{q.folder_path || 'All Questions'}</span>
                        {q.tags && q.tags.length > 0 && (
                          <div className="flex items-center space-x-1 hidden sm:inline-flex">
                            {q.tags.slice(0, 2).map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-400 border border-slate-700/50"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 flex-shrink-0">

                    <span className="text-xs text-slate-400 hidden md:inline-block">
                      {q.status}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBookmark(q.id);
                      }}
                      className="p-1 text-slate-400 hover:text-yellow-300 transition"
                      title="Toggle bookmark"
                    >
                      <Star
                        className={`w-4 h-4 ${q.is_bookmarked ? 'fill-[#fef08a] text-yellow-300' : ''
                          }`}
                      />
                    </button>

                    {onDeleteQuestion && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteQuestion(q.id, q.title);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
                        title="Delete question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* 2. CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full p-12 text-center text-xs text-slate-500 bg-[#0D1527] border border-slate-800 rounded-2xl">
              No questions match your current filters.
            </div>
          ) : (
            filtered.map((q) => (
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

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(q.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-yellow-300 hover:bg-slate-800 transition"
                        title="Toggle bookmark"
                      >
                        <Star
                          className={`w-4 h-4 ${q.is_bookmarked ? 'fill-[#fef08a] text-yellow-300' : ''
                            }`}
                        />
                      </button>

                      {onDeleteQuestion && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteQuestion(q.id, q.title);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Delete question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-wrap gap-y-1 mb-1">
                    <h3 className="font-bold text-base text-white group-hover:text-blue-300 transition leading-snug">
                      {q.title}
                    </h3>
                    {/* Difficulty tag right to question title */}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${difficultyColors[q.difficulty] || 'text-slate-400'
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
            ))
          )}
        </div>
      )}
    </div>
  );
};
