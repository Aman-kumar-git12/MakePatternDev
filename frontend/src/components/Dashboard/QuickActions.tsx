import React from 'react';
import { Zap, FolderPlus, FilePlus } from 'lucide-react';

interface QuickActionsProps {
  onNewFolder: () => void;
  onNewQuestion: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onNewFolder,
  onNewQuestion,
}) => {
  return (
    <div className="bg-[#0D1527] border border-slate-800/90 rounded-2xl p-5 shadow-lg shadow-black/20 mb-6">
      <div className="flex items-center space-x-2 mb-4">
        <Zap className="w-4 h-4 text-blue-400 fill-blue-400" />
        <h3 className="text-sm font-bold text-white">Quick Actions</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* New Folder - Blue */}
        <button
          onClick={onNewFolder}
          className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[#135BEC] hover:bg-[#1D65F5] active:scale-95 text-white font-medium text-xs shadow-lg shadow-blue-600/30 transition duration-150"
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Folder</span>
        </button>

        {/* New Question - Purple */}
        <button
          onClick={onNewQuestion}
          className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#5A52F0] active:scale-95 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition duration-150"
        >
          <FilePlus className="w-4 h-4" />
          <span>New Question</span>
        </button>
      </div>
    </div>
  );
};
