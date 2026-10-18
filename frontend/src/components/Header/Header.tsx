import React from 'react';
import { Search, Sun, Bell, ChevronDown, Plus, Menu } from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNewQuestion?: () => void;
  onToggleMobileMenu?: () => void;
  userName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenNewQuestion,
  onToggleMobileMenu,
  userName = 'Aman Kumar',
}) => {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#080D1A]/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      {/* Mobile Menu & Search Bar */}
      <div className="flex items-center space-x-3 w-full max-w-xl">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
            title="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-[#0D1527] hover:bg-[#111A30] border border-slate-800/90 rounded-full text-slate-400 text-xs transition duration-150 group shadow-inner"
        >
          <div className="flex items-center space-x-2.5">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition" />
            <span className="text-slate-400 group-hover:text-slate-300 transition text-[13px] truncate">
              Search questions, topics, or folders...
            </span>
          </div>
          <span className="text-[10px] bg-slate-800/90 border border-slate-700/80 text-slate-300 px-2 py-0.5 rounded-md font-mono hidden sm:inline-block">
            ⌘K
          </span>
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-3.5">
        {/* Quick New Question Button */}
        {onOpenNewQuestion && (
          <button
            onClick={onOpenNewQuestion}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition"
            title="Create New Question"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Question</span>
          </button>
        )}

        {/* Theme button */}
        <button
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          title="Toggle Theme"
        >
          <Sun className="w-4 h-4" />
        </button>

        {/* Notification Bell with red dot */}
        <button
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#080D1A]" />
        </button>

        {/* User Avatar badge matching screenshot */}
        <div className="flex items-center space-x-2.5 pl-2 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-semibold text-xs flex items-center justify-center shadow-md shadow-blue-500/20">
            {userName.charAt(0)}
          </div>
          <span className="text-xs font-medium text-slate-200 group-hover:text-white transition">
            {userName}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition" />
        </div>
      </div>
    </header>
  );
};
