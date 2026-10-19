import React, { useState } from 'react';
import { Home, Layers, FileText, Bookmark, RotateCcw, ChevronLeft, ChevronRight, X, LogOut, Sparkles } from 'lucide-react';
import type { ViewMode, User, Question } from '../../types/dsa';

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  bookmarkCount?: number;
  revisionCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  user?: User | null;
  onLogout?: () => void;
  activeQuestion?: Question | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  bookmarkCount = 0,
  revisionCount = 0,
  isMobileOpen = false,
  onCloseMobile,
  user,
  onLogout,
  activeQuestion,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Primary navigation items
  const navItems = [
    { id: 'home' as ViewMode, label: 'Home', icon: Home },
    { id: 'patterns' as ViewMode, label: 'My Patterns', icon: Layers },
    { id: 'all-questions' as ViewMode, label: 'All Questions', icon: FileText },
    {
      id: 'bookmarks' as ViewMode,
      label: 'Bookmarks',
      icon: Bookmark,
      badge: bookmarkCount > 0 ? bookmarkCount : undefined,
    },
    {
      id: 'revision' as ViewMode,
      label: 'Revision',
      icon: RotateCcw,
      badge: revisionCount > 0 ? revisionCount : undefined,
    },
  ];

  const isItemActive = (id: ViewMode) => {
    if (currentView === id) return true;
    if (currentView === 'recent' && id === 'all-questions') return true;
    if (currentView === 'workspace') {
      if (activeQuestion?.folder_id && id === 'patterns') return true;
      if (!activeQuestion?.folder_id && id === 'all-questions') return true;
    }
    return false;
  };

  const handleNavClick = (id: ViewMode) => {
    onSelectView(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const userName = user?.full_name || 'Aman Kumar';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 md:hidden animate-fade-in"
          style={{ backgroundColor: 'var(--bg-overlay)' }}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 h-screen flex flex-col select-none flex-shrink-0 transition-all duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}
        style={{
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-primary)',
        }}
      >
        {/* Brand Header */}
        <div
          className="h-16 px-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          <div
            onClick={() => handleNavClick('home')}
            className={`flex items-center space-x-3 cursor-pointer group ${
              isCollapsed ? 'mx-auto' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-[#fef08a] flex items-center justify-center shadow-md shadow-yellow-200/30 group-hover:scale-105 transition duration-200">
              <Layers className="w-5 h-5 text-[#18181b]" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span style={{ color: 'var(--text-primary)' }} className="font-bold text-sm tracking-tight group-hover:text-yellow-300 transition">
                  MakePattern
                </span>
                <span style={{ color: 'var(--text-tertiary)' }} className="text-[10px] font-mono">
                  DSA Curriculum
                </span>
              </div>
            )}
          </div>

          {/* Close button for mobile drawer */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg transition"
            style={{ color: 'var(--text-secondary)' }}
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Navigation Menu */}
        <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto custom-scrollbar">
          {!isCollapsed && (
            <div className="px-3 pb-2 text-[10px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
              Navigation
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center rounded-xl text-xs font-semibold transition duration-200 group relative ${
                  isCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'
                } ${
                  active
                    ? 'shadow-md shadow-yellow-400/20'
                    : ''
                }`}
                style={
                  active
                    ? {
                        backgroundColor: 'var(--bg-hover)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-hover)',
                      }
                    : {
                        color: 'var(--text-secondary)',
                      }
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = '';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-4 h-4 transition duration-200 ${
                      active ? 'text-yellow-300' : 'text-slate-300 group-hover:text-yellow-300'
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="font-semibold text-xs" style={{ color: active ? 'var(--text-primary)' : 'inherit' }}>
                      {item.label}
                    </span>
                  )}
                </div>

                {/* Badge if bookmark count > 0 */}
                {!isCollapsed && item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      active ? 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/40' : 'bg-white/10 text-white border border-white/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Collapsed badge indicator dot */}
                {isCollapsed && item.badge !== undefined && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-yellow-300" style={{ boxShadow: `0 0 0 2px var(--badge-ring)` }} />
                )}
              </button>
            );
          })}

          {/* Active Question Badge (shows where user is present when solving) */}
          {currentView === 'workspace' && activeQuestion && !isCollapsed && (
            <div className="mx-1 mt-4 p-2.5 rounded-xl bg-yellow-400/10 border border-yellow-400/25 space-y-1 animate-fade-in shadow-sm shadow-yellow-400/5">
              <div className="flex items-center space-x-1.5 text-[10px] font-bold text-yellow-300 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-yellow-400 animate-pulse flex-shrink-0" />
                <span>Present In Problem</span>
              </div>
              <div className="text-xs font-semibold text-yellow-100 truncate" title={activeQuestion.title}>
                {activeQuestion.title}
              </div>
            </div>
          )}
        </div>

        {/* User Card & Sign Out Footer */}
        {user && (
          <div className="p-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
            {!isCollapsed ? (
              <div
                className="flex items-center justify-between p-2 rounded-xl"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#fef08a] border border-[#fde047] text-[#18181b] font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{userName}</div>
                    <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
                  </div>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              onLogout && (
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )
            )}
          </div>
        )}

        {/* Desktop Collapse/Expand Toggle Footer */}
        <div className="hidden md:flex p-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-full flex items-center rounded-xl text-xs py-2 transition duration-150 ${
              isCollapsed ? 'justify-center' : 'justify-between px-3'
            }`}
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {!isCollapsed && (
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Collapse sidebar</span>
            )}
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
