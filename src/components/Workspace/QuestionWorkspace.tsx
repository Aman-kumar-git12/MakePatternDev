import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Star,
  Folder,
  Tag,
  Check,
  Loader2,
  BookOpen,
  Code2,
  FlaskConical,
  BarChart,
  ExternalLink,
  Link2,
  Trash2,
  Edit2,
  ChevronRight,
  X,
} from 'lucide-react';
import { NotesEditor } from './NotesEditor';
import { MonacoCodeEditor } from './MonacoCodeEditor';
import { TestCasesSection } from './TestCasesSection';
import { ComplexityTab } from './ComplexityTab';
import type { Question, Solution, TestCase, Difficulty, QuestionStatus, SupportedLanguage } from '../../types/dsa';
import { api } from '../../services/api';

interface QuestionWorkspaceProps {
  question: Question;
  onSaveQuestion: (updated: Partial<Question>) => Promise<void>;
  onToggleBookmark: (questionId: string) => void;
  onAddSolution: (
    questionId: string,
    title: string,
    language: SupportedLanguage,
    timeComplexity?: string,
    spaceComplexity?: string,
    code?: string,
    solutionType?: string,
    explanation?: string
  ) => Promise<Solution>;
  onUpdateSolution: (solutionId: string, updates: Partial<Solution>) => Promise<void>;
  onDeleteSolution: (solutionId: string) => Promise<void>;
  onDeleteQuestion?: (questionId: string, title: string) => void;
  onBackToDashboard: () => void;
}

