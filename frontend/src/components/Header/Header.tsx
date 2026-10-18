import React, { useState, useRef, useEffect } from 'react';
import { Search, Sun, Bell, ChevronDown, Plus, Menu, LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';
import type { User } from '../../types/dsa';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNewQuestion?: () => void;
  onToggleMobileMenu?: () => void;
  user?: User | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenNewQuestion,
  onToggleMobileMenu,
  user,
  onLogout,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userName = user?.full_name || 'Aman Kumar';
  const userEmail = user?.email || 'aman@makepattern.dev';

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isDropdownOpen]);

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

        {/* Notification Bell with indicator */}
        <button
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#080D1A]" />
        </button>

        {/* User Profile & Interactive Dropdown */}
        <div className="relative pl-1" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center space-x-2.5 p-1 rounded-xl hover:bg-slate-800/50 transition cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-blue-500/20 ring-1 ring-blue-500/30">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-slate-200 group-hover:text-white transition hidden sm:inline-block max-w-[120px] truncate">
              {userName}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180 text-blue-400' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0C1222] border border-slate-800/90 shadow-2xl shadow-black/80 p-2 z-50 animate-fade-in divide-y divide-slate-800/80">
              <div className="px-3 py-2.5">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-semibold text-xs text-white truncate">{userName}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono truncate">{userEmail}</div>
                <div className="mt-2 flex items-center space-x-1.5 text-[10px] text-blue-400">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Authenticated Session</span>
                </div>
              </div>

              <div className="pt-1.5 pb-1">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Account
                </div>
                <div className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-slate-800/50 transition">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Curriculum Learner</span>
                </div>
              </div>

              {onLogout && (
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
