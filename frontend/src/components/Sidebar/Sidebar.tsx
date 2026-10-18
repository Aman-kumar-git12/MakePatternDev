import React, { useState } from 'react';
import { Home, Layers, FileText, Bookmark, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ViewMode } from '../../types/dsa';

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  bookmarkCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  bookmarkCount = 0,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Exactly four primary navigation items as required
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
  ];

  const isItemActive = (id: ViewMode) => {
    if (currentView === id) return true;
    if ((currentView === 'recent' || currentView === 'revision') && id === 'all-questions') return true;
    return false;
  };

  const handleNavClick = (id: ViewMode) => {
    onSelectView(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 h-screen flex flex-col bg-[#080C14] border-r border-slate-800/80 select-none flex-shrink-0 transition-all duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between">
          <div
            onClick={() => handleNavClick('home')}
            className={`flex items-center space-x-3 cursor-pointer group ${
              isCollapsed ? 'mx-auto' : ''
            }`}
            title="DSA Tracker Home"
          >
            <span className="text-blue-500 font-bold text-xl tracking-tighter font-mono select-none drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
              &lt;/&gt;
            </span>
            {!isCollapsed && (
              <div className="overflow-hidden transition-all duration-200">
                <h1 className="font-bold text-base tracking-tight text-white leading-tight">
                  DSA Tracker
                </h1>
                <p className="text-[10px] text-slate-500 font-mono">Knowledge Base</p>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The Exactly Four Primary Navigation Items */}
        <div className="p-3 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-xl text-xs font-medium transition duration-150 group relative ${
                  isCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'
                } ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </div>

                {!isCollapsed && item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      active ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Collapsed badge indicator dot */}
                {isCollapsed && item.badge !== undefined && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-[#080C14]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Desktop Collapse/Expand Toggle Footer */}
        <div className="hidden md:flex p-3 border-t border-slate-800/80">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-full flex items-center rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-900/80 py-2 transition duration-150 ${
              isCollapsed ? 'justify-center' : 'justify-between px-3'
            }`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {!isCollapsed && (
              <span className="text-[11px] font-medium text-slate-500">Collapse sidebar</span>
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
