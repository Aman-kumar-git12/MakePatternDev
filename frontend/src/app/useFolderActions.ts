import { api } from '../services/api';
import type { Folder, QuestionListItem } from '../types/dsa';
import type { AppData } from './useAppData';
import type { ModalState } from './useModalState';
import type { ActiveQuestionState } from './useActiveQuestion';

/** Folder CRUD, drag-and-drop reordering and moves (direct and via the Move modal). */
export function useFolderActions(data: AppData, modals: ModalState, active: ActiveQuestionState) {
  const { setFolders, setQuestions, setSummary } = data;
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

  const handleReorderFolders = async (reorderedFolders: Folder[]) => {
    setFolders(reorderedFolders);
    try {
      const payload: { id: string; position: number }[] = [];
      const collectPositions = (nodes: Folder[]) => {
        nodes.forEach((node, idx) => {
          payload.push({ id: node.id, position: idx });
          if (node.subfolders && node.subfolders.length > 0) {
            collectPositions(node.subfolders);
          }
        });
      };
      collectPositions(reorderedFolders);
      await api.reorderFolders(payload);
      const freshTree = await api.getFolderTree();
      setFolders(freshTree);
    } catch (err) {
      console.error('Failed to persist folder reordering:', err);
    }
  };

  const handleReorderQuestions = async (folderId: string, reorderedQuestions: QuestionListItem[]) => {
    setQuestions((prev) => {
      const otherQuestions = prev.filter((q) => q.folder_id !== folderId);
      return [...otherQuestions, ...reorderedQuestions];
    });
    try {
      const payload = reorderedQuestions.map((q, idx) => ({ id: q.id, position: idx }));
      await api.reorderQuestions(payload);
    } catch (err) {
      console.error('Failed to persist question reordering:', err);
    }
  };

  const handleReorderChildren = async (
    parentId: string,
    reorderedFolders: Folder[],
    reorderedQuestions: QuestionListItem[]
  ) => {
    const updateFolderInTree = (nodes: Folder[]): Folder[] => {
      return nodes.map((node) => {
        if (node.id === parentId) {
          return {
            ...node,
            subfolders: reorderedFolders,
          };
        }
        if (node.subfolders && node.subfolders.length > 0) {
          return {
            ...node,
            subfolders: updateFolderInTree(node.subfolders),
          };
        }
        return node;
      });
    };

    setFolders((prev) => updateFolderInTree(prev));
    setQuestions((prev) => {
      const otherQuestions = prev.filter((q) => q.folder_id !== parentId);
      return [...otherQuestions, ...reorderedQuestions];
    });

    try {
      const folderPayload = reorderedFolders.map((f, idx) => ({ id: f.id, position: f.position ?? idx }));
      const questionPayload = reorderedQuestions.map((q, idx) => ({ id: q.id, position: q.position ?? idx }));
      await Promise.all([
        folderPayload.length > 0 ? api.reorderFolders(folderPayload) : Promise.resolve(),
        questionPayload.length > 0 ? api.reorderQuestions(questionPayload) : Promise.resolve(),
      ]);
    } catch (err) {
      console.error('Failed to persist interleaved children reordering:', err);
    }
  };

  const handleMoveQuestionDirect = async (questionId: string, targetFolderId: string) => {
    try {
      await api.moveQuestion(questionId, targetFolderId);
      const [updatedTree, updatedQuestions] = await Promise.all([
        api.getFolderTree(),
        api.listQuestions(),
      ]);
      setFolders(updatedTree);
      setQuestions(updatedQuestions);
    } catch (err) {
      console.error('Failed to move question directly:', err);
    }
  };

  const handleMoveFolderDirect = async (folderId: string, targetParentId: string | null) => {
    try {
      await api.moveFolder(folderId, targetParentId);
      const [updatedTree, updatedQuestions] = await Promise.all([
        api.getFolderTree(),
        api.listQuestions(),
      ]);
      setFolders(updatedTree);
      setQuestions(updatedQuestions);
    } catch (err) {
      console.error('Failed to move folder directly:', err);
    }
  };

  const handleDeleteFolder = (folderId: string, folderName: string) => {
    setDeleteData({
      title: `Delete "${folderName}"?`,
      message: 'Warning: Deleting this topic will permanently delete all its subtopics, questions, code solutions, and test cases. This action cannot be undone.',
      itemType: 'folder',
      onConfirm: async () => {
        await api.deleteFolder(folderId);
        const [updatedTree, updatedSummary, updatedQuestions] = await Promise.all([
          api.getFolderTree(),
          api.getProgressSummary(),
          api.listQuestions(),
        ]);
        setFolders(updatedTree);
        setSummary(updatedSummary);
        setQuestions(updatedQuestions);
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
