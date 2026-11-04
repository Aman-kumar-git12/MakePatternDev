import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { extractNewtonQotd } from '../lib/newtonQotd';

/**
 * Reads Newton School's featured Question of the Day from the page the user is viewing.
 * It makes no requests of its own: it only reads the card the site has already rendered, and
 * hands the title + link (read from the same card) to the background worker.
 */
export default defineContentScript({
  matches: ['https://my.newtonschool.co/*'],
  runAt: 'document_idle',
  main() {
    const RENDER_WAIT_MS = 20_000; // the card appears after the site's own data load
    const RECHECK_MS = 5 * 60_000;
    let lastSent = '';
    let observer: MutationObserver | null = null;
    let giveUp: ReturnType<typeof setTimeout> | null = null;

    const onQotdPage = () => /^\/question-of-the-day\/?$/.test(location.pathname);

    const report = (result: { ok: true; title: string; problemUrl: string | null } | { ok: false; error: string }) => {
      const sig = JSON.stringify(result);
      if (sig === lastSent) return; // nothing new since the last report from this page
      lastSent = sig;
      void browser.runtime.sendMessage({ type: 'newtonQotd', result }).catch(() => undefined);
    };

    const stopWaiting = () => {
      observer?.disconnect();
      observer = null;
      if (giveUp) clearTimeout(giveUp);
      giveUp = null;
    };

    /** Reads the card now, or waits for the site to render it (then gives up and reports why). */
    const read = () => {
      if (!onQotdPage()) return;
      stopWaiting();
      const attempt = () => {
        const r = extractNewtonQotd(document);
        if (r.ok) {
          stopWaiting();
          report({ ok: true, ...r.value });
        }
        return r;
      };
      if (attempt().ok) return;
      observer = new MutationObserver(() => void attempt());
      observer.observe(document.body, { childList: true, subtree: true });
      giveUp = setTimeout(() => {
        const r = attempt();
        stopWaiting();
        if (!r.ok) report({ ok: false, error: r.error });
      }, RENDER_WAIT_MS);
    };

    read();
    // The site is a single-page app: notice navigation to the page without a reload.
    let path = location.pathname;
    setInterval(() => {
      if (location.pathname !== path) {
        path = location.pathname;
        lastSent = '';
        read();
      }
    }, 1000);
    // Recheck when the user comes back to the tab, and every 5 minutes while it stays visible.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') read();
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') read();
    }, RECHECK_MS);
  },
});
