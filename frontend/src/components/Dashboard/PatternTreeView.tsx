import React, { useState, useMemo } from 'react';
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
  FileCode,
  FolderTree,
  ExternalLink,
  Layers,
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

export const PatternTreeView: React.FC<PatternTreeViewProps> = ({
  folders,
  questions,
  onSelectQuestion,
  onOpenNewQuestion,
  onDeleteFolder,
  onToggleBookmark,
}) => {
  // Store expanded state for folders by ID (default expanded)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const expandAll = (list: Folder[]) => {
      for (const f of list) {
        initial[f.id] = true;
        if (f.subfolders && f.subfolders.length > 0) {
          expandAll(f.subfolders);
        }
      }
    };
    expandAll(folders);
    return initial;
  });

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Group questions strictly by folder_id (Pattern questions only)
  const questionsByFolder = useMemo(() => {
    const map = new Map<string, QuestionListItem[]>();
    for (const q of questions) {
      if (!q.folder_id) continue; // Skip non-pattern questions
      const list = map.get(q.folder_id) || [];
      list.push(q);
      map.set(q.folder_id, list);
    }
    for (const [folderId, list] of map.entries()) {
      map.set(folderId, sortQuestions(list));
    }
    return map;
  }, [questions]);

  const getQuestionsForFolder = (folderId: string): QuestionListItem[] => {
    return questionsByFolder.get(folderId) || [];
  };

  const getRecursiveQuestionCount = (folder: Folder): number => {
    let count = getQuestionsForFolder(folder.id).length;
    if (folder.subfolders) {
      for (const sub of folder.subfolders) {
        count += getRecursiveQuestionCount(sub);
      }
    }
    return count;
  };

  const renderStatusIcon = (status: QuestionStatus) => {
    switch (status) {
      case 'Solved':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
      case 'In Progress':
        return <Clock className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />;
      case 'Needs Revision':
        return <RotateCcw className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0" />;
      default:
        return <Circle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />;
    }
  };

  const difficultyColors: Record<Difficulty, string> = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-yellow-300 bg-[#fef08a]/15 border border-[#fef08a]/30',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  // Render question row with exact same structure as MyPatternsView
  const renderQuestionRow = (q: QuestionListItem) => {
    return (
      <div
        key={q.id}
        onClick={() => onSelectQuestion(q.id)}
        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800/40 cursor-pointer transition group border border-transparent hover:border-slate-800"
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <div title={q.status}>{renderStatusIcon(q.status)}</div>
          <FileCode className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span className="text-xs text-slate-300 group-hover:text-blue-300 font-medium truncate">
            {q.title}
          </span>
          {q.tags && q.tags.length > 0 && (
            <div className="hidden sm:flex items-center space-x-1">
              {q.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800/80 text-slate-400 border border-slate-700/50"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <span
            className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
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
              className="p-1 text-slate-500 hover:text-yellow-300 transition cursor-pointer"
              title="Bookmark"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  q.is_bookmarked ? 'fill-[#fef08a] text-yellow-300' : ''
                }`}
              />
            </button>
          )}

          {q.problem_url && (
            <a
              href={q.problem_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-slate-500 hover:text-blue-400 p-1 transition"
              title="Open problem link"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    );
  };

  // Render a recursive subtopic node matching MyPatternsView structure
  const renderSubtopicNode = (node: Folder) => {
    const isExpanded = !!expandedFolders[node.id];
    const nodeQuestions = getQuestionsForFolder(node.id);
    const subtopics = sortFolders(node.subfolders || []);
    const hasChildren = subtopics.length > 0 || nodeQuestions.length > 0;

    return (
      <div key={node.id} className="text-xs space-y-1 rounded-xl bg-[#090E1A]/80 border border-slate-800/80 p-2.5 transition">
        {/* Subtopic Header */}
        <div
          onClick={() => toggleFolder(node.id)}
          className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer transition select-none group"
        >
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-slate-400 hover:text-white transition">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </span>

            <FolderTree className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />

            <span className="font-semibold text-slate-200 group-hover:text-blue-300 transition truncate text-xs">
              {node.name}
            </span>

            <span className="text-[10px] text-slate-500 font-mono px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700/50">
              {nodeQuestions.length} {nodeQuestions.length === 1 ? 'problem' : 'problems'}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenNewQuestion(node.id);
              }}
              className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white transition shadow-sm cursor-pointer"
              title={`Add Problem inside "${node.name}"`}
            >
              <Plus className="w-3 h-3" />
              <span>Problem</span>
            </button>
          </div>
        </div>

        {/* Subtopic Children */}
        {isExpanded && (
          <div className="pl-3 ml-2 border-l border-slate-800 space-y-1.5 pt-1">
            {subtopics.map(renderSubtopicNode)}
            {nodeQuestions.map(renderQuestionRow)}

            {!hasChildren && (
              <div className="py-2 px-2 text-xs text-slate-500 italic flex items-center justify-between">
                <span>No problems in this subtopic yet</span>
                <button
                  onClick={() => onOpenNewQuestion(node.id)}
                  className="text-blue-400 hover:text-blue-300 font-medium text-xs flex items-center space-x-1 cursor-pointer"
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

  // Render Root Pattern / Topic Card matching MyPatternsView structure
  const renderRootTopicCard = (pattern: Folder) => {
    const isExpanded = !!expandedFolders[pattern.id];
    const directQuestions = getQuestionsForFolder(pattern.id);
    const subfolders = sortFolders(pattern.subfolders || []);
    const totalQ = getRecursiveQuestionCount(pattern);
    const hasChildren = subfolders.length > 0 || directQuestions.length > 0;

    return (
      <div
        key={pattern.id}
        className="bg-[#0D1527] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5 transition-all duration-200"
      >
        {/* Topic Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/80">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div
              onClick={() => toggleFolder(pattern.id)}
              className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-200" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-600/70 flex items-center justify-center hover:border-slate-400">
                  <ChevronRight className="w-2.5 h-2.5 text-slate-400" />
                </div>
              )}
            </div>

            <div
              onClick={() => toggleFolder(pattern.id)}
              className="cursor-pointer group select-none min-w-0"
            >
              <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-blue-300 transition truncate">
                  {pattern.name}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                  {subfolders.length} {subfolders.length === 1 ? 'subtopic' : 'subtopics'} • {totalQ} {totalQ === 1 ? 'problem' : 'problems'}
                </span>
              </div>
              {pattern.description && (
                <p className="text-xs text-slate-400 truncate max-w-lg mt-0.5">
                  {pattern.description}
                </p>
              )}
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => onOpenNewQuestion(pattern.id)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md transition active:scale-95 cursor-pointer"
              title={`Add Question inside "${pattern.name}"`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </button>

            {onDeleteFolder && (
              <button
                onClick={() => onDeleteFolder(pattern.id, pattern.name)}
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                title={`Delete pattern "${pattern.name}"`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content under this topic */}
        {isExpanded && (
          <div className="space-y-3 pt-1">
            {/* Subtopics */}
            {subfolders.length > 0 && (
              <div className="space-y-2">
                {subfolders.map(renderSubtopicNode)}
              </div>
            )}

            {/* Direct questions under root topic */}
            {directQuestions.length > 0 && (
              <div className="space-y-1.5">
                {subfolders.length > 0 && (
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 pt-1">
                    General Questions
                  </div>
                )}
                <div className="space-y-1">
                  {directQuestions.map(renderQuestionRow)}
                </div>
              </div>
            )}

            {!hasChildren && (
              <div className="py-6 text-center text-slate-500 text-xs italic bg-[#090E1A]/60 rounded-xl border border-slate-800/60 p-4">
                <span>No problems in this topic yet.</span>
                <button
                  onClick={() => onOpenNewQuestion(pattern.id)}
                  className="ml-2 text-yellow-400 hover:text-yellow-300 font-medium inline-flex items-center space-x-1 cursor-pointer"
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

  const sortedRoot = sortFolders(folders);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-yellow-400" />
          <h2 className="text-sm font-bold text-white tracking-tight">
            Curated Pattern Problems
          </h2>
        </div>
        <span className="text-xs text-slate-400">
          Showing pattern questions by topic hierarchy
        </span>
      </div>

      {sortedRoot.length === 0 ? (
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
          No pattern topics available yet. Click "Start Your Journey" or create a topic to get started!
        </div>
      ) : (
        <div className="space-y-4">
          {sortedRoot.map(renderRootTopicCard)}
        </div>
      )}
    </div>
  );
};
