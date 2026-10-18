import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  RotateCcw,
  Circle,
  Star,
} from 'lucide-react';
import type { Folder, QuestionListItem, Difficulty, QuestionStatus } from '../../types/dsa';

interface PatternTreeViewProps {
  folders: Folder[];
  questions: QuestionListItem[];
  onSelectQuestion: (questionId: string) => void;
  onOpenNewQuestion: (folderId?: string) => void;
  onDeleteFolder?: (folderId: string, folderName: string) => void;
  onToggleBookmark?: (questionId: string) => void;
}

export const PatternTreeView: React.FC<PatternTreeViewProps> = ({
  folders,
  questions,
  onSelectQuestion,
  onOpenNewQuestion,
  onDeleteFolder,
  onToggleBookmark,
}) => {
  // Store expanded state for folders by ID
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    // By default, expand root folders
    for (const f of folders) {
      initial[f.id] = true;
    }
    return initial;
  });

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const getQuestionsForFolder = (folderId: string): QuestionListItem[] => {
    return questions.filter((q) => q.folder_id === folderId);
  };

  const renderStatusIcon = (status: QuestionStatus) => {
    switch (status) {
      case 'Solved':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'In Progress':
        return <Clock className="w-3.5 h-3.5 text-yellow-300" />;
      case 'Needs Revision':
        return <RotateCcw className="w-3.5 h-3.5 text-yellow-300" />;
      default:
        return <Circle className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const difficultyColors: Record<Difficulty, string> = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-yellow-300 bg-[#fef08a]/15 border border-[#fef08a]/30',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  // Helper to render tree nodes recursively
  const renderFolderNode = (folder: Folder, isRoot = false) => {
    const isExpanded = !!expandedFolders[folder.id];
    const folderQuestions = getQuestionsForFolder(folder.id);
    const subfolders = folder.subfolders || [];
    const hasChildren = subfolders.length > 0 || folderQuestions.length > 0;

    return (
      <div key={folder.id} className="relative select-none">
        {/* Row Header */}
        <div
          onClick={() => toggleFolder(folder.id)}
          className="flex items-center justify-between py-2.5 px-3 rounded-xl cursor-pointer transition group"
          style={{ color: isRoot ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '';
          }}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            {/* Expand / Collapse Icon */}
            <div className="w-5 h-5 flex items-center justify-center transition" style={{ color: 'var(--text-tertiary)' }}>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ border: '1px solid var(--border-hover)' }}
                >
                  <ChevronRight className="w-2.5 h-2.5" />
                </div>
              )}
            </div>

            {/* Folder Name */}
            <span
              className={`truncate ${
                isRoot
                  ? 'font-medium text-[15px]'
                  : 'text-[13.5px]'
              }`}
              style={{ color: isRoot ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              {folder.name}
            </span>
          </div>

          {/* Right Action / Count */}
          <div className="flex items-center space-x-2">
            {folderQuestions.length > 0 && (
              <span className="text-[11px] transition" style={{ color: 'var(--text-muted)' }}>
                {folderQuestions.length} {folderQuestions.length === 1 ? 'problem' : 'problems'}
              </span>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenNewQuestion(folder.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition"
              style={{ color: 'var(--text-tertiary)' }}
              title="Add Question to this topic"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {onDeleteFolder && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(folder.id, folder.name);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                title={`Delete pattern "${folder.name}"`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Children (Subfolders and Questions) with connecting tree lines */}
        {isExpanded && (
          <div
            className="relative pl-6 ml-3.5 space-y-0.5 mt-0.5 mb-1.5"
            style={{ borderLeft: '1px solid var(--border-subtle)' }}
          >
            {/* 1. Subfolders */}
            {subfolders.map((sub) =>
              renderFolderNode(sub, false)
            )}

            {/* 2. Questions directly under this folder */}
            {folderQuestions.map((q) => (
              <div
                key={q.id}
                onClick={() => onSelectQuestion(q.id)}
                className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition group relative"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '';
                }}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="flex-shrink-0">{renderStatusIcon(q.status)}</div>
                  <span className="text-xs group-hover:text-blue-300 transition truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                    {q.title}
                  </span>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      difficultyColors[q.difficulty] || ''
                    }`}
                    style={!difficultyColors[q.difficulty] ? { color: 'var(--text-tertiary)' } : undefined}
                  >
                    {q.difficulty}
                  </span>

                  {onToggleBookmark && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBookmark(q.id);
                      }}
                      className="p-1 hover:text-yellow-300 transition"
                      style={{ color: 'var(--text-muted)' }}
                      title="Bookmark"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          q.is_bookmarked ? 'fill-[#fef08a] text-yellow-300' : ''
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* If folder is empty and has no subfolders, show friendly add prompt */}
            {!hasChildren && (
              <div className="py-2 px-3 text-xs italic flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
                <span>No problems in this topic yet</span>
                <button
                  onClick={() => onOpenNewQuestion(folder.id)}
                  className="text-yellow-400 hover:text-yellow-300 font-medium text-xs flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add First Question</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-elevated)',
      }}
    >
      <div className="space-y-2">
        {folders.length === 0 ? (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            No categories available. Click "New Question" above to start!
          </div>
        ) : (
          folders.map((folder) =>
            renderFolderNode(folder, true)
          )
        )}
      </div>
    </div>
  );
};
