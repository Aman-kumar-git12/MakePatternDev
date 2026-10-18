import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  ChevronDown,
  ChevronRight,
  FileCode,
  CheckCircle2,
  Clock,
  RotateCcw,
  Circle,
  Star,
  Trash2,
  Edit2,
  Search,
  FolderTree,
  ExternalLink,
} from 'lucide-react';
import type { Folder, QuestionListItem, Difficulty, QuestionStatus } from '../../types/dsa';

interface MyPatternsViewProps {
  folders: Folder[];
  questions: QuestionListItem[];
  onSelectQuestion: (questionId: string) => void;
  onCreateFolder: (name: string, parentId: string | null, description?: string, tags?: string[]) => Promise<void>;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string, folderName: string) => void;
  onOpenAddItem: (initialType?: 'topic' | 'subtopic' | 'file', folderId?: string) => void;
  onToggleBookmark?: (questionId: string) => void;
  onDeleteQuestion?: (questionId: string, questionTitle: string) => void;
}

export const MyPatternsView: React.FC<MyPatternsViewProps> = ({
  folders,
  questions,
  onSelectQuestion,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onOpenAddItem,
  onToggleBookmark,
  onDeleteQuestion,
}) => {
  const [newTopicName, setNewTopicName] = useState('');
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded folders state (all root patterns expanded by default)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const f of folders) {
      init[f.id] = true;
    }
    return init;
  });

  // Keep newly added or loaded root topics expanded by default
  React.useEffect(() => {
    setExpandedNodes((prev) => {
      const next = { ...prev };
      let hasChanges = false;
      for (const f of folders) {
        if (next[f.id] === undefined) {
          next[f.id] = true;
          hasChanges = true;
        }
      }
      return hasChanges ? next : prev;
    });
  }, [folders]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const handleAddNewPatternTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    try {
      setIsAddingTopic(true);
      await onCreateFolder(newTopicName.trim(), null);
      setNewTopicName('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add pattern topic');
    } finally {
      setIsAddingTopic(false);
    }
  };

  const getQuestionsForFolder = (folderId: string): QuestionListItem[] => {
    return questions.filter((q) => q.folder_id === folderId);
  };

  // Filter root folders and subtopics based on search query
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const query = searchQuery.toLowerCase();

    return folders.filter((f) => {
      const matchName = f.name.toLowerCase().includes(query);
      const matchDesc = (f.description || '').toLowerCase().includes(query);
      const matchTags = (f.tags || []).some((t) => t.toLowerCase().includes(query));
      const matchSub = (f.subfolders || []).some((sf) =>
        sf.name.toLowerCase().includes(query) || (sf.tags || []).some((t) => t.toLowerCase().includes(query))
      );
      const matchQ = questions.some(
        (q) => q.folder_id === f.id && q.title.toLowerCase().includes(query)
      );
      return matchName || matchDesc || matchTags || matchSub || matchQ;
    });
  }, [folders, questions, searchQuery]);

  const renderStatusIcon = (status: QuestionStatus) => {
    switch (status) {
      case 'Solved':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'In Progress':
        return <Clock className="w-3.5 h-3.5 text-blue-400" />;
      case 'Needs Revision':
        return <RotateCcw className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Circle className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const difficultyColors: Record<Difficulty, string> = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  // Render subfolder / subtopic tree node
  const renderSubtopicNode = (node: Folder) => {
    const isExpanded = !!expandedNodes[node.id];
    const nodeQuestions = getQuestionsForFolder(node.id);
    const subfolders = node.subfolders || [];
    const hasChildren = subfolders.length > 0 || nodeQuestions.length > 0;

    return (
      <div key={node.id} className="relative select-none">
        {/* Subtopic Row Header */}
        <div
          onClick={() => toggleNode(node.id)}
          className="flex items-center justify-between py-2 px-2.5 rounded-lg cursor-pointer transition hover:bg-[#121B30] text-slate-300 font-normal group"
        >
          <div className="flex items-center space-x-2 min-w-0">
            {/* Expand / Collapse Icon */}
            <div className="w-4 h-4 flex items-center justify-center text-slate-400 group-hover:text-white transition">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-slate-600/70 flex items-center justify-center group-hover:border-slate-400">
                  <ChevronRight className="w-2 h-2 text-slate-400" />
                </div>
              )}
            </div>

            {/* Subtopic Name */}
            <span className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
              {node.name}
            </span>

            {/* Subtopic Tags */}
            {node.tags && node.tags.length > 0 && (
              <div className="hidden sm:flex items-center space-x-1">
                {node.tags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60 font-mono"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition font-mono">
              {nodeQuestions.length} {nodeQuestions.length === 1 ? 'question' : 'questions'}
            </span>

            {/* Add Question to this subtopic */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenAddItem('file', node.id);
              }}
              className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white transition shadow-sm"
              title={`Add Question inside "${node.name}"`}
            >
              <Plus className="w-3 h-3" />
              <span>Add Question</span>
            </button>

            {/* Edit Subtopic */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditFolder(node);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition"
              title={`Edit subtopic "${node.name}"`}
            >
              <Edit2 className="w-3 h-3" />
            </button>

            {/* Delete Subtopic */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(node.id, node.name);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
              title={`Delete subtopic "${node.name}"`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Subtopic Children (Questions) */}
        {isExpanded && (
          <div className="relative pl-5 ml-2.5 border-l border-slate-700/50 space-y-0.5 mt-0.5 mb-1">
            {/* Nested subtopics if any */}
            {subfolders.map((sub) => renderSubtopicNode(sub))}

            {/* Questions in this subtopic */}
            {nodeQuestions.map((q) => (
              <div
                key={q.id}
                onClick={() => onSelectQuestion(q.id)}
                className="flex items-center justify-between py-1.5 px-2.5 rounded-md hover:bg-slate-800/50 cursor-pointer transition group relative before:content-[''] before:absolute before:-left-5 before:top-1/2 before:w-3.5 before:h-[1px] before:bg-slate-700/50"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="flex-shrink-0">{renderStatusIcon(q.status)}</div>
                  <span className="text-xs text-slate-200 group-hover:text-blue-300 transition truncate font-medium">
                    {q.title}
                  </span>
                  {q.problem_url && (
                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-blue-400 flex-shrink-0" />
                  )}
                </div>

                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <span
                    className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                      difficultyColors[q.difficulty] || 'text-slate-400'
                    }`}
                  >
                    {q.difficulty}
                  </span>

                  {onToggleBookmark && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBookmark(q.id);
                      }}
                      className="p-0.5 text-slate-500 hover:text-amber-400 transition"
                      title="Bookmark"
                    >
                      <Star
                        className={`w-3 h-3 ${
                          q.is_bookmarked ? 'fill-amber-400 text-amber-400' : ''
                        }`}
                      />
                    </button>
                  )}

                  {onDeleteQuestion && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteQuestion(q.id, q.title);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                      title={`Delete question "${q.title}"`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Empty prompt */}
            {!hasChildren && (
              <div className="py-2 px-2.5 text-xs text-slate-500 italic flex items-center justify-between">
                <span>No problems in this subtopic yet</span>
                <button
                  onClick={() => onOpenAddItem('file', node.id)}
                  className="text-blue-400 hover:text-blue-300 font-medium text-xs flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add First Question</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4 animate-fade-in">
      {/* Top Header Card: Title, Search, and Quick Add Pattern */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <h1 className="text-lg font-bold text-white tracking-tight">
                Topics & Patterns Management
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Organize core DSA topics, subtopic patterns, multiple code approaches, and test cases
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onOpenAddItem('topic')}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition"
              title="Create a new top-level DSA topic"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Topic</span>
            </button>
          </div>
        </div>

        {/* Search & Fast Topic Creation Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-1">
          {/* Search Filter */}
          <div className="md:col-span-5 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics, subtopics, tags, or problems..."
              className="w-full bg-[#080C14] border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Quick Create Main Topic */}
          <form onSubmit={handleAddNewPatternTopic} className="md:col-span-7 flex space-x-2">
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="Create new top-level topic (e.g. Heaps, Dynamic Programming, Graphs)..."
              className="flex-1 bg-[#080C14] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isAddingTopic || !newTopicName.trim()}
              className="flex items-center space-x-1 px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-semibold transition disabled:opacity-50 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingTopic ? 'Adding...' : 'Add Topic'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Topics List: Each topic rendered as a complete expandable card */}
      <div className="space-y-3.5">
        {filteredFolders.length === 0 ? (
          <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs space-y-2">
            <Layers className="w-8 h-8 mx-auto text-slate-600" />
            <p className="font-semibold text-slate-400">
              {searchQuery ? `No topics match "${searchQuery}"` : 'No topics added yet'}
            </p>
            <p className="text-[11px] text-slate-500">
              Type a topic name above and click "Add Topic" to create your first DSA topic.
            </p>
          </div>
        ) : (
          filteredFolders.map((pattern) => {
            const isExpanded = !!expandedNodes[pattern.id];
            const patternQuestions = getQuestionsForFolder(pattern.id);
            const subfolders = pattern.subfolders || [];
            const hasChildren = subfolders.length > 0 || patternQuestions.length > 0;

            const totalQ = pattern.question_count || 0;

            return (
              <div
                key={pattern.id}
                className="bg-[#0D1527] border border-slate-800/90 rounded-xl p-4 shadow-md transition hover:border-slate-700/90"
              >
                {/* Topic Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/70">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div
                      onClick={() => toggleNode(pattern.id)}
                      className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-200" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-600/70 flex items-center justify-center hover:border-slate-400">
                          <ChevronRight className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div
                      onClick={() => toggleNode(pattern.id)}
                      className="cursor-pointer group select-none min-w-0"
                    >
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition truncate">
                          {pattern.name}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {subfolders.length} {subfolders.length === 1 ? 'subtopic' : 'subtopics'} • {totalQ} {totalQ === 1 ? 'problem' : 'problems'}
                        </span>
                      </div>
                      {pattern.description && (
                        <p className="text-[11px] text-slate-400 truncate max-w-lg mt-0.5">
                          {pattern.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions for this topic */}
                  <div className="flex items-center space-x-1.5 flex-wrap">
                    {/* Add Subtopic */}
                    <button
                      onClick={() => onOpenAddItem('subtopic', pattern.id)}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                      title={`Add Subtopic under "${pattern.name}"`}
                    >
                      <FolderTree className="w-3.5 h-3.5 text-blue-400" />
                      <span>Add Subtopic</span>
                    </button>

                    {/* Add Question */}
                    <button
                      onClick={() => onOpenAddItem('file', pattern.id)}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md transition"
                      title={`Add Question inside "${pattern.name}"`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Add Question</span>
                    </button>

                    {/* Edit Topic */}
                    <button
                      onClick={() => onEditFolder(pattern)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
                      title={`Edit topic "${pattern.name}"`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Topic */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(pattern.id, pattern.name);
                      }}
                      className="flex items-center space-x-1 px-2 py-1 rounded-lg text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 transition shadow-sm font-medium"
                      title={`Delete topic "${pattern.name}"`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
                {/* Expanded Tree Structure inside this topic */}
                {isExpanded && (
                  <div className="pt-2 pl-2">
                    {hasChildren ? (
                      <div className="relative pl-5 ml-2 border-l border-slate-700/50 space-y-1">
                        {/* 1. Subtopics */}
                        {subfolders.map((sub) => renderSubtopicNode(sub))}

                        {/* 2. Questions directly under root pattern */}
                        {patternQuestions.map((q) => (
                          <div
                            key={q.id}
                            onClick={() => onSelectQuestion(q.id)}
                            className="flex items-center justify-between py-1.5 px-2.5 rounded-md hover:bg-slate-800/50 cursor-pointer transition group relative before:content-[''] before:absolute before:-left-5 before:top-1/2 before:w-3.5 before:h-[1px] before:bg-slate-700/50"
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              <div className="flex-shrink-0">{renderStatusIcon(q.status)}</div>
                              <span className="text-xs text-slate-200 group-hover:text-blue-300 transition truncate font-medium">
                                {q.title}
                              </span>
                              {q.problem_url && (
                                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-blue-400 flex-shrink-0" />
                              )}
                            </div>

                            <div className="flex items-center space-x-1.5 flex-shrink-0">
                              <span
                                className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                                  difficultyColors[q.difficulty] || 'text-slate-400'
                                }`}
                              >
                                {q.difficulty}
                              </span>

                              {onToggleBookmark && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleBookmark(q.id);
                                  }}
                                  className="p-0.5 text-slate-500 hover:text-amber-400 transition"
                                  title="Bookmark"
                                >
                                  <Star
                                    className={`w-3 h-3 ${
                                      q.is_bookmarked ? 'fill-amber-400 text-amber-400' : ''
                                    }`}
                                  />
                                </button>
                              )}

                              {onDeleteQuestion && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteQuestion(q.id, q.title);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                                  title={`Delete question "${q.title}"`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-3 px-2 text-xs text-slate-500 italic flex items-center justify-between">
                        <span>No subtopics or questions in this topic yet.</span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onOpenAddItem('subtopic', pattern.id)}
                            className="text-blue-400 hover:text-blue-300 font-medium text-xs flex items-center space-x-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Subtopic</span>
                          </button>
                          <span>•</span>
                          <button
                            onClick={() => onOpenAddItem('file', pattern.id)}
                            className="text-blue-400 hover:text-blue-300 font-medium text-xs flex items-center space-x-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Question</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
