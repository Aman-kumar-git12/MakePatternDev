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
  ExternalLink,
} from 'lucide-react';
import type { Folder, QuestionListItem, Difficulty, QuestionStatus } from '../../types/dsa';

interface PatternTreeViewProps {
  folders: Folder[];
  questions: QuestionListItem[];
  onSelectQuestion: (questionId: string) => void;
  onOpenNewQuestion: (folderId?: string) => void;
  onDeleteFolder?: (folderId: string, folderName: string) => void;
  onToggleBookmark?: (questionId: string) => void;
  activeQuestionId?: string | null;
}

export const PatternTreeView: React.FC<PatternTreeViewProps> = ({
  folders,
  questions,
  onSelectQuestion,
  onOpenNewQuestion,
  onDeleteFolder,
  onToggleBookmark,
  activeQuestionId,
}) => {
  // Store expanded state for folders by ID (default to true for all root folders)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
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

  const sortFolders = (list: Folder[]): Folder[] => {
    return [...list].sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      if (posA !== posB) return posA - posB;
      if (a.created_at && b.created_at) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
    });
  };

  const sortQuestions = (list: QuestionListItem[]): QuestionListItem[] => {
    return [...list].sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      if (posA !== posB) return posA - posB;
      if (a.created_at && b.created_at) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
    });
  };

  const getQuestionsForFolder = (folderId: string): QuestionListItem[] => {
    return sortQuestions(questions.filter((q) => q.folder_id === folderId));
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
    const subfolders = sortFolders(folder.subfolders || []);
    const hasChildren = subfolders.length > 0 || folderQuestions.length > 0;

    type UnifiedTreeChild =
      | { kind: 'subfolder'; id: string; position: number; data: Folder }
      | { kind: 'question'; id: string; position: number; data: QuestionListItem };

    const unifiedChildren: UnifiedTreeChild[] = [
      ...subfolders.map((sf, idx) => ({
        kind: 'subfolder' as const,
        id: sf.id,
        position: sf.position ?? idx,
        data: sf,
      })),
      ...folderQuestions.map((q, idx) => ({
        kind: 'question' as const,
        id: q.id,
        position: q.position ?? idx,
        data: q,
      })),
    ].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      if (a.kind === 'subfolder' && b.kind === 'question') return -1;
      if (a.kind === 'question' && b.kind === 'subfolder') return 1;
      return 0;
    });

    const renderQuestionItem = (q: QuestionListItem) => {
      const isActive = activeQuestionId === q.id;
      return (
        <div
          key={q.id}
          onClick={() => onSelectQuestion(q.id)}
          className={`flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition group relative ${
            isActive
              ? 'bg-yellow-400/15 border-l-4 border-l-yellow-400 border border-yellow-400/35 text-yellow-200 shadow-sm shadow-yellow-400/10'
              : 'border border-transparent'
          }`}
          style={isActive ? undefined : { color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'rgba(254, 240, 138, 0.08)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = '';
            }
          }}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            {isActive ? (
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
            ) : (
              <div className="flex-shrink-0">{renderStatusIcon(q.status)}</div>
            )}
            <span
              className={`text-xs transition truncate ${
                isActive
                  ? 'font-bold text-yellow-200'
                  : 'font-medium group-hover:text-yellow-200'
              }`}
              style={isActive ? undefined : { color: 'var(--text-primary)' }}
            >
              {q.title}
            </span>

            {/* Difficulty tag right to question title */}
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                difficultyColors[q.difficulty] || ''
              }`}
              style={!difficultyColors[q.difficulty] ? { color: 'var(--text-tertiary)' } : undefined}
            >
              {q.difficulty}
            </span>
          </div>

          {/* Controls: Right side actions */}
          <div className="flex items-center space-x-2.5 flex-shrink-0">

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

            {/* Right side: Link (Fixed slot ensures tags and links stay in perfect vertical sequence) */}
            <div className="w-6 flex items-center justify-center shrink-0">
              {q.problem_url && q.problem_url.trim() ? (
                <a
                  href={q.problem_url.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 text-slate-500 hover:text-yellow-300 transition rounded flex items-center justify-center"
                  title="Open problem link"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span
                  className="p-1 text-slate-600/30 cursor-not-allowed flex items-center justify-center"
                  title="No problem link"
                >
                  <ExternalLink className="w-3.5 h-3.5 opacity-20" />
                </span>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div key={folder.id} className="relative select-none">
        {/* Row Header */}
        <div
          onClick={() => toggleFolder(folder.id)}
          className="flex items-center justify-between py-2.5 px-3 rounded-xl cursor-pointer transition group"
          style={{ color: isRoot ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(254, 240, 138, 0.05)';
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
            {unifiedChildren.map((item) =>
              item.kind === 'subfolder'
                ? renderFolderNode(item.data, false)
                : renderQuestionItem(item.data)
            )}

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
          sortFolders(folders).map((folder) =>
            renderFolderNode(folder, true)
          )
        )}
      </div>
    </div>
  );
};
