import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FileCode,
  CheckCircle2,
  Clock,
  RotateCcw,
  Circle,
  Star,
  Trash2,
  Edit2,
  Search,
  FolderTree,
  ExternalLink,
  GripVertical,
  Share2,
} from 'lucide-react';
import { SharePatternModal } from '../Modals/SharePatternModal';
import type { Folder, QuestionListItem, Difficulty, QuestionStatus } from '../../types/dsa';

interface MyPatternsViewProps {
  folders: Folder[];
  questions: QuestionListItem[];
  onSelectQuestion: (questionId: string) => void;
  onCreateFolder: (name: string, parentId: string | null, description?: string, tags?: string[]) => Promise<void>;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string, folderName: string) => void;
  onOpenCreateTopic: () => void;
  onOpenCreateSubtopic: (folderId: string) => void;
  onOpenCreateQuestion: (folderId: string) => void;
  onToggleBookmark?: (questionId: string) => void;
  onDeleteQuestion?: (questionId: string, questionTitle: string) => void;
  onReorderFolders?: (reorderedFolders: Folder[]) => Promise<void> | void;
  onReorderQuestions?: (folderId: string, reorderedQuestions: QuestionListItem[]) => Promise<void> | void;
  onReorderChildren?: (parentId: string, reorderedFolders: Folder[], reorderedQuestions: QuestionListItem[]) => Promise<void> | void;
  onMoveQuestion?: (questionId: string, targetFolderId: string) => Promise<void> | void;
  activeQuestionId?: string | null;
}

const EXPANDED_STORAGE_KEY = 'mp_mypatterns_expanded_nodes';

interface DragState {
  type: 'root-folder' | 'subfolder' | 'question';
  id: string;
  folderId?: string | null; // For questions: folder_id
  parentId?: string | null; // For subfolders: parent folder ID
}

interface DropTarget {
  type: 'root-folder' | 'subfolder' | 'question';
  id: string;
  position: 'before' | 'after' | 'into';
}

type UnifiedChildItem =
  | { kind: 'subtopic'; id: string; position: number; data: Folder }
  | { kind: 'question'; id: string; position: number; data: QuestionListItem };

const getUnifiedChildren = (
  subfolders: Folder[],
  questions: QuestionListItem[]
): UnifiedChildItem[] => {
  const sortedSubs = sortFolders(subfolders);
  const sortedQs = sortQuestions(questions);

  const list: UnifiedChildItem[] = [
    ...sortedSubs.map((s, idx) => ({
      kind: 'subtopic' as const,
      id: s.id,
      position: s.position !== undefined && s.position !== null ? s.position : idx,
      data: s,
    })),
    ...sortedQs.map((q, idx) => ({
      kind: 'question' as const,
      id: q.id,
      position: q.position !== undefined && q.position !== null ? q.position : sortedSubs.length + idx,
      data: q,
    })),
  ];

  return list.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    if (a.kind !== b.kind) return a.kind === 'subtopic' ? -1 : 1;
    return 0;
  });
};

// First added shown first at top (position ASC, then created_at ASC)
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

