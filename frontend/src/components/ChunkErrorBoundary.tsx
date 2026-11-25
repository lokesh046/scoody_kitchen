import { Component, type ReactNode } from 'react';

// After a deploy, a tab left open from before still runs the old main bundle. Clicking into a
// route it hasn't loaded yet tries to fetch that route's JS chunk by its old (now-deleted) hashed
// filename, which 404s — React has nothing to render and the visitor is left on a blank screen.
// Catching that failure and reloading picks up the new build automatically instead.
const CHUNK_ERROR_PATTERN =
  /failed to fetch dynamically imported module|loading chunk|chunkloaderror|importerror|error loading dynamically imported module/i;

const RELOAD_FLAG_KEY = 'chunk-error-reload-attempted';

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_ERROR_PATTERN.test(message);
}

// Only reload once per tab session, so a genuinely broken build doesn't reload-loop forever.
function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG_KEY)) return false;
    sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
  } catch {
    // sessionStorage unavailable (private mode etc.) - still attempt the reload below.
  }
  window.location.reload();
  return true;
}

// Vite's module-preload polyfill fires this event (instead of throwing into the React tree) when
// a preloaded chunk fails to fetch. Call once at app startup alongside the boundary below.
export function installChunkPreloadRecovery() {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnce();
  });
}

interface State {
  hasError: boolean;
  failedPermanently: boolean;
}

export class ChunkErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, failedPermanently: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error) && reloadOnce()) return;
    this.setState({ failedPermanently: true });
  }

  render() {
    if (this.state.hasError) {
      if (this.state.failedPermanently) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-paper px-4">
            <div className="text-center space-y-3">
              <p className="font-body text-sm text-ink">Something went wrong loading this page.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="font-body text-xs uppercase tracking-wider font-bold text-turmeric underline cursor-pointer"
              >
                Reload
              </button>
            </div>
          </div>
        );
      }
      // A reload is already in flight - render nothing jarring while it kicks in.
      return <div className="min-h-screen bg-paper" />;
    }
    return this.props.children;
  }
}
