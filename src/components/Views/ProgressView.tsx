import React from 'react';
import { Award, PieChart, Layers } from 'lucide-react';
import type { ProgressSummary, Folder } from '../../types/dsa';

interface ProgressViewProps {
  summary: ProgressSummary | null;
  folders: Folder[];
  title?: string;
  onSelectFolder?: (folderId: string) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ summary, folders: _folders, title = 'My Patterns' }) => {
  const total = summary?.total_questions || 0;
  const solved = summary?.solved_questions || 0;
  const overallPct = summary?.overall_percentage || 0;

  const diffBreakdown = summary?.difficulty_breakdown || {
    Easy: { total: 0, solved: 0 },
    Medium: { total: 0, solved: 0 },
    Hard: { total: 0, solved: 0 },
  };

  const calculatePct = (s: number, t: number) => (t > 0 ? Math.round((s / t) * 100) : 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center space-x-3 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-md">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-xs text-slate-400">
            Track pattern mastery, category completion, and difficulty breakdown
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Overall Completion */}
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            <PieChart className="w-4 h-4 text-blue-400" />
            <span>Overall Completion</span>
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl font-extrabold text-white">{Math.round(overallPct)}%</span>
            <span className="text-xs font-mono text-slate-400">{solved} / {total} Solved</span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>

        {/* Difficulty Breakdown */}
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-5 shadow-lg md:col-span-2 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Difficulty Breakdown</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Easy */}
            <div className="p-3 rounded-xl bg-[#0A0F1D] border border-slate-800">
              <span className="text-xs font-semibold text-emerald-400 block mb-1">Easy</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-bold text-white">{diffBreakdown.Easy.solved}</span>
                <span className="text-xs text-slate-400">/ {diffBreakdown.Easy.total}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-2">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${calculatePct(diffBreakdown.Easy.solved, diffBreakdown.Easy.total)}%` }}
                />
              </div>
            </div>

            {/* Medium */}
            <div className="p-3 rounded-xl bg-[#0A0F1D] border border-slate-800">
              <span className="text-xs font-semibold text-yellow-300 block mb-1">Medium</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-bold text-white">{diffBreakdown.Medium.solved}</span>
                <span className="text-xs text-slate-400">/ {diffBreakdown.Medium.total}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-2">
                <div
                  className="h-full bg-[#fef08a] rounded-full"
                  style={{ width: `${calculatePct(diffBreakdown.Medium.solved, diffBreakdown.Medium.total)}%` }}
                />
              </div>
            </div>

            {/* Hard */}
            <div className="p-3 rounded-xl bg-[#0A0F1D] border border-slate-800">
              <span className="text-xs font-semibold text-rose-400 block mb-1">Hard</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-bold text-white">{diffBreakdown.Hard.solved}</span>
                <span className="text-xs text-slate-400">/ {diffBreakdown.Hard.total}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-2">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${calculatePct(diffBreakdown.Hard.solved, diffBreakdown.Hard.total)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recursive Category Completion Breakdown */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span>Category & Subfolder Completion</span>
        </div>

        <div className="space-y-3">
          {summary?.folder_overview.map((f) => (
            <div
              key={f.folder_id}
              className="p-4 rounded-xl bg-[#0A0F1D] border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <h4 className="text-sm font-semibold text-white">{f.folder_name}</h4>
                <p className="text-xs text-slate-400">
                  {f.solved_questions} of {f.total_questions} questions solved
                </p>
              </div>

              <div className="flex items-center space-x-4">
                <div className="w-36 sm:w-48 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300 shadow-sm shadow-blue-500/40"
                    style={{ width: `${f.progress_percentage}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-200 font-mono w-12 text-right">
                  {Math.round(f.progress_percentage)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
