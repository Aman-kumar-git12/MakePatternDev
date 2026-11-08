import { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { PublicRoute } from './components/Auth/PublicRoute';
import { MainAppShell } from './app/MainAppShell';
import { GuestShell } from './app/GuestShell';
import { SharedPatternView, ViewFallback } from './app/lazyViews';
import { api } from './services/api';

/** Open to everyone: signed-out visitors get the guest shell, which asks them to sign in for anything else. */
const OPEN_PATHS = ['/', '/extension'];

/** Every authenticated path renders the same shell; the shell picks the view from the URL. */
const PROTECTED_PATHS = [
  '/patterns',
  '/questions',
  '/bookmarks',
  '/recent',
  '/revision',
  '/progress',
  '/settings',
  '/trash',
  '/question/:questionId',
];

function App() {
  useEffect(() => {
    // Pre-warm the backend immediately so login/register requests respond instantly
    api.warmup();
  }, []);

  return (
    <Routes>
      {/* Public Guest Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* Public Read-Only Shared Pattern Route (supports /shared/ and /share/) */}
      {['/shared/:shareId', '/share/:shareId'].map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <Suspense fallback={<ViewFallback />}>
              <SharedPatternView />
            </Suspense>
          }
        />
      ))}

      {/* Home and the extension guide: guest shell when signed out, full app when signed in */}
      {OPEN_PATHS.map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute guest={<GuestShell />}>
              <MainAppShell />
            </ProtectedRoute>
          }
        />
      ))}

      {/* Protected Application Routes */}
      {PROTECTED_PATHS.map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute>
              <MainAppShell />
            </ProtectedRoute>
          }
        />
      ))}

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
