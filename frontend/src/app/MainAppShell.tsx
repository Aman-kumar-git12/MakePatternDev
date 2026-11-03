import { Sidebar } from '../components/Sidebar/Sidebar';
import { Header } from '../components/Header/Header';
import { useAuth } from '../context/AuthContext';
import { useAppData } from './useAppData';
import { useModalState } from './useModalState';
import { useViewRouting } from './useViewRouting';
import { useActiveQuestion } from './useActiveQuestion';
import { useFolderActions } from './useFolderActions';
import { useQuestionActions } from './useQuestionActions';
import { MainContent } from './MainContent';
import { AppModals } from './AppModals';
import { UndoToastStack } from '../components/Common/UndoToast';
import { useShellShortcuts } from '../shortcuts/useShellShortcuts';

/** Authenticated application shell: sidebar + header + routed view + global modals. */
export function MainAppShell() {
  const { user, logout } = useAuth();
  const data = useAppData();
  const modals = useModalState();
  const { currentView, handleSelectNavView } = useViewRouting();
  const active = useActiveQuestion();
  const folderActions = useFolderActions(data, modals, active);
  const questionActions = useQuestionActions(data, modals, active);

  const bookmarkedQuestions = data.questions.filter((q) => q.is_bookmarked);
  const dueCount = data.reviews.queue.due_count;
  const { isMobileMenuOpen, setIsMobileMenuOpen, setIsSearchOpen, handleOpenNewQuestion } = modals;
  // Keyboard shortcuts, focus mode (hides sidebar/header in a question), "?" help, preference sync.
  const shell = useShellShortcuts({ currentView, onSelectView: handleSelectNavView, modals, active, questionActions });

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      {/* 1. Left Sidebar (hidden in focus mode; display:contents keeps layout otherwise) */}
      <div className={shell.focusActive ? 'hidden' : 'contents'}>
      <Sidebar
        currentView={currentView}
        onSelectView={handleSelectNavView}
        bookmarkCount={bookmarkedQuestions.length}
        revisionCount={dueCount}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        user={user}
        onLogout={logout}
        activeQuestion={active.activeQuestion}
      />
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        {!shell.focusActive && (
        <Header
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNewQuestion={() => handleOpenNewQuestion()}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          user={user}
          onLogout={logout}
        />
        )}

        {/* View Switcher based on current URL */}
        <MainContent
          currentView={currentView}
          onSelectNavView={handleSelectNavView}
          data={data}
          modals={modals}
          active={active}
          folderActions={folderActions}
          questionActions={questionActions}
          bookmarkedQuestions={bookmarkedQuestions}
          dueCount={dueCount}
        />
      </div>

      <AppModals
        data={data}
        modals={modals}
        active={active}
        folderActions={folderActions}
        questionActions={questionActions}
      />

      {/* Undo / status toasts (soft deletes, bulk actions) */}
      <UndoToastStack />

      {/* Shortcuts help overlay + focus-mode toggle */}
      {shell.overlays}
    </div>
  );
}
