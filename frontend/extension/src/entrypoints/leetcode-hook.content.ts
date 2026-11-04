import { defineContentScript } from 'wxt/utils/define-content-script';

/**
 * Runs in the page's own JS world on leetcode.com so it can observe the page's fetch/XHR
 * calls: it remembers the code sent to /problems/<slug>/submit/ and, when the matching
 * /submissions/detail/<id>/check/ poll reports a final state, hands the verdict to the
 * isolated bridge script. It never changes requests or responses.
 *
 * Hardening (see leetcode-bridge.content.ts for the channel): everything this script relies
 * on is captured at document_start, before any page script can patch it, and responses are
 * read through the captured native getters/methods (so a page script can't feed us forged
 * bodies or URLs via overridden `Response.json`, `xhr.responseText`, `Request.url`…). Only
 * same-origin endpoints count.
 *
 * Residual risk: the MAIN world is shared with page scripts. A script that patches other
 * built-ins this file uses (Map/Set methods, String/Array helpers…) can still tamper with
 * what we report, and LeetCode's own code could change its endpoints. So this is defence in
 * depth only: the background verifies every capture with LeetCode's API before storing it
 * and prefers LeetCode's copy of the code and verdict.
 *
 * Firefox supports `world: 'MAIN'` from 128 (our minimum). If a browser ignores `world` and
 * runs this in the isolated world, patching `fetch` there would see nothing, so it bails out.
 */
