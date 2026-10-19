import React, { useState, useEffect } from 'react';
import { X, FileCode, Link2, Sparkles, Loader2 } from 'lucide-react';
import type { Folder, Difficulty, QuestionStatus } from '../../types/dsa';

interface CreateQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFolderId?: string;
  folders: Folder[];
  onCreateQuestion: (data: {
    folder_id?: string | null;
    title: string;
    problem_url?: string;
    difficulty: Difficulty;
    status: QuestionStatus;
    tags: string[];
    problem_statement: string;
    notes?: string;
  }) => Promise<void>;
}

export const CreateQuestionModal: React.FC<CreateQuestionModalProps> = ({
  isOpen,
  onClose,
  initialFolderId,
  folders,
  onCreateQuestion,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [problemUrl, setProblemUrl] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [status, setStatus] = useState<QuestionStatus>('Not Started');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flatten folders for the select dropdown
  const flattenFolders = (
    list: Folder[],
    depth = 0
  ): Array<{ id: string; name: string; depth: number }> => {
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

  useEffect(() => {
    if (isOpen) {
      if (initialFolderId) {
        setSelectedFolderId(initialFolderId);
      } else {
        setSelectedFolderId('');
      }
    }
  }, [isOpen, initialFolderId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Problem title is required');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onCreateQuestion({
        folder_id: selectedFolderId || undefined,
        title: title.trim(),
        problem_url: problemUrl.trim() || undefined,
        difficulty,
        status,
        tags: [],
        problem_statement: '',
        notes: '',
      });
      // Reset form
      setTitle('');
      setProblemUrl('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add problem');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-lg bg-[#0C1222] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/80 text-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Top Accent Glow */}
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-md">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Add New Problem</h2>
              <p className="text-xs text-slate-400">
                Track a coding question with difficulty, solutions, and notes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Form - purely for problem creation */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="problem-folder">
              Destination Topic / Subtopic <span className="text-slate-400 font-normal">(Optional — defaults to All Questions only)</span>
            </label>
            <select
              id="problem-folder"
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#090E1A] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition cursor-pointer"
            >
              <option value="">📂 None (All Questions only — not in pattern)</option>
              {flatList.map((f) => (
                <option key={f.id} value={f.id}>
                  {'\u00A0'.repeat(f.depth * 4)}
                  {f.depth > 0 ? '↳ ' : '📁 '}
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="problem-title">
              Problem Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="problem-title"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Two Sum, Valid Parentheses, LRU Cache"
              className="w-full px-3.5 py-2.5 bg-[#090E1A] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-inner"
            />
          </div>

          {/* Difficulty & Status Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Difficulty</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((d) => {
                  const active = difficulty === d;
                  const activeStyles =
                    d === 'Easy'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                      : d === 'Medium'
                      ? 'bg-[#fef08a]/25 text-yellow-300 border-[#fef08a]/50'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/50';

                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`py-1.5 text-center text-xs font-semibold rounded-lg border transition ${
                        active ? activeStyles : 'bg-[#090E1A] text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="problem-status">
                Initial Status
              </label>
              <select
                id="problem-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as QuestionStatus)}
                className="w-full px-3 py-2 bg-[#090E1A] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="Not Started">⚪ Not Started</option>
                <option value="In Progress">🔵 In Progress</option>
                <option value="Solved">🟢 Solved</option>
                <option value="Needs Revision">🟠 Needs Revision</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="problem-url">
              Problem URL <span className="text-slate-500 text-[11px] font-normal">(LeetCode, Codeforces, etc.)</span>
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                id="problem-url"
                type="url"
                value={problemUrl}
                onChange={(e) => setProblemUrl(e.target.value)}
                placeholder="https://leetcode.com/problems/..."
                className="w-full pl-9 pr-3.5 py-2 bg-[#090E1A] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
              />
            </div>
          </div>



          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Add Problem</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
