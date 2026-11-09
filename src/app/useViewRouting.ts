import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ViewMode } from '../types/dsa';

/** Derives the active view from the URL and maps sidebar selections back to routes. */
export function useViewRouting() {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active view mode from pathname
  const currentView = useMemo<ViewMode>(() => {
    const path = location.pathname;
    if (path.startsWith('/question/')) return 'workspace';
    if (path === '/patterns') return 'patterns';
    if (path === '/questions') return 'all-questions';
    if (path === '/bookmarks') return 'bookmarks';
    if (path === '/recent') return 'recent';
    if (path === '/revision') return 'revision';
    if (path === '/progress') return 'progress';
    if (path === '/settings') return 'settings';
    if (path === '/trash') return 'trash';
    if (path === '/extension') return 'extension';
    return 'home';
  }, [location.pathname]);

  // Navigation from Sidebar
  const handleSelectNavView = (view: ViewMode) => {
    switch (view) {
      case 'home':
        navigate('/');
        break;
      case 'patterns':
        navigate('/patterns');
        break;
      case 'all-questions':
        navigate('/questions');
        break;
      case 'bookmarks':
        navigate('/bookmarks');
        break;
      case 'recent':
        navigate('/recent');
        break;
      case 'revision':
        navigate('/revision');
        break;
      case 'progress':
        navigate('/progress');
        break;
      case 'settings':
        navigate('/settings');
        break;
      case 'trash':
        navigate('/trash');
        break;
      case 'extension':
        navigate('/extension');
        break;
      default:
        navigate('/');
    }
  };

  return { currentView, handleSelectNavView };
}
