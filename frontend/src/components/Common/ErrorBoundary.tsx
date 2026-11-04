import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError, reloadForNewVersion } from '../../pwa/reloadForNewVersion';

interface State {
  error: unknown;
}

/** Top-level safety net: a render or chunk-load error shows a recovery screen, not a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
    if (isChunkLoadError(error)) reloadForNewVersion();
  }

  render() {
    if (!this.state.error) return this.props.children;
    const updated = isChunkLoadError(this.state.error);
    return (
      <div className="min-h-[100dvh] w-full bg-[#080C14] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-lg font-semibold">{updated ? 'A new version is available' : 'Something went wrong'}</h1>
          <p className="text-sm text-slate-400">
            {updated
              ? 'MakePattern was updated while this tab was open. Reload to continue.'
              : 'The page hit an unexpected error. Your saved work is safe — reload to continue.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
