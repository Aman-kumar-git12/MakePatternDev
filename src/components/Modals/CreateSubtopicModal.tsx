import React, { useState, useEffect } from 'react';
import { X, FolderTree, Sparkles, Loader2 } from 'lucide-react';
import type { Folder } from '../../types/dsa';

interface CreateSubtopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialParentId?: string;
  folders: Folder[];
  onCreateSubtopic: (name: string, parentId: string, description?: string, tags?: string[]) => Promise<void>;
}

export const CreateSubtopicModal: React.FC<CreateSubtopicModalProps> = ({
  isOpen,
  onClose,
  initialParentId,
  folders,
  onCreateSubtopic,
}) => {
  const [parentFolderId, setParentFolderId] = useState<string>('');
  const [subtopicName, setSubtopicName] = useState('');
  const [description, setDescription] = useState('');
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
      if (initialParentId) {
        setParentFolderId(initialParentId);
      } else if (flatList.length > 0) {
        setParentFolderId(flatList[0].id);
      }
    }
  }, [isOpen, initialParentId, folders]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentFolderId) {
      setError('Please select a parent topic for this subtopic');
      return;
    }
    if (!subtopicName.trim()) {
      setError('Subtopic name is required');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onCreateSubtopic(subtopicName.trim(), parentFolderId, description.trim(), []);
      // Reset form
      setSubtopicName('');
      setDescription('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create subtopic');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-lg bg-[#0C1222] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/80 text-slate-100">
        {/* Top Accent Glow */}
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shadow-md">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create New Subtopic</h2>
              <p className="text-xs text-slate-400">
                Organize problems under a parent category or pattern
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

        {/* Form - purely for subtopic creation */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="parent-folder">
              Parent Topic / Category <span className="text-rose-400">*</span>
            </label>
            <select
              id="parent-folder"
              required
              value={parentFolderId}
              onChange={(e) => setParentFolderId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#090E1A] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
            >
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
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="subtopic-name">
              Subtopic Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="subtopic-name"
              type="text"
              required
              autoFocus
              value={subtopicName}
              onChange={(e) => setSubtopicName(e.target.value)}
              placeholder="e.g. Sliding Window, Two Pointers, In-Order Traversal"
              className="w-full px-3.5 py-2.5 bg-[#090E1A] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="subtopic-desc">
              Description <span className="text-slate-500 text-[11px] font-normal">(Optional)</span>
            </label>
            <textarea
              id="subtopic-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key pattern concepts, techniques, or tips..."
              className="w-full px-3.5 py-2 bg-[#090E1A] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition shadow-inner resize-none"
            />
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
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Subtopic</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

