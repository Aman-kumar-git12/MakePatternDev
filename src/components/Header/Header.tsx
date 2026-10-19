import React, { useState, useRef, useEffect } from 'react';
import { Search, Sun, Moon, Bell, ChevronDown, Plus, Menu, LogOut, User as UserIcon, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
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
  const { toggleTheme, isDark } = useTheme();

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
    <header
      className="h-16 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between"
      style={{
        backgroundColor: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-primary)',
      }}
    >
      {/* Mobile Menu & Search Bar */}
      <div className="flex items-center space-x-3 w-full max-w-xl">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-1 rounded-xl transition"
            style={{ color: 'var(--text-secondary)' }}
            title="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs transition duration-150 group shadow-inner"
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-tertiary)',
          }}
        >
          <div className="flex items-center space-x-2.5">
            <Search className="w-4 h-4 group-hover:text-yellow-300 transition" style={{ color: 'var(--text-tertiary)' }} />
            <span className="transition text-[13px] truncate" style={{ color: 'var(--text-tertiary)' }}>
              Search questions, topics, or folders...
            </span>
          </div>
          <span
            className="text-[10px] px-2 py-0.5 rounded-md font-mono hidden sm:inline-block"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
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
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#fef08a] hover:bg-[#fef9c3] text-[#18181b] rounded-xl text-xs font-semibold shadow-md shadow-yellow-200/30 active:scale-95 transition"
            title="Create New Question"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Question</span>
          </button>
        )}

        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl transition"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification Bell with indicator */}
        <button
          className="p-2 rounded-xl transition relative"
          style={{ color: 'var(--text-secondary)' }}
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" style={{ boxShadow: `0 0 0 2px var(--ring-bg)` }} />
        </button>

        {/* User Profile & Interactive Dropdown */}
        <div className="relative pl-1" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center space-x-2.5 p-1 rounded-xl transition cursor-pointer group"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '';
            }}
          >
            <div className="w-8 h-8 rounded-full bg-[#fef08a] text-[#18181b] font-bold text-xs flex items-center justify-center shadow-md shadow-yellow-200/30 ring-1 ring-[#fef08a]/50">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium transition hidden sm:inline-block max-w-[120px] truncate" style={{ color: 'var(--text-primary)' }}>
              {userName}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180 text-yellow-300' : ''
              }`}
              style={{ color: isDropdownOpen ? undefined : 'var(--text-tertiary)' }}
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-2xl p-2 z-50 animate-fade-in"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-dropdown)',
              }}
            >
              <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-semibold text-xs truncate" style={{ color: 'var(--text-primary)' }}>{userName}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <div className="text-[11px] font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>{userEmail}</div>
                <div className="mt-2 flex items-center space-x-1.5 text-[10px] text-yellow-300">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Authenticated Session</span>
                </div>
              </div>

              <div className="pt-1.5 pb-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Account
                </div>
                <div
                  className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs transition"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <UserIcon className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
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
