import { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dashboard } from '../components/Dashboard/Dashboard';
import { api } from '../services/api';
import type { QuestionListItem, ViewMode } from '../types/dsa';
import type { AppData } from './useAppData';
import type { ModalState } from './useModalState';
import type { ActiveQuestionState } from './useActiveQuestion';
import type { FolderActions } from './useFolderActions';
import type { QuestionActions } from './useQuestionActions';
import {
  QuestionWorkspace,
  BookmarksView,
  AllQuestionsView,
  ProgressView,
  MyPatternsView,
  RevisionPage,
  SettingsView,
  TrashView,
  ViewFallback,
} from './lazyViews';

interface MainContentProps {
  currentView: ViewMode;
  onSelectNavView: (view: ViewMode) => void;
  data: AppData;
  modals: ModalState;
  active: ActiveQuestionState;
  folderActions: FolderActions;
  questionActions: QuestionActions;
  bookmarkedQuestions: QuestionListItem[];
  dueCount: number;
}

/** View switcher for the main column, driven by the current URL. */
export function MainContent({
  currentView,
  onSelectNavView,
  data,
  modals,
  active,
  folderActions,
  questionActions,
  bookmarkedQuestions,
  dueCount,
}: MainContentProps) {
  const navigate = useNavigate();
  const { folders, questions, summary, setSummary, activityKey, setActivityKey, reviews, refreshData } = data;
  const { activeQuestion, setActiveQuestion, handleSelectQuestion } = active;
  const {
    handleOpenNewTopic,
    handleOpenNewSubtopic,
    handleOpenNewQuestion,
    setIsImportModalOpen,
    setIsCurriculaOpen,
    setEditFolderData,
  } = modals;
  const {
    handleCreateFolder,
    handleDeleteFolder,
    handleReorderFolders,
    handleReorderQuestions,
    handleReorderChildren,
    handleMoveQuestionDirect,
    handleMoveFolderDirect,
  } = folderActions;
  const {
    handleToggleBookmark,
    handleToggleRevision,
    handleSaveQuestion,
    handleQuestionUpdated,
    handleRenameQuestion,
    handleMoveQuestion,
    handleDeleteQuestion,
    handleBulkAction,
    handleAddSolution,
    handleUpdateSolution,
    handleDeleteSolution,
  } = questionActions;

  return (
    <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
      <Suspense fallback={<ViewFallback />}>
        {currentView === 'home' && (
          <Dashboard
            summary={summary}
            folders={folders}
            questions={questions}
            onSelectQuestion={handleSelectQuestion}
            onOpenNewFolder={() => handleOpenNewTopic()}
            onOpenNewQuestion={(folderId) => handleOpenNewQuestion(folderId)}
            onDeleteFolder={handleDeleteFolder}
            onOpenImportLeetCode={() => setIsImportModalOpen(true)}
            onOpenCurricula={() => setIsCurriculaOpen(true)}
            onSelectView={onSelectNavView}
            onToggleBookmark={handleToggleBookmark}
            activeQuestionId={activeQuestion?.id}
            activityKey={activityKey}
            dueCount={dueCount}
            onQuestionTracked={async () => {
              await refreshData();
            }}
          />
        )}

        {currentView === 'workspace' && activeQuestion && (
          <QuestionWorkspace
            question={activeQuestion}
            onSaveQuestion={handleSaveQuestion}
            onToggleBookmark={handleToggleBookmark}
            onAddSolution={handleAddSolution}
            onUpdateSolution={handleUpdateSolution}
            onDeleteSolution={handleDeleteSolution}
            onDeleteQuestion={handleDeleteQuestion}
            onQuestionUpdated={handleQuestionUpdated}
            onBackToDashboard={() => {
              setActiveQuestion(null);
              navigate('/');
            }}
          />
        )}

        {currentView === 'bookmarks' && (
          <BookmarksView
            questions={bookmarkedQuestions}
            onSelectQuestion={handleSelectQuestion}
            onRemoveBookmark={handleToggleBookmark}
            folders={folders}
            onBulkAction={handleBulkAction}
          />
        )}

        {currentView === 'all-questions' && (
          <AllQuestionsView
            questions={questions}
            onSelectQuestion={handleSelectQuestion}
            onToggleBookmark={handleToggleBookmark}
            onOpenNewQuestion={() => handleOpenNewQuestion()}
            onRenameQuestion={handleRenameQuestion}
            onMoveQuestion={handleMoveQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            title="All Questions"
            subtitle="Browse, filter, and track questions across your entire curriculum"
            sortBy="order"
            folders={folders}
            onBulkAction={handleBulkAction}
          />
        )}

        {currentView === 'recent' && (
          <AllQuestionsView
            questions={questions}
            onSelectQuestion={handleSelectQuestion}
            onToggleBookmark={handleToggleBookmark}
            onOpenNewQuestion={() => handleOpenNewQuestion()}
            onRenameQuestion={handleRenameQuestion}
            onMoveQuestion={handleMoveQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            title="Recently Updated"
            subtitle="Questions sorted by most recently modified solutions and notes"
            sortBy="updated"
            folders={folders}
            onBulkAction={handleBulkAction}
          />
        )}

        {currentView === 'revision' && (
          <RevisionPage
            reviews={reviews}
            questions={questions}
            onSelectQuestion={handleSelectQuestion}
            onToggleRevision={handleToggleRevision}
            onToggleBookmark={handleToggleBookmark}
            onReviewed={() => {
              setActivityKey((k) => k + 1);
              void api.getProgressSummary().then(setSummary).catch(() => {});
            }}
          />
        )}

        {currentView === 'patterns' && (
          <MyPatternsView
            folders={folders}
            questions={questions}
            onSelectQuestion={handleSelectQuestion}
            onCreateFolder={handleCreateFolder}
            onEditFolder={(folder) => setEditFolderData(folder)}
            onDeleteFolder={handleDeleteFolder}
            onOpenCreateTopic={handleOpenNewTopic}
            onOpenCreateSubtopic={handleOpenNewSubtopic}
            onOpenCreateQuestion={handleOpenNewQuestion}
            onToggleBookmark={handleToggleBookmark}
            onDeleteQuestion={handleDeleteQuestion}
            onReorderFolders={handleReorderFolders}
            onReorderQuestions={handleReorderQuestions}
            onReorderChildren={handleReorderChildren}
            onMoveQuestion={handleMoveQuestionDirect}
            onMoveFolder={handleMoveFolderDirect}
            activeQuestionId={activeQuestion?.id}
          />
        )}

        {currentView === 'progress' && (
          <ProgressView
            summary={summary}
            folders={folders}
            title="Progress Overview"
            activityKey={activityKey}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            folders={folders}
            onDataChanged={refreshData}
            onOpenCurricula={() => setIsCurriculaOpen(true)}
          />
        )}

        {currentView === 'trash' && <TrashView onDataChanged={refreshData} />}
      </Suspense>
    </main>
  );
}