export default defineContentScript({
  matches: ['https://leetcode.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const g = globalThis as { chrome?: { runtime?: { id?: string } }; browser?: { runtime?: { id?: string } } };
    if (g.chrome?.runtime?.id || g.browser?.runtime?.id) return; // not the MAIN world

    // --- Native references, captured before page scripts run --------------------------
    const W = window;
    const origin = location.origin;
    const dispatch = EventTarget.prototype.dispatchEvent;
    const addListener = EventTarget.prototype.addEventListener;
    const removeListener = EventTarget.prototype.removeEventListener;
    const NativeCustomEvent = CustomEvent;
    const NativeURL = URL;
    const NativeRequest = Request;
    const stringify = JSON.stringify;
    const exec = RegExp.prototype.exec;
    const then = Promise.prototype.then;
    const match = (re: RegExp, s: string) => exec.call(re, s) as RegExpExecArray | null;
    const parse = JSON.parse;
    const originalFetch = W.fetch;
    const responseClone = Response.prototype.clone;
    const responseJson = Response.prototype.json;
    const getter = <T>(proto: object, key: string) =>
      Object.getOwnPropertyDescriptor(proto, key)!.get as (this: T) => unknown;
    const responseUrl = getter<Response>(Response.prototype, 'url');
    const requestUrl = getter<Request>(Request.prototype, 'url');
    const requestClone = Request.prototype.clone;
    const requestText = Request.prototype.text;
    const XHR = XMLHttpRequest.prototype;
    const originalOpen = XHR.open;
    const originalSend = XHR.send;
    const xhrReadyState = getter<XMLHttpRequest>(XHR, 'readyState');
    const xhrResponseUrl = getter<XMLHttpRequest>(XHR, 'responseURL');
    const xhrResponseType = getter<XMLHttpRequest>(XHR, 'responseType');
    const xhrResponse = getter<XMLHttpRequest>(XHR, 'response');
    const xhrResponseText = getter<XMLHttpRequest>(XHR, 'responseText');

    // --- Handshake with the bridge: receive the per-page nonce ---------------------------
    let channel: string | null = null;
    const onNonce = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (channel || typeof detail !== 'string' || !match(/^\d+(?:-\d+){3}$/, detail)) return;
      channel = `cj-lc-${detail}`;
      removeListener.call(W, 'cj-lc-nonce', onNonce, true);
      dispatch.call(W, new NativeCustomEvent('cj-lc-ack', { detail }));
    };
    addListener.call(W, 'cj-lc-nonce', onNonce, true);
    // If the bridge already ran it answers synchronously; otherwise it sends the nonce itself
    // when it starts (still before any page script).
    dispatch.call(W, new NativeCustomEvent('cj-lc-hello'));

    function post(payload: Record<string, unknown>) {
      if (!channel) return; // no bridge: never fall back to a guessable channel
      dispatch.call(W, new NativeCustomEvent(channel, { detail: stringify(payload) }));
    }

    // --- Capture logic ------------------------------------------------------------------
    const pending = new Map<string, { slug: string; code?: string; lang?: string }>();
    const reported = new Set<string>();
    const submitPath = /^\/problems\/([a-z0-9-]+)\/submit\/?$/;
    const checkPath = /^\/submissions\/detail\/(\d+)\/check\/?$/;

    /** Same-origin pathname of `url`, or null. */
    function samePath(url: unknown): string | null {
      if (typeof url !== 'string' || !url) return null;
      try {
        const u = new NativeURL(url, origin);
        return u.origin === origin ? u.pathname : null;
      } catch {
        return null;
      }
    }

    function onSubmitResponse(slug: string, body: string | null, json: unknown) {
      const id = (json as { submission_id?: unknown } | null)?.submission_id;
      if ((typeof id !== 'number' && typeof id !== 'string') || !match(/^\d+$/, String(id))) return;
      let code: string | undefined;
      let lang: string | undefined;
      try {
        const parsed = body ? (parse(body) as { typed_code?: unknown; lang?: unknown }) : {};
        if (typeof parsed.typed_code === 'string') code = parsed.typed_code;
        if (typeof parsed.lang === 'string') lang = parsed.lang;
      } catch {
        /* body wasn't JSON */
      }
      if (pending.size > 50) pending.clear();
      pending.set(String(id), { slug, code, lang });
    }

    function onCheckResponse(id: string, json: unknown) {
      const r = json as Record<string, unknown> | null;
      if (r?.state !== 'SUCCESS' || reported.has(id)) return;
      const info = pending.get(id);
      const slug = info?.slug ?? match(/^\/problems\/([a-z0-9-]+)/, location.pathname)?.[1];
      if (!slug) return;
      reported.add(id);
      pending.delete(id);
      post({
        submissionId: id,
        slug,
        statusMsg: String(r.status_msg ?? ''),
        lang: info?.lang ?? (typeof r.lang === 'string' ? r.lang : undefined),
        code: info?.code,
        runtime: typeof r.status_runtime === 'string' ? r.status_runtime : undefined,
        memory: typeof r.status_memory === 'string' ? r.status_memory : undefined,
        totalCorrect: typeof r.total_correct === 'number' ? r.total_correct : undefined,
        totalTestcases: typeof r.total_testcases === 'number' ? r.total_testcases : undefined,
      });
    }

    /** `path` is the response's real (native) URL path; `body` the request body if any. */
    function route(path: string | null, body: string | null, getJson: () => Promise<unknown>) {
      if (!path) return;
      const submit = match(submitPath, path);
      const check = match(checkPath, path);
      if (!submit && !check) return;
      // Native `then`: a page script patching Promise.prototype.then can't hand us forged JSON.
      then.call(
        getJson(),
        (json) => {
          if (submit) onSubmitResponse(submit[1]!, body, json);
          else if (check) onCheckResponse(check[1]!, json);
        },
        () => undefined,
      );
    }

    W.fetch = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      let body: string | null = typeof init?.body === 'string' ? init.body : null;
      if (body === null && input instanceof NativeRequest) {
        const path = samePath(requestUrl.call(input));
        if (path && match(submitPath, path)) {
          body = await (requestText.call(requestClone.call(input)) as Promise<string>).catch(() => null);
        }
      }
      const response = await originalFetch.call(this, input, init);
      // Route on the URL the browser actually fetched, not on what the caller claims.
      route(samePath(responseUrl.call(response)), body, () => responseJson.call(responseClone.call(response)) as Promise<unknown>);
      return response;
    };

    const tracked = new WeakSet<XMLHttpRequest>();
    XHR.open = function (this: XMLHttpRequest, ...args: unknown[]) {
      tracked.add(this);
      return (originalOpen as (...a: unknown[]) => void).apply(this, args);
    };
    XHR.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      if (tracked.has(this)) {
        const xhr = this;
        const requestBody = typeof body === 'string' ? body : null;
        addListener.call(xhr, 'load', () => {
          if (xhrReadyState.call(xhr) !== 4) return; // a dispatched fake 'load'
          route(samePath(xhrResponseUrl.call(xhr)), requestBody, async () =>
            xhrResponseType.call(xhr) === 'json' ? xhrResponse.call(xhr) : parse(String(xhrResponseText.call(xhr))),
          );
        });
      }
      return originalSend.call(this, body);
    };
  },
});
