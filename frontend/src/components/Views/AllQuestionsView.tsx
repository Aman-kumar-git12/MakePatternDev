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
  sortBy?: 'updated' | 'title' | 'difficulty';
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
  onRenameQuestion: _onRenameQuestion,
  onMoveQuestion: _onMoveQuestion,
  onDeleteQuestion,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [sortOption, setSortOption] = useState<'updated' | 'title' | 'difficulty'>(sortBy);

  useEffect(() => {
    setSelectedStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setSortOption(sortBy);
  }, [sortBy]);

  const filtered = useMemo(() => {
    const list = questions.filter((q) => {
      const matchesSearch =
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        (q.folder_path && q.folder_path.toLowerCase().includes(search.toLowerCase())) ||
        (q.tags && q.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));

      const matchesDiff = selectedDifficulty === 'all' || q.difficulty === selectedDifficulty;
      const matchesStatus = selectedStatus === 'all' || q.status === selectedStatus;

      return matchesSearch && matchesDiff && matchesStatus;
    });

    return list.sort((a, b) => {
      if (sortOption === 'updated') {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      }
      if (sortOption === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortOption === 'difficulty') {
        const diffWeight = { Easy: 1, Medium: 2, Hard: 3 };
        return (diffWeight[a.difficulty] || 0) - (diffWeight[b.difficulty] || 0);
      }
      return 0;
    });
  }, [questions, search, selectedDifficulty, selectedStatus, sortOption]);

  const renderStatusIcon = (status: QuestionStatus) => {
    switch (status) {
      case 'Solved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'In Progress':
        return <Clock className="w-4 h-4 text-blue-400" />;
      case 'Needs Revision':
        return <RotateCcw className="w-4 h-4 text-amber-400" />;
      default:
        return <Circle className="w-4 h-4 text-slate-500" />;
    }
  };

  const difficultyColors = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        <button
          onClick={onOpenNewQuestion}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-medium text-xs shadow-lg shadow-blue-600/30 transition duration-150"
        >
          <Plus className="w-4 h-4" />
          <span>New Question</span>
        </button>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[#0D1527] border border-slate-800 rounded-2xl p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions by title, topic, or tag..."
            className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty filter */}
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer"
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
            className="bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer"
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
              <option value="updated" className="bg-[#0A0F1D]">Recently Updated</option>
              <option value="title" className="bg-[#0A0F1D]">Title (A-Z)</option>
              <option value="difficulty" className="bg-[#0A0F1D]">Difficulty</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {filtered.length} questions</span>
          {initialStatus !== 'all' && (
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
                  <div className="flex-shrink-0">{renderStatusIcon(q.status)}</div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-sm text-slate-100 group-hover:text-blue-300 transition truncate">
                        {q.title}
                      </h4>
                      {q.is_bookmarked && (
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
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
                      <span>{q.folder_path || 'DSA'}</span>
                      {q.tags && q.tags.length > 0 && (
                        <div className="flex items-center space-x-1 hidden sm:inline-flex">
                          {q.tags.slice(0, 2).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.2 rounded-md bg-slate-800/90 text-slate-400 border border-slate-700/50"
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
                  <span
                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      difficultyColors[q.difficulty] || 'text-slate-400'
                    }`}
                  >
                    {q.difficulty}
                  </span>

                  <span className="text-xs text-slate-400 hidden md:inline-block">
                    {q.status}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBookmark(q.id);
                    }}
                    className="p-1 text-slate-400 hover:text-amber-400 transition"
                    title="Toggle bookmark"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        q.is_bookmarked ? 'fill-amber-400 text-amber-400' : ''
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

                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
