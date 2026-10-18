import React, { useState } from 'react';
import { X, FileCode, Plus, Tag } from 'lucide-react';
import type { Folder, Difficulty, QuestionStatus } from '../../types/dsa';

interface NewQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    folder_id: string;
    title: string;
    difficulty: Difficulty;
    status: QuestionStatus;
    tags: string[];
    problem_statement: string;
  }) => Promise<void>;
  folders: Folder[];
  initialFolderId?: string;
}

export const NewQuestionModal: React.FC<NewQuestionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  folders,
  initialFolderId,
}) => {
  // Flatten folders to select target
  const flattenFolders = (list: Folder[], depth = 0): Array<{ id: string; name: string; depth: number }> => {
    let result: Array<{ id: string; name: string; depth: number }> = [];
    for (const f of list) {
      result.push({ id: f.id, name: f.name, depth });
      if (f.subfolders && f.subfolders.length > 0) {
        result = result.concat(flattenFolders(f.subfolders, depth + 1));
      }
    }
    return result;
  };

  const flatList = flattenFolders(folders);

  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState(initialFolderId || (flatList[0]?.id || ''));
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [status, setStatus] = useState<QuestionStatus>('Not Started');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['Array']);
  const [problemStatement, setProblemStatement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (initialFolderId) {
      setFolderId(initialFolderId);
    } else if ((!folderId || !flatList.some((f) => f.id === folderId)) && flatList.length > 0) {
      setFolderId(flatList[0].id);
    }
  }, [initialFolderId, flatList, folderId]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !folderId) return;

    try {
      setIsSubmitting(true);
      await onSubmit({
        title: title.trim(),
        folder_id: folderId,
        difficulty,
        status,
        tags,
        problem_statement: problemStatement.trim(),
      });
      setTitle('');
      setProblemStatement('');
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create question');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0D1527] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <FileCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Create New Question</h2>
            <p className="text-xs text-slate-400">Add a DSA problem with solutions & notes</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Question Title *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Trapping Rain Water, LRU Cache, Subarray Sum Equals K"
              className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Folder Location *
            </label>
            <select
              required
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              {flatList.map((f) => (
                <option key={f.id} value={f.id}>
                  {'\u00A0'.repeat(f.depth * 4)}📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="Easy">🟢 Easy</option>
                <option value="Medium">🟡 Medium</option>
                <option value="Hard">🔴 Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as QuestionStatus)}
                className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="Not Started">⚪ Not Started</option>
                <option value="In Progress">🔵 In Progress</option>
                <option value="Solved">🟢 Solved</option>
                <option value="Needs Revision">🟠 Needs Revision</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Tags
            </label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag and press Enter"
                className="flex-1 bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs"
                >
                  <Tag className="w-3 h-3" />
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-white ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Problem Statement (Optional)
            </label>
            <textarea
              rows={3}
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              placeholder="Paste problem description, inputs, and constraints..."
              className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !folderId}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-medium text-sm transition shadow-lg shadow-purple-600/30 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
