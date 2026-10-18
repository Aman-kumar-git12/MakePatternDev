import React from 'react';
import { Folder as FolderIcon, ChevronRight } from 'lucide-react';
import type { FolderProgressItem } from '../../types/dsa';

interface FolderProgressOverviewProps {
  folders: FolderProgressItem[];
  onViewAll: () => void;
  onSelectFolder?: (folderId: string) => void;
}

export const FolderProgressOverview: React.FC<FolderProgressOverviewProps> = ({
  folders,
  onViewAll,
  onSelectFolder,
}) => {
  return (
    <div className="bg-[#0D1527] border border-slate-800/90 rounded-2xl p-5 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FolderIcon className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Your Folders</h3>
        </div>
        <button
          onClick={onViewAll}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1 transition"
        >
          <span>View All</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {folders.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No folders created yet.
          </div>
        ) : (
          folders.slice(0, 3).map((f) => (
            <div
              key={f.folder_id}
              onClick={() => onSelectFolder && onSelectFolder(f.folder_id)}
              className="p-3 rounded-xl bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800/60 hover:border-slate-700 cursor-pointer transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <FolderIcon className="w-5 h-5 text-[#38bdf8] fill-[#38bdf8]/80 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition truncate">
                  {f.folder_name}
                </span>
              </div>

              <div className="flex items-center space-x-3.5 flex-shrink-0">
                <span className="text-xs text-slate-400 font-normal">
                  {f.solved_questions} / {f.total_questions}
                </span>

                <div className="w-24 sm:w-36 h-2 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full bg-[#1D6BF3] rounded-full transition-all duration-300 shadow-sm shadow-blue-500/50"
                    style={{ width: `${Math.max(f.progress_percentage, 8)}%` }}
                  />
                </div>

                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
