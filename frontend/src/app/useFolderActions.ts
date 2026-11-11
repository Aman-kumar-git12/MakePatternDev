import { api } from '../services/api';
import type { Folder, QuestionListItem } from '../types/dsa';
import type { AppData } from './useAppData';
import type { ModalState } from './useModalState';
import type { ActiveQuestionState } from './useActiveQuestion';
import { pushToast, pushUndoToast } from '../hooks/useUndoToasts';
import { confirmAction } from '../components/ConfirmDialog';
import {
  findFolderNode,
  insertFolderNode,
  isSelfOrDescendant,
  nextChildPosition,
  recountTree,
  removeFolderNode,
  swapFolderId,
} from './treeOps';
import type { SyncQueue } from './useSyncQueue';
import { startPendingId } from './pendingIds';

const truncateName = (name: string) => (name.length > 60 ? `${name.slice(0, 59)}…` : name);

/** Folder CRUD, drag-and-drop reordering and moves (direct and via the Move modal). */
export function useFolderActions(data: AppData, modals: ModalState, active: ActiveQuestionState, sync: SyncQueue) {
  const { setServerFolders, setServerQuestions, setSummary, refreshData } = data;
  const { latest, applyLocal, enqueueSave } = sync;
  const { moveData } = modals;
  const { activeQuestion, setActiveQuestion } = active;

  /**
   * Create a topic (parentId null) or subtopic. It appears at once, at the end of its parent, and
   * is saved in the background; until then it has a temporary id that later requests wait on.
   */
  const handleCreateFolder = async (
    name: string,
    parentId: string | null = null,
    description: string = '',
    tags: string[] = []
  ) => {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Name is required');
    if (cleanName.length > 200) throw new Error('Name must be 200 characters or fewer');
    const { folders, questions } = latest.current;
    if (parentId && !findFolderNode(folders, parentId)) throw new Error('That topic no longer exists');

    const position = nextChildPosition(folders, questions, parentId);
    const pendingId = startPendingId();
    const now = new Date().toISOString();
    const folder: Folder = {
      id: pendingId.id,
      parent_id: parentId,
      name: cleanName,
      description,
      tags,
      position,
      question_count: 0,
      solved_count: 0,
      progress_percentage: 0,
      subfolders: [],
      questions: [],
      created_at: now,
      updated_at: now,
    };
    applyLocal(insertFolderNode(folders, parentId, folder));
    setSummary((prev) =>
      prev
        ? parentId
          ? { ...prev, total_subtopics: (prev.total_subtopics ?? 0) + 1 }
          : { ...prev, total_topics: (prev.total_topics ?? 0) + 1 }
        : prev
    );

    enqueueSave(
      async () => {
        try {
          // A temporary parent id is swapped for the real one by the API client.
          const created = await api.createFolder(cleanName, parentId, description, tags, position);
          pendingId.saved(created.id);
          const next = swapFolderId(latest.current.folders, latest.current.questions, pendingId.id, created);
          applyLocal(next.folders, next.questions);
        } catch (err) {
          pendingId.failed(err);
          throw err;
        }
      },
      {
        reconcile: true,
        failMessage: (err) =>
          `Couldn't create “${truncateName(cleanName)}”${err instanceof Error && err.message ? `: ${err.message}` : '.'}`,
      }
    );
  };

  const handleCreateTopic = async (name: string, description?: string, tags?: string[]) => {
    await handleCreateFolder(name, null, description, tags);
  };

  const handleCreateSubtopic = async (name: string, parentId: string, description?: string, tags?: string[]) => {
    await handleCreateFolder(name, parentId, description, tags);
  };

  const handleUpdateFolder = async (
    folderId: string,
    updates: {
      name?: string;
      description?: string;
      tags?: string[];
      parent_id?: string | null;
    }
  ) => {
    await api.updateFolder(folderId, updates);
    const [updatedTree, updatedSummary, updatedQuestions] = await Promise.all([
      api.getFolderTree(),
      api.getProgressSummary(),
      api.listQuestions(),
    ]);
    setServerFolders(updatedTree);
    setSummary(updatedSummary);
    setServerQuestions(updatedQuestions);
  };

  // Rearranging is optimistic: see useSyncQueue for how saves are queued and re-synced.
  /** Top-level topics only: subtopic positions are shared with problems and must not be renumbered. */
  const handleReorderFolders = (reorderedFolders: Folder[]) => {
    applyLocal(reorderedFolders);
    const payload = reorderedFolders.map((node, idx) => ({ id: node.id, position: node.position ?? idx }));
    enqueueSave(() => api.reorderFolders(payload));
  };

  const handleReorderQuestions = (folderId: string, reorderedQuestions: QuestionListItem[]) => {
    const others = latest.current.questions.filter((q) => q.folder_id !== folderId);
    applyLocal(latest.current.folders, [...others, ...reorderedQuestions]);
    const payload = reorderedQuestions.map((q, idx) => ({ id: q.id, position: q.position ?? idx }));
    enqueueSave(() => api.reorderQuestions(payload));
  };

  const handleReorderChildren = (parentId: string, reorderedFolders: Folder[], reorderedQuestions: QuestionListItem[]) => {
    const updateFolderInTree = (nodes: Folder[]): Folder[] =>
      nodes.map((node) => {
        if (node.id === parentId) return { ...node, subfolders: reorderedFolders };
        return node.subfolders?.length ? { ...node, subfolders: updateFolderInTree(node.subfolders) } : node;
      });
    const others = latest.current.questions.filter((q) => q.folder_id !== parentId);
    applyLocal(updateFolderInTree(latest.current.folders), [...others, ...reorderedQuestions]);

    const folderPayload = reorderedFolders.map((f, idx) => ({ id: f.id, position: f.position ?? idx }));
    const questionPayload = reorderedQuestions.map((q, idx) => ({ id: q.id, position: q.position ?? idx }));
    enqueueSave(() =>
      Promise.all([
        folderPayload.length > 0 ? api.reorderFolders(folderPayload) : Promise.resolve(),
        questionPayload.length > 0 ? api.reorderQuestions(questionPayload) : Promise.resolve(),
      ])
    );
  };

  /** Drag a problem into another topic/subtopic: it appears at the end there immediately. */
  const handleMoveQuestionDirect = (questionId: string, targetFolderId: string) => {
    const { folders, questions } = latest.current;
    const question = questions.find((q) => q.id === questionId);
    if (!question || question.folder_id === targetFolderId) return;
    const position = nextChildPosition(folders, questions, targetFolderId);
    const nextQuestions = questions.map((q) => (q.id === questionId ? { ...q, folder_id: targetFolderId, position } : q));
    applyLocal(recountTree(folders, nextQuestions), nextQuestions);
    if (activeQuestion?.id === questionId) setActiveQuestion({ ...activeQuestion, folder_id: targetFolderId });
    enqueueSave(() => api.moveQuestion(questionId, targetFolderId, position), { reconcile: true });
  };

  /** Drag a subtopic into another topic (or out to the top level): it moves immediately. */
  const handleMoveFolderDirect = (folderId: string, targetParentId: string | null) => {
    const { folders, questions } = latest.current;
    if (targetParentId && isSelfOrDescendant(folders, folderId, targetParentId)) {
      pushToast({ message: "A topic can't be moved inside itself.", tone: 'error' });
      return;
    }
    const { tree, removed } = removeFolderNode(folders, folderId);
    if (!removed || (removed as Folder).parent_id === targetParentId) return;
    const position = nextChildPosition(tree, questions, targetParentId);
    const moved: Folder = { ...(removed as Folder), parent_id: targetParentId, position };
    applyLocal(recountTree(insertFolderNode(tree, targetParentId, moved), questions));
    enqueueSave(() => api.moveFolder(folderId, targetParentId, position), { reconcile: true });
  };

  /** Soft delete into the trash, then offer a 10-second undo. */
  const softDeleteFolder = async (folderId: string, folderName: string) => {
    const res = await api.deleteFolder(folderId);
    const deletedIds = new Set(res.deleted_folder_ids || [folderId]);
    if (activeQuestion?.folder_id && deletedIds.has(activeQuestion.folder_id)) {
      setActiveQuestion(null);
    }
    pushUndoToast(`Deleted “${folderName.length > 40 ? `${folderName.slice(0, 39)}…` : folderName}”`, async () => {
      await api.restoreTrashItem(res.trash_id);
      await refreshData();
    });
    await refreshData();
  };

  /** Ask first, then move the topic (with everything inside it) to the trash, with a 10-second undo. */
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    const folder = findFolderNode(latest.current.folders, folderId);
    // Count from the live question list: it already reflects deletes/moves the tree hasn't caught up with.
    const folderIds = new Set<string>();
    const collect = (f: Folder) => {
      folderIds.add(f.id);
      (f.subfolders || []).forEach(collect);
    };
    if (folder) collect(folder);
    const questionCount = latest.current.questions.filter((q) => q.folder_id && folderIds.has(q.folder_id)).length;
    const subtopicCount = Math.max(0, folderIds.size - 1);
    const kind = folder?.parent_id ? 'subtopic' : 'topic';
    const contents = [
      subtopicCount ? `${subtopicCount} subtopic${subtopicCount === 1 ? '' : 's'}` : '',
      questionCount ? `${questionCount} problem${questionCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean);
    const ok = await confirmAction({
      title: `Delete ${kind} “${truncateName(folderName)}”?`,
      message: contents.length
        ? `It contains ${contents.join(' and ')}. Everything inside, including solutions and test cases, moves to Trash and can be restored for 30 days.`
        : 'It moves to Trash and can be restored for 30 days.',
    });
    if (!ok) return;
    try {
      await softDeleteFolder(folderId, folderName);
    } catch (err) {
      pushToast({ message: err instanceof Error ? err.message : 'Delete failed', tone: 'error' });
    }
  };

  // Execute Move Modal
  const handleExecuteMove = async (targetId: string | null) => {
    if (!moveData) return;
    if (moveData.type === 'folder') {
      await api.moveFolder(moveData.id, targetId);
    } else {
      // null target = "no folder" (unfiled)
      await api.moveQuestion(moveData.id, targetId);
    }

    const [updatedTree, updatedSummary, updatedQuestions] = await Promise.all([
      api.getFolderTree(),
      api.getProgressSummary(),
      api.listQuestions(),
    ]);
    setServerFolders(updatedTree);
    setSummary(updatedSummary);
    setServerQuestions(updatedQuestions);

    if (activeQuestion && activeQuestion.id === moveData.id) {
      const refreshedQ = await api.getQuestion(activeQuestion.id);
      setActiveQuestion(refreshedQ);
    }
  };

  return {
    handleCreateFolder,
    handleCreateTopic,
    handleCreateSubtopic,
    handleUpdateFolder,
    handleReorderFolders,
    handleReorderQuestions,
    handleReorderChildren,
    handleMoveQuestionDirect,
    handleMoveFolderDirect,
    handleDeleteFolder,
    handleExecuteMove,
  };
}

export type FolderActions = ReturnType<typeof useFolderActions>;