export const MyPatternsView: React.FC<MyPatternsViewProps> = ({
  folders,
  questions,
  onSelectQuestion,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onOpenCreateTopic,
  onOpenCreateSubtopic,
  onOpenCreateQuestion,
  onToggleBookmark,
  onDeleteQuestion,
  onReorderFolders,
  onReorderQuestions,
  onReorderChildren,
  onMoveQuestion,
  activeQuestionId,
}) => {
  const [newTopicName, setNewTopicName] = useState('');
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sharingFolder, setSharingFolder] = useState<Folder | null>(null);

  // Drag and Drop state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // Nodes are expanded by default unless explicitly collapsed
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem(EXPANDED_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse saved expanded nodes:', e);
    }
    return {};
  });

  const isNodeExpanded = (nodeId: string): boolean => {
    // Default to true (expanded) if not explicitly set
    return expandedNodes[nodeId] !== false;
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const currentlyOpen = prev[nodeId] !== false;
      const next = {
        ...prev,
        [nodeId]: !currentlyOpen,
      };
      try {
        sessionStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist expanded nodes:', e);
      }
      return next;
    });
  };

  const handleAddNewPatternTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    try {
      setIsAddingTopic(true);
      await onCreateFolder(newTopicName.trim(), null);
      setNewTopicName('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add pattern topic');
    } finally {
      setIsAddingTopic(false);
    }
  };

  // Build a lookup map of questions by folder ID, sorted FIFO (first added at top)
  const questionsByFolder = useMemo(() => {
    const map = new Map<string, QuestionListItem[]>();
    for (const q of questions) {
      if (q.folder_id) {
        const list = map.get(q.folder_id) || [];
        list.push(q);
        map.set(q.folder_id, list);
      }
    }
    for (const [folderId, list] of map.entries()) {
      map.set(folderId, sortQuestions(list));
    }
    return map;
  }, [questions]);

  const getQuestionsForFolder = (folderId: string): QuestionListItem[] => {
    return questionsByFolder.get(folderId) || [];
  };

  const difficultyColors: Record<Difficulty, string> = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-yellow-300 bg-[#fef08a]/15 border border-[#fef08a]/30',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
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

  // Sort root folders FIFO / by position
  const sortedRootFolders = useMemo(() => {
    return sortFolders(folders);
  }, [folders]);

  // Filter root folders
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return sortedRootFolders;
    const q = searchQuery.toLowerCase();

    return sortedRootFolders.filter((f) => {
      const matchName = f.name.toLowerCase().includes(q);
      const matchDesc = f.description?.toLowerCase().includes(q);
      const hasMatchingSubfolder = f.subfolders?.some((sub) =>
        sub.name.toLowerCase().includes(q)
      );
      return matchName || matchDesc || hasMatchingSubfolder;
    });
  }, [sortedRootFolders, searchQuery]);

  // Drag handlers for Root Topics
  const handleRootTopicDrop = (targetTopicId: string) => {
    if (!dragState || dragState.type !== 'root-folder' || dragState.id === targetTopicId) {
      setDragState(null);
      setDropTarget(null);
      return;
    }

    const currentList = [...sortedRootFolders];
    const dragIdx = currentList.findIndex((f) => f.id === dragState.id);
    const targetIdx = currentList.findIndex((f) => f.id === targetTopicId);

    if (dragIdx === -1 || targetIdx === -1) {
      setDragState(null);
      setDropTarget(null);
      return;
    }

    const [dragged] = currentList.splice(dragIdx, 1);
    const insertIdx = currentList.findIndex((f) => f.id === targetTopicId);
    const finalIdx = dropTarget?.position === 'after' ? insertIdx + 1 : insertIdx;
    currentList.splice(finalIdx, 0, dragged);

    const reordered = currentList.map((f, idx) => ({ ...f, position: idx }));
    if (onReorderFolders) {
      onReorderFolders(reordered);
    }
    setDragState(null);
    setDropTarget(null);
  };

  // Unified Drop handler: Subtopics and Questions can be rearranged together!
  const handleChildDrop = (
    parentId: string,
    targetId: string,
    forcedPosition?: 'before' | 'after'
  ) => {
    if (
      !dragState ||
      dragState.parentId !== parentId ||
      dragState.id === targetId
    ) {
      setDragState(null);
      setDropTarget(null);
      return;
    }

    const currentPos = forcedPosition || dropTarget?.position || 'before';

    const findAndReorderChildren = (
      nodes: Folder[]
    ): {
      updatedTree: Folder[];
      reorderedSubfolders: Folder[];
      reorderedQuestions: QuestionListItem[];
    } | null => {
      for (const node of nodes) {
        if (node.id === parentId) {
          const curSubs = node.subfolders || [];
          const curQuestions = questionsByFolder.get(parentId) || [];
          const unified = getUnifiedChildren(curSubs, curQuestions);

          const dragIdx = unified.findIndex((it) => it.id === dragState.id);
          const targetIdx = unified.findIndex((it) => it.id === targetId);

          if (dragIdx === -1 || targetIdx === -1) return null;

          const [dragged] = unified.splice(dragIdx, 1);
          const newTargetIdx = unified.findIndex((it) => it.id === targetId);
          const finalIdx = currentPos === 'after' ? newTargetIdx + 1 : newTargetIdx;
          unified.splice(finalIdx, 0, dragged);

          const reorderedSubfolders: Folder[] = [];
          const reorderedQuestions: QuestionListItem[] = [];

          unified.forEach((it, idx) => {
            if (it.kind === 'subtopic') {
              reorderedSubfolders.push({ ...it.data, position: idx });
            } else {
              reorderedQuestions.push({ ...it.data, position: idx });
            }
          });

          const updatedNode = { ...node, subfolders: reorderedSubfolders };
          const updatedTree = nodes.map((n) => (n.id === parentId ? updatedNode : n));

          return { updatedTree, reorderedSubfolders, reorderedQuestions };
        }

        if (node.subfolders && node.subfolders.length > 0) {
          const res = findAndReorderChildren(node.subfolders);
          if (res) {
            const updatedTree = nodes.map((n) =>
              n.id === node.id ? { ...n, subfolders: res.updatedTree } : n
            );
            return {
              updatedTree,
              reorderedSubfolders: res.reorderedSubfolders,
              reorderedQuestions: res.reorderedQuestions,
            };
          }
        }
      }
      return null;
    };

    const result = findAndReorderChildren(folders);
    if (result) {
      if (onReorderChildren) {
        onReorderChildren(parentId, result.reorderedSubfolders, result.reorderedQuestions);
      } else {
        if (onReorderFolders) onReorderFolders(result.updatedTree);
        if (onReorderQuestions) onReorderQuestions(parentId, result.reorderedQuestions);
      }
    }

    setDragState(null);
    setDropTarget(null);
  };

  const handleMoveItem = (
    parentId: string,
    itemId: string,
    direction: 'up' | 'down'
  ) => {
    const findAndMove = (
      nodes: Folder[]
    ): {
      updatedTree: Folder[];
      reorderedSubfolders: Folder[];
      reorderedQuestions: QuestionListItem[];
    } | null => {
      for (const node of nodes) {
        if (node.id === parentId) {
          const curSubs = node.subfolders || [];
          const curQuestions = questionsByFolder.get(parentId) || [];
          const unified = getUnifiedChildren(curSubs, curQuestions);

          const idx = unified.findIndex((it) => it.id === itemId);
          if (idx === -1) return null;

          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= unified.length) return null;

          const [item] = unified.splice(idx, 1);
          unified.splice(targetIdx, 0, item);

          const reorderedSubfolders: Folder[] = [];
          const reorderedQuestions: QuestionListItem[] = [];

          unified.forEach((it, i) => {
            if (it.kind === 'subtopic') {
              reorderedSubfolders.push({ ...it.data, position: i });
            } else {
              reorderedQuestions.push({ ...it.data, position: i });
            }
          });

          const updatedNode = { ...node, subfolders: reorderedSubfolders };
          const updatedTree = nodes.map((n) => (n.id === parentId ? updatedNode : n));

          return { updatedTree, reorderedSubfolders, reorderedQuestions };
        }

        if (node.subfolders && node.subfolders.length > 0) {
          const res = findAndMove(node.subfolders);
          if (res) {
            const updatedTree = nodes.map((n) =>
              n.id === node.id ? { ...n, subfolders: res.updatedTree } : n
            );
            return {
              updatedTree,
              reorderedSubfolders: res.reorderedSubfolders,
              reorderedQuestions: res.reorderedQuestions,
            };
          }
        }
      }
      return null;
    };

    const result = findAndMove(folders);
    if (result) {
      if (onReorderChildren) {
        onReorderChildren(parentId, result.reorderedSubfolders, result.reorderedQuestions);
      } else {
        if (onReorderFolders) onReorderFolders(result.updatedTree);
        if (onReorderQuestions) onReorderQuestions(parentId, result.reorderedQuestions);
      }
    }
  };

  // Reusable Question Row with Yellowish theme highlight ONLY where user is present
  const renderQuestionRow = (
    q: QuestionListItem,
    parentId: string,
    index: number,
    totalCount: number
  ) => {
    const isDraggingQ = dragState?.id === q.id;
    const isTargetQ = dropTarget?.id === q.id;
    const isFirst = index === 0;
    const isLast = index === totalCount - 1;
    const isActive = activeQuestionId === q.id;

    return (
      <div
        key={q.id}
        onClick={() => onSelectQuestion(q.id)}
        onDragOver={(e) => {
          if (
            dragState &&
            dragState.parentId === parentId &&
            dragState.id !== q.id
          ) {
            e.preventDefault();
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const isAfter = e.clientY - rect.top > rect.height / 2;
            setDropTarget({
              type: 'question',
              id: q.id,
              position: isAfter ? 'after' : 'before',
            });
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            if (dropTarget?.id === q.id) {
              setDropTarget(null);
            }
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleChildDrop(parentId, q.id);
        }}
        className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg transition group relative select-none cursor-pointer before:content-[''] before:absolute before:-left-5 before:top-1/2 before:w-3.5 before:h-[1px] ${
          isActive
            ? 'bg-yellow-400/15 border-l-4 border-l-yellow-400 border border-yellow-400/35 text-yellow-200 shadow-sm shadow-yellow-400/10 before:bg-yellow-400/60'
            : 'border border-transparent hover:bg-yellow-400/5 hover:border-yellow-400/20 text-slate-300 before:bg-slate-700/50'
        } ${
          isDraggingQ ? 'opacity-40 border border-dashed border-yellow-400/50' : ''
        } ${
          isTargetQ && dropTarget?.position === 'before'
            ? 'border-t-2 border-t-yellow-400'
            : isTargetQ && dropTarget?.position === 'after'
            ? 'border-b-2 border-b-yellow-400'
            : ''
        }`}
      >
        <div className="flex items-center space-x-2 min-w-0">
          {/* Drag handle for question */}
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData('text/plain', q.id);
              setDragState({
                type: 'question',
                id: q.id,
                parentId: parentId,
                folderId: parentId,
              });
            }}
            onDragEnd={() => {
              setDragState(null);
              setDropTarget(null);
            }}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing p-0.5 text-slate-500 hover:text-yellow-300 transition"
            title="Drag to rearrange problem"
          >
            <GripVertical className="w-3 h-3" />
          </div>

          {/* Quick Move Up/Down buttons for Question on hover */}
          <div className="flex flex-col -space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              disabled={isFirst}
              onClick={(e) => {
                e.stopPropagation();
                handleMoveItem(parentId, q.id, 'up');
              }}
              className={`p-0.5 rounded transition ${
                isFirst
                  ? 'opacity-20 cursor-not-allowed text-slate-600'
                  : 'text-slate-400 hover:text-yellow-300 hover:bg-yellow-400/10'
              }`}
              title="Move problem up"
            >
              <ChevronUp className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={(e) => {
                e.stopPropagation();
                handleMoveItem(parentId, q.id, 'down');
              }}
              className={`p-0.5 rounded transition ${
                isLast
                  ? 'opacity-20 cursor-not-allowed text-slate-600'
                  : 'text-slate-400 hover:text-yellow-300 hover:bg-yellow-400/10'
              }`}
              title="Move problem down"
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Status or pulsating yellow dot when active */}
          {isActive ? (
            <span
              className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0"
              title="You are currently viewing this problem"
            />
          ) : (
            <div title={q.status}>{renderStatusIcon(q.status)}</div>
          )}

          <FileCode
            className={`w-3.5 h-3.5 flex-shrink-0 ${
              isActive ? 'text-yellow-400' : 'text-slate-500'
            }`}
          />

          <span
            className={`truncate ${
              isActive
                ? 'font-bold text-yellow-200'
                : 'font-medium text-slate-300 group-hover:text-yellow-200'
            }`}
          >
            {q.title}
          </span>
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
              className="text-slate-500 hover:text-yellow-400 transition"
              title={q.is_bookmarked ? 'Remove bookmark' : 'Bookmark problem'}
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  q.is_bookmarked
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-slate-500'
                }`}
              />
            </button>
          )}

          {q.problem_url && (
            <a
              href={q.problem_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-slate-500 hover:text-yellow-300 p-0.5 transition"
              title="Open problem link"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {onDeleteQuestion && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteQuestion(q.id, q.title);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
              title="Delete question"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render a recursive subtopic / nested folder node
  const renderSubtopicNode = (node: Folder, index?: number, totalCount?: number) => {
    const expanded = isNodeExpanded(node.id);
    const nodeQuestions = getQuestionsForFolder(node.id);
    const subtopics = sortFolders(node.subfolders || []);
    const hasChildren = subtopics.length > 0 || nodeQuestions.length > 0;

    const isDraggingThis = dragState?.id === node.id;
    const isTargetThis = dropTarget?.id === node.id;
    const isFirst = index !== undefined ? index === 0 : false;
    const isLast = index !== undefined && totalCount !== undefined ? index === totalCount - 1 : false;

    return (
      <div
        key={node.id}
        className={`text-xs space-y-1 rounded-lg transition-all ${
          isDraggingThis ? 'opacity-40' : ''
        }`}
      >
        {/* Node Row Header */}
        <div
          onClick={() => toggleNode(node.id)}
          onDragOver={(e) => {
            if (dragState && dragState.id !== node.id) {
              if (dragState.parentId === node.parent_id) {
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const relY = e.clientY - rect.top;
                if (dragState.type === 'question' && relY > rect.height * 0.25 && relY < rect.height * 0.75) {
                  setDropTarget({ type: 'subfolder', id: node.id, position: 'into' });
                } else {
                  const isAfter = relY > rect.height / 2;
                  setDropTarget({ type: 'subfolder', id: node.id, position: isAfter ? 'after' : 'before' });
                }
              } else if (dragState.type === 'question') {
                e.preventDefault();
                e.stopPropagation();
                setDropTarget({ type: 'subfolder', id: node.id, position: 'into' });
              }
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              if (dropTarget?.id === node.id) {
                setDropTarget(null);
              }
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dropTarget?.position === 'into' && dragState?.type === 'question' && onMoveQuestion) {
              onMoveQuestion(dragState.id, node.id);
              setDragState(null);
              setDropTarget(null);
              return;
            }
            if (node.parent_id) {
              handleChildDrop(node.parent_id, node.id);
            }
          }}
          className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-yellow-400/5 cursor-pointer transition select-none group ${
            isTargetThis && dropTarget?.position === 'into'
              ? 'border-2 border-yellow-400 bg-yellow-400/20 shadow-md shadow-yellow-400/20'
              : isTargetThis && dropTarget?.position === 'before'
              ? 'border-t-2 border-t-yellow-400'
              : isTargetThis && dropTarget?.position === 'after'
              ? 'border-b-2 border-b-yellow-400'
              : ''
          }`}
        >
          <div className="flex items-center space-x-1.5 min-w-0">
            {/* Drag Handle for Subtopic */}
            <div
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', node.id);
                setDragState({
                  type: 'subfolder',
                  id: node.id,
                  parentId: node.parent_id,
                });
              }}
              onDragEnd={() => {
                setDragState(null);
                setDropTarget(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="cursor-grab active:cursor-grabbing p-0.5 text-slate-500 hover:text-yellow-300 transition"
              title="Drag to rearrange subtopic"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>

            {/* Quick Move Up/Down buttons on hover */}
            <div className="flex flex-col -space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                disabled={isFirst}
                onClick={(e) => {
                  e.stopPropagation();
                  if (node.parent_id) handleMoveItem(node.parent_id, node.id, 'up');
                }}
                className={`p-0.5 rounded transition ${isFirst ? 'opacity-20 cursor-not-allowed text-slate-600' : 'text-slate-400 hover:text-yellow-300 hover:bg-yellow-400/10'}`}
                title="Move subtopic up"
              >
                <ChevronUp className="w-2.5 h-2.5" />
              </button>
              <button
                type="button"
                disabled={isLast}
                onClick={(e) => {
                  e.stopPropagation();
                  if (node.parent_id) handleMoveItem(node.parent_id, node.id, 'down');
                }}
                className={`p-0.5 rounded transition ${isLast ? 'opacity-20 cursor-not-allowed text-slate-600' : 'text-slate-400 hover:text-yellow-300 hover:bg-yellow-400/10'}`}
                title="Move subtopic down"
              >
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </div>

            <span className="text-slate-500 hover:text-white transition">
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </span>

            <FolderTree className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />

            <span className="font-medium text-slate-200 group-hover:text-yellow-200 transition truncate">
              {node.name}
            </span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition font-mono">
              {nodeQuestions.length} {nodeQuestions.length === 1 ? 'problem' : 'problems'}
            </span>

            {/* Add Subtopic to this subtopic */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateSubtopic(node.id);
              }}
              className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition shadow-sm border border-slate-700"
              title={`Add Subtopic inside "${node.name}"`}
            >
              <Plus className="w-3 h-3 text-indigo-400" />
              <span>Subtopic</span>
            </button>

            {/* Add Question to this subtopic */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateQuestion(node.id);
              }}
              className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white transition shadow-sm"
              title={`Add Problem inside "${node.name}"`}
            >
              <Plus className="w-3 h-3" />
              <span>Problem</span>
            </button>

            {/* Share Subtopic */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSharingFolder(node);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 transition"
              title={`Share "${node.name}"`}
            >
              <Share2 className="w-3 h-3" />
            </button>

            {/* Edit Subtopic */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditFolder(node);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition"
              title={`Edit subtopic "${node.name}"`}
            >
              <Edit2 className="w-3 h-3" />
            </button>

            {/* Delete Subtopic */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(node.id, node.name);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
              title={`Delete subtopic "${node.name}"`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Node Children (Questions & Nested Subtopics unified together) */}
        {expanded && (
          <div className="pl-4 ml-2 border-l border-slate-800 space-y-1 py-1">
            {(() => {
              const unified = getUnifiedChildren(node.subfolders || [], nodeQuestions);
              return unified.map((item, idx) =>
                item.kind === 'subtopic'
                  ? renderSubtopicNode(item.data, idx, unified.length)
                  : renderQuestionRow(item.data, node.id, idx, unified.length)
              );
            })()}

            {/* Empty prompt */}
            {!hasChildren && (
              <div className="py-2 px-2.5 text-xs text-slate-500 italic flex items-center justify-between">
                <span>No problems in this subtopic yet</span>
                <button
                  onClick={() => onOpenCreateQuestion(node.id)}
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

  // Compute aggregate statistics across topics & questions
  const stats = useMemo(() => {
    let topicCount = 0;
    const seenFolders = new Set<string>();
    const countFolders = (list: Folder[]) => {
      for (const f of list) {
        if (!seenFolders.has(f.id)) {
          seenFolders.add(f.id);
          topicCount++;
        }
        if (f.subfolders && f.subfolders.length > 0) {
          countFolders(f.subfolders);
        }
      }
    };
    countFolders(folders);

    let easyCount = 0;
    let medCount = 0;
    let hardCount = 0;
    for (const q of questions) {
      if (q.difficulty === 'Easy') easyCount++;
      else if (q.difficulty === 'Medium') medCount++;
      else if (q.difficulty === 'Hard') hardCount++;
    }

    return {
      totalTopics: topicCount,
      totalQuestions: questions.length,
      easyCount,
      medCount,
      hardCount,
    };
  }, [folders, questions]);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4 animate-fade-in font-sans">
      {/* Top Header Card */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-yellow-400" />
              <h1 className="text-lg font-bold text-white tracking-tight">
                Topics & Patterns Management
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Organize core DSA topics, subtopic patterns, multiple code approaches, and test cases
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSharingFolder({ id: 'all', name: 'All Patterns & Topics' } as Folder)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold shadow-md transition"
              title="Share the whole list of topics & patterns"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share All Patterns</span>
            </button>

            <button
              onClick={onOpenCreateTopic}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#fef08a] hover:bg-[#fef9c3] text-[#18181b] text-xs font-semibold shadow-md shadow-yellow-200/30 transition"
              title="Create a new top-level DSA topic"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Topic</span>
            </button>
          </div>
        </div>

        {/* Quick Stats: Total Topics, Total Questions, Easy, Med, Hard */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#090E1A] border border-slate-800 text-xs">
            <span className="text-slate-400">Total Topics:</span>
            <span className="font-bold text-white">{stats.totalTopics}</span>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#090E1A] border border-slate-800 text-xs">
            <span className="text-slate-400">Total Questions:</span>
            <span className="font-bold text-white">{stats.totalQuestions}</span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs">
            <span className="text-emerald-400 font-medium">Easy:</span>
            <span className="font-bold text-emerald-300">{stats.easyCount}</span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs">
            <span className="text-amber-400 font-medium">Med:</span>
            <span className="font-bold text-amber-300">{stats.medCount}</span>
          </div>
          <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-xs">
            <span className="text-rose-400 font-medium">Hard:</span>
            <span className="font-bold text-rose-300">{stats.hardCount}</span>
          </div>
        </div>

        {/* Search & Fast Topic Creation Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-1">
          {/* Search Filter */}
          <div className="md:col-span-5 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics or subtopics..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#090E1A] border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Inline Topic Creator */}
          <form
            onSubmit={handleAddNewPatternTopic}
            className="md:col-span-7 flex items-center space-x-2"
          >
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="Quick create root topic (e.g. Heaps, Greedy)..."
              className="flex-1 px-3 py-1.5 bg-[#090E1A] border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isAddingTopic || !newTopicName.trim()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 disabled:opacity-40 transition whitespace-nowrap"
            >
              {isAddingTopic ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>
      </div>

      {/* Main Topics Container */}
      <div className="space-y-3">
        {filteredFolders.length === 0 ? (
          <div className="text-center py-12 bg-[#0D1527] border border-slate-800 rounded-xl space-y-2">
            <Layers className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No pattern topics found.</p>
            <button
              onClick={onOpenCreateTopic}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition"
            >
              + Create First Topic
            </button>
          </div>
        ) : (
          filteredFolders.map((pattern) => {
            const expanded = isNodeExpanded(pattern.id);
            const patternQuestions = getQuestionsForFolder(pattern.id);
            const subfolders = sortFolders(pattern.subfolders || []);
            const hasChildren = subfolders.length > 0 || patternQuestions.length > 0;
            const totalQ = pattern.question_count || 0;

            const isDraggingTopic = dragState?.id === pattern.id;
            const isTargetTopic = dropTarget?.id === pattern.id;

            return (
              <div
                key={pattern.id}
                onDragOver={(e) => {
                  if (dragState?.type === 'root-folder' && dragState.id !== pattern.id) {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const isAfter = e.clientY - rect.top > rect.height / 2;
                    setDropTarget({
                      type: 'root-folder',
                      id: pattern.id,
                      position: isAfter ? 'after' : 'before',
                    });
                  }
                }}
                onDragLeave={() => {
                  if (dropTarget?.id === pattern.id) {
                    setDropTarget(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleRootTopicDrop(pattern.id);
                }}
                className={`bg-[#0D1527] border border-slate-800/90 rounded-xl p-4 shadow-md transition hover:border-slate-700/90 ${
                  isDraggingTopic ? 'opacity-40 border-dashed border-slate-600' : ''
                } ${
                  isTargetTopic && dropTarget?.position === 'before'
                    ? 'border-t-2 border-t-yellow-400'
                    : isTargetTopic && dropTarget?.position === 'after'
                    ? 'border-b-2 border-b-yellow-400'
                    : ''
                }`}
              >
                {/* Topic Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/70">
                  <div className="flex items-center space-x-2 min-w-0">
                    {/* Drag Handle for Root Topic */}
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', pattern.id);
                        setDragState({
                          type: 'root-folder',
                          id: pattern.id,
                        });
                      }}
                      onDragEnd={() => {
                        setDragState(null);
                        setDropTarget(null);
                      }}
                      className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-slate-300 transition"
                      title="Drag to rearrange topic order"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div
                      onClick={() => toggleNode(pattern.id)}
                      className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition flex-shrink-0"
                    >
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-200" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-600/70 flex items-center justify-center hover:border-slate-400">
                          <ChevronRight className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div
                      onClick={() => toggleNode(pattern.id)}
                      className="cursor-pointer group select-none min-w-0"
                    >
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition truncate">
                          {pattern.name}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {subfolders.length} {subfolders.length === 1 ? 'subtopic' : 'subtopics'} • {totalQ} {totalQ === 1 ? 'problem' : 'problems'}
                        </span>
                      </div>
                      {pattern.description && (
                        <p className="text-[11px] text-slate-400 truncate max-w-lg mt-0.5">
                          {pattern.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions for this topic */}
                  <div className="flex items-center space-x-1.5 flex-wrap">
                    {/* Add Subtopic */}
                    <button
                      onClick={() => onOpenCreateSubtopic(pattern.id)}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                      title={`Add Subtopic under "${pattern.name}"`}
                    >
                      <FolderTree className="w-3.5 h-3.5 text-blue-400" />
                      <span>Add Subtopic</span>
                    </button>

                    {/* Add Question */}
                    <button
                      onClick={() => onOpenCreateQuestion(pattern.id)}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md transition"
                      title={`Add Question inside "${pattern.name}"`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Add Question</span>
                    </button>

                    {/* Share Topic */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSharingFolder(pattern);
                      }}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 transition shadow-sm font-medium"
                      title={`Share pattern "${pattern.name}"`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>

                    {/* Edit Topic */}
                    <button
                      onClick={() => onEditFolder(pattern)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
                      title={`Edit topic "${pattern.name}"`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Topic */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(pattern.id, pattern.name);
                      }}
                      className="flex items-center space-x-1 px-2 py-1 rounded-lg text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 transition shadow-sm font-medium"
                      title={`Delete topic "${pattern.name}"`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Tree Structure inside this topic */}
                {expanded && (
                  <div className="pt-2 pl-2">
                    {hasChildren ? (
                      <div className="relative pl-5 ml-2 border-l border-slate-700/50 space-y-1">
                        {(() => {
                          const unified = getUnifiedChildren(subfolders, patternQuestions);
                          return unified.map((item, idx) =>
                            item.kind === 'subtopic'
                              ? renderSubtopicNode(item.data, idx, unified.length)
                              : renderQuestionRow(item.data, pattern.id, idx, unified.length)
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-500 bg-slate-900/40 rounded-lg border border-dashed border-slate-800 space-y-2">
                        <p>No subtopics or problems added to this pattern yet.</p>
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => onOpenCreateSubtopic(pattern.id)}
                            className="text-yellow-400 hover:text-yellow-300 font-medium text-xs flex items-center space-x-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Subtopic</span>
                          </button>
                          <span>•</span>
                          <button
                            onClick={() => onOpenCreateQuestion(pattern.id)}
                            className="text-yellow-400 hover:text-yellow-300 font-medium text-xs flex items-center space-x-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Problem</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Share Modal */}
      <SharePatternModal
        isOpen={Boolean(sharingFolder)}
        folder={sharingFolder}
        onClose={() => setSharingFolder(null)}
      />
    </div>
  );
};