export const QuestionWorkspace: React.FC<QuestionWorkspaceProps> = ({
  question,
  onSaveQuestion,
  onToggleBookmark,
  onAddSolution,
  onUpdateSolution,
  onDeleteSolution,
  onDeleteQuestion,
  onBackToDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'notes' | 'testcases' | 'complexity'>('code');
  const [title, setTitle] = useState(question.title);
  const [problemUrl, setProblemUrl] = useState(question.problem_url || '');
  const [difficulty, setDifficulty] = useState<Difficulty>(question.difficulty);
  const [status, setStatus] = useState<QuestionStatus>(question.status);
  const [problemStatement, setProblemStatement] = useState(question.problem_statement || '');
  const [notes, setNotes] = useState(question.notes || '');
  const [tags, setTags] = useState<string[]>(question.tags || []);
  const [solutions, setSolutions] = useState<Solution[]>(question.solutions || []);
  const [testCases, setTestCases] = useState<TestCase[]>(question.test_cases || []);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [tempUrl, setTempUrl] = useState(question.problem_url || '');

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state when switching questions
  useEffect(() => {
    setTitle(question.title);
    setProblemUrl(question.problem_url || '');
    setTempUrl(question.problem_url || '');
    setDifficulty(question.difficulty);
    setStatus(question.status);
    setProblemStatement(question.problem_statement || '');
    setNotes(question.notes || '');
    setTags(question.tags || []);
    setSolutions(question.solutions || []);
    setTestCases(question.test_cases || []);
    setSaveStatus('saved');
  }, [question.id]);

  // Load test cases if not attached
  useEffect(() => {
    let isMounted = true;
    api.getTestCases(question.id)
      .then((cases) => {
        if (isMounted) setTestCases(cases);
      })
      .catch((err) => console.error('Error fetching test cases:', err));
    return () => {
      isMounted = false;
    };
  }, [question.id]);

  // Debounced autosave
  const triggerAutosave = useCallback(
    (updates: Partial<Question>) => {
      setSaveStatus('unsaved');
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          setSaveStatus('saving');
          await onSaveQuestion(updates);
          setSaveStatus('saved');
        } catch (err) {
          console.error('Autosave error:', err);
          setSaveStatus('unsaved');
        }
      }, 700);
    },
    [onSaveQuestion]
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    triggerAutosave({ title: newTitle });
  };

  const handleProblemUrlChange = (newUrl: string) => {
    setProblemUrl(newUrl);
    triggerAutosave({ problem_url: newUrl });
  };

  const handleDifficultyChange = (newDiff: Difficulty) => {
    setDifficulty(newDiff);
    triggerAutosave({ difficulty: newDiff });
  };

  const handleStatusChange = (newStatus: QuestionStatus) => {
    setStatus(newStatus);
    if (newStatus === 'Solved') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
    triggerAutosave({ status: newStatus });
  };

  const handleProblemStatementChange = (val: string) => {
    setProblemStatement(val);
    triggerAutosave({ problem_statement: val });
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    triggerAutosave({ notes: val });
  };

  // Solution Operations
  const handleAddSolution = async (
    solTitle: string,
    language: SupportedLanguage,
    timeComplexity?: string,
    spaceComplexity?: string,
    code?: string,
    solutionType?: string,
    explanation?: string
  ) => {
    const created = await onAddSolution(
      question.id,
      solTitle,
      language,
      timeComplexity,
      spaceComplexity,
      code,
      solutionType,
      explanation
    );
    setSolutions([...solutions, created]);
  };

  const handleUpdateSolution = async (id: string, updates: Partial<Solution>) => {
    setSolutions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
    await onUpdateSolution(id, updates);
  };

  const handleDeleteSolution = async (id: string) => {
    setSolutions((prev) => prev.filter((s) => s.id !== id));
    await onDeleteSolution(id);
  };

  // Test Case Operations
  const handleAddTestCase = async (data: {
    title?: string;
    input?: string;
    expected_output?: string;
    notes?: string;
    position?: number;
  }) => {
    const created = await api.createTestCase(question.id, data);
    setTestCases((prev) => [...prev, created]);
  };

  const handleUpdateTestCase = async (id: string, updates: Partial<TestCase>) => {
    const updated = await api.updateTestCase(id, updates);
    setTestCases((prev) => prev.map((tc) => (tc.id === id ? updated : tc)));
  };

  const handleDeleteTestCase = async (id: string) => {
    await api.deleteTestCase(id);
    setTestCases((prev) => prev.filter((tc) => tc.id !== id));
  };

  const difficultyColors = {
    Easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Medium: 'bg-[#fef08a]/15 text-yellow-300 border-[#fef08a]/30',
    Hard: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  // Safe problem URL target
  const formattedProblemUrl = problemUrl.trim()
    ? problemUrl.startsWith('http://') || problemUrl.startsWith('https://')
      ? problemUrl
      : `https://${problemUrl}`
    : '';

  return (
    <div className="p-3 sm:p-4 max-w-6xl mx-auto space-y-3 animate-fade-in font-sans">
      {/* 1. QUESTION HEADER & METADATA (Compact Height) */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl px-3.5 py-2 shadow-md space-y-1.5">
        {/* Top Mini-Row: Breadcrumb + Delete */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 leading-none">
          <div className="flex items-center space-x-1.5 flex-wrap min-w-0">
            <button
              onClick={onBackToDashboard}
              className="hover:text-blue-400 transition font-medium"
            >
              Dashboard
            </button>
            <ChevronRight className="w-2.5 h-2.5 text-slate-600" />
            <div className="flex items-center space-x-1 text-slate-300 font-medium">
              <Folder className="w-3 h-3 text-blue-400" />
              <span>{question.folder_path || 'DSA Topics'}</span>
            </div>
            <ChevronRight className="w-2.5 h-2.5 text-slate-600" />
            <span className="text-slate-200 font-semibold truncate max-w-xs">{title}</span>
          </div>

          {/* Delete Question action */}
          {onDeleteQuestion && (
            <button
              onClick={() => onDeleteQuestion(question.id, title)}
              className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition text-[11px]"
              title="Delete this question"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          )}
        </div>

        {/* Main Row: Title + Difficulty Tag + Tags (Left) and Actions (Right) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
          {/* Left: Title + Difficulty Tag + Tags */}
          <div className="flex items-center space-x-2 min-w-0 flex-1 flex-wrap gap-y-1">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-base sm:text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none transition truncate max-w-md py-0 leading-tight"
            />
            {/* Difficulty Tag right to question title */}
            <select
              value={difficulty}
              onChange={(e) => handleDifficultyChange(e.target.value as Difficulty)}
              className={`text-xs font-semibold px-2 py-0.5 rounded-lg border focus:outline-none cursor-pointer shrink-0 ${difficultyColors[difficulty]}`}
              title="Change difficulty"
            >
              <option value="Easy" className="bg-[#0D1527] text-emerald-400">Easy</option>
              <option value="Medium" className="bg-[#0D1527] text-yellow-300">Medium</option>
              <option value="Hard" className="bg-[#0D1527] text-rose-400">Hard</option>
            </select>
            {tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px]"
                  >
                    <Tag className="w-2.5 h-2.5 text-slate-400" />
                    <span>{t}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right: Actions in a single compact flex row */}
          <div className="flex items-center space-x-1.5 flex-wrap flex-shrink-0">
            {/* Problem URL: Combined Open Problem + Edit button */}
            {formattedProblemUrl ? (
              <div className="inline-flex items-center rounded-lg bg-[#fef08a]/20 border border-[#fef08a]/35 overflow-hidden shadow-sm">
                <a
                  href={formattedProblemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 px-2.5 py-1 text-yellow-300 hover:bg-[#fef08a]/30 text-xs font-semibold transition"
                  title={`Open problem on ${formattedProblemUrl}`}
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Problem</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setTempUrl(problemUrl);
                    setIsUrlModalOpen(true);
                  }}
                  className="p-1 text-yellow-300 hover:text-white hover:bg-[#fef08a]/40 border-l border-[#fef08a]/35 transition"
                  title="Edit problem link"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTempUrl(problemUrl);
                  setIsUrlModalOpen(true);
                }}
                className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-yellow-300 border border-slate-700 text-xs transition"
                title="Add problem link"
              >
                <Link2 className="w-3 h-3" />
                <span>+ Link</span>
              </button>
            )}

            {/* Autosave Indicator */}
            <div className="flex items-center space-x-1 text-xs text-slate-400 px-1">
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-yellow-300" />
                  <span className="text-[10px]">Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-slate-400">Saved</span>
                </>
              )}
              {saveStatus === 'unsaved' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#fef08a]" />
                  <span className="text-[10px]">Unsaved</span>
                </>
              )}
            </div>

            {/* Bookmark button */}
            <button
              onClick={() => onToggleBookmark(question.id)}
              className={`px-2 py-1 rounded-lg border transition flex items-center space-x-1 text-xs font-medium ${
                question.is_bookmarked
                  ? 'bg-[#fef08a]/20 border-[#fef08a]/35 text-yellow-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title={question.is_bookmarked ? 'Remove bookmark' : 'Bookmark question'}
            >
              <Star
                className={`w-3 h-3 ${
                  question.is_bookmarked ? 'fill-[#fef08a] text-yellow-300' : ''
                }`}
              />
              <span className="text-[11px] hidden sm:inline">
                {question.is_bookmarked ? 'Bookmarked' : 'Bookmark'}
              </span>
            </button>

            {/* Status Dropdown */}
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as QuestionStatus)}
              className="bg-[#0A0F1D] text-slate-200 border border-slate-700/80 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="Not Started">⚪ Not Started</option>
              <option value="In Progress">🔵 In Progress</option>
              <option value="Solved">🟢 Solved</option>
              <option value="Needs Revision">🟠 Needs Revision</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. WORKSPACE TABS */}
      <div className="flex items-center space-x-1.5 border-b border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'code'
              ? 'bg-[#fef08a] text-[#18181b] shadow-md shadow-yellow-200/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>Code Solutions ({solutions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'notes'
              ? 'bg-[#fef08a] text-[#18181b] shadow-md shadow-yellow-200/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Step-by-Step Notes</span>
        </button>

        <button
          onClick={() => setActiveTab('testcases')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'testcases'
              ? 'bg-[#fef08a] text-[#18181b] shadow-md shadow-yellow-200/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Test Cases ({testCases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('complexity')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'complexity'
              ? 'bg-[#fef08a] text-[#18181b] shadow-md shadow-yellow-200/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <BarChart className="w-3.5 h-3.5" />
          <span>Complexity Overview</span>
        </button>
      </div>

      {/* 3. TAB CONTENTS */}
      {activeTab === 'code' && (
        <MonacoCodeEditor
          solutions={solutions}
          onAddSolution={handleAddSolution}
          onUpdateSolution={handleUpdateSolution}
          onDeleteSolution={handleDeleteSolution}
        />
      )}

      {activeTab === 'notes' && (
        <NotesEditor
          problemStatement={problemStatement}
          notes={notes}
          onChangeProblemStatement={handleProblemStatementChange}
          onChangeNotes={handleNotesChange}
        />
      )}

      {activeTab === 'testcases' && (
        <TestCasesSection
          questionId={question.id}
          testCases={testCases}
          onAddTestCase={handleAddTestCase}
          onUpdateTestCase={handleUpdateTestCase}
          onDeleteTestCase={handleDeleteTestCase}
        />
      )}

      {activeTab === 'complexity' && (
        <ComplexityTab solutions={solutions} />
      )}

      {/* Custom Edit URL Modal - replaces native browser prompt/alert */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {problemUrl ? 'Edit Question URL' : 'Add Question URL'}
                  </h3>
                  <p className="text-xs text-slate-400">Direct link to LeetCode, GFG, or Codeforces</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUrlModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Problem Link
              </label>
              <input
                type="url"
                autoFocus
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="https://leetcode.com/problems/..."
                className="w-full bg-[#080C14] border border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleProblemUrlChange(tempUrl.trim());
                    setIsUrlModalOpen(false);
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {problemUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    handleProblemUrlChange('');
                    setIsUrlModalOpen(false);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 hover:underline"
                >
                  Remove Link
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsUrlModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleProblemUrlChange(tempUrl.trim());
                    setIsUrlModalOpen(false);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-xs text-white font-semibold shadow-lg shadow-blue-600/30 transition"
                >
                  Save Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
