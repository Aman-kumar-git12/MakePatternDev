import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { validateCapture } from '../lib/messages';

/**
 * Isolated-world relay: forwards verdicts from the MAIN-world hook to the background worker.
 *
 * Channel hardening. Page scripts share the MAIN world with the hook, so a plain
 * `window.postMessage` channel lets any script on leetcode.com (ads, XSS, LeetCode's own
 * code) forge "Accepted" captures. Instead:
 *  1. At document_start — before any page script exists — this script generates a random
 *     nonce and hands it to the hook through a one-shot handshake (`cj-lc-hello` /
 *     `cj-lc-nonce` / `cj-lc-ack`). Both scripts run before page scripts in either order,
 *     and after the ack the nonce is never sent again, so page scripts can't learn it.
 *  2. Captures are then sent as a CustomEvent whose *type* is `cj-lc-<nonce>`: a page script
 *     can neither listen for nor dispatch an event type it doesn't know.
 *  3. Payloads are strictly validated here and again in the background, and the background
 *     cross-checks each capture with LeetCode's own API before storing it.
 * Residual risk: the hook itself lives in the shared MAIN world, so a page script that tampers
 * with built-ins the hook uses can still make it report something false; and if the hook
 * never runs (browser without MAIN-world support) a page script could answer the handshake.
 * Hence the background verification, which rejects anything LeetCode doesn't confirm and
 * flags captures it couldn't check as `unverified`.
 */
export default defineContentScript({
  matches: ['https://leetcode.com/*'],
  runAt: 'document_start',
  main() {
    const nonce = crypto.getRandomValues(new Uint32Array(4)).join('-');
    let delivered = false;

    const sendNonce = () => {
      if (!delivered) window.dispatchEvent(new CustomEvent('cj-lc-nonce', { detail: nonce }));
    };
    const onHello = () => sendNonce();
    const onAck = (e: Event) => {
      if ((e as CustomEvent).detail !== nonce) return; // only the real hook knows the nonce
      delivered = true;
      window.removeEventListener('cj-lc-hello', onHello, true);
      window.removeEventListener('cj-lc-ack', onAck, true);
    };
    window.addEventListener('cj-lc-hello', onHello, true);
    window.addEventListener('cj-lc-ack', onAck, true);
    // Covers the order where the hook already ran and is waiting for the nonce.
    sendNonce();

    window.addEventListener(
      `cj-lc-${nonce}`,
      (event: Event) => {
        event.stopImmediatePropagation();
        let raw: unknown;
        try {
          raw = JSON.parse(String((event as CustomEvent).detail));
        } catch {
          return;
        }
        const check = validateCapture(raw);
        if (!check.ok) return;
        void browser.runtime.sendMessage({ type: 'lcSubmission', payload: check.capture }).catch(() => undefined);
      },
      true,
    );
  },
});
