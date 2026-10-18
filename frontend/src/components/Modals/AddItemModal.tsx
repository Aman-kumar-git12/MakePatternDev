import React, { useState, useEffect } from 'react';
import { X, FolderPlus, FileCode, Tag, Link2, Sparkles, FolderTree } from 'lucide-react';
import type { Folder, Difficulty, QuestionStatus } from '../../types/dsa';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'topic' | 'subtopic' | 'file';
  initialFolderId?: string;
  folders: Folder[];
  onCreateFolder: (name: string, parentId: string | null, description?: string, tags?: string[]) => Promise<void>;
  onCreateQuestion: (data: {
    folder_id: string;
    title: string;
    problem_url?: string;
    difficulty: Difficulty;
    status: QuestionStatus;
    tags: string[];
    problem_statement: string;
    notes?: string;
  }) => Promise<void>;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  initialType = 'file',
  initialFolderId,
  folders,
  onCreateFolder,
  onCreateQuestion,
}) => {
  const [itemType, setItemType] = useState<'topic' | 'subtopic' | 'file'>(initialType);

  // Topic & Subtopic form state
  const [subtopicName, setSubtopicName] = useState('');
  const [topicName, setTopicName] = useState('');
  const [topicDescription, setTopicDescription] = useState('');
  const [parentFolderId, setParentFolderId] = useState<string>('');

  // Subtopic Tags
  const [subtopicTagInput, setSubtopicTagInput] = useState('');
  const [subtopicTags, setSubtopicTags] = useState<string[]>([]);

  // Topic Tags
  const [topicTagInput, setTopicTagInput] = useState('');
  const [topicTags, setTopicTags] = useState<string[]>([]);

  // Question form state
  const [questionTitle, setQuestionTitle] = useState('');
  const [problemUrl, setProblemUrl] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [status, setStatus] = useState<QuestionStatus>('Not Started');
  const [questionTagInput, setQuestionTagInput] = useState('');
  const [questionTags, setQuestionTags] = useState<string[]>([]);
  const [explanationNotes, setExplanationNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Flatten folders for select dropdown
  const flattenFolders = (
    list: Folder[],
    depth = 0
  ): Array<{ id: string; name: string; depth: number; isRoot: boolean }> => {
    let result: Array<{ id: string; name: string; depth: number; isRoot: boolean }> = [];
    for (const f of list) {
      result.push({ id: f.id, name: f.name, depth, isRoot: f.parent_id === null });
      if (f.subfolders && f.subfolders.length > 0) {
        result = result.concat(flattenFolders(f.subfolders, depth + 1));
      }
    }
    return result;
  };

  const flatList = flattenFolders(folders);
  const rootTopics = folders.filter((f) => f.parent_id === null);

  useEffect(() => {
    if (isOpen) {
      setItemType(initialType);
      if (initialFolderId) {
        setParentFolderId(initialFolderId);
        setSelectedFolderId(initialFolderId);
      } else {
        if (rootTopics.length > 0) {
          setParentFolderId(rootTopics[0].id);
        }
        if (flatList.length > 0) {
          setSelectedFolderId(flatList[0].id);
        }
      }
    }
  }, [isOpen, initialType, initialFolderId, folders]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (itemType === 'topic') {
        if (!topicName.trim()) return;
        await onCreateFolder(topicName.trim(), null, topicDescription.trim(), topicTags);
        setTopicName('');
        setTopicDescription('');
        setTopicTags([]);
      } else if (itemType === 'subtopic') {
        if (!subtopicName.trim()) return;
        const targetParent = parentFolderId || (rootTopics[0]?.id ?? null);
        if (!targetParent) {
          alert('Please select a parent topic for this subtopic.');
          setIsSubmitting(false);
          return;
        }
        await onCreateFolder(subtopicName.trim(), targetParent, '', subtopicTags);
        setSubtopicName('');
        setSubtopicTags([]);
      } else {
        if (!questionTitle.trim()) return;
        const targetFolder = selectedFolderId || (flatList[0]?.id ?? '');
        if (!targetFolder) {
          alert('Please select a topic or subtopic for this question.');
          setIsSubmitting(false);
          return;
        }

        await onCreateQuestion({
          title: questionTitle.trim(),
          folder_id: targetFolder,
          problem_url: problemUrl.trim(),
          difficulty,
          status,
          tags: questionTags,
          problem_statement: '',
          notes: explanationNotes.trim(),
        });
        setQuestionTitle('');
        setProblemUrl('');
        setExplanationNotes('');
        setQuestionTags([]);
      }
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0D1527] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-100 max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            {itemType === 'topic' ? (
              <FolderPlus className="w-5 h-5" />
            ) : itemType === 'subtopic' ? (
              <FolderTree className="w-5 h-5" />
            ) : (
              <FileCode className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {itemType === 'subtopic'
                ? 'Add Subtopic'
                : itemType === 'topic'
                ? 'Create New Topic'
                : 'Add Question File'}
            </h2>
            <p className="text-xs text-slate-400">
              {itemType === 'subtopic'
                ? 'Add a specialized pattern or category under a topic'
                : itemType === 'topic'
                ? 'Create a top-level DSA topic to organize patterns'
                : 'Add a new problem with notes, solutions, and test cases'}
            </p>
          </div>
        </div>

        {/* 3-Way Mode Switcher */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#090F1D] border border-slate-800 rounded-xl mb-4">
          <button
            type="button"
            onClick={() => setItemType('subtopic')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              itemType === 'subtopic'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Subtopic</span>
          </button>

          <button
            type="button"
            onClick={() => setItemType('file')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              itemType === 'file'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Question</span>
          </button>

          <button
            type="button"
            onClick={() => setItemType('topic')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              itemType === 'topic'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Main Topic</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SUBTOPIC FORM (Strictly contains: 1. Subtopic Name, 2. Parent Topic, 3. Tags) */}
          {itemType === 'subtopic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Subtopic Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subtopicName}
                  onChange={(e) => setSubtopicName(e.target.value)}
                  placeholder="e.g. Two Pointers, Sliding Window, DFS, Knapsack"
                  className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Parent Topic <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={parentFolderId}
                  onChange={(e) => setParentFolderId(e.target.value)}
                  className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="" disabled>Select parent topic...</option>
                  {rootTopics.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      📁 {rt.name}
                    </option>
                  ))}
                  {rootTopics.length === 0 && (
                    <option value="" disabled>No topics available yet. Please create a main topic first.</option>
                  )}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Preselected topic where this subtopic will reside.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tags <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={subtopicTagInput}
                    onChange={(e) => setSubtopicTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (subtopicTagInput.trim() && !subtopicTags.includes(subtopicTagInput.trim())) {
                          setSubtopicTags([...subtopicTags, subtopicTagInput.trim()]);
                          setSubtopicTagInput('');
                        }
                      }
                    }}
                    placeholder="Type tag and press Enter (e.g. Pattern, Fast-Slow)"
                    className="flex-1 bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (subtopicTagInput.trim() && !subtopicTags.includes(subtopicTagInput.trim())) {
                        setSubtopicTags([...subtopicTags, subtopicTagInput.trim()]);
                        setSubtopicTagInput('');
                      }
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-xl transition"
                  >
                    Add
                  </button>
                </div>
                {subtopicTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {subtopicTags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px]"
                      >
                        <Tag className="w-3 h-3" />
                        <span>{t}</span>
                        <button
                          type="button"
                          onClick={() => setSubtopicTags(subtopicTags.filter((tag) => tag !== t))}
                          className="hover:text-rose-400 ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TOPIC FORM (Topic Name, Description, Tags) */}
          {itemType === 'topic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Topic Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  placeholder="e.g. Arrays, Strings, Trees, Dynamic Programming"
                  className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Description <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={topicDescription}
                  onChange={(e) => setTopicDescription(e.target.value)}
                  placeholder="Brief summary or focus of this topic..."
                  className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tags <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={topicTagInput}
                    onChange={(e) => setTopicTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (topicTagInput.trim() && !topicTags.includes(topicTagInput.trim())) {
                          setTopicTags([...topicTags, topicTagInput.trim()]);
                          setTopicTagInput('');
                        }
                      }
                    }}
                    placeholder="e.g. Core, Linear, Advanced"
                    className="flex-1 bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (topicTagInput.trim() && !topicTags.includes(topicTagInput.trim())) {
                        setTopicTags([...topicTags, topicTagInput.trim()]);
                        setTopicTagInput('');
                      }
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-xl transition"
                  >
                    Add
                  </button>
                </div>
                {topicTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {topicTags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px]"
                      >
                        <Tag className="w-3 h-3" />
                        <span>{t}</span>
                        <button
                          type="button"
                          onClick={() => setTopicTags(topicTags.filter((tag) => tag !== t))}
                          className="hover:text-rose-400 ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QUESTION FORM */}
          {itemType === 'file' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Question Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={questionTitle}
                  onChange={(e) => setQuestionTitle(e.target.value)}
                  placeholder="e.g. Longest Substring Without Repeating Characters"
                  className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Parent Topic or Subtopic <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {flatList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {'\u00A0'.repeat(f.depth * 3)}{f.depth > 0 ? '↳ ' : '📁 '}{f.name}
                    </option>
                  ))}
                  {flatList.length === 0 && (
                    <option value="" disabled>No topics available yet.</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Question Link (URL)</span>
                  <span className="text-slate-500 font-normal">Optional</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Link2 className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="url"
                    value={problemUrl}
                    onChange={(e) => setProblemUrl(e.target.value)}
                    placeholder="https://leetcode.com/problems/..."
                    className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Will appear prominently as an "Open Problem" button on the question page.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Difficulty <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                    className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="Easy">🟢 Easy</option>
                    <option value="Medium">🟠 Medium</option>
                    <option value="Hard">🔴 Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Status <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as QuestionStatus)}
                    className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="Not Started">⚪ Not Started</option>
                    <option value="In Progress">🔵 In Progress</option>
                    <option value="Solved">🟢 Solved</option>
                    <option value="Needs Revision">🟠 Needs Revision</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Explanation / Step-by-Step Notes <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={explanationNotes}
                  onChange={(e) => setExplanationNotes(e.target.value)}
                  placeholder="Document step-by-step notes or algorithmic intuition..."
                  className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tags <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={questionTagInput}
                    onChange={(e) => setQuestionTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (questionTagInput.trim() && !questionTags.includes(questionTagInput.trim())) {
                          setQuestionTags([...questionTags, questionTagInput.trim()]);
                          setQuestionTagInput('');
                        }
                      }
                    }}
                    placeholder="e.g. Array, Two Pointers, LeetCode 75"
                    className="flex-1 bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (questionTagInput.trim() && !questionTags.includes(questionTagInput.trim())) {
                        setQuestionTags([...questionTags, questionTagInput.trim()]);
                        setQuestionTagInput('');
                      }
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-xl transition"
                  >
                    Add
                  </button>
                </div>
                {questionTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {questionTags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px]"
                      >
                        <Tag className="w-3 h-3" />
                        <span>{t}</span>
                        <button
                          type="button"
                          onClick={() => setQuestionTags(questionTags.filter((tag) => tag !== t))}
                          className="hover:text-rose-400 ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-medium text-xs transition shadow-lg shadow-blue-600/30 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? 'Creating...'
                  : itemType === 'subtopic'
                  ? 'Create Subtopic'
                  : itemType === 'topic'
                  ? 'Create Topic'
                  : 'Create Question'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
