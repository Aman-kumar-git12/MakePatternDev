import React, { useState } from 'react';
import { X, Link2, Sparkles, CheckCircle } from 'lucide-react';
import type { Folder, Difficulty, QuestionStatus } from '../../types/dsa';

interface ImportLeetCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onImport: (data: {
    folder_id: string;
    title: string;
    difficulty: Difficulty;
    status: QuestionStatus;
    tags: string[];
    problem_statement: string;
  }) => Promise<void>;
}

export const ImportLeetCodeModal: React.FC<ImportLeetCodeModalProps> = ({
  isOpen,
  onClose,
  folders,
  onImport,
}) => {
  const [urlOrSlug, setUrlOrSlug] = useState('');
  const [folderId, setFolderId] = useState(folders[0]?.id || '');
  const [isImporting, setIsImporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  if (!isOpen) return null;

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

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlOrSlug.trim() || !folderId) return;

    try {
      setIsImporting(true);

      // Clean slug from URL if pasted (e.g. https://leetcode.com/problems/container-with-most-water/)
      let slug = urlOrSlug.trim();
      if (slug.includes('/problems/')) {
        slug = slug.split('/problems/')[1].split('/')[0];
      }
      // Format human-friendly title
      const title = slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());

      await onImport({
        folder_id: folderId,
        title,
        difficulty: 'Medium',
        status: 'In Progress',
        tags: ['LeetCode', 'Algorithms'],
        problem_statement: `Imported from LeetCode (${slug}).\n\nProblem URL: https://leetcode.com/problems/${slug}/`,
      });

      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        setUrlOrSlug('');
        onClose();
      }, 1000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
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
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Import from LeetCode</h2>
            <p className="text-xs text-slate-400">Sync problems and add to your DSA folders</p>
          </div>
        </div>

        {successMsg ? (
          <div className="py-8 text-center text-emerald-400 space-y-2">
            <CheckCircle className="w-10 h-10 mx-auto" />
            <p className="text-sm font-semibold">Problem imported successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                LeetCode URL or Problem Slug *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={urlOrSlug}
                onChange={(e) => setUrlOrSlug(e.target.value)}
                placeholder="e.g. https://leetcode.com/problems/trapping-rain-water/ or 3sum"
                className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Target Folder *
              </label>
              <select
                required
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              >
                {flatList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {'\u00A0'.repeat(f.depth * 4)}📁 {f.name}
                  </option>
                ))}
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
                disabled={isImporting || !urlOrSlug.trim() || !folderId}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-medium text-sm transition shadow-lg shadow-emerald-600/30 flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isImporting ? 'Importing...' : 'Import Problem'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
