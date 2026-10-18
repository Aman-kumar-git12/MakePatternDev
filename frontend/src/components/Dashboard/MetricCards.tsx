import React from 'react';
import { CheckCircle2, Clock, RotateCcw, FileText } from 'lucide-react';
import type { ProgressSummary } from '../../types/dsa';

interface MetricCardsProps {
  summary: ProgressSummary | null;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ summary }) => {
  const total = summary ? summary.total_questions : 32;
  const solved = summary ? summary.solved_questions : 6;
  const inProgress = summary ? summary.in_progress_questions : 2;
  const needsRevision = summary ? summary.needs_revision_questions : 1;
  const percentage = summary ? summary.overall_percentage : 19;

  const solvedPct = total > 0 ? (solved / total) * 100 : 0;
  const inProgressPct = total > 0 ? (inProgress / total) * 100 : 0;
  const needsRevPct = total > 0 ? (needsRevision / total) * 100 : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
      {/* 1. Solved */}
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between shadow-lg shadow-black/20">
        <div className="flex items-center space-x-3.5 mb-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Solved</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold text-white">{solved}</span>
              <span className="text-[10px] text-slate-400">out of {total}</span>
            </div>
          </div>
        </div>
        {/* Bottom colored mini bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(solvedPct, 15)}%` }}
          />
        </div>
      </div>

      {/* 2. In Progress */}
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between shadow-lg shadow-black/20">
        <div className="flex items-center space-x-3.5 mb-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">In Progress</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold text-white">{inProgress}</span>
              <span className="text-[10px] text-slate-400">out of {total}</span>
            </div>
          </div>
        </div>
        {/* Bottom colored mini bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(inProgressPct, 12)}%` }}
          />
        </div>
      </div>

      {/* 3. Needs Revision */}
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between shadow-lg shadow-black/20">
        <div className="flex items-center space-x-3.5 mb-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Needs Revision</span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-bold text-white">{needsRevision}</span>
              <span className="text-[10px] text-slate-400">out of {total}</span>
            </div>
          </div>
        </div>
        {/* Bottom colored mini bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(needsRevPct, 10)}%` }}
          />
        </div>
      </div>

      {/* 4. Total Questions */}
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-2xl p-4 flex items-center space-x-3.5 shadow-lg shadow-black/20">
        <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-slate-400 block">Total Questions</span>
          <span className="text-xl font-bold text-white block">{total}</span>
        </div>
      </div>

      {/* 5. Overall Progress (Circular ring + bar) */}
      <div className="col-span-2 md:col-span-1 bg-[#0D1527] border border-slate-800/90 rounded-2xl p-4 flex items-center space-x-3.5 shadow-lg shadow-black/20">
        {/* SVG Ring Progress matching screenshot */}
        <div className="relative w-11 h-11 flex-shrink-0 flex items-center justify-center">
          <svg className="w-11 h-11 transform -rotate-90">
            <circle
              cx="22"
              cy="22"
              r="17"
              stroke="#151F33"
              strokeWidth="4"
              fill="transparent"
            />
            <circle
              cx="22"
              cy="22"
              r="17"
              stroke="#3B82F6"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={107}
              strokeDashoffset={107 - (107 * Math.min(percentage, 100)) / 100}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-[11px] font-bold text-white">{Math.round(percentage)}%</span>
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-slate-400 block">Overall Progress</span>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden my-1">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 font-mono block text-right">
            {solved} / {total}
          </span>
        </div>
      </div>
    </div>
  );
};
