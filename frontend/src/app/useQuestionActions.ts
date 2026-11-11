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
import type { SyncQueue } from './useSyncQueue';
import { startPendingId } from './pendingIds';
import { folderPathFor, nextChildPosition, recountTree } from './treeOps';

const truncate = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Question-level actions: bookmarks, revision flag, create/save/rename/move/delete, solutions. */
export function useQuestionActions(data: AppData, modals: ModalState, active: ActiveQuestionState, sync: SyncQueue) {
  const navigate = useNavigate();
  const { setQuestions, setServerFolders, setServerQuestions, setSummary, setActivityKey, refreshReviews, loadInitialData, refreshData } = data;
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
      setServerFolders(updatedTree);
      setSummary(updatedSummary);
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  // Toggle Revision Status
  const handleToggleRevision = async (questionId: string, isChecked: boolean) => {
    const nextStatus: QuestionStatus = isChecked ? 'Needs Revision' : 'Solved';
    const previousStatus = sync.latest.current.questions.find((q) => q.id === questionId)?.status;

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
      setServerFolders(updatedTree);
      void refreshReviews();
      // Marking it solved can log a solve for today.
      if (nextStatus === 'Solved') setActivityKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to toggle revision status:', err);
      if (previousStatus) {
        setActiveQuestion((prev) => (prev && prev.id === questionId ? { ...prev, status: previousStatus } : prev));
      }
      pushToast({ message: err instanceof Error ? `Couldn't update the status: ${err.message}` : "Couldn't update the status", tone: 'error' });
      loadInitialData();
    }
  };

  /**
   * Add a problem. It shows up at once (at the end of its topic) and is saved in the background;
   * opening it before the save finishes just waits for the save.
   */
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
    const title = payload.title.trim();
    const problemUrl = (payload.problem_url || '').trim();
    if (!title) throw new Error('Problem title is required');
    if (title.length > 300) throw new Error('Title must be 300 characters or fewer');
    if (problemUrl.length > 500) throw new Error('Link must be 500 characters or fewer');

    const { folders, questions } = sync.latest.current;
    const folderId = payload.folder_id || null;
    const unfiled = questions.filter((q) => !q.folder_id).map((q) => q.position ?? 0);
    const position = folderId
      ? nextChildPosition(folders, questions, folderId)
      : unfiled.length
        ? Math.max(...unfiled) + 1
        : 0;
    const pendingId = startPendingId();
    const now = new Date().toISOString();
    const item: QuestionListItem = {
      id: pendingId.id,
      folder_id: folderId,
      title,
      problem_url: problemUrl || undefined,
      difficulty: payload.difficulty,
      status: payload.status,
      tags: payload.tags,
      is_bookmarked: false,
      folder_path: folderPathFor(folders, folderId),
      position,
      solved_at: payload.status === 'Solved' ? now : null,
      attempts: 0,
      time_spent_minutes: 0,
      created_at: now,
      updated_at: now,
    };
    const nextQuestions = [...questions, item];
    sync.applyLocal(recountTree(folders, nextQuestions), nextQuestions);
    setSummary((prev) => {
      if (!prev) return prev;
      const total = prev.total_questions + 1;
      const solved = prev.solved_questions + (payload.status === 'Solved' ? 1 : 0);
      const bucket = prev.difficulty_breakdown?.[payload.difficulty];
      return {
        ...prev,
        total_questions: total,
        solved_questions: solved,
        in_progress_questions: prev.in_progress_questions + (payload.status === 'In Progress' ? 1 : 0),
        needs_revision_questions: prev.needs_revision_questions + (payload.status === 'Needs Revision' ? 1 : 0),
        not_started_questions: prev.not_started_questions + (payload.status === 'Not Started' ? 1 : 0),
        overall_percentage: Math.round((solved / total) * 1000) / 10,
        difficulty_breakdown: bucket
          ? {
              ...prev.difficulty_breakdown,
              [payload.difficulty]: {
                total: bucket.total + 1,
                solved: bucket.solved + (payload.status === 'Solved' ? 1 : 0),
              },
            }
          : prev.difficulty_breakdown,
      };
    });
    navigate('/patterns');

    sync.enqueueSave(
      async () => {
        try {
          // A folder created a moment ago is swapped for its real id by the API client.
          const created = await api.createQuestion({ ...payload, title, problem_url: problemUrl || undefined, position });
          pendingId.saved(created.id);
          const current = sync.latest.current;
          const saved = current.questions.map((q) =>
            q.id === pendingId.id
              ? {
                  ...q,
                  id: created.id,
                  folder_id: created.folder_id ?? null,
                  folder_path: created.folder_path ?? q.folder_path,
                  position: created.position ?? q.position,
                  solved_at: created.solved_at ?? q.solved_at,
                  next_review_at: created.next_review_at ?? q.next_review_at,
                  leetcode_slug: created.leetcode_slug ?? q.leetcode_slug,
                  created_at: created.created_at ?? q.created_at,
                  updated_at: created.updated_at ?? q.updated_at,
                }
              : q
          );
          sync.applyLocal(recountTree(current.folders, saved), saved);
          // Added as already solved: the server logged a solve, so the heatmap and review queue change.
          if (created.status === 'Solved') {
            setActivityKey((k) => k + 1);
            void refreshReviews();
          }
        } catch (err) {
          pendingId.failed(err);
          throw err;
        }
      },
      {
        reconcile: true,
        failMessage: (err) =>
          `Couldn't add “${truncate(title)}”${err instanceof Error && err.message ? `: ${err.message}` : '.'}`,
      }
    );
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
        setServerFolders(updatedTree);
        setSummary(updatedSummary);
        if (updates.status) {
          void refreshReviews();
          setActivityKey((k) => k + 1);
        }
      }
    },
    [refreshReviews, setActiveQuestion, setQuestions, setServerFolders, setSummary, setActivityKey]
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
        setServerFolders(updatedTree);
        setServerQuestions(updatedQuestions);
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
