import { lazy, Suspense, useState, type ReactNode } from 'react';

/**
 * Route-level and on-demand components are split into their own chunks so the first paint only
 * ships the shell (sidebar, header, dashboard, auth pages).
 */
export const QuestionWorkspace = lazy(() =>
  import('../components/Workspace/QuestionWorkspace').then((m) => ({ default: m.QuestionWorkspace }))
);
export const BookmarksView = lazy(() =>
  import('../components/Views/BookmarksView').then((m) => ({ default: m.BookmarksView }))
);
export const AllQuestionsView = lazy(() =>
  import('../components/Views/AllQuestionsView').then((m) => ({ default: m.AllQuestionsView }))
);
export const ProgressView = lazy(() =>
  import('../components/Views/ProgressView').then((m) => ({ default: m.ProgressView }))
);
export const MyPatternsView = lazy(() =>
  import('../components/Views/MyPatternsView').then((m) => ({ default: m.MyPatternsView }))
);
export const SharedPatternView = lazy(() =>
  import('../components/Views/SharedPatternView').then((m) => ({ default: m.SharedPatternView }))
);
export const RevisionPage = lazy(() =>
  import('../components/Views/RevisionPage').then((m) => ({ default: m.RevisionPage }))
);
export const SettingsView = lazy(() =>
  import('../components/Views/SettingsView').then((m) => ({ default: m.SettingsView }))
);

// Modals
export const GlobalSearchModal = lazy(() =>
  import('../components/Header/GlobalSearchModal').then((m) => ({ default: m.GlobalSearchModal }))
);
export const CreateTopicModal = lazy(() =>
  import('../components/Modals/CreateTopicModal').then((m) => ({ default: m.CreateTopicModal }))
);
export const CreateSubtopicModal = lazy(() =>
  import('../components/Modals/CreateSubtopicModal').then((m) => ({ default: m.CreateSubtopicModal }))
);
export const CreateQuestionModal = lazy(() =>
  import('../components/Modals/CreateQuestionModal').then((m) => ({ default: m.CreateQuestionModal }))
);
export const EditTopicModal = lazy(() =>
  import('../components/Modals/EditTopicModal').then((m) => ({ default: m.EditTopicModal }))
);
export const MoveModal = lazy(() =>
  import('../components/Modals/MoveModal').then((m) => ({ default: m.MoveModal }))
);
export const ConfirmDeleteModal = lazy(() =>
  import('../components/Modals/ConfirmDeleteModal').then((m) => ({ default: m.ConfirmDeleteModal }))
);
export const RenameModal = lazy(() =>
  import('../components/Modals/RenameModal').then((m) => ({ default: m.RenameModal }))
);
export const ImportLeetCodeModal = lazy(() =>
  import('../components/Modals/ImportLeetCodeModal').then((m) => ({ default: m.ImportLeetCodeModal }))
);
export const CurriculaModal = lazy(() =>
  import('../components/Modals/CurriculaModal').then((m) => ({ default: m.CurriculaModal }))
);

/** Lightweight placeholder shown while a view chunk loads. */
export function ViewFallback() {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center" role="status" aria-live="polite">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
        style={{ color: 'var(--text-secondary)' }}
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * Mounts a lazily-loaded modal the first time it opens and keeps it mounted afterwards, so its
 * chunk isn't fetched at first paint but open/close behaviour is unchanged once loaded.
 * (These modals render nothing while closed and re-sync their state when `isOpen` flips.)
 */
export function LazyModal({ isOpen, children }: { isOpen: boolean; children: ReactNode }) {
  const [hasOpened, setHasOpened] = useState(isOpen);
  if (isOpen && !hasOpened) setHasOpened(true);
  if (!hasOpened) return null;
  return <Suspense fallback={null}>{children}</Suspense>;
}
