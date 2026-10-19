import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  Search,
  Code2,
  X,
  FileText,
  User,
  Sparkles,
  Link2Off
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { api } from '../../services/api';
import type {
  PublicSharedPatternResponse,
  Folder,
  QuestionListItem,
  Question,
  Difficulty,
  SupportedLanguage
} from '../../types/dsa';

export const SharedPatternView: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicSharedPatternResponse | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Read-only question modal state
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [activeSolutionIndex, setActiveSolutionIndex] = useState(0);

  // Snackbar state for missing problem URL
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const snackbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const FUNNY_NO_LINK_MESSAGES = [
    "🕵️‍♂️ 404: Link Not Found! The sender forgot to attach the problem URL.",
    "🤷‍♂️ Sender said: 'Trust me bro, the problem exists!' (No link provided 😅)",
    "🦗 *crickets chirping*... The sender kept the problem link top secret! 🤫",
    "🚀 Houston, we have a problem... but the sender didn't give us the link to it! 🛰️",
    "👻 Whoosh! The link ghosted us. Guess you'll have to solve it from memory!",
    "📦 The sender shipped the code, but forgot to pack the problem link!",
    "☕ Looks like the sender needed one more cup of coffee before sharing this question!"
  ];

  const handleOpenProblemLink = () => {
    const rawUrl = activeQuestion?.problem_url?.trim();
    if (rawUrl) {
      const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      const randomMsg =
        FUNNY_NO_LINK_MESSAGES[Math.floor(Math.random() * FUNNY_NO_LINK_MESSAGES.length)];
      if (snackbarTimerRef.current) {
        clearTimeout(snackbarTimerRef.current);
      }
      setSnackbarMessage(randomMsg);
      snackbarTimerRef.current = setTimeout(() => {
        setSnackbarMessage(null);
      }, 4500);
    }
  };

  useEffect(() => {
    return () => {
      if (snackbarTimerRef.current) {
        clearTimeout(snackbarTimerRef.current);
      }
    };
  }, []);

  const patternsList = useMemo(() => {
    if (!data) return [];
    return data.patterns && data.patterns.length > 0
      ? data.patterns
      : (data.pattern ? [data.pattern] : []);
  }, [data]);

  const isAllPatterns = useMemo(() => {
    if (!data) return false;
    return data.share_type === 'all' || (!data.pattern && Boolean(data.patterns));
  }, [data]);

  // Compute aggregate metrics: total topics, total questions, easy count, med count, hard count
  const stats = useMemo(() => {
    let topicCount = 0;
    let questionCount = 0;
    let easyCount = 0;
    let medCount = 0;
    let hardCount = 0;

    const seenQuestions = new Set<string>();

    const traverse = (folder: Folder) => {
      topicCount += 1;
      if (folder.questions) {
        for (const q of folder.questions) {
          if (!seenQuestions.has(q.id)) {
            seenQuestions.add(q.id);
            questionCount += 1;
            if (q.difficulty === 'Easy') easyCount += 1;
            else if (q.difficulty === 'Medium') medCount += 1;
            else if (q.difficulty === 'Hard') hardCount += 1;
          }
        }
      }
      if (folder.subfolders) {
        for (const sf of folder.subfolders) {
          traverse(sf);
        }
      }
    };

    patternsList.forEach(traverse);

    return {
      totalTopics: topicCount,
      totalQuestions: questionCount,
      easyCount,
      medCount,
      hardCount,
    };
  }, [patternsList]);

  useEffect(() => {
    if (shareId) {
      loadSharedPattern(shareId);
    }
  }, [shareId]);

  const loadSharedPattern = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSharedPattern(id);
      setData(res);

      // Default all folders to expanded
      const initialExpanded: Record<string, boolean> = {};
      const expandFolder = (f: Folder) => {
        initialExpanded[f.id] = true;
        f.subfolders?.forEach(expandFolder);
      };
      if (res.patterns && res.patterns.length > 0) {
        res.patterns.forEach(expandFolder);
      } else if (res.pattern) {
        expandFolder(res.pattern);
      }
      setExpandedNodes(initialExpanded);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Shared pattern not found or inactive');
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleSelectQuestion = async (questionId: string) => {
    if (!shareId) return;
    setActiveQuestionId(questionId);
    setLoadingQuestion(true);
    setActiveSolutionIndex(0);
    try {
      const q = await api.getSharedQuestion(shareId, questionId);
      setActiveQuestion(q);
    } catch (err) {
      console.error('Failed to load question details:', err);
      alert('Failed to load question details');
      setActiveQuestionId(null);
    } finally {
      setLoadingQuestion(false);
    }
  };

  const closeQuestionModal = () => {
    setActiveQuestionId(null);
    setActiveQuestion(null);
  };

  const getDifficultyColor = (diff: Difficulty) => {
    switch (diff) {
      case 'Easy':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Medium':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'Hard':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };



  const monacoLanguage = (lang?: SupportedLanguage | string) => {
    switch (lang) {
      case 'python':
        return 'python';
      case 'cpp':
        return 'cpp';
      case 'java':
        return 'java';
      case 'javascript':
        return 'javascript';
      default:
        return 'python';
    }
  };

  // Filter helper
  const filterQuestion = (q: QuestionListItem) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      q.title.toLowerCase().includes(query) ||
      q.difficulty.toLowerCase().includes(query) ||
      q.tags?.some((t) => t.toLowerCase().includes(query))
    );
  };

  const filterFolder = (f: Folder): boolean => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    if (f.name.toLowerCase().includes(query)) return true;
    const hasMatchingQ = f.questions?.some(filterQuestion);
    const hasMatchingSub = f.subfolders?.some(filterFolder);
    return Boolean(hasMatchingQ || hasMatchingSub);
  };

  // Render questions
  const renderQuestionRow = (q: QuestionListItem) => {
    if (!filterQuestion(q)) return null;

    return (
      <div
        key={q.id}
        onClick={() => handleSelectQuestion(q.id)}
        className="flex items-center justify-between p-3 rounded-xl bg-[#0B101E] hover:bg-[#111A30] border border-slate-800/80 hover:border-blue-500/40 transition cursor-pointer group"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="shrink-0 p-1.5 rounded-lg bg-slate-800/80 text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/15 border border-slate-700/50 transition">
            <Code2 className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-medium text-slate-200 group-hover:text-blue-300 transition truncate">
            {q.title}
          </span>
          {/* Difficulty tag right to question title */}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${getDifficultyColor(
              q.difficulty
            )}`}
          >
            {q.difficulty}
          </span>
          {q.tags && q.tags.length > 0 && (
            <div className="hidden sm:flex items-center space-x-1">
              {q.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Controls: Right side actions */}
        <div className="flex items-center space-x-3 shrink-0">

          {/* Right side: Link (Fixed slot ensures tags and links stay in perfect vertical sequence) */}
          <div className="w-7 flex items-center justify-center shrink-0">
            {q.problem_url && q.problem_url.trim() ? (
              <a
                href={q.problem_url.trim()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition flex items-center justify-center"
                title={`Open problem link: ${q.problem_url}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span
                className="p-1.5 text-slate-700/50 cursor-not-allowed flex items-center justify-center"
                title="No problem link provided"
              >
                <ExternalLink className="w-3.5 h-3.5 opacity-25" />
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render Subfolder recursively
  const renderSubtopic = (node: Folder) => {
    if (!filterFolder(node)) return null;
    const isExpanded = expandedNodes[node.id] !== false;
    const visibleQuestions = (node.questions || []).filter(filterQuestion);
    const visibleSubfolders = (node.subfolders || []).filter(filterFolder);

    return (
      <div key={node.id} className="space-y-1.5">
        <div
          onClick={() => toggleNode(node.id)}
          className="flex items-center justify-between p-2.5 rounded-xl bg-[#0E162B] hover:bg-[#131E3B] border border-slate-800 transition cursor-pointer select-none"
        >
          <div className="flex items-center space-x-2 min-w-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span className="text-sm font-semibold text-white truncate">{node.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {node.question_count || (node.questions ? node.questions.length : 0)}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="pl-4 ml-2 border-l border-slate-800/80 space-y-2 py-1">
            {visibleSubfolders.map(renderSubtopic)}
            {visibleQuestions.map(renderQuestionRow)}
            {visibleSubfolders.length === 0 && visibleQuestions.length === 0 && (
              <div className="text-xs text-slate-500 py-1 italic">No questions in this section</div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse mb-4">
          <Layers className="w-6 h-6" />
        </div>
        <p className="text-slate-300 font-medium text-sm">Loading shared patterns...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Pattern Unavailable</h1>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          This shared pattern link is invalid, expired, revoked, or has been disabled by its owner.
        </p>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-lg shadow-blue-600/30"
        >
          Go to MakePattern
        </Link>
      </div>
    );
  }

  const { owner_name } = data;

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0A0F1D]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 group-hover:scale-105 transition">
              <Layers className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">MakePattern</span>
          </Link>
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>{isAllPatterns ? 'All Patterns (Read-Only)' : 'Shared Read-Only'}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleCopyLink}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
              copiedLink
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <Link
            to="/register"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Build Your Own</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 lg:px-8 py-8 space-y-6">
        {/* Pattern Banner */}
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs text-purple-400 font-medium">
                <User className="w-3.5 h-3.5" />
                <span>Curated by {owner_name}</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                {isAllPatterns ? 'All Topics & Patterns' : (data.pattern?.name || 'Shared Pattern')}
              </h1>
              <p className="text-sm text-slate-400 max-w-2xl">
                {isAllPatterns
                  ? 'Complete curated collection of Data Structures & Algorithms patterns and solutions'
                  : (data.pattern?.description || 'Curated DSA pattern')}
              </p>
            </div>

            {/* Quick Stats: Total Topics, Total Questions, Easy, Med, Hard */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Total Topics */}
              <div className="px-3.5 py-2 rounded-xl bg-[#0A0F1D]/90 border border-slate-800 text-center min-w-[72px]">
                <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                  Total Topics
                </div>
                <div className="text-base font-bold text-white mt-0.5">
                  {stats.totalTopics}
                </div>
              </div>

              {/* Total Questions */}
              <div className="px-3.5 py-2 rounded-xl bg-[#0A0F1D]/90 border border-slate-800 text-center min-w-[72px]">
                <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                  Total Questions
                </div>
                <div className="text-base font-bold text-white mt-0.5">
                  {stats.totalQuestions}
                </div>
              </div>

              {/* Easy Count */}
              <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-center min-w-[62px]">
                <div className="text-[10px] text-emerald-400 uppercase font-semibold tracking-wider">
                  Easy
                </div>
                <div className="text-base font-bold text-emerald-300 mt-0.5">
                  {stats.easyCount}
                </div>
              </div>

              {/* Med Count */}
              <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-center min-w-[62px]">
                <div className="text-[10px] text-amber-400 uppercase font-semibold tracking-wider">
                  Med
                </div>
                <div className="text-base font-bold text-amber-300 mt-0.5">
                  {stats.medCount}
                </div>
              </div>

              {/* Hard Count */}
              <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-center min-w-[62px]">
                <div className="text-[10px] text-rose-400 uppercase font-semibold tracking-wider">
                  Hard
                </div>
                <div className="text-base font-bold text-rose-300 mt-0.5">
                  {stats.hardCount}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search questions by title, difficulty, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0D1527] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div className="text-xs text-slate-500">
            Click on any question to view its solution and details
          </div>
        </div>

        {/* Pattern Content Tree(s) */}
        <div className="space-y-4">
          {patternsList.filter(filterFolder).map((pat) => {
            const isPatExpanded = expandedNodes[pat.id] !== false;
            const patDirectQuestions = (pat.questions || []).filter(filterQuestion);
            const patSubfolders = (pat.subfolders || []).filter(filterFolder);

            return (
              <div
                key={pat.id}
                className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4"
              >
                {/* Topic Header */}
                <div
                  onClick={() => toggleNode(pat.id)}
                  className="flex items-center justify-between cursor-pointer select-none group pb-1"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 rounded-lg bg-blue-600/10 text-blue-400 group-hover:bg-blue-600/20 transition">
                      {isPatExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white group-hover:text-blue-300 transition">
                        {pat.name}
                      </h2>
                      {pat.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{pat.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-mono">
                      {pat.question_count || (pat.questions ? pat.questions.length : 0)} questions
                    </span>
                  </div>
                </div>

                {isPatExpanded && (
                  <div className="space-y-4 pt-2">
                    {/* Subtopics */}
                    {patSubfolders.map(renderSubtopic)}

                    {/* Direct questions */}
                    {patDirectQuestions.length > 0 && (
                      <div className="space-y-2 pt-2">
                        {patSubfolders.length > 0 && (
                          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
                            General Questions
                          </div>
                        )}
                        {patDirectQuestions.map(renderQuestionRow)}
                      </div>
                    )}

                    {patSubfolders.length === 0 && patDirectQuestions.length === 0 && (
                      <div className="py-6 text-center text-slate-500 text-xs italic">
                        No questions in this section yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {patternsList.filter(filterFolder).length === 0 && (
            <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-sm">
              No topics or questions found matching your search.
            </div>
          )}
        </div>
      </main>

      {/* Read-Only Question Detail Modal */}
      {activeQuestionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0D1527] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative text-slate-100 overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-[#0A0F1D]/80">
              <div className="flex items-center space-x-3 min-w-0 pr-4">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-white truncate">
                      {activeQuestion?.title || 'Loading Question...'}
                    </h2>
                    {activeQuestion && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getDifficultyColor(
                          activeQuestion.difficulty
                        )}`}
                      >
                        {activeQuestion.difficulty}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                    <span className="flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-purple-300">Read-Only Mode</span>
                    </span>
                    {activeQuestion?.problem_url && (
                      <>
                        <span>•</span>
                        <a
                          href={activeQuestion.problem_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline flex items-center space-x-1"
                        >
                          <span>Problem Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Top-Right Action Buttons: Open Link & Close Modal */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenProblemLink}
                  title={
                    activeQuestion?.problem_url
                      ? 'Open problem link in new tab'
                      : 'No problem link provided by sender'
                  }
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open Link</span>
                </button>

                <button
                  onClick={closeQuestionModal}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition shrink-0 cursor-pointer"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingQuestion ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-slate-400">Loading problem details...</p>
                </div>
              ) : activeQuestion ? (
                <>
                  {/* Problem Statement */}
                  {activeQuestion.problem_statement && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Problem Statement
                      </h3>
                      <div className="p-4 rounded-xl bg-[#0A0F1D] border border-slate-800 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {activeQuestion.problem_statement}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {activeQuestion.notes && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Notes & Insights
                      </h3>
                      <div className="p-4 rounded-xl bg-[#0A0F1D] border border-slate-800 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {activeQuestion.notes}
                      </div>
                    </div>
                  )}

                  {/* Solutions Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                        <Code2 className="w-4 h-4 text-blue-400" />
                        <span>Solutions ({activeQuestion.solutions?.length || 0})</span>
                      </h3>
                    </div>

                    {activeQuestion.solutions && activeQuestion.solutions.length > 0 ? (
                      <div className="bg-[#0A0F1D] border border-slate-800 rounded-xl overflow-hidden">
                        {/* Tabs */}
                        <div className="flex items-center space-x-1 p-2 bg-[#080D1A] border-b border-slate-800 overflow-x-auto">
                          {activeQuestion.solutions.map((sol, idx) => (
                            <button
                              key={sol.id || idx}
                              onClick={() => setActiveSolutionIndex(idx)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                                activeSolutionIndex === idx
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              {sol.title || sol.solution_type || `Solution ${idx + 1}`}
                            </button>
                          ))}
                        </div>

                        {/* Active Solution Content */}
                        {(() => {
                          const sol = activeQuestion.solutions[activeSolutionIndex] || activeQuestion.solutions[0];
                          if (!sol) return null;

                          return (
                            <div className="p-4 space-y-4">
                              {/* Metadata chips */}
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">
                                  {sol.language}
                                </span>
                                {(sol.time_complexity || sol.time_complexity_estimate) && (
                                  <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    Time: {sol.time_complexity || sol.time_complexity_estimate}
                                  </span>
                                )}
                                {(sol.space_complexity || sol.space_complexity_estimate) && (
                                  <span className="px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    Space: {sol.space_complexity || sol.space_complexity_estimate}
                                  </span>
                                )}
                              </div>

                              {sol.explanation && (
                                <p className="text-xs text-slate-400 leading-relaxed italic">
                                  {sol.explanation}
                                </p>
                              )}

                              {/* Monaco Editor in Read-only */}
                              <div className="border border-slate-800 rounded-xl overflow-hidden">
                                <Editor
                                  height="320px"
                                  language={monacoLanguage(sol.language)}
                                  value={sol.code || '// No code provided'}
                                  theme="vs-dark"
                                  options={{
                                    readOnly: true,
                                    minimap: { enabled: false },
                                    fontSize: 13,
                                    scrollBeyondLastLine: false,
                                    fontFamily: 'JetBrains Mono, Fira Code, monospace',
                                    renderLineHighlight: 'none',
                                    domReadOnly: true,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-[#0A0F1D] border border-slate-800 text-xs text-slate-500 italic">
                        No solutions recorded for this question yet.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-[#0A0F1D]/80 flex justify-end">
              <button
                onClick={closeQuestionModal}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Humorous Snackbar for missing problem link */}
      {snackbarMessage && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[92vw] sm:w-auto px-4 py-3 rounded-2xl bg-[#121829]/95 backdrop-blur-md border border-amber-500/40 text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center space-x-3 animate-fade-in"
          style={{
            boxShadow: '0 8px 30px rgba(245, 158, 11, 0.22), 0 4px 16px rgba(0,0,0,0.8)',
          }}
        >
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
            <Link2Off className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">
                Link Not Provided
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                404
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-0.5 leading-snug">
              {snackbarMessage}
            </p>
          </div>
          <button
            onClick={() => setSnackbarMessage(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition shrink-0 cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
