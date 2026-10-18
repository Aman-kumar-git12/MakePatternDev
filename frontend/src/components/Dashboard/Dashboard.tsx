import React from 'react';
import { CompletionHeader } from './CompletionHeader';
import { PatternTreeView } from './PatternTreeView';
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
}) => {
  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4 animate-fade-in">
      {/* 1. OVERALL COMPLETION & STATS BAR */}
      <CompletionHeader summary={summary} onSelectView={onSelectView} />

      {/* 2. TOPIC & PROBLEM HIERARCHY TREE (Exact match to Image 2) */}
      <PatternTreeView
        folders={folders}
        questions={questions}
        onSelectQuestion={onSelectQuestion}
        onOpenNewQuestion={onOpenNewQuestion}
        onDeleteFolder={onDeleteFolder}
        onToggleBookmark={onToggleBookmark}
      />
    </div>
  );
};
