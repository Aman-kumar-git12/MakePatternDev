import { Suspense } from 'react';
import type { AppData } from './useAppData';
import type { ModalState } from './useModalState';
import type { ActiveQuestionState } from './useActiveQuestion';
import type { FolderActions } from './useFolderActions';
import type { QuestionActions } from './useQuestionActions';
import {
  GlobalSearchModal,
  CreateTopicModal,
  CreateSubtopicModal,
  CreateQuestionModal,
  EditTopicModal,
  MoveModal,
  ConfirmDeleteModal,
  RenameModal,
  ImportLeetCodeModal,
  CurriculaModal,
  LazyModal,
} from './lazyViews';

interface AppModalsProps {
  data: AppData;
  modals: ModalState;
  active: ActiveQuestionState;
  folderActions: FolderActions;
  questionActions: QuestionActions;
}

/** Every app-wide modal. Each modal's code is fetched the first time it opens. */
export function AppModals({ data, modals, active, folderActions, questionActions }: AppModalsProps) {
  const { folders, refreshData } = data;
  const { handleSelectQuestion } = active;
  const { handleCreateTopic, handleCreateSubtopic, handleUpdateFolder, handleExecuteMove } = folderActions;
  const { handleCreateQuestion, handleImportedQuestion } = questionActions;
  const {
    isSearchOpen,
    setIsSearchOpen,
    isCreateTopicOpen,
    setIsCreateTopicOpen,
    isCreateSubtopicOpen,
    setIsCreateSubtopicOpen,
    isCreateQuestionOpen,
    setIsCreateQuestionOpen,
    modalTargetFolderId,
    editFolderData,
    setEditFolderData,
    isImportModalOpen,
    setIsImportModalOpen,
    isCurriculaOpen,
    setIsCurriculaOpen,
    moveData,
    setMoveData,
    deleteData,
    setDeleteData,
    renameData,
    setRenameData,
  } = modals;

  return (
    <>
      {/* Global Modals */}
      <LazyModal isOpen={isSearchOpen}>
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectQuestion={handleSelectQuestion}
        />
      </LazyModal>

      {/* 1. Dedicated Topic Modal (Main Topic) */}
      <LazyModal isOpen={isCreateTopicOpen}>
        <CreateTopicModal
          isOpen={isCreateTopicOpen}
          onClose={() => setIsCreateTopicOpen(false)}
          onCreateTopic={handleCreateTopic}
        />
      </LazyModal>

      {/* 2. Dedicated Subtopic Modal */}
      <LazyModal isOpen={isCreateSubtopicOpen}>
        <CreateSubtopicModal
          isOpen={isCreateSubtopicOpen}
          onClose={() => setIsCreateSubtopicOpen(false)}
          initialParentId={modalTargetFolderId}
          folders={folders}
          onCreateSubtopic={handleCreateSubtopic}
        />
      </LazyModal>

      {/* 3. Dedicated Problem Modal */}
      <LazyModal isOpen={isCreateQuestionOpen}>
        <CreateQuestionModal
          isOpen={isCreateQuestionOpen}
          onClose={() => setIsCreateQuestionOpen(false)}
          initialFolderId={modalTargetFolderId}
          folders={folders}
          onCreateQuestion={handleCreateQuestion}
        />
      </LazyModal>

      <Suspense fallback={null}>
        {editFolderData && (
          <EditTopicModal
            isOpen={true}
            onClose={() => setEditFolderData(null)}
            folder={editFolderData}
            allFolders={folders}
            onUpdate={handleUpdateFolder}
          />
        )}
      </Suspense>

      <LazyModal isOpen={isImportModalOpen}>
        <ImportLeetCodeModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          folders={folders}
          onImported={handleImportedQuestion}
          onOpenExisting={(questionId) => {
            setIsImportModalOpen(false);
            void handleSelectQuestion(questionId);
          }}
        />
      </LazyModal>

      <LazyModal isOpen={isCurriculaOpen}>
        <CurriculaModal
          isOpen={isCurriculaOpen}
          onClose={() => setIsCurriculaOpen(false)}
          onImported={async () => {
            await refreshData();
          }}
        />
      </LazyModal>

      <Suspense fallback={null}>
        {moveData && (
          <MoveModal
            isOpen={true}
            onClose={() => setMoveData(null)}
            type={moveData.type}
            itemId={moveData.id}
            itemTitle={moveData.title}
            folders={folders}
            onSubmit={handleExecuteMove}
          />
        )}

        {deleteData && (
          <ConfirmDeleteModal
            isOpen={true}
            onClose={() => setDeleteData(null)}
            title={deleteData.title}
            message={deleteData.message}
            itemType={deleteData.itemType}
            onConfirm={deleteData.onConfirm}
          />
        )}

        {renameData && (
          <RenameModal
            isOpen={true}
            onClose={() => setRenameData(null)}
            title={renameData.title}
            initialValue={renameData.initialValue}
            onSubmit={renameData.onSubmit}
          />
        )}
      </Suspense>
    </>
  );
}
