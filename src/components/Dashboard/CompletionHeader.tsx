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
          className="rounded-xl p-3 cursor-pointer transition group"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center space-x-2 text-yellow-400 mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Topics</span>
          </div>
          <div className="text-xl font-bold group-hover:text-yellow-300 transition" style={{ color: 'var(--text-primary)' }}>{totalTopics}</div>
        </div>

        <div
          onClick={() => onSelectView && onSelectView('patterns')}
          className="rounded-xl p-3 cursor-pointer transition group"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center space-x-2 text-yellow-300 mb-1">
            <FolderTree className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Subtopics</span>
          </div>
          <div className="text-xl font-bold group-hover:text-yellow-200 transition" style={{ color: 'var(--text-primary)' }}>{totalSubtopics}</div>
        </div>

        <div
          onClick={() => onSelectView && onSelectView('all-questions')}
          className="rounded-xl p-3 cursor-pointer transition group"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center space-x-2 text-emerald-400 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Solved</span>
          </div>
          <div className="text-xl font-bold group-hover:text-emerald-300 transition" style={{ color: 'var(--text-primary)' }}>
            {solved} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/ {total}</span>
          </div>
        </div>

        <div
          onClick={() => onSelectView && onSelectView('revision')}
          className="rounded-xl p-3 cursor-pointer transition group"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center space-x-2 text-yellow-300 mb-1">
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Needs Revision</span>
          </div>
          <div className="text-xl font-bold text-yellow-300 group-hover:text-yellow-200 transition">{needsRevision}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* 1. OVERALL COMPLETION */}
        <div
          className="md:col-span-4 rounded-2xl p-5 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          <div>
            {/* Header */}
            <div className="flex items-center space-x-2 text-yellow-300 mb-3">
              <PieChart className="w-4 h-4 stroke-[2.2]" />
              <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
                Overall Completion
              </span>
            </div>

            {/* Stats Row */}
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {overallPercentage}%
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {solved} / {total} Solved
              </span>
            </div>
          </div>

          {/* Light Yellow Progress Bar */}
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <div
              className="h-full bg-[#fef08a] rounded-full transition-all duration-500 shadow-sm shadow-yellow-200/30"
              style={{ width: `${Math.min(100, Math.max(overallPercentage, 3))}%` }}
            />
          </div>
        </div>

        {/* 2. DIFFICULTY BREAKDOWN */}
        <div
          className="md:col-span-8 rounded-2xl p-5 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
        {/* Header */}
        <div className="flex items-center space-x-2 text-emerald-400 mb-3">
          <Award className="w-4 h-4 stroke-[2.2]" />
          <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-secondary)' }}>
            Difficulty Breakdown
          </span>
        </div>

        {/* 3 Sub-Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Easy */}
          <div
            className="rounded-xl p-3 flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--bg-card-alt)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <span className="text-xs font-semibold text-emerald-400 block mb-1">
                Easy
              </span>
              <div className="flex items-baseline space-x-1 mb-2">
                <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{easySolved}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>/ {easyTotal}</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(easyPct, 2))}%` }}
              />
            </div>
          </div>

          {/* Medium */}
          <div
            className="rounded-xl p-3 flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--bg-card-alt)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <span className="text-xs font-semibold text-yellow-300 block mb-1">
                Medium
              </span>
              <div className="flex items-baseline space-x-1 mb-2">
                <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{medSolved}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>/ {medTotal}</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <div
                className="h-full bg-[#fef08a] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(medPct, 2))}%` }}
              />
            </div>
          </div>

          {/* Hard */}
          <div
            className="rounded-xl p-3 flex flex-col justify-between"
            style={{
              backgroundColor: 'var(--bg-card-alt)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <span className="text-xs font-semibold text-rose-400 block mb-1">
                Hard
              </span>
              <div className="flex items-baseline space-x-1 mb-2">
                <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{hardSolved}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>/ {hardTotal}</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
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
