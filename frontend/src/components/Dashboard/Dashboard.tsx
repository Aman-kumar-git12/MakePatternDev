import React from 'react';
import { CompletionHeader } from './CompletionHeader';
import { PatternTreeView } from './PatternTreeView';
import { ArrowRight, Layers } from 'lucide-react';
import type { ProgressSummary, Folder, QuestionListItem, ViewMode } from '../../types/dsa';

interface DashboardProps {
  summary: ProgressSummary | null;
  folders: Folder[];
  questions: QuestionListItem[];
  onSelectQuestion: (questionId: string) => void;
  onOpenNewFolder?: () => void;
  onOpenNewQuestion: (folderId?: string) => void;
  onDeleteFolder?: (folderId: string, folderName: string) => void;
  onOpenImportLeetCode?: () => void;
  onSelectView?: (view: ViewMode) => void;
  onToggleBookmark?: (questionId: string) => void;
  activeQuestionId?: string | null;
}

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  folders,
  questions,
  onSelectQuestion,
  onOpenNewQuestion,
  onDeleteFolder,
  onToggleBookmark,
  onSelectView,
  activeQuestionId,
}) => {
  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4 animate-fade-in">
      {/* Hero Banner */}
      <div
        className="relative overflow-hidden rounded-2xl bg-[#09090c]"
        style={{
          boxShadow: 'var(--shadow-elevated)',
          border: '1px solid var(--border-primary)',
        }}
      >
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/image.png)',
          }}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, rgba(5,5,7,0.94) 0%, rgba(5,5,7,0.80) 40%, rgba(5,5,7,0.2) 65%, rgba(5,5,7,0.35) 100%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 p-6 sm:p-8 flex flex-col justify-center min-h-[200px]">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-1 h-6 bg-[#fef08a] rounded-full" />
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-zinc-400">
              MakePattern / Master DSA
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2" style={{ color: '#ffffff' }}>
            Algorithm Today,
            <br />
            <span style={{ color: '#fef08a' }}>
              Efficiency Tomorrow.
            </span>
          </h1>

          <p className="text-sm max-w-md mb-4" style={{ color: '#d4d4d8' }}>
            Decode the patterns of complex systems. Master DSA and engineer your potential.
          </p>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => onSelectView?.('patterns')}
              className="flex items-center space-x-2 px-4 py-2 rounded-full bg-[#fef08a] hover:bg-[#fef9c3] text-[#18181b] text-xs font-semibold shadow-md shadow-yellow-200/20 active:scale-95 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Start Your Journey</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSelectView?.('all-questions')}
              className="flex items-center space-x-2 text-xs font-medium text-zinc-300 hover:text-white transition"
            >
              <span className="w-6 h-px bg-zinc-600" />
              <span>Explore Problems</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. OVERALL COMPLETION & STATS BAR */}
      <CompletionHeader summary={summary} onSelectView={onSelectView} />

      {/* 2. TOPIC & PROBLEM HIERARCHY TREE */}
      <PatternTreeView
        folders={folders}
        questions={questions}
        onSelectQuestion={onSelectQuestion}
        onOpenNewQuestion={onOpenNewQuestion}
        onDeleteFolder={onDeleteFolder}
        onToggleBookmark={onToggleBookmark}
        activeQuestionId={activeQuestionId}
      />
    </div>
  );
};
