import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Copy,
  Check,
  Plus,
  Trash2,
  Clock,
  HardDrive,
  Sparkles,
  RefreshCw,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Save,
  X,
  RotateCcw,
} from 'lucide-react';
import type { Solution, SupportedLanguage, ComplexityAnalysisResult } from '../../types/dsa';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

interface MonacoCodeEditorProps {
  solutions: Solution[];
  onAddSolution: (
    title: string,
    language: SupportedLanguage,
    timeComplexity?: string,
    spaceComplexity?: string,
    code?: string,
    solutionType?: string,
    explanation?: string
  ) => void;
  onUpdateSolution: (id: string, updates: Partial<Solution>) => void;
  onDeleteSolution: (id: string) => void;
}

const STARTER_CODES: Record<SupportedLanguage, string> = {
  python: `class Solution:
    def solve(self, nums: list[int], target: int = 0) -> int:
        # Write your Python solution here
        pass
`,
  cpp: `#include <iostream>
#include <vector>

class Solution {
public:
    int solve(std::vector<int>& nums, int target = 0) {
        // Write your C++ solution here
        return 0;
    }
};
`,
  java: `import java.util.*;

class Solution {
    public int solve(int[] nums, int target) {
        // Write your Java solution here
        return 0;
    }
}
`,
  javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
var solve = function(nums, target) {
    // Write your JavaScript solution here
    return 0;
};
`,
};

const TIME_COMPLEXITY_PRESETS = [
  'O(1)',
  'O(log n)',
  'O(n)',
  'O(n log n)',
  'O(n²)',
  'O(n³)',
  'O(2^n)',
  'O(n!)',
];

const SPACE_COMPLEXITY_PRESETS = [
  'O(1)',
  'O(log n)',
  'O(n)',
  'O(n²)',
  'O(k)',
];

export const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({
  solutions,
  onAddSolution,
  onUpdateSolution,
  onDeleteSolution,
}) => {
  const { isDark } = useTheme();
  const [activeSolutionId, setActiveSolutionId] = useState<string>(solutions[0]?.id || '');
  const [copied, setCopied] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEditingComplexity, setIsEditingComplexity] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [complexitySavedToast, setComplexitySavedToast] = useState(false);
  const [solutionToDelete, setSolutionToDelete] = useState<{ id: string; title: string } | null>(null);

  // Active solution or fallback
  const activeSolution = solutions.find((s) => s.id === activeSolutionId) || solutions[0];

  // Local editable state for current solution
  const [code, setCode] = useState(activeSolution?.code || '');
  const [explanation, setExplanation] = useState(activeSolution?.explanation || '');
  const [manualTime, setManualTime] = useState(activeSolution?.manual_time_complexity || activeSolution?.time_complexity || '');
  const [manualSpace, setManualSpace] = useState(activeSolution?.manual_space_complexity || activeSolution?.space_complexity || '');
  const [customRationale, setCustomRationale] = useState(activeSolution?.analysis_explanation || '');

  const saveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync when active solution changes
  useEffect(() => {
    if (activeSolution) {
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
      }
      setActiveSolutionId(activeSolution.id);
      setCode(activeSolution.code || '');
      setExplanation(activeSolution.explanation || '');
      setManualTime(activeSolution.manual_time_complexity || activeSolution.time_complexity || '');
      setManualSpace(activeSolution.manual_space_complexity || activeSolution.space_complexity || '');
      setCustomRationale(activeSolution.analysis_explanation || '');
      setIsSaved(true);
    }
  }, [activeSolution?.id]);

  const handleCopyCode = async () => {
    if (!activeSolution) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleAnalyzeComplexity = async (codeToAnalyze: string, lang: SupportedLanguage) => {
    if (!activeSolution) return;
    try {
      setIsAnalyzing(true);
      const result: ComplexityAnalysisResult = await api.analyzeComplexity(codeToAnalyze, lang);

      const updates: Partial<Solution> = {
        time_complexity_estimate: result.time_complexity,
        space_complexity_estimate: result.space_complexity,
        analysis_explanation: result.explanation,
        analysis_status: result.status,
        analyzed_code_hash: result.code_hash,
      };

      // Space complexity can update if not manually set; time complexity is left for user
      if (!activeSolution.manual_space_complexity) {
        updates.space_complexity = result.space_complexity;
        setManualSpace(result.space_complexity);
      }
      setCustomRationale(result.explanation);

      await onUpdateSolution(activeSolution.id, updates);
    } catch (err) {
      console.error('Complexity analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCodeChange = (newCode: string | undefined) => {
    const val = newCode ?? '';
    setCode(val);
    setIsSaved(false);

    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
    }

    // Auto-save debounced to database
    saveDebounceTimerRef.current = setTimeout(async () => {
      if (activeSolution) {
        try {
          await onUpdateSolution(activeSolution.id, { code: val });
          setIsSaved(true);
        } catch (e) {
          console.error('Failed to auto-save code:', e);
        }
      }
    }, 700);
  };

  const handleSaveAll = async () => {
    if (!activeSolution) return;
    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
    }
    setIsAnalyzing(true);
    try {
      const effTime = manualTime.trim(); // User adds it itself, empty if blank
      const effSpace = manualSpace.trim() || activeSolution.space_complexity || 'O(1)';

      await onUpdateSolution(activeSolution.id, {
        code,
        explanation,
        manual_time_complexity: effTime || null,
        manual_space_complexity: manualSpace.trim() || null,
        time_complexity: effTime,
        space_complexity: effSpace,
      });

      setIsSaved(true);
      setComplexitySavedToast(true);
      setTimeout(() => setComplexitySavedToast(false), 2000);
    } catch (err) {
      console.error('Error saving solution:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Immediate Save Complexity Override
  const handleSaveComplexityOverride = async () => {
    if (!activeSolution) return;
    const finalTime = manualTime.trim(); // User adds it itself, empty if blank
    const finalSpace = manualSpace.trim() || activeSolution.space_complexity || 'O(1)';

    await onUpdateSolution(activeSolution.id, {
      manual_time_complexity: finalTime || null,
      manual_space_complexity: manualSpace.trim() || null,
      time_complexity: finalTime,
      space_complexity: finalSpace,
      analysis_explanation: customRationale.trim() || activeSolution.analysis_explanation,
    });

    setComplexitySavedToast(true);
    setTimeout(() => setComplexitySavedToast(false), 2000);
    setIsEditingComplexity(false);
  };

  // Reset complexity override to automated estimate
  const handleResetToAutoComplexity = async () => {
    if (!activeSolution) return;
    setIsAnalyzing(true);
    try {
      const result = await api.analyzeComplexity(code, activeSolution.language);
      setManualTime(result.time_complexity);
      setManualSpace(result.space_complexity);
      setCustomRationale(result.explanation);

      onUpdateSolution(activeSolution.id, {
        manual_time_complexity: null,
        manual_space_complexity: null,
        time_complexity: result.time_complexity,
        space_complexity: result.space_complexity,
        time_complexity_estimate: result.time_complexity,
        space_complexity_estimate: result.space_complexity,
        analysis_explanation: result.explanation,
        analysis_status: result.status,
        analyzed_code_hash: result.code_hash,
      });

      setComplexitySavedToast(true);
      setTimeout(() => setComplexitySavedToast(false), 2000);
      setIsEditingComplexity(false);
    } catch (err) {
      console.error('Error resetting complexity:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateDefaultSolution = (approachType: 'Brute Force' | 'Better Approach' | 'Optimized Approach') => {
    // Strictly max 3 solutions allowed
    if (solutions.length >= 3) return;

    const defaultLang: SupportedLanguage = activeSolution ? activeSolution.language : 'python';

    // In every case, new solution code starts empty, and time complexity starts empty
    onAddSolution(
      approachType,
      defaultLang,
      '', // Time complexity starts empty
      'O(1)',
      '', // Code starts completely empty
      approachType,
      ''
    );
  };

  const handleExecuteDelete = () => {
    if (!solutionToDelete) return;
    const deletedId = solutionToDelete.id;
    onDeleteSolution(deletedId);

    // If deleting the active solution, switch to another existing solution
    if (activeSolutionId === deletedId) {
      const remaining = solutions.filter((s) => s.id !== deletedId);
      if (remaining.length > 0) {
        setActiveSolutionId(remaining[0].id);
      }
    }
    setSolutionToDelete(null);
  };

  const monacoLanguage = (lang: SupportedLanguage) => {
    if (lang === 'cpp') return 'cpp';
    if (lang === 'java') return 'java';
    if (lang === 'javascript') return 'javascript';
    return 'python';
  };

  // Check which standard slots are missing (strictly max 3)
  const hasBrute = solutions.some((s) => s.title.toLowerCase().includes('brute'));
  const hasBetter = solutions.some((s) => s.title.toLowerCase().includes('better'));
  const hasOptimized = solutions.some((s) => s.title.toLowerCase().includes('optim'));

  return (
    <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4">
      {/* 1. Solution Slots Header (Strictly max 3 solutions) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        {/* Solution Tabs (Max 3) */}
        <div className="flex items-center space-x-1.5 overflow-x-auto max-w-full custom-scrollbar py-0.5">
          {solutions.map((sol) => {
            const isActive = activeSolution?.id === sol.id;
            return (
              <div
                key={sol.id}
                onClick={() => setActiveSolutionId(sol.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition flex-shrink-0 group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{sol.title}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/30 text-blue-200">
                  {sol.language}
                </span>

                {/* Delete button on each tab */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSolutionToDelete({ id: sol.id, title: sol.title });
                  }}
                  className={`p-0.5 rounded-md transition ${
                    isActive
                      ? 'text-white/70 hover:text-white hover:bg-white/20'
                      : 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/20'
                  }`}
                  title={`Delete solution "${sol.title}"`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Quick preset add buttons only if solutions.length < 3 */}
          {solutions.length < 3 && !hasBrute && (
            <button
              onClick={() => handleCreateDefaultSolution('Brute Force')}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs border border-dashed border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition flex-shrink-0"
              title="Add Brute Force solution"
            >
              <Plus className="w-3 h-3 text-rose-400" />
              <span>+ Brute Force</span>
            </button>
          )}

          {solutions.length < 3 && !hasBetter && (
            <button
              onClick={() => handleCreateDefaultSolution('Better Approach')}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs border border-dashed border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition flex-shrink-0"
              title="Add Better Approach solution"
            >
              <Plus className="w-3 h-3 text-yellow-300" />
              <span>+ Better Approach</span>
            </button>
          )}

          {solutions.length < 3 && !hasOptimized && (
            <button
              onClick={() => handleCreateDefaultSolution('Optimized Approach')}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs border border-dashed border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition flex-shrink-0"
              title="Add Optimized solution"
            >
              <Plus className="w-3 h-3 text-emerald-400" />
              <span>+ Optimized</span>
            </button>
          )}

          {/* Limit indicator when 3 solutions exist */}
          {solutions.length >= 3 && (
            <span className="text-[11px] font-medium text-slate-500 px-2 py-1 bg-slate-900/40 rounded-lg border border-slate-800">
              3/3 Solutions
            </span>
          )}
        </div>

        {/* Right Action: Language Selector & Copy & Delete Solution */}
        {activeSolution && (
          <div className="flex items-center space-x-2">
            {/* Approach Title Dropdown */}
            <select
              value={activeSolution.title}
              onChange={(e) => onUpdateSolution(activeSolution.id, { title: e.target.value })}
              className="bg-[#0A0F1D] text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="Brute Force">Brute Force</option>
              <option value="Better Approach">Better Approach</option>
              <option value="Optimized Approach">Optimized Approach</option>
            </select>

            {/* Language Selector (Python, C++, Java, JavaScript) */}
            <select
              value={activeSolution.language}
              onChange={(e) => {
                const newLang = e.target.value as SupportedLanguage;
                // Automatically switch boilerplate to new language template
                const newBoilerplate = STARTER_CODES[newLang] || '';
                setCode(newBoilerplate);
                setIsSaved(false);
                onUpdateSolution(activeSolution.id, {
                  language: newLang,
                  code: newBoilerplate,
                });
              }}
              className="bg-[#0A0F1D] text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-mono"
            >
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
              <option value="javascript">JavaScript</option>
            </select>

            {/* Clear Code Button */}
            <button
              type="button"
              onClick={() => {
                setCode('');
                setIsSaved(false);
                onUpdateSolution(activeSolution.id, { code: '' });
              }}
              className="px-2 py-1 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-900/60 text-slate-400 hover:text-slate-200 text-xs transition"
              title="Clear editor code"
            >
              Clear
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopyCode}
              className="p-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-900/60 text-slate-400 hover:text-white transition flex items-center space-x-1 text-xs"
              title="Copy code"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Delete Solution Button */}
            <button
              onClick={() => setSolutionToDelete({ id: activeSolution.id, title: activeSolution.title })}
              className="p-1.5 rounded-lg border border-rose-500/30 hover:border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition flex items-center space-x-1 text-xs"
              title="Delete this solution"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        )}
      </div>

      {activeSolution ? (
        <div className="space-y-4">
          {/* 2. Main Row: Code Editor on Left, Complexity Analysis on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left 8 Columns: Monaco Code Editor */}
            <div className="lg:col-span-8 bg-[#0A0F1D] border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="px-4 py-2 bg-[#080D1A] border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-white">{activeSolution.title}</span>
                  {!isSaved && (
                    <span className="text-[10px] text-yellow-300 font-medium">● Unsaved edits</span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-500 uppercase">
                  Language: {activeSolution.language}
                </span>
              </div>

              <div className="h-[430px] w-full">
                <Editor
                  height="100%"
                  language={monacoLanguage(activeSolution.language)}
                  theme={isDark ? 'vs-dark' : 'light'}
                  value={code}
                  onChange={handleCodeChange}
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    lineNumbers: 'on',
                    folding: true,
                    wordWrap: 'on',
                    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                  }}
                />
              </div>
            </div>

            {/* Right 4 Columns: Complexity Analysis & Manual Editing */}
            <div className="lg:col-span-4 bg-[#0A0F1D] border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm space-y-3">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-yellow-300" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Complexity Analysis
                    </h4>
                  </div>

                  <button
                    onClick={() => handleAnalyzeComplexity(code, activeSolution.language)}
                    disabled={isAnalyzing}
                    className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
                    title="Re-run static complexity analysis"
                  >
                    <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin text-yellow-300' : ''}`} />
                    <span>Re-analyze</span>
                  </button>
                </div>

                {/* Analysis Status */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Analysis Status:</span>
                  <div>
                    {isAnalyzing ? (
                      <span className="text-[11px] font-medium text-yellow-300 flex items-center space-x-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Analyzing...</span>
                      </span>
                    ) : activeSolution.analysis_status === 'Unable to Analyze' ? (
                      <span className="text-[11px] font-medium text-yellow-300 flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Unable to analyze</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Complexity Display Cards with direct Edit buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Time Complexity Card */}
                  <div
                    onClick={() => setIsEditingComplexity(true)}
                    className="bg-[#0D1527] border border-yellow-200/30 hover:border-yellow-200/60 rounded-xl p-2.5 cursor-pointer transition group relative shadow-sm"
                    title="Click to edit Time Complexity"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-semibold mb-1">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-yellow-300" />
                        <span>Time</span>
                      </div>
                      <Edit3 className="w-3 h-3 text-slate-500 group-hover:text-yellow-300 transition" />
                    </div>
                    <div className="text-lg font-bold font-mono text-yellow-300">
                      {activeSolution.time_complexity ? (
                        activeSolution.time_complexity
                      ) : (
                        <span className="text-slate-500 text-xs font-normal italic">Empty (Click to add)</span>
                      )}
                    </div>
                    <span className="text-[9px] font-sans block mt-0.5">
                      {activeSolution.time_complexity ? (
                        <span className="text-emerald-400 font-semibold">User Defined</span>
                      ) : (
                        <span className="text-slate-500">Not set</span>
                      )}
                    </span>
                  </div>

                  {/* Space Complexity Card */}
                  <div
                    onClick={() => setIsEditingComplexity(true)}
                    className="bg-[#0D1527] border border-slate-700 hover:border-slate-500 rounded-xl p-2.5 cursor-pointer transition group relative shadow-sm"
                    title="Click to edit Space Complexity"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-semibold mb-1">
                      <div className="flex items-center space-x-1">
                        <HardDrive className="w-3 h-3 text-emerald-400" />
                        <span>Space</span>
                      </div>
                      <Edit3 className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition" />
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-400">
                      {activeSolution.space_complexity || 'O(1)'}
                    </div>
                    <span className="text-[9px] font-sans block mt-0.5">
                      {activeSolution.manual_space_complexity ? (
                        <span className="text-yellow-300 font-semibold">(Manual Override)</span>
                      ) : (
                        <span className="text-slate-500">(Auto Estimated)</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Estimation Rationale Box */}
                <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-2.5 space-y-1">
                  <div className="flex items-center space-x-1 text-slate-400 text-[10px] uppercase font-semibold">
                    <HelpCircle className="w-3 h-3 text-slate-400" />
                    <span>Estimation Rationale:</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {activeSolution.analysis_explanation ||
                      'Static structure analysis analyzes loop nesting depth, recursion branching, sorting calls, and auxiliary collection allocations.'}
                  </p>
                </div>

                {/* Edit Complexity Section Toggle */}
                <div className="border-t border-slate-800 pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsEditingComplexity(!isEditingComplexity)}
                      className="flex items-center space-x-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isEditingComplexity ? 'Close Complexity Editor' : 'Edit Complexity Manually'}</span>
                    </button>

                    {(activeSolution.manual_time_complexity || activeSolution.manual_space_complexity) && (
                      <button
                        type="button"
                        onClick={handleResetToAutoComplexity}
                        className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center space-x-1 transition"
                        title="Restore automated static analysis values"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Reset to Auto</span>
                      </button>
                    )}
                  </div>

                  {complexitySavedToast && (
                    <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>Complexity updated successfully!</span>
                    </div>
                  )}

                  {/* Interactive Complexity Editor Form */}
                  {isEditingComplexity && (
                    <div className="bg-[#0D1527] border border-blue-500/30 rounded-xl p-3 space-y-3 animate-fade-in text-xs shadow-md">
                      {/* Time Complexity Input & Presets */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-300 uppercase">
                          Time Complexity
                        </label>
                        <input
                          type="text"
                          value={manualTime}
                          onChange={(e) => setManualTime(e.target.value)}
                          placeholder="e.g. O(n log n)"
                          className="w-full bg-[#080C14] border border-slate-700 focus:border-blue-500 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                        />
                        {/* Quick Presets */}
                        <div className="flex flex-wrap gap-1 pt-0.5 items-center">
                          <button
                            type="button"
                            onClick={() => setManualTime('')}
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono border transition ${
                              !manualTime
                                ? 'bg-slate-700 text-white border-slate-600'
                                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-rose-400'
                            }`}
                            title="Clear to empty"
                          >
                            Empty
                          </button>
                          {TIME_COMPLEXITY_PRESETS.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setManualTime(p)}
                              className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono border transition ${
                                manualTime === p
                                  ? 'bg-blue-600 text-white border-blue-500'
                                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Space Complexity Input & Presets */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-300 uppercase">
                          Space Complexity
                        </label>
                        <input
                          type="text"
                          value={manualSpace}
                          onChange={(e) => setManualSpace(e.target.value)}
                          placeholder="e.g. O(1)"
                          className="w-full bg-[#080C14] border border-slate-700 focus:border-blue-500 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                        />
                        {/* Quick Presets */}
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {SPACE_COMPLEXITY_PRESETS.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setManualSpace(p)}
                              className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono border transition ${
                                manualSpace === p
                                  ? 'bg-purple-600 text-white border-purple-500'
                                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Rationale / Note */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-300 uppercase">
                          Complexity Note / Rationale
                        </label>
                        <textarea
                          rows={2}
                          value={customRationale}
                          onChange={(e) => setCustomRationale(e.target.value)}
                          placeholder="Explain why this complexity applies (e.g. nested loop with binary search)..."
                          className="w-full bg-[#080C14] border border-slate-700 focus:border-blue-500 rounded-lg p-2 text-[11px] text-white"
                        />
                      </div>

                      {/* Apply & Save Buttons */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingComplexity(false)}
                          className="text-[11px] text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveComplexityOverride}
                          className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition"
                        >
                          Apply & Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Save Solution Button */}
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isAnalyzing}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs transition shadow-md shadow-blue-600/30 flex items-center justify-center space-x-1.5 disabled:opacity-50 mt-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaved ? 'Save Changes' : 'Save Changes *'}</span>
              </button>
            </div>
          </div>

          {/* 3. Solution Explanation / Notes (Beneath Code Editor) */}
          <div className="bg-[#0A0F1D] border border-slate-800 rounded-xl p-3.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Approach Explanation & Implementation Notes</span>
              </label>
              <button
                type="button"
                onClick={handleSaveAll}
                className="text-[11px] text-blue-400 hover:text-blue-300"
              >
                Save Explanation
              </button>
            </div>
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => {
                setExplanation(e.target.value);
                setIsSaved(false);
              }}
              placeholder={`Explain the idea behind this ${activeSolution.title}: key variables, invariants, edge case handling, and why this time/space is achieved...`}
              className="w-full bg-[#0D1527] border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed resize-y"
            />
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500 text-xs">
          No solutions yet. Click above to add a Brute Force, Better, or Optimized solution.
        </div>
      )}

      {/* Confirmation Modal to Delete Solution */}
      {solutionToDelete && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Delete Solution</h3>
                <p className="text-xs text-slate-400">"{solutionToDelete.title}"</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete this code solution and its complexity estimates?
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSolutionToDelete(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-xs text-white font-semibold shadow-lg shadow-rose-600/30 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
