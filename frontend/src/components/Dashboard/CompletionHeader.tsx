import React from 'react';
import {
  Layers,
  FolderTree,
  RotateCcw,
  CheckCircle2,
  PieChart,
  Award,
  Zap,
  Flame,
  Code2,
  TrendingUp,
  ArrowUpRight
} from 'lucide-react';
import type { ProgressSummary, ViewMode } from '../../types/dsa';

interface CompletionHeaderProps {
  summary: ProgressSummary | null;
  onSelectView?: (view: ViewMode) => void;
}

export const CompletionHeader: React.FC<CompletionHeaderProps> = ({ summary, onSelectView }) => {
  const total = summary?.total_questions ?? 0;
  const solved = summary?.solved_questions ?? 0;
  const inProgress = summary?.in_progress_questions ?? 0;
  const needsRevision = summary?.needs_revision_questions ?? 0;
  const notStarted = summary?.not_started_questions ?? Math.max(0, total - solved - inProgress);
  const overallPercentage = summary?.overall_percentage ?? (total > 0 ? Math.round((solved / total) * 100) : 0);
  
  const totalTopics = summary?.total_topics ?? 0;
  const totalSubtopics = summary?.total_subtopics ?? 0;

  // Easy breakdown
  const easyTotal = summary?.difficulty_breakdown?.Easy?.total ?? 0;
  const easySolved = summary?.difficulty_breakdown?.Easy?.solved ?? 0;
  const easyPct = easyTotal > 0 ? Math.round((easySolved / easyTotal) * 100) : 0;
  const easyRemaining = Math.max(0, easyTotal - easySolved);

  // Medium breakdown
  const medTotal = summary?.difficulty_breakdown?.Medium?.total ?? 0;
  const medSolved = summary?.difficulty_breakdown?.Medium?.solved ?? 0;
  const medPct = medTotal > 0 ? Math.round((medSolved / medTotal) * 100) : 0;
  const medRemaining = Math.max(0, medTotal - medSolved);

  // Hard breakdown
  const hardTotal = summary?.difficulty_breakdown?.Hard?.total ?? 0;
  const hardSolved = summary?.difficulty_breakdown?.Hard?.solved ?? 0;
  const hardPct = hardTotal > 0 ? Math.round((hardSolved / hardTotal) * 100) : 0;
  const hardRemaining = Math.max(0, hardTotal - hardSolved);

  // SVG Circular Gauge calculation
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, overallPercentage)) / 100) * circumference;

  return (
    <div className="space-y-4 font-sans animate-fade-in">
      {/* 1. TOP ARCHITECTURE & STATUS KPI STRIP (4 CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Total Topics */}
        <div
          onClick={() => onSelectView?.('patterns')}
          className="rounded-2xl p-4 transition-all duration-200 group cursor-pointer hover:border-yellow-500/40 hover:-translate-y-0.5 relative overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="p-2 rounded-xl bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 group-hover:scale-105 transition">
              <Layers className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-yellow-400 transition" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
              Topics / Patterns
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-white group-hover:text-yellow-300 transition tracking-tight">
                {totalTopics}
              </span>
              <span className="text-xs text-zinc-500">patterns</span>
            </div>
          </div>
        </div>

        {/* Total Subtopics */}
        <div
          onClick={() => onSelectView?.('patterns')}
          className="rounded-2xl p-4 transition-all duration-200 group cursor-pointer hover:border-purple-500/40 hover:-translate-y-0.5 relative overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20 group-hover:scale-105 transition">
              <FolderTree className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 transition" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
              Subtopics
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-white group-hover:text-purple-300 transition tracking-tight">
                {totalSubtopics}
              </span>
              <span className="text-xs text-zinc-500">nested sets</span>
            </div>
          </div>
        </div>

        {/* Total Questions */}
        <div
          onClick={() => onSelectView?.('all-questions')}
          className="rounded-2xl p-4 transition-all duration-200 group cursor-pointer hover:border-blue-500/40 hover:-translate-y-0.5 relative overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20 group-hover:scale-105 transition">
              <Code2 className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400 transition" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
              Total Questions
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-white group-hover:text-blue-300 transition tracking-tight">
                {total}
              </span>
              <span className="text-xs text-emerald-400 font-medium">
                {solved} solved
              </span>
            </div>
          </div>
        </div>

        {/* Needs Revision */}
        <div
          onClick={() => onSelectView?.('revision')}
          className="rounded-2xl p-4 transition-all duration-200 group cursor-pointer hover:border-amber-500/40 hover:-translate-y-0.5 relative overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition">
              <RotateCcw className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400 transition" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-0.5">
              Needs Revision
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-amber-300 group-hover:text-amber-200 transition tracking-tight">
                {needsRevision}
              </span>
              <span className="text-xs text-zinc-500">to review</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. OVERALL COMPLETION GAUGE + DIFFICULTY BREAKDOWN (EASY, MED, HARD) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Overall Completion Circular Gauge (col-span-4) */}
        <div
          className="lg:col-span-4 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400">
                  <PieChart className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold tracking-wider uppercase text-zinc-300">
                  Overall Completion
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-zinc-800 text-yellow-300 border border-zinc-700/60">
                {total > 0 && solved === total ? 'Mastered' : 'In Progress'}
              </span>
            </div>

            {/* Radial Circular Progress Display */}
            <div className="flex flex-col items-center justify-center my-2">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Track Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="#1c1f2e"
                    strokeWidth="8"
                  />
                  {/* Progress Arc */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="#fef08a"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    style={{
                      filter: 'drop-shadow(0 0 6px rgba(254, 240, 138, 0.4))',
                    }}
                  />
                </svg>

                {/* Inner Percentage Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                  <span className="text-3xl font-extrabold tracking-tight text-white">
                    {overallPercentage}%
                  </span>
                  <span className="text-[11px] font-medium text-zinc-400 mt-0.5">
                    {solved} / {total} Solved
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Breakdown Pills */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800/80 text-xs">
            <div className="flex items-center space-x-2 bg-[#090D1A] px-2.5 py-1.5 rounded-xl border border-zinc-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-zinc-400 text-[11px]">Solved:</span>
              <span className="font-bold text-white ml-auto">{solved}</span>
            </div>
            <div className="flex items-center space-x-2 bg-[#090D1A] px-2.5 py-1.5 rounded-xl border border-zinc-800">
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <span className="text-zinc-400 text-[11px]">Active:</span>
              <span className="font-bold text-white ml-auto">{inProgress}</span>
            </div>
            <div className="flex items-center space-x-2 bg-[#090D1A] px-2.5 py-1.5 rounded-xl border border-zinc-800">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-zinc-400 text-[11px]">Revision:</span>
              <span className="font-bold text-white ml-auto">{needsRevision}</span>
            </div>
            <div className="flex items-center space-x-2 bg-[#090D1A] px-2.5 py-1.5 rounded-xl border border-zinc-800">
              <span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" />
              <span className="text-zinc-400 text-[11px]">Unstarted:</span>
              <span className="font-bold text-white ml-auto">{notStarted}</span>
            </div>
          </div>
        </div>

        {/* Right: Difficulty Breakdown Cards (Easy, Medium, Hard) (col-span-8) */}
        <div
          className="lg:col-span-8 rounded-2xl p-5 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-wider uppercase text-zinc-300">
                  Difficulty Breakdown & Readiness
                </h3>
              </div>
            </div>
            <span className="text-xs text-zinc-500">
              {total} Total Interview Problems
            </span>
          </div>

          {/* 3 Difficulty KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* EASY CARD */}
            <div
              onClick={() => onSelectView?.('all-questions')}
              className="rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-950/10 group relative"
              style={{
                backgroundColor: 'var(--bg-card-alt)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Easy</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                    {easyPct}%
                  </span>
                </div>

                <div className="my-2">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-black text-white tracking-tight">
                      {easySolved}
                    </span>
                    <span className="text-xs font-medium text-zinc-400">
                      / {easyTotal} Solved
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {easyRemaining === 0 && easyTotal > 0
                      ? 'All Easy Solved! 🎉'
                      : `${easyRemaining} remaining`}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="w-full h-2 rounded-full overflow-hidden bg-zinc-800/80">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700 shadow-sm shadow-emerald-500/50"
                    style={{ width: `${Math.min(100, Math.max(easyPct, easySolved > 0 ? 4 : 0))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* MEDIUM CARD */}
            <div
              onClick={() => onSelectView?.('all-questions')}
              className="rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer hover:border-amber-500/50 hover:bg-amber-950/10 group relative"
              style={{
                backgroundColor: 'var(--bg-card-alt)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center space-x-1.5 text-xs font-bold text-amber-400">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Medium</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                    {medPct}%
                  </span>
                </div>

                <div className="my-2">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-black text-white tracking-tight">
                      {medSolved}
                    </span>
                    <span className="text-xs font-medium text-zinc-400">
                      / {medTotal} Solved
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {medRemaining === 0 && medTotal > 0
                      ? 'All Medium Solved! 🚀'
                      : `${medRemaining} remaining`}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="w-full h-2 rounded-full overflow-hidden bg-zinc-800/80">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-700 shadow-sm shadow-amber-400/50"
                    style={{ width: `${Math.min(100, Math.max(medPct, medSolved > 0 ? 4 : 0))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* HARD CARD */}
            <div
              onClick={() => onSelectView?.('all-questions')}
              className="rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer hover:border-rose-500/50 hover:bg-rose-950/10 group relative"
              style={{
                backgroundColor: 'var(--bg-card-alt)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center space-x-1.5 text-xs font-bold text-rose-400">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Hard</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/25">
                    {hardPct}%
                  </span>
                </div>

                <div className="my-2">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-black text-white tracking-tight">
                      {hardSolved}
                    </span>
                    <span className="text-xs font-medium text-zinc-400">
                      / {hardTotal} Solved
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {hardRemaining === 0 && hardTotal > 0
                      ? 'All Hard Solved! 👑'
                      : `${hardRemaining} remaining`}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="w-full h-2 rounded-full overflow-hidden bg-zinc-800/80">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-700 shadow-sm shadow-rose-500/50"
                    style={{ width: `${Math.min(100, Math.max(hardPct, hardSolved > 0 ? 4 : 0))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Guidance Footer */}
          <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center space-x-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
              <span>Recommended target: 60% Medium, 30% Easy, 10% Hard</span>
            </span>
            <span className="hidden sm:inline text-zinc-500">
              Click any card to explore questions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
