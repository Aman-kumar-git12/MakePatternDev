import React, { useState, useEffect } from 'react';
import { X, Edit2, Save } from 'lucide-react';
import type { Folder } from '../../types/dsa';

interface EditTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder;
  allFolders: Folder[];
  onUpdate: (
    folderId: string,
    updates: {
      name?: string;
      description?: string;
      tags?: string[];
      parent_id?: string | null;
    }
  ) => Promise<void>;
}

export const EditTopicModal: React.FC<EditTopicModalProps> = ({
  isOpen,
  onClose,
  folder,
  allFolders,
  onUpdate,
}) => {
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description || '');
  const [parentId, setParentId] = useState<string | null>(folder.parent_id);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(folder.name);
    setDescription(folder.description || '');
    setParentId(folder.parent_id);
  }, [folder]);

  if (!isOpen) return null;

  const isSubtopic = folder.parent_id !== null;
  const rootTopics = allFolders.filter((f) => f.parent_id === null && f.id !== folder.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSaving(true);
      await onUpdate(folder.id, {
        name: name.trim(),
        description: description.trim(),
        tags: folder.tags || [],
        parent_id: parentId,
      });
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update topic');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0D1527] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Edit2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Edit {isSubtopic ? 'Subtopic' : 'Topic'}
            </h2>
            <p className="text-xs text-slate-400">
              Update name, description, or re-parent hierarchy
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {isSubtopic ? 'Subtopic Name' : 'Topic Name'} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {!isSubtopic && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Description <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary or focus of this topic..."
                className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          {isSubtopic && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Parent Topic
              </label>
              <select
                value={parentId || ''}
                onChange={(e) => setParentId(e.target.value || null)}
                className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {rootTopics.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    📁 {rt.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-medium text-xs transition shadow-lg shadow-blue-600/30 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

