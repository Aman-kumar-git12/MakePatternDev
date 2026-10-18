import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
  MoreVertical,
  Plus,
  Edit2,
  ArrowRightLeft,
  Trash2,
} from 'lucide-react';
import type { Folder } from '../../types/dsa';

interface FolderTreeItemProps {
  folder: Folder;
  depth?: number;
  activeQuestionId: string | null;
  expandedFolderIds: Set<string>;
  onToggleExpand: (folderId: string) => void;
  onSelectQuestion: (questionId: string) => void;
  onAddSubfolder: (parentId: string) => void;
  onAddQuestion: (folderId: string) => void;
  onRenameFolder: (folderId: string, currentName: string) => void;
  onMoveFolder: (folderId: string, folderName: string) => void;
  onDeleteFolder: (folderId: string, folderName: string) => void;
  onRenameQuestion: (questionId: string, currentTitle: string) => void;
  onMoveQuestion: (questionId: string, questionTitle: string) => void;
  onDeleteQuestion: (questionId: string, questionTitle: string) => void;
  onToggleBookmark: (questionId: string) => void;
}

export const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folder,
  depth = 0,
  activeQuestionId,
  expandedFolderIds,
  onToggleExpand,
  onSelectQuestion,
  onAddSubfolder,
  onAddQuestion,
  onRenameFolder,
  onMoveFolder,
  onDeleteFolder,
  onRenameQuestion,
  onMoveQuestion,
  onDeleteQuestion,
  onToggleBookmark,
}) => {
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);

  const isExpanded = expandedFolderIds.has(folder.id);
  const hasSubfolders = folder.subfolders && folder.subfolders.length > 0;

  return (
    <div className="select-none text-xs">
      {/* Folder Row */}
      <div
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className="group relative flex items-center justify-between py-1.5 pr-2 rounded-lg hover:bg-slate-800/60 transition cursor-pointer text-slate-300 hover:text-white"
        onClick={() => onToggleExpand(folder.id)}
      >
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {/* Chevron */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(folder.id);
            }}
            className="p-0.5 text-slate-400 hover:text-white transition flex-shrink-0"
          >
            {hasSubfolders ? (
              isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
              )
            ) : (
              <span className="w-3.5 inline-block" />
            )}
          </button>

          {/* Folder Icon - vivid sky-blue filled like screenshot */}
          {isExpanded && hasSubfolders ? (
            <FolderOpen className="w-4 h-4 text-[#38bdf8] fill-[#38bdf8]/60 flex-shrink-0" />
          ) : (
            <FolderIcon className="w-4 h-4 text-[#38bdf8] fill-[#38bdf8]/80 flex-shrink-0" />
          )}

          {/* Folder Name */}
          <span className="truncate font-medium text-slate-300 group-hover:text-white text-xs">
            {folder.name}
          </span>
        </div>

        {/* Action Controls */}
        <div
          className="flex items-center space-x-1 flex-shrink-0 ml-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Add Question/Subfolder Button */}
          <button
            onClick={() => onAddQuestion(folder.id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded transition"
            title="Add Question to this folder"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Context Menu Button */}
          <div className="relative">
            <button
              onClick={() => setFolderMenuOpen(!folderMenuOpen)}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded transition"
              title="Folder options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {folderMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setFolderMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-44 bg-[#0F172A] border border-slate-700 rounded-xl shadow-2xl py-1 z-50 text-slate-200 text-xs">
                  <button
                    onClick={() => {
                      setFolderMenuOpen(false);
                      onAddQuestion(folder.id);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center space-x-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Question</span>
                  </button>
                  <button
                    onClick={() => {
                      setFolderMenuOpen(false);
                      onAddSubfolder(folder.id);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center space-x-2"
                  >
                    <FolderIcon className="w-3.5 h-3.5" />
                    <span>New Subfolder</span>
                  </button>
                  <button
                    onClick={() => {
                      setFolderMenuOpen(false);
                      onRenameFolder(folder.id, folder.name);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center space-x-2"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Rename</span>
                  </button>
                  <button
                    onClick={() => {
                      setFolderMenuOpen(false);
                      onMoveFolder(folder.id, folder.name);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center space-x-2"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Move Folder</span>
                  </button>
                  <div className="border-t border-slate-800 my-1" />
                  <button
                    onClick={() => {
                      setFolderMenuOpen(false);
                      onDeleteFolder(folder.id, folder.name);
                    }}
                    className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-600 hover:text-white flex items-center space-x-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Children: Subfolders only (No questions rendered in sidebar tree) */}
      {isExpanded && hasSubfolders && (
        <div className="space-y-0.5">
          {folder.subfolders!.map((sub) => (
            <FolderTreeItem
              key={sub.id}
              folder={sub}
              depth={depth + 1}
              activeQuestionId={activeQuestionId}
              expandedFolderIds={expandedFolderIds}
              onToggleExpand={onToggleExpand}
              onSelectQuestion={onSelectQuestion}
              onAddSubfolder={onAddSubfolder}
              onAddQuestion={onAddQuestion}
              onRenameFolder={onRenameFolder}
              onMoveFolder={onMoveFolder}
              onDeleteFolder={onDeleteFolder}
              onRenameQuestion={onRenameQuestion}
              onMoveQuestion={onMoveQuestion}
              onDeleteQuestion={onDeleteQuestion}
              onToggleBookmark={onToggleBookmark}
            />
          ))}
        </div>
      )}
    </div>
  );
};
