import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';
import App from './App.tsx';
import { UpdateToast } from './components/Common/UpdateToast';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { reloadForNewVersion } from './pwa/reloadForNewVersion';

registerServiceWorker();

// A tab opened before a deploy can request JS chunks that no longer exist: reload once.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
          <UpdateToast />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
