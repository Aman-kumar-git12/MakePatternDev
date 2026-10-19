import { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Header } from './components/Header/Header';
import { Dashboard } from './components/Dashboard/Dashboard';
import { QuestionWorkspace } from './components/Workspace/QuestionWorkspace';
import { BookmarksView } from './components/Views/BookmarksView';
import { AllQuestionsView } from './components/Views/AllQuestionsView';
import { ProgressView } from './components/Views/ProgressView';
import { MyPatternsView } from './components/Views/MyPatternsView';
import { SharedPatternView } from './components/Views/SharedPatternView';
import { RevisionView } from './components/Views/RevisionView';
import { GlobalSearchModal } from './components/Header/GlobalSearchModal';
import { CreateTopicModal } from './components/Modals/CreateTopicModal';
import { CreateSubtopicModal } from './components/Modals/CreateSubtopicModal';
import { CreateQuestionModal } from './components/Modals/CreateQuestionModal';
import { EditTopicModal } from './components/Modals/EditTopicModal';
import { MoveModal } from './components/Modals/MoveModal';
import { ConfirmDeleteModal } from './components/Modals/ConfirmDeleteModal';
import { RenameModal } from './components/Modals/RenameModal';
import { ImportLeetCodeModal } from './components/Modals/ImportLeetCodeModal';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { PublicRoute } from './components/Auth/PublicRoute';
import { useAuth } from './context/AuthContext';

import { api } from './services/api';
import type {
  Folder,
  Question,
  QuestionListItem,
  ProgressSummary,
  ViewMode,
  Difficulty,
  QuestionStatus,
  SupportedLanguage,
  Solution,
} from './types/dsa';

function MainAppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ questionId?: string }>();
  const { user, logout } = useAuth();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);

  // Modals state - separate dedicated modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false);
  const [isCreateSubtopicOpen, setIsCreateSubtopicOpen] = useState(false);
  const [isCreateQuestionOpen, setIsCreateQuestionOpen] = useState(false);
  const [modalTargetFolderId, setModalTargetFolderId] = useState<string | undefined>(undefined);

  const [moveData, setMoveData] = useState<{
    type: 'folder' | 'question';
    id: string;
    title: string;
  } | null>(null);

  const [deleteData, setDeleteData] = useState<{
    title: string;
    message: string;
    itemType: 'folder' | 'question' | 'solution';
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [renameData, setRenameData] = useState<{
    title: string;
    initialValue: string;
    onSubmit: (newName: string) => Promise<void>;
  } | null>(null);

  const [editFolderData, setEditFolderData] = useState<Folder | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Derive active view mode from pathname
  const currentView = useMemo<ViewMode>(() => {
    const path = location.pathname;
    if (path.startsWith('/question/')) return 'workspace';
    if (path === '/patterns') return 'patterns';
    if (path === '/questions') return 'all-questions';
    if (path === '/bookmarks') return 'bookmarks';
    if (path === '/recent') return 'recent';
    if (path === '/revision') return 'revision';
    if (path === '/progress') return 'progress';
    return 'home';
  }, [location.pathname]);

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

  // Initial Data Fetch
  const loadInitialData = useCallback(async () => {
    try {
      const [treeData, summaryData, listData] = await Promise.all([
        api.getFolderTree(),
        api.getProgressSummary(),
        api.listQuestions(),
      ]);

      setFolders(treeData);
      setSummary(summaryData);
      setQuestions(listData);
    } catch (err) {
      console.error('Failed to load initial curriculum data:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Deep link sync for /question/:questionId
  useEffect(() => {
    const routeQuestionId = params.questionId;
    if (routeQuestionId) {
      if (!activeQuestion || activeQuestion.id !== routeQuestionId) {
        api.getQuestion(routeQuestionId)
          .then((q) => setActiveQuestion(q))
          .catch((err) => {
            console.error('Failed to resolve route question:', err);
            navigate('/', { replace: true });
          });
      }
    } else {
      if (activeQuestion && !location.pathname.startsWith('/question/')) {
        setActiveQuestion(null);
      }
    }
  }, [params.questionId, location.pathname, activeQuestion, navigate]);

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

  // Select Question & Navigate to Workspace Route
  const handleSelectQuestion = async (questionId: string) => {
    try {
      const q = await api.getQuestion(questionId);
      setActiveQuestion(q);
      navigate(`/question/${questionId}`);
    } catch (err) {
      console.error('Failed to open question:', err);
    }
  };

  // Navigation from Sidebar
  const handleSelectNavView = (view: ViewMode) => {
    switch (view) {
      case 'home':
        navigate('/');
        break;
      case 'patterns':
        navigate('/patterns');
        break;
      case 'all-questions':
        navigate('/questions');
        break;
      case 'bookmarks':
        navigate('/bookmarks');
        break;
      case 'recent':
        navigate('/recent');
        break;
      case 'revision':
        navigate('/revision');
        break;
      case 'progress':
        navigate('/progress');
        break;
      default:
        navigate('/');
    }
  };

  // Toggle Bookmark
  const handleToggleBookmark = async (questionId: string) => {
    try {
      const res = await api.toggleBookmark(questionId);

      // Update question list state
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, is_bookmarked: res.is_bookmarked } : q))
      );

      // Update active question if currently open
      if (activeQuestion && activeQuestion.id === questionId) {
        setActiveQuestion({ ...activeQuestion, is_bookmarked: res.is_bookmarked });
      }

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

    if (activeQuestion && activeQuestion.id === questionId) {
      setActiveQuestion({ ...activeQuestion, status: nextStatus });
    }

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
    } catch (err) {
      console.error('Failed to toggle revision status:', err);
      loadInitialData();
    }
  };

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

  // Question Operations
  const handleCreateQuestion = async (data: {
    folder_id?: string | null;
    title: string;
    problem_url?: string;
    difficulty: Difficulty;
    status: QuestionStatus;
    tags: string[];
    problem_statement: string;
    notes?: string;
  }) => {
    const created = await api.createQuestion(data);
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

  const handleSaveQuestion = async (updates: Partial<Question>) => {
    if (!activeQuestion) return;
    const updated = await api.updateQuestion(activeQuestion.id, updates);
    setActiveQuestion(updated);

    // Sync in list
    setQuestions((prev) =>
      prev.map((q) => (q.id === updated.id ? { ...q, ...updated } : q))
    );

    // Refresh summary & folder counts if status changed
    if (updates.status || updates.difficulty || updates.title) {
      const [updatedTree, updatedSummary] = await Promise.all([
        api.getFolderTree(),
        api.getProgressSummary(),
      ]);
      setFolders(updatedTree);
      setSummary(updatedSummary);
    }
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
        if (activeQuestion && activeQuestion.id === questionId) {
          setActiveQuestion({ ...activeQuestion, title: newTitle });
        }
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

  const handleDeleteQuestion = (questionId: string, questionTitle: string) => {
    setDeleteData({
      title: `Delete question "${questionTitle}"?`,
      message: 'This will permanently remove this question along with all its code solutions, step-by-step notes, complexity estimates, and test cases.',
      itemType: 'question',
      onConfirm: async () => {
        await api.deleteQuestion(questionId);
        const [updatedTree, updatedSummary, updatedQuestions] = await Promise.all([
          api.getFolderTree(),
          api.getProgressSummary(),
          api.listQuestions(),
        ]);
        setFolders(updatedTree);
        setSummary(updatedSummary);
        setQuestions(updatedQuestions);
        if (activeQuestion && activeQuestion.id === questionId) {
          setActiveQuestion(null);
          navigate('/');
        }
      },
    });
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

  // Execute Move Modal
  const handleExecuteMove = async (targetId: string | null) => {
    if (!moveData) return;
    if (moveData.type === 'folder') {
      await api.moveFolder(moveData.id, targetId);
    } else {
      if (!targetId) throw new Error('A question must belong to a folder.');
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

    if (activeQuestion && activeQuestion.id === moveData.id && targetId) {
      const refreshedQ = await api.getQuestion(activeQuestion.id);
      setActiveQuestion(refreshedQ);
    }
  };

  const bookmarkedQuestions = questions.filter((q) => q.is_bookmarked);
  const revisionCount = questions.filter((q) => q.status === 'Needs Revision').length;

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      {/* 1. Left Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={handleSelectNavView}
        bookmarkCount={bookmarkedQuestions.length}
        revisionCount={revisionCount}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        user={user}
        onLogout={logout}
        activeQuestion={activeQuestion}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNewQuestion={() => handleOpenNewQuestion()}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          user={user}
          onLogout={logout}
        />

        {/* View Switcher based on current URL */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
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
              onSelectView={handleSelectNavView}
              onToggleBookmark={handleToggleBookmark}
              activeQuestionId={activeQuestion?.id}
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
            />
          )}

          {currentView === 'revision' && (
            <RevisionView
              questions={questions}
              onSelectQuestion={handleSelectQuestion}
              onToggleRevision={handleToggleRevision}
              onToggleBookmark={handleToggleBookmark}
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
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectQuestion={handleSelectQuestion}
      />

      {/* 1. Dedicated Topic Modal (Main Topic) */}
      <CreateTopicModal
        isOpen={isCreateTopicOpen}
        onClose={() => setIsCreateTopicOpen(false)}
        onCreateTopic={handleCreateTopic}
      />

      {/* 2. Dedicated Subtopic Modal */}
      <CreateSubtopicModal
        isOpen={isCreateSubtopicOpen}
        onClose={() => setIsCreateSubtopicOpen(false)}
        initialParentId={modalTargetFolderId}
        folders={folders}
        onCreateSubtopic={handleCreateSubtopic}
      />

      {/* 3. Dedicated Problem Modal */}
      <CreateQuestionModal
        isOpen={isCreateQuestionOpen}
        onClose={() => setIsCreateQuestionOpen(false)}
        initialFolderId={modalTargetFolderId}
        folders={folders}
        onCreateQuestion={handleCreateQuestion}
      />

      {editFolderData && (
        <EditTopicModal
          isOpen={true}
          onClose={() => setEditFolderData(null)}
          folder={editFolderData}
          allFolders={folders}
          onUpdate={handleUpdateFolder}
        />
      )}

      <ImportLeetCodeModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        folders={folders}
        onImport={handleCreateQuestion}
      />

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
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public Guest Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* Public Read-Only Shared Pattern Route (supports /shared/ and /share/) */}
      <Route path="/shared/:shareId" element={<SharedPatternView />} />
      <Route path="/share/:shareId" element={<SharedPatternView />} />

      {/* Protected Application Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainAppShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patterns"
        element={
          <ProtectedRoute>
            <MainAppShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/questions"
        element={
          <ProtectedRoute>
            <MainAppShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bookmarks"
        element={
          <ProtectedRoute>
            <MainAppShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recent"
        element={
          <ProtectedRoute>
            <MainAppShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/revision"
        element={
          <ProtectedRoute>
            <MainAppShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/progress"
        element={
          <ProtectedRoute>
            <MainAppShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/question/:questionId"
        element={
          <ProtectedRoute>
            <MainAppShell />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
