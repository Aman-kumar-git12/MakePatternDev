/**
 * Service worker registration (production builds only) with an opt-in update flow:
 * when a new version is installed and waiting, subscribers are told so the UI can offer "Reload".
 */
type Listener = (waiting: boolean) => void;

let waitingWorker: ServiceWorker | null = null;
// Only reload for an update the user asked for; the first install's clients.claim()
// also fires controllerchange and must not reload the page.
let updateRequested = false;
const listeners = new Set<Listener>();

function setWaiting(worker: ServiceWorker | null) {
  waitingWorker = worker;
  listeners.forEach((l) => l(Boolean(worker)));
}

export function onUpdateAvailable(listener: Listener): () => void {
  listeners.add(listener);
  listener(Boolean(waitingWorker));
  return () => listeners.delete(listener);
}

/** Activate the waiting worker; the page reloads once it takes control. */
export function applyUpdate(): void {
  if (!waitingWorker) {
    window.location.reload();
    return;
  }
  updateRequested = true;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRequested || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      // An update may already be waiting from a previous visit.
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // "installed" with an existing controller = a new version is waiting (not the first install).
          if (installing.state === 'installed' && navigator.serviceWorker.controller) setWaiting(installing);
        });
      });
      // Long-lived tabs (installed app): check for a new deploy hourly and when refocused.
      setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {});
      });
    } catch (err) {
      console.warn('Service worker registration failed', err);
    }
  });
}
