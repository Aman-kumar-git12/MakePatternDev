import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  RotateCcw,
  Search,
  ExternalLink,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  X,
  AlertCircle,
  Shuffle,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';
import type { QuestionListItem, Difficulty } from '../../types/dsa';
import { api } from '../../services/api';

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

  // Random Questions state
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  const [randomCount, setRandomCount] = useState<number>(3);
  const [randomSource, setRandomSource] = useState<'all' | 'not_revised' | 'revision'>('all');
  const [isLoadingRandom, setIsLoadingRandom] = useState(false);
  const [randomQuestions, setRandomQuestions] = useState<QuestionListItem[] | null>(null);
  const [randomError, setRandomError] = useState<string | null>(null);

  // Global counts
  const revisionQuestions = useMemo(
    () => questions.filter((q) => q.status === 'Needs Revision'),
    [questions]
  );
  const totalCount = questions.length;
  const revisionCount = revisionQuestions.length;
  const unflaggedCount = Math.max(0, totalCount - revisionCount);

  // Keep randomQuestions statuses in sync when parent questions prop updates
  useEffect(() => {
    if (!randomQuestions) return;
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    setRandomQuestions((prev) => {
      if (!prev) return null;
      return prev.map((item) => {
        const updated = questionMap.get(item.id);
        return updated ? { ...item, ...updated } : item;
      });
    });
  }, [questions]);

  // Base list of questions to display: either random selection or all questions
  const displayedQuestions = useMemo(() => {
    return randomQuestions !== null ? randomQuestions : questions;
  }, [randomQuestions, questions]);

  // Filtered List
  const filtered = useMemo(() => {
    return displayedQuestions.filter((q) => {
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
  }, [displayedQuestions, search, filterDifficulty, activeTab]);

  const handleCheckboxClick = async (e: React.MouseEvent, q: QuestionListItem) => {
    e.stopPropagation();
    const isCurrentlyRevision = q.status === 'Needs Revision';
    setUpdatingId(q.id);
    try {
      await onToggleRevision(q.id, !isCurrentlyRevision);
      if (randomQuestions) {
        setRandomQuestions((prev) =>
          prev
            ? prev.map((item) =>
                item.id === q.id
                  ? { ...item, status: !isCurrentlyRevision ? 'Needs Revision' : 'Solved' }
                  : item
              )
            : null
        );
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleFindRandomQuestions = async () => {
    setIsLoadingRandom(true);
    setRandomError(null);
    try {
      const res = await api.getRandomQuestions({
        count: randomCount,
        pool: randomSource,
        only_revision: randomSource === 'revision',
      });
      if (!res || res.length === 0) {
        setRandomError(
          randomSource === 'revision'
            ? 'No questions found in Revision Queue. Flag questions for revision first, or choose "All Questions".'
            : randomSource === 'not_revised'
            ? 'No unrevised questions found. All questions are currently in the Revision Queue.'
            : 'No questions available in the tracker.'
        );
        return;
      }
      setRandomQuestions(res);
      setIsRandomModalOpen(false);
      showToast(`Selected ${res.length} random question${res.length > 1 ? 's' : ''}`);
    } catch (err: any) {
      console.error('Failed to get random questions:', err);
      setRandomError(err.message || 'Failed to fetch random questions');
    } finally {
      setIsLoadingRandom(false);
    }
  };

  const difficultyColors: Record<Difficulty, string> = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleRedirectionClick = (e: React.MouseEvent, q: QuestionListItem) => {
    e.stopPropagation();
    if (q.problem_url && q.problem_url.trim()) {
      const rawUrl = q.problem_url.trim();
      const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      showToast(`No question link is present for "${q.title}"`);
    }
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

        {/* Right side controls: Get Random Questions button & Revision Queue counter */}
        <div className="flex items-center space-x-3 shrink-0 relative z-10">
          <button
            onClick={() => {
              setRandomCount(Math.min(5, Math.max(1, totalCount > 0 ? Math.min(totalCount, 5) : 3)));
              setRandomSource('all');
              setRandomError(null);
              setIsRandomModalOpen(true);
            }}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all duration-150 cursor-pointer"
          >
            <Shuffle className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Get Random Questions</span>
            <span className="sm:hidden">Random</span>
          </button>

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

      {/* 2. RANDOM PRACTICE MODE BANNER (When random questions are active) */}
      {randomQuestions !== null && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 shadow-lg animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Random Practice Set</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/25 text-amber-300 border border-amber-500/40">
                  {randomQuestions.length} Questions
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  ({randomSource === 'all'
                    ? 'from All Questions'
                    : randomSource === 'not_revised'
                    ? 'from Not Revised Questions'
                    : 'from Revision Queue'})
                </span>
              </div>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Practicing these randomly picked questions on this revision page.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleFindRandomQuestions}
              disabled={isLoadingRandom}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 text-xs font-semibold transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoadingRandom ? 'animate-spin' : ''}`} />
              <span>Reroll</span>
            </button>
            <button
              onClick={() => setRandomQuestions(null)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition active:scale-95 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Show All Questions</span>
            </button>
          </div>
        </div>
      )}

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
            Showing {filtered.length} of {displayedQuestions.length} questions {randomQuestions !== null ? '(Random Mode)' : ''}
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
                  title={isRevision ? 'Remove from revision queue' : 'Mark for revision'}
                  disabled={isUpdating}
                  onClick={(e) => handleCheckboxClick(e, q)}
                  className={`p-1.5 rounded-xl border transition-all duration-200 shrink-0 cursor-pointer ${
                    isRevision
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30 shadow-md shadow-amber-500/10'
                      : 'bg-slate-900 border-slate-700/80 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  {isUpdating ? (
                    <RotateCcw className="w-5 h-5 animate-spin text-amber-400" />
                  ) : isRevision ? (
                    <CheckSquare className="w-5 h-5 stroke-[2.4]" />
                  ) : (
                    <Square className="w-5 h-5 stroke-[1.8]" />
                  )}
                </button>

                {/* Title & Metadata */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                    <span className="font-semibold text-sm sm:text-base text-slate-200 group-hover:text-amber-300 transition truncate">
                      {q.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        difficultyColors[q.difficulty] || difficultyColors.Medium
                      }`}
                    >
                      {q.difficulty}
                    </span>
                    {isRevision && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 tracking-wider">
                        Needs Revision
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 mt-1 text-xs text-slate-400 flex-wrap gap-y-1">
                    {q.folder_path && (
                      <span className="truncate max-w-xs text-slate-400 font-mono text-[11px]">
                        📁 {q.folder_path}
                      </span>
                    )}
                    {q.tags && q.tags.length > 0 && (
                      <div className="flex items-center space-x-1.5">
                        {q.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700/50"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Link Redirection & Action chevron */}
              <div className="flex items-center space-x-2 shrink-0">
                {q.problem_url && q.problem_url.trim() ? (
                  <button
                    type="button"
                    onClick={(e) => handleRedirectionClick(e, q)}
                    title={`Open problem link in new tab: ${q.problem_url}`}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-medium transition cursor-pointer active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden md:inline text-[11px]">Problem</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleRedirectionClick(e, q)}
                    title="No link provided"
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-500 hover:text-slate-400 border border-slate-700/40 text-xs font-medium transition cursor-pointer active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5 opacity-40" />
                    <span className="hidden md:inline text-[11px] opacity-60">No Link</span>
                  </button>
                )}

                <div className="p-1.5 rounded-lg text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition">
                  <ArrowRight className="w-4 h-4" />
                </div>
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
              {randomQuestions !== null
                ? 'No questions matched in this random practice set. You can reroll or click "Show All Questions" to clear the filter.'
                : activeTab === 'flagged'
                ? 'No questions are currently checked for revision. Tick the checkbox on any question to add it to your revision queue!'
                : 'No questions match your current search or filter criteria.'}
            </p>
            {randomQuestions !== null && (
              <button
                type="button"
                onClick={() => setRandomQuestions(null)}
                className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Show All Questions
              </button>
            )}
          </div>
        )}
      </div>

      {/* 5. GET RANDOM QUESTIONS MODAL */}
      {isRandomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-[#0D1527] border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 relative animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsRandomModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Shuffle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Get Random Questions</h3>
                <p className="text-xs text-slate-400">Pick up to 5 random questions to practice active recall</p>
              </div>
            </div>

            {randomError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{randomError}</span>
              </div>
            )}

            {/* Number of Questions Selector */}
            <div className="space-y-2.5 mb-5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  How many random questions do you want?
                </label>
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  Max 5
                </span>
              </div>

              {/* Counter controls + Presets */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center bg-[#0A0F1D] border border-slate-800 rounded-xl p-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRandomCount((c) => Math.max(1, c - 1))}
                    disabled={randomCount <= 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={randomCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) {
                        setRandomCount(Math.min(5, Math.max(1, val)));
                      }
                    }}
                    className="w-12 text-center bg-transparent font-bold text-white text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => setRandomCount((c) => Math.min(5, c + 1))}
                    disabled={randomCount >= 5}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick preset chips */}
                <div className="flex items-center space-x-1.5 flex-1">
                  {[1, 2, 3, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRandomCount(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        randomCount === num
                          ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                          : 'bg-[#0A0F1D] text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scope: Question Pool (All Questions on left by default) */}
            <div className="space-y-2 mb-6">
              <label className="text-xs font-semibold text-slate-300 block">Question Pool</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. All Questions (Default on the left) */}
                <button
                  type="button"
                  onClick={() => setRandomSource('all')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    randomSource === 'all'
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                      : 'bg-[#0A0F1D] border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold truncate">All Questions</div>
                  <div className="text-[11px] opacity-75 mt-0.5">{totalCount} total tracked</div>
                </button>

                {/* 2. Not Revised Questions */}
                <button
                  type="button"
                  onClick={() => setRandomSource('not_revised')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    randomSource === 'not_revised'
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                      : 'bg-[#0A0F1D] border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold truncate">Not Revised</div>
                  <div className="text-[11px] opacity-75 mt-0.5">{unflaggedCount} questions</div>
                </button>

                {/* 3. Revision Queue */}
                <button
                  type="button"
                  onClick={() => setRandomSource('revision')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    randomSource === 'revision'
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                      : 'bg-[#0A0F1D] border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold truncate">Revision Queue</div>
                  <div className="text-[11px] opacity-75 mt-0.5">{revisionCount} flagged</div>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsRandomModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoadingRandom}
                onClick={handleFindRandomQuestions}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/25 active:scale-95 disabled:opacity-50 transition cursor-pointer"
              >
                {isLoadingRandom ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Finding...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Find Questions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92vw] sm:w-auto px-4 py-3 rounded-2xl bg-[#0D1527]/95 backdrop-blur-md border border-amber-500/40 text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center space-x-3 animate-fade-in"
          style={{
            boxShadow: '0 8px 30px rgba(245, 158, 11, 0.22), 0 4px 16px rgba(0,0,0,0.8)',
          }}
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Notification
            </div>
            <p className="text-xs text-slate-200 mt-0.5 leading-snug">
              {toastMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition shrink-0 cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
