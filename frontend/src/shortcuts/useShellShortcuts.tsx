import { useCallback, useState } from 'react';
import { usePreferences, usePreferencesServerSync } from '../context/usePreferences';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { ShortcutsHelp } from '../components/Common/ShortcutsHelp';
import { FocusModeToggle } from '../components/Common/FocusModeToggle';
import type { ViewMode } from '../types/dsa';
import type { ModalState } from '../app/useModalState';
import type { ActiveQuestionState } from '../app/useActiveQuestion';
import type { QuestionActions } from '../app/useQuestionActions';

const GO_VIEWS = {
  dashboard: 'home',
  patterns: 'patterns',
  reviews: 'revision',
  bookmarks: 'bookmarks',
  settings: 'settings',
} as const satisfies Record<string, ViewMode>;

/**
 * Keyboard shortcuts, focus mode, the "?" help overlay and preference sync for the signed-in shell.
 * Kept out of MainAppShell so the shell stays a thin composition.
 */
export function useShellShortcuts(opts: {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  modals: ModalState;
  active: ActiveQuestionState;
  questionActions: QuestionActions;
}) {
  const { currentView, onSelectView, modals, active, questionActions } = opts;
  usePreferencesServerSync();
  const { prefs, setPrefs } = usePreferences();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const inWorkspace = currentView === 'workspace' && !!active.activeQuestion;
  const focusActive = prefs.focus_mode && inWorkspace;

  const toggleFocus = useCallback(() => setPrefs({ focus_mode: !prefs.focus_mode }), [prefs.focus_mode, setPrefs]);

  const closeAnyModal = (): boolean => {
    const m = modals;
    const open: [boolean, () => void][] = [
      [m.isSearchOpen, () => m.setIsSearchOpen(false)],
      [!!m.deleteData, () => m.setDeleteData(null)],
      [!!m.moveData, () => m.setMoveData(null)],
      [!!m.renameData, () => m.setRenameData(null)],
      [!!m.editFolderData, () => m.setEditFolderData(null)],
      [m.isCreateQuestionOpen, () => m.setIsCreateQuestionOpen(false)],
      [m.isCreateSubtopicOpen, () => m.setIsCreateSubtopicOpen(false)],
      [m.isCreateTopicOpen, () => m.setIsCreateTopicOpen(false)],
      [m.isImportModalOpen, () => m.setIsImportModalOpen(false)],
      [m.isCurriculaOpen, () => m.setIsCurriculaOpen(false)],
      [m.isMobileMenuOpen, () => m.setIsMobileMenuOpen(false)],
    ];
    const hit = open.find(([isOpen]) => isOpen);
    if (!hit) return false;
    hit[1]();
    return true;
  };

  useKeyboardShortcuts({
    enabled: prefs.shortcuts_enabled,
    onSearch: () => modals.setIsSearchOpen(true),
    onHelp: () => setIsHelpOpen(true),
    onGo: (target) => onSelectView(GO_VIEWS[target]),
    onOpenQuestion: (id) => void active.handleSelectQuestion(id),
    onStartReview: () => onSelectView('revision'),
    onNewQuestion: () => modals.handleOpenNewQuestion(),
    onToggleFocus: () => {
      if (inWorkspace) toggleFocus();
    },
    onBookmark: (selectedId) => {
      const id = inWorkspace ? active.activeQuestion?.id : selectedId;
      if (id) void questionActions.handleToggleBookmark(id);
    },
    onEscape: () => {
      if (isHelpOpen) {
        setIsHelpOpen(false);
        return true;
      }
      if (closeAnyModal()) return true;
      if (focusActive) {
        setPrefs({ focus_mode: false });
        return true;
      }
      return false;
    },
  });

  const overlays = (
    <>
      <ShortcutsHelp isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} shortcutsEnabled={prefs.shortcuts_enabled} />
      {inWorkspace && <FocusModeToggle active={focusActive} onToggle={toggleFocus} />}
    </>
  );

  return { focusActive, overlays, openShortcutsHelp: () => setIsHelpOpen(true) };
}
