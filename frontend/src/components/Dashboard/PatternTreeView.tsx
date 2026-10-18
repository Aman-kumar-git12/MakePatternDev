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
    // By default, expand "Beginner Problems" or root folders
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
        return <Clock className="w-3.5 h-3.5 text-blue-400" />;
      case 'Needs Revision':
        return <RotateCcw className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Circle className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const difficultyColors: Record<Difficulty, string> = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
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
          className={`flex items-center justify-between py-2.5 px-3 rounded-xl cursor-pointer transition group ${
            isRoot
              ? 'hover:bg-slate-800/40 text-slate-200 font-medium'
              : 'hover:bg-[#121B30] text-slate-300 font-normal'
          }`}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            {/* Expand / Collapse Icon */}
            <div className="w-5 h-5 flex items-center justify-center text-slate-400 group-hover:text-white transition">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-600/70 flex items-center justify-center group-hover:border-slate-400">
                  <ChevronRight className="w-2.5 h-2.5" />
                </div>
              )}
            </div>

            {/* Folder Name */}
            <span
              className={`text-sm truncate ${
                isRoot
                  ? 'text-white font-medium text-[15px]'
                  : 'text-slate-300 group-hover:text-white text-[13.5px]'
              }`}
            >
              {folder.name}
            </span>
          </div>

          {/* Right Action / Count */}
          <div className="flex items-center space-x-2">
            {folderQuestions.length > 0 && (
              <span className="text-[11px] text-slate-500 group-hover:text-slate-400 transition">
                {folderQuestions.length} {folderQuestions.length === 1 ? 'problem' : 'problems'}
              </span>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenNewQuestion(folder.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
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
          <div className="relative pl-6 ml-3.5 border-l border-slate-700/50 space-y-0.5 mt-0.5 mb-1.5">
            {/* 1. Subfolders */}
            {subfolders.map((sub) =>
              renderFolderNode(sub, false)
            )}

            {/* 2. Questions directly under this folder */}
            {folderQuestions.map((q) => (
              <div
                key={q.id}
                onClick={() => onSelectQuestion(q.id)}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition group relative before:content-[''] before:absolute before:-left-6 before:top-1/2 before:w-4 before:h-[1px] before:bg-slate-700/50"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="flex-shrink-0">{renderStatusIcon(q.status)}</div>
                  <span className="text-xs text-slate-200 group-hover:text-blue-300 transition truncate font-medium">
                    {q.title}
                  </span>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      difficultyColors[q.difficulty] || 'text-slate-400'
                    }`}
                  >
                    {q.difficulty}
                  </span>

                  {onToggleBookmark && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBookmark(q.id);
                      }}
                      className="p-1 text-slate-500 hover:text-amber-400 transition"
                      title="Bookmark"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          q.is_bookmarked ? 'fill-amber-400 text-amber-400' : ''
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* If folder is empty and has no subfolders, show friendly add prompt */}
            {!hasChildren && (
              <div className="py-2 px-3 text-xs text-slate-500 italic flex items-center justify-between">
                <span>No problems in this topic yet</span>
                <button
                  onClick={() => onOpenNewQuestion(folder.id)}
                  className="text-blue-400 hover:text-blue-300 font-medium text-xs flex items-center space-x-1"
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
    <div className="bg-[#0B101E] border border-slate-800/90 rounded-2xl p-5 shadow-xl">
      <div className="space-y-2">
        {folders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
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
