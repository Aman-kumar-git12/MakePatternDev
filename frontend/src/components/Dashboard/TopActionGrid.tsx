import React from 'react';
import { FileText, Link2, Bookmark, ChevronRight } from 'lucide-react';

interface TopActionGridProps {
  onNewFolder: () => void;
  onNewQuestion: () => void;
  onImportLeetCode: () => void;
  onViewBookmarks: () => void;
}

export const TopActionGrid: React.FC<TopActionGridProps> = ({
  onNewFolder,
  onNewQuestion,
  onImportLeetCode,
  onViewBookmarks,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 h-full">
      {/* 1. New Folder */}
      <div
        onClick={onNewFolder}
        className="p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C35] border border-slate-800/90 hover:border-blue-500/30 shadow-lg shadow-black/20 cursor-pointer transition duration-150 flex flex-col justify-between group"
      >
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-xl bg-[#14254D] border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
            <FileText className="w-4 h-4" />
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition" />
        </div>
        <div className="mt-3">
          <h4 className="text-xs font-bold text-white group-hover:text-blue-300 transition">
            New Folder
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Organize your topics</p>
        </div>
      </div>

      {/* 2. New Question */}
      <div
        onClick={onNewQuestion}
        className="p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C35] border border-slate-800/90 hover:border-purple-500/30 shadow-lg shadow-black/20 cursor-pointer transition duration-150 flex flex-col justify-between group"
      >
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-xl bg-[#29174D] border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:scale-105 transition">
            <FileText className="w-4 h-4" />
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 transition" />
        </div>
        <div className="mt-3">
          <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition">
            New Question
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Add a problem</p>
        </div>
      </div>

      {/* 3. Import from LeetCode */}
      <div
        onClick={onImportLeetCode}
        className="p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C35] border border-slate-800/90 hover:border-emerald-500/30 shadow-lg shadow-black/20 cursor-pointer transition duration-150 flex flex-col justify-between group"
      >
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-xl bg-[#0D2D31] border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
            <Link2 className="w-4 h-4" />
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition" />
        </div>
        <div className="mt-3">
          <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
            Import from LeetCode
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Sync your progress</p>
        </div>
      </div>

      {/* 4. View Bookmarks */}
      <div
        onClick={onViewBookmarks}
        className="p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C35] border border-slate-800/90 hover:border-blue-500/30 shadow-lg shadow-black/20 cursor-pointer transition duration-150 flex flex-col justify-between group"
      >
        <div className="flex items-start justify-between">
          <div className="w-9 h-9 rounded-xl bg-[#14254D] border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
            <Bookmark className="w-4 h-4" />
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition" />
        </div>
        <div className="mt-3">
          <h4 className="text-xs font-bold text-white group-hover:text-blue-300 transition">
            View Bookmarks
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Go to saved questions</p>
        </div>
      </div>
    </div>
  );
};
