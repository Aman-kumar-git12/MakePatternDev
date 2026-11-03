import { useState, useEffect } from 'react';
import type { Folder } from '../types/dsa';

export interface MoveData {
  type: 'folder' | 'question';
  id: string;
  title: string;
}

export interface DeleteData {
  title: string;
  message: string;
  itemType: 'folder' | 'question' | 'solution';
  onConfirm: () => Promise<void>;
}

export interface RenameData {
  title: string;
  initialValue: string;
  onSubmit: (newName: string) => Promise<void>;
}

/** Open/closed state + payloads for every global modal, plus the Ctrl/Cmd+K shortcut. */
export function useModalState() {
  // Modals state - separate dedicated modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false);
  const [isCreateSubtopicOpen, setIsCreateSubtopicOpen] = useState(false);
  const [isCreateQuestionOpen, setIsCreateQuestionOpen] = useState(false);
  const [modalTargetFolderId, setModalTargetFolderId] = useState<string | undefined>(undefined);

  const [moveData, setMoveData] = useState<MoveData | null>(null);
  const [deleteData, setDeleteData] = useState<DeleteData | null>(null);
  const [renameData, setRenameData] = useState<RenameData | null>(null);

  const [editFolderData, setEditFolderData] = useState<Folder | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCurriculaOpen, setIsCurriculaOpen] = useState(false);

  const handleOpenNewTopic = () => {
    setIsCreateTopicOpen(true);
  };

  const handleOpenNewSubtopic = (folderId?: string) => {
    setModalTargetFolderId(folderId);
    setIsCreateSubtopicOpen(true);
  };

  const handleOpenNewQuestion = (folderId?: string) => {
    setModalTargetFolderId(folderId);
    setIsCreateQuestionOpen(true);
  };

  // Keyboard shortcut Ctrl/Cmd + K for global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isSearchOpen,
    setIsSearchOpen,
    isImportModalOpen,
    setIsImportModalOpen,
    isCreateTopicOpen,
    setIsCreateTopicOpen,
    isCreateSubtopicOpen,
    setIsCreateSubtopicOpen,
    isCreateQuestionOpen,
    setIsCreateQuestionOpen,
    modalTargetFolderId,
    moveData,
    setMoveData,
    deleteData,
    setDeleteData,
    renameData,
    setRenameData,
    editFolderData,
    setEditFolderData,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isCurriculaOpen,
    setIsCurriculaOpen,
    handleOpenNewTopic,
    handleOpenNewSubtopic,
    handleOpenNewQuestion,
  };
}

export type ModalState = ReturnType<typeof useModalState>;
