import React from 'react';
import { PieChart, Award, Layers, FolderTree, RotateCcw, CheckCircle2 } from 'lucide-react';
import type { ProgressSummary } from '../../types/dsa';

interface CompletionHeaderProps {
  summary: ProgressSummary | null;
  onSelectView?: (view: any) => void;
}

export const CompletionHeader: React.FC<CompletionHeaderProps> = ({ summary, onSelectView }) => {
  const total = summary?.total_questions ?? 0;
  const solved = summary?.solved_questions ?? 0;
  const overallPercentage = summary?.overall_percentage ?? (total > 0 ? Math.round((solved / total) * 100) : 0);
  const totalTopics = summary?.total_topics ?? 0;
  const totalSubtopics = summary?.total_subtopics ?? 0;
  const needsRevision = summary?.needs_revision_questions ?? 0;

  const easyTotal = summary?.difficulty_breakdown?.Easy?.total ?? 0;
  const easySolved = summary?.difficulty_breakdown?.Easy?.solved ?? 0;
  const easyPct = easyTotal > 0 ? (easySolved / easyTotal) * 100 : 0;

  const medTotal = summary?.difficulty_breakdown?.Medium?.total ?? 0;
  const medSolved = summary?.difficulty_breakdown?.Medium?.solved ?? 0;
  const medPct = medTotal > 0 ? (medSolved / medTotal) * 100 : 0;

  const hardTotal = summary?.difficulty_breakdown?.Hard?.total ?? 0;
  const hardSolved = summary?.difficulty_breakdown?.Hard?.solved ?? 0;
  const hardPct = hardTotal > 0 ? (hardSolved / hardTotal) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Quick Summary KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => onSelectView && onSelectView('patterns')}
          className="bg-[#0B1222] border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-3 cursor-pointer transition shadow-md group"
        >
          <div className="flex items-center space-x-2 text-blue-400 mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Topics</span>
          </div>
          <div className="text-xl font-bold text-white group-hover:text-blue-300 transition">{totalTopics}</div>
        </div>

        <div
          onClick={() => onSelectView && onSelectView('patterns')}
          className="bg-[#0B1222] border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-3 cursor-pointer transition shadow-md group"
        >
          <div className="flex items-center space-x-2 text-indigo-400 mb-1">
            <FolderTree className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Subtopics</span>
          </div>
          <div className="text-xl font-bold text-white group-hover:text-indigo-300 transition">{totalSubtopics}</div>
        </div>

        <div
          onClick={() => onSelectView && onSelectView('all-questions')}
          className="bg-[#0B1222] border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-3 cursor-pointer transition shadow-md group"
        >
          <div className="flex items-center space-x-2 text-emerald-400 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Solved</span>
          </div>
          <div className="text-xl font-bold text-white group-hover:text-emerald-300 transition">
            {solved} <span className="text-xs font-normal text-slate-500">/ {total}</span>
          </div>
        </div>

        <div
          onClick={() => onSelectView && onSelectView('revision')}
          className="bg-[#0B1222] border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-3 cursor-pointer transition shadow-md group"
        >
          <div className="flex items-center space-x-2 text-amber-400 mb-1">
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Needs Revision</span>
          </div>
          <div className="text-xl font-bold text-amber-400 group-hover:text-amber-300 transition">{needsRevision}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* 1. OVERALL COMPLETION */}
        <div className="md:col-span-4 bg-[#0B1222] border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            {/* Header */}
            <div className="flex items-center space-x-2 text-blue-400 mb-3">
              <PieChart className="w-4 h-4 stroke-[2.2]" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-300">
                Overall Completion
              </span>
            </div>

            {/* Stats Row */}
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {overallPercentage}%
              </span>
              <span className="text-xs font-medium text-slate-400">
                {solved} / {total} Solved
              </span>
            </div>
          </div>

          {/* Blue Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500 shadow-sm shadow-blue-500/50"
              style={{ width: `${Math.min(100, Math.max(overallPercentage, 3))}%` }}
            />
          </div>
        </div>

        {/* 2. DIFFICULTY BREAKDOWN */}
        <div className="md:col-span-8 bg-[#0B1222] border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
        {/* Header */}
        <div className="flex items-center space-x-2 text-emerald-400 mb-3">
          <Award className="w-4 h-4 stroke-[2.2]" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-slate-300">
            Difficulty Breakdown
          </span>
        </div>

        {/* 3 Sub-Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Easy */}
          <div className="bg-[#090F1C] border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-400 block mb-1">
                Easy
              </span>
              <div className="flex items-baseline space-x-1 mb-2">
                <span className="text-lg font-bold text-white">{easySolved}</span>
                <span className="text-xs text-slate-400 font-medium">/ {easyTotal}</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(easyPct, 2))}%` }}
              />
            </div>
          </div>

          {/* Medium */}
          <div className="bg-[#090F1C] border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-amber-400 block mb-1">
                Medium
              </span>
              <div className="flex items-baseline space-x-1 mb-2">
                <span className="text-lg font-bold text-white">{medSolved}</span>
                <span className="text-xs text-slate-400 font-medium">/ {medTotal}</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(medPct, 2))}%` }}
              />
            </div>
          </div>

          {/* Hard */}
          <div className="bg-[#090F1C] border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-rose-400 block mb-1">
                Hard
              </span>
              <div className="flex items-baseline space-x-1 mb-2">
                <span className="text-lg font-bold text-white">{hardSolved}</span>
                <span className="text-xs text-slate-400 font-medium">/ {hardTotal}</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${hardPct > 0 ? hardPct : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};
