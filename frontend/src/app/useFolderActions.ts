import { useEffect, useRef } from 'react';
import { api } from '../services/api';
import type { Folder, QuestionListItem } from '../types/dsa';
import type { AppData } from './useAppData';
import type { ModalState } from './useModalState';
import type { ActiveQuestionState } from './useActiveQuestion';
import { pushToast, pushUndoToast } from '../hooks/useUndoToasts';
import { insertFolderNode, isSelfOrDescendant, nextChildPosition, recountTree, removeFolderNode } from './treeOps';

const LARGE_FOLDER_CONFIRM_THRESHOLD = 20;

const findFolder = (nodes: Folder[], id: string): Folder | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = node.subfolders?.length ? findFolder(node.subfolders, id) : null;
    if (hit) return hit;
  }
  return null;
};

/** Folder CRUD, drag-and-drop reordering and moves (direct and via the Move modal). */
export function useFolderActions(data: AppData, modals: ModalState, active: ActiveQuestionState) {
  const { setFolders, setQuestions, setSummary, refreshData } = data;
  const { moveData, setDeleteData } = modals;
  const { activeQuestion, setActiveQuestion } = active;

  // Folder Operations
  const handleCreateFolder = async (
    name: string,
    parentId: string | null = null,
    description: string = '',
    tags: string[] = []
  ) => {
    await api.createFolder(name, parentId, description, tags);
    const [updatedTree, updatedSummary] = await Promise.all([
      api.getFolderTree(),
      api.getProgressSummary(),
    ]);
    setFolders(updatedTree);
    setSummary(updatedSummary);
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
    setFolders(updatedTree);
    setSummary(updatedSummary);
    setQuestions(updatedQuestions);
  };

  /*
   * Rearranging is optimistic: the screen changes at once and the save runs in the background.
   * Saves run one at a time, in the order they were made, so quick successive drags reach the
   * server in the same order and a refresh shows exactly what was on screen.
   */
  const latest = useRef({ folders: data.folders, questions: data.questions });
  useEffect(() => {
    latest.current = { folders: data.folders, questions: data.questions };
  }, [data.folders, data.questions]);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingSaves = useRef(0);
  const saveFailed = useRef(false);
  const needsReconcile = useRef(false);
  /** Bumped on every optimistic change, so a background re-sync never overwrites a newer one. */
  const localVersion = useRef(0);

  const applyLocal = (folders: Folder[], questions?: QuestionListItem[]) => {
    localVersion.current += 1;
    latest.current = { folders, questions: questions ?? latest.current.questions };
    setFolders(folders);
    if (questions) setQuestions(questions);
  };

  /** Once every queued save is done, quietly re-read the server copy (unless something changed since). */
  const reconcile = async () => {
    const version = localVersion.current;
    try {
      const [tree, list] = await Promise.all([api.getFolderTree(), api.listQuestions()]);
      if (version === localVersion.current && pendingSaves.current === 0) {
        latest.current = { folders: tree, questions: list };
        setFolders(tree);
        setQuestions(list);
      }
    } catch {
      // Offline or the server is waking up: the optimistic state stays; the next load corrects it.
    }
  };

  const enqueueSave = (save: () => Promise<unknown>, opts: { reconcile?: boolean } = {}) => {
    pendingSaves.current += 1;
    if (opts.reconcile) needsReconcile.current = true;
    saveQueue.current = saveQueue.current
      .then(save)
      .then(
        () => undefined,
        (err) => {
          console.error('Failed to save the new arrangement:', err);
          saveFailed.current = true;
        }
      )
      .finally(() => {
        pendingSaves.current -= 1;
        if (pendingSaves.current > 0) return;
        if (saveFailed.current) {
          saveFailed.current = false;
          needsReconcile.current = false;
          pushToast({ message: "Couldn't save the new order — it has been restored.", tone: 'error' });
          void refreshData().catch(() => undefined);
        } else if (needsReconcile.current) {
          needsReconcile.current = false;
          void reconcile();
        }
      });
  };

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

  /**
   * Small folders are deleted immediately (undo replaces the confirm dialog). Large ones
   * (> 20 questions) still ask first, since restoring them is a bigger surprise if mis-clicked.
   */
  const handleDeleteFolder = (folderId: string, folderName: string) => {
    const folder = findFolder(data.folders, folderId);
    const questionCount = folder?.question_count ?? 0;
    if (questionCount <= LARGE_FOLDER_CONFIRM_THRESHOLD) {
      softDeleteFolder(folderId, folderName).catch((err) => {
        pushToast({ message: err instanceof Error ? err.message : 'Delete failed', tone: 'error' });
      });
      return;
    }
    setDeleteData({
      title: `Delete "${folderName}"?`,
      message: `This topic contains ${questionCount} questions. It will move to Trash with all its subtopics, solutions and test cases, and can be restored for 30 days.`,
      itemType: 'folder',
      onConfirm: async () => {
        await softDeleteFolder(folderId, folderName);
      },
    });
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
    setFolders(updatedTree);
    setSummary(updatedSummary);
    setQuestions(updatedQuestions);

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
