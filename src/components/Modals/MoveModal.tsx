import React, { useState } from 'react';
import { X, ArrowRightLeft, AlertCircle } from 'lucide-react';
import type { Folder } from '../../types/dsa';

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'folder' | 'question';
  itemId: string;
  itemTitle: string;
  folders: Folder[];
  onSubmit: (targetFolderId: string | null) => Promise<void>;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  isOpen,
  onClose,
  type,
  itemId,
  itemTitle,
  folders,
  onSubmit,
}) => {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Collect all descendant ids of the folder being moved so we can disable them!
  const getDescendantIds = (folderId: string): Set<string> => {
    const descendants = new Set<string>();
    const findChildren = (list: Folder[]) => {
      for (const f of list) {
        if (f.id === folderId) {
          const collect = (children: Folder[]) => {
            for (const c of children) {
              descendants.add(c.id);
              if (c.subfolders) collect(c.subfolders);
            }
          };
          if (f.subfolders) collect(f.subfolders);
          return;
        }
        if (f.subfolders) findChildren(f.subfolders);
      }
    };
    findChildren(folders);
    return descendants;
  };

  const forbiddenIds = type === 'folder' ? new Set([itemId, ...getDescendantIds(itemId)]) : new Set<string>();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (type === 'folder' && targetId && forbiddenIds.has(targetId)) {
      setErrorMsg('Cannot move folder into itself or one of its subfolders.');
      return;
    }

    if (type === 'question' && !targetId) {
      setErrorMsg('A question must belong to a folder.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(targetId);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Move operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0D1527] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="p-2.5 rounded-xl bg-[#fef08a]/20 text-yellow-300 border border-[#fef08a]/35">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Move {type === 'folder' ? 'Folder' : 'Question'}
            </h2>
            <p className="text-xs text-slate-400 truncate max-w-xs">{itemTitle}</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Destination Folder
            </label>
            <select
              value={targetId || ''}
              onChange={(e) => setTargetId(e.target.value ? e.target.value : null)}
              className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-yellow-300 transition"
            >
              {type === 'folder' && <option value="">(Root Level)</option>}
              {flatList.map((f) => {
                const isForbidden = forbiddenIds.has(f.id);
                return (
                  <option key={f.id} value={f.id} disabled={isForbidden}>
                    {'\u00A0'.repeat(f.depth * 4)}📁 {f.name} {isForbidden ? '(Invalid target)' : ''}
                  </option>
                );
              })}
            </select>
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
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#fef08a] hover:bg-[#fef9c3] active:scale-95 text-[#18181b] font-semibold text-sm transition shadow-md shadow-yellow-200/30 disabled:opacity-50"
            >
              {isSubmitting ? 'Moving...' : 'Confirm Move'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
