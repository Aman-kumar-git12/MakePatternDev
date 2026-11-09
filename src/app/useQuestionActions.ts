import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type {
  Question,
  QuestionListItem,
  Difficulty,
  QuestionStatus,
  SupportedLanguage,
  Solution,
  BulkActionRequest,
  BulkActionResult,
} from '../types/dsa';
import { pushToast, pushUndoToast } from '../hooks/useUndoToasts';
import { confirmAction } from '../components/ConfirmDialog';
import type { AppData } from './useAppData';
import type { ModalState } from './useModalState';
import type { ActiveQuestionState } from './useActiveQuestion';

const truncate = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Question-level actions: bookmarks, revision flag, create/save/rename/move/delete, solutions. */
export function useQuestionActions(data: AppData, modals: ModalState, active: ActiveQuestionState) {
  const navigate = useNavigate();
  const { setFolders, setQuestions, setSummary, setActivityKey, refreshReviews, loadInitialData, refreshData } = data;
  const { setIsImportModalOpen, setRenameData, setMoveData } = modals;
  const { activeQuestion, setActiveQuestion } = active;
  // Latest save sequence per question; older responses are ignored (out-of-order protection).
  const saveSeqRef = useRef<Record<string, number>>({});

  // Toggle Bookmark
  const handleToggleBookmark = async (questionId: string) => {
    try {
      const res = await api.toggleBookmark(questionId);

      // Update question list state
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, is_bookmarked: res.is_bookmarked } : q))
      );

      // Update active question if currently open
      setActiveQuestion((prev) => (prev && prev.id === questionId ? { ...prev, is_bookmarked: res.is_bookmarked } : prev));

      // Refresh folder tree & summary
      const [updatedTree, updatedSummary] = await Promise.all([
        api.getFolderTree(),
        api.getProgressSummary(),
      ]);
      setFolders(updatedTree);
      setSummary(updatedSummary);
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  // Toggle Revision Status
  const handleToggleRevision = async (questionId: string, isChecked: boolean) => {
    const nextStatus: QuestionStatus = isChecked ? 'Needs Revision' : 'Solved';

    // 1. Optimistic UI update for instantaneous live feedback
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, status: nextStatus } : q))
    );

    setActiveQuestion((prev) => (prev && prev.id === questionId ? { ...prev, status: nextStatus } : prev));

    setSummary((prev) => {
      if (!prev) return prev;
      const delta = isChecked ? 1 : -1;
      return {
        ...prev,
        needs_revision_questions: Math.max(0, (prev.needs_revision_questions || 0) + delta),
      };
    });

    try {
      // 2. Persist update in backend
      await api.updateQuestion(questionId, { status: nextStatus });

      // 3. Sync full canonical summary and folder tree in background
      const [updatedSummary, updatedTree] = await Promise.all([
        api.getProgressSummary(),
        api.getFolderTree(),
      ]);
      setSummary(updatedSummary);
      setFolders(updatedTree);
      void refreshReviews();
    } catch (err) {
      console.error('Failed to toggle revision status:', err);
      loadInitialData();
    }
  };

  // Question Operations
  const handleCreateQuestion = async (payload: {
    folder_id?: string | null;
    title: string;
    problem_url?: string;
    difficulty: Difficulty;
    status: QuestionStatus;
    tags: string[];
    problem_statement: string;
    notes?: string;
  }) => {
    const created = await api.createQuestion(payload);
    const [updatedTree, updatedSummary, updatedQuestions] = await Promise.all([
      api.getFolderTree(),
      api.getProgressSummary(),
      api.listQuestions(),
    ]);
    setFolders(updatedTree);
    setSummary(updatedSummary);
    setQuestions(updatedQuestions);

    if (created && created.id) {
      try {
        const fullQ = await api.getQuestion(created.id);
        setActiveQuestion(fullQ);
      } catch {
        // Fallback if detail fetch fails
      }
    }
    navigate('/patterns');
  };

  /**
   * Autosave target. The question id is explicit (a late save for question A can no longer
   * overwrite question B), responses older than the latest save for that question are ignored,
   * and only the saved fields + server-computed metadata are merged (so a save of one field can't
   * clobber newer local values of another).
   */
  const handleSaveQuestion = useCallback(
    async (questionId: string, updates: Partial<Question>) => {
      const seq = (saveSeqRef.current[questionId] || 0) + 1;
      saveSeqRef.current[questionId] = seq;
      const updated = await api.updateQuestion(questionId, updates);
      if (saveSeqRef.current[questionId] !== seq) return; // a newer save superseded this one

      const serverFields: Partial<Question> = {
        updated_at: updated.updated_at,
        solved_at: updated.solved_at,
        next_review_at: updated.next_review_at,
        last_reviewed_at: updated.last_reviewed_at,
        review_count: updated.review_count,
        review_interval_days: updated.review_interval_days,
        folder_id: updated.folder_id,
        folder_path: updated.folder_path,
      };
      const saved: Partial<Question> = {};
      (Object.keys(updates) as Array<keyof Question>).forEach((k) => {
        (saved as Record<string, unknown>)[k] = updated[k];
      });

      setActiveQuestion((prev) => (prev && prev.id === questionId ? { ...prev, ...saved, ...serverFields } : prev));
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? ({ ...q, ...saved, ...serverFields } as QuestionListItem) : q))
      );

      // Refresh summary, folder counts, review queue & heatmap if progress-relevant fields changed
      if (updates.status || updates.difficulty || updates.title) {
        const [updatedTree, updatedSummary] = await Promise.all([
          api.getFolderTree(),
          api.getProgressSummary(),
        ]);
        setFolders(updatedTree);
        setSummary(updatedSummary);
        if (updates.status) {
          void refreshReviews();
          setActivityKey((k) => k + 1);
        }
      }
    },
    [refreshReviews, setActiveQuestion, setQuestions, setFolders, setSummary, setActivityKey]
  );

  /** A fresh server copy arrived (attempt logged / LeetCode refresh): sync everything derived from it. */
  const handleQuestionUpdated = useCallback(
    (updated: Question) => {
      setActiveQuestion((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
      void refreshData();
    },
    [refreshData, setActiveQuestion]
  );

  const handleImportedQuestion = async (created: Question) => {
    await refreshData();
    setIsImportModalOpen(false);
    setActiveQuestion(created);
    navigate(`/question/${created.id}`);
  };

  const handleRenameQuestion = (questionId: string, currentTitle: string) => {
    setRenameData({
      title: 'Rename Question',
      initialValue: currentTitle,
      onSubmit: async (newTitle: string) => {
        await api.updateQuestion(questionId, { title: newTitle });
        const [updatedTree, updatedQuestions] = await Promise.all([
          api.getFolderTree(),
          api.listQuestions(),
        ]);
        setFolders(updatedTree);
        setQuestions(updatedQuestions);
        setActiveQuestion((prev) => (prev && prev.id === questionId ? { ...prev, title: newTitle } : prev));
      },
    });
  };

  const handleMoveQuestion = (questionId: string, questionTitle: string) => {
    setMoveData({
      type: 'question',
      id: questionId,
      title: questionTitle,
    });
  };

  /**
   * Ask first, then soft delete: the question goes to the trash and a 10-second "Undo" toast
   * restores it (it also stays restorable from the Trash view for 30 days).
   */
  const handleDeleteQuestion = async (questionId: string, questionTitle: string) => {
    const ok = await confirmAction({
      title: `Delete “${truncate(questionTitle)}”?`,
      message: 'The problem, its solutions, notes and test cases move to Trash and can be restored for 30 days.',
    });
    if (!ok) return;
    // Optimistically hide it so the UI reacts instantly.
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    const wasActive = activeQuestion?.id === questionId;
    if (wasActive) {
      setActiveQuestion(null);
      navigate('/');
    }
    try {
      const res = await api.deleteQuestion(questionId);
      pushUndoToast(`Deleted “${truncate(questionTitle)}”`, async () => {
        await api.restoreTrashItem(res.trash_id);
        await refreshData();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      pushToast({ message: msg, tone: 'error' });
    }
    await refreshData();
  };

  /** Apply one action to many selected questions; deletes get an undo toast. */
  const handleBulkAction = async (request: BulkActionRequest): Promise<BulkActionResult | null> => {
    const n = request.question_ids.length;
    const label = `${n} question${n === 1 ? '' : 's'}`;
    if (request.action === 'delete') {
      const ok = await confirmAction({
        title: `Delete ${label}?`,
        message: `The selected ${n === 1 ? 'problem moves' : 'problems move'} to Trash with their solutions, notes and test cases, and can be restored for 30 days.`,
      });
      if (!ok) return null;
    }
    const res = await api.bulkQuestions(request);
    if (request.action === 'delete') {
      if (activeQuestion && request.question_ids.includes(activeQuestion.id)) setActiveQuestion(null);
      const trashId = res.trash_id;
      if (trashId) {
        pushUndoToast(`Deleted ${label}`, async () => {
          await api.restoreTrashItem(trashId);
          await refreshData();
        });
      }
    } else {
      pushToast({ message: `Updated ${res.updated} of ${label}`, tone: 'success', duration: 3000 });
      // Keep an open workspace in sync with server-side changes.
      if (activeQuestion && request.question_ids.includes(activeQuestion.id)) {
        api.getQuestion(activeQuestion.id).then(setActiveQuestion).catch(() => {});
      }
    }
    await refreshData();
    return res;
  };

  // Solutions Operations
  const handleAddSolution = async (
    questionId: string,
    title: string,
    language: SupportedLanguage,
    timeComplexity: string = '',
    spaceComplexity: string = 'O(1)',
    code: string = '',
    solutionType?: string,
    explanation?: string
  ): Promise<Solution> => {
    return api.createSolution(questionId, {
      title,
      language,
      code,
      time_complexity: timeComplexity,
      space_complexity: spaceComplexity,
      solution_type: solutionType,
      explanation,
    });
  };

  const handleUpdateSolution = async (solutionId: string, updates: Partial<Solution>) => {
    await api.updateSolution(solutionId, updates);
  };

  const handleDeleteSolution = async (solutionId: string) => {
    await api.deleteSolution(solutionId);
  };

  return {
    handleToggleBookmark,
    handleToggleRevision,
    handleCreateQuestion,
    handleSaveQuestion,
    handleQuestionUpdated,
    handleImportedQuestion,
    handleRenameQuestion,
    handleMoveQuestion,
    handleDeleteQuestion,
    handleBulkAction,
    handleAddSolution,
    handleUpdateSolution,
    handleDeleteSolution,
  };
}

export type QuestionActions = ReturnType<typeof useQuestionActions>;
