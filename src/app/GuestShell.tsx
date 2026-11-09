import { Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { Header } from '../components/Header/Header';
import { Dashboard } from '../components/Dashboard/Dashboard';
import { SignInPrompt } from '../components/Auth/SignInPrompt';
import { ExtensionGuideView, ViewFallback } from './lazyViews';
import { useViewRouting } from './useViewRouting';
import { setPendingIntent, takePendingIntent, type PendingIntent } from '../services/authStorage';
import type { ViewMode } from '../types/dsa';

/** Views a signed-out visitor can open. Everything else asks them to sign in first. */
const GUEST_VIEWS: ViewMode[] = ['home', 'extension'];

const VIEW_PATHS: Partial<Record<ViewMode, string>> = {
  patterns: '/patterns',
  'all-questions': '/questions',
  bookmarks: '/bookmarks',
  revision: '/revision',
  progress: '/progress',
  settings: '/settings',
  trash: '/trash',
};

const VIEW_ACTIONS: Partial<Record<ViewMode, string>> = {
  patterns: 'see your patterns',
  'all-questions': 'see your questions',
  bookmarks: 'see your bookmarks',
  revision: 'review questions',
  progress: 'track your progress',
  settings: 'open settings',
  trash: 'open the trash',
};

interface Prompt {
  action: string;
  /** Where to land after signing in. */
  returnTo: string;
  intent?: PendingIntent;
}

/**
 * The app as a signed-out visitor sees it: the home page and the extension guide are open,
 * and anything that needs an account (adding a question, opening a view) asks them to sign in.
 */
export function GuestShell() {
  const navigate = useNavigate();
  const { currentView, handleSelectNavView } = useViewRouting();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const ask = useCallback((action: string, returnTo = '/', intent?: PendingIntent) => {
    setPrompt({ action, returnTo, intent });
    setIsMobileMenuOpen(false);
  }, []);

  const askToAddQuestion = useCallback(() => ask('add a question', '/', 'new-question'), [ask]);

  const goToAuth = (page: '/login' | '/register', p: Prompt | null) => {
    // Drop any older unfinished intent, then remember this one so it resumes after sign-in.
    takePendingIntent();
    if (p?.intent) setPendingIntent(p.intent);
    setPrompt(null);
    navigate(page, { state: { from: { pathname: p?.returnTo ?? '/' } } });
  };

  const onSelectView = (view: ViewMode) => {
    if (GUEST_VIEWS.includes(view)) {
      handleSelectNavView(view);
    } else {
      ask(VIEW_ACTIONS[view] ?? 'continue', VIEW_PATHS[view] ?? '/');
    }
  };

  // Same shortcut as the signed-in app for a new question ("n"), so it explains itself instead of doing nothing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) askToAddQuestion();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [askToAddQuestion]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden font-sans" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      <Sidebar
        currentView={currentView}
        onSelectView={onSelectView}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        user={null}
        guestViews={GUEST_VIEWS}
        onSignIn={() => goToAuth('/login', null)}
      />

      <div className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <Header
          onOpenSearch={() => ask('search your questions')}
          onOpenNewQuestion={askToAddQuestion}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          user={null}
          onSignIn={() => goToAuth('/login', null)}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <Suspense fallback={<ViewFallback />}>
            {currentView === 'extension' ? (
              <ExtensionGuideView />
            ) : (
              <Dashboard
                guest
                summary={null}
                folders={[]}
                questions={[]}
                onSelectQuestion={() => ask('open a question')}
                onOpenNewQuestion={askToAddQuestion}
                onOpenNewFolder={() => ask('create a topic')}
                onOpenImportLeetCode={() => ask('import problems from LeetCode')}
                onOpenCurricula={() => ask('add a starter curriculum')}
                onSelectView={onSelectView}
                onSignIn={() => goToAuth('/login', null)}
              />
            )}
          </Suspense>
        </main>
      </div>

      <SignInPrompt
        action={prompt?.action ?? null}
        onSignIn={() => goToAuth('/login', prompt)}
        onRegister={() => goToAuth('/register', prompt)}
        onClose={() => setPrompt(null)}
      />
    </div>
  );
}
