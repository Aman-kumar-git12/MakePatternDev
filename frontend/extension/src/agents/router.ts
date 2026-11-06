import { browser } from 'wxt/browser';
import { verifyLeetCodeCapture, type VerifyDeps } from '../lib/leetcodeVerify';
import { applyNewtonFailure, applyNewtonRead } from '../lib/newtonQotd';
import { authorize, type LeetCodeCapture, type Message, type SenderInfo } from '../lib/messages';
import { getItem, setItem, updateItem } from '../lib/storage';
import type { Submission } from '../lib/types';
import { analyze, analyzeComplexityFor, deleteAnalysis } from './codeAnalysis';
import { ensureAlarms, exclusive, refreshStale, runAgent, track, whenOpen } from './registry';
import { scheduleReminders, updateBadge } from './reminders';
import { ingestLeetCodeCapture } from './submissions';
import { applyIdleSetting } from './timeTracker';

/**
 * Background-side message handling: checks who sent the message and that it is well formed
 * (`authorize`), then dispatches it. Every rejection is thrown as an Error whose message is
 * returned to the sender as `{ ok: false, error }`.
 */
export async function handleMessage(raw: unknown, sender: SenderInfo): Promise<unknown> {
  const msg = authorize(raw, sender, browser.runtime.id, browser.runtime.getURL('/'));
  if (msg.type === 'clearData') return clearData();
  // While data is being cleared, hold everything else until the clear is done.
  await whenOpen();
  return dispatch(msg);
}

function dispatch(msg: Exclude<Message, { type: 'clearData' }>): Promise<unknown> {
  switch (msg.type) {
    // These start agents, which track themselves (and wait for a running clear).
    case 'runAgent':
      return runAgent(msg.id);
    case 'settingsChanged':
      return (async () => {
        await applyIdleSetting();
        await Promise.allSettled([runAgent('contests'), runAgent('potd'), runAgent('submissions')]);
        return updateBadge();
      })();
    // Storage writers: tracked so a clear waits for them.
    case 'togglePotdDone':
      return track(
        updateItem('potdDone', (done) => {
          const set = new Set(done[msg.date] ?? []);
          if (set.has(msg.key)) set.delete(msg.key);
          else set.add(msg.key);
          return { ...done, [msg.date]: [...set] };
        }),
      );
    case 'setReminder':
      return track(
        (async () => {
          await updateItem('reminderOverrides', (o) => ({ ...o, [msg.contestId]: msg.on }));
          return scheduleReminders();
        })(),
      );
    case 'lcSubmission':
      return track(ingestVerifiedCapture(msg.payload));
    case 'newtonQotd': {
      const result = msg.result;
      // Title and link are stored together; a failed read keeps the last good pair, marked stale.
      return track(
        (async () => {
          await updateItem('newtonQotd', (prev) => (result.ok ? applyNewtonRead(result) : applyNewtonFailure(prev, result.error)));
          // Keep the reason for a failed read so the card can say what went wrong.
          await setItem('newtonQotdError', result.ok ? null : { error: result.error.slice(0, 200), at: new Date().toISOString() });
          return null;
        })(),
      );
    }
    case 'analyze':
      return track(analyze(msg));
    case 'analyzeComplexity':
      // Resolves with the result; it is also recorded on the analysis, so a closed popup loses nothing.
      return track(analyzeComplexityFor(msg.analysisId));
    case 'deleteAnalysis':
      return track(deleteAnalysis(msg.analysisId));
  }
}

/**
 * Verifies a live capture against LeetCode, then ingests it. Rejected captures throw; captures
 * that couldn't be checked are stored with `unverified: true`.
 */
export async function ingestVerifiedCapture(c: LeetCodeCapture, deps: Partial<VerifyDeps> = {}): Promise<Submission> {
  const v = await verifyLeetCodeCapture(c, deps);
  if (v.status === 'rejected') throw new Error(v.reason);
  const id = `leetcode:${v.capture.submissionId}`;
  const existed = (await getItem('submissions')).some((s) => s.id === id);
  const sub = await ingestLeetCodeCapture(v.capture);
  // Don't downgrade a record that already came from LeetCode's API.
  if (v.status === 'verified' || existed) return sub;
  await updateItem('submissions', (subs) => subs.map((s) => (s.id === id ? { ...s, unverified: true } : s)));
  return { ...sub, unverified: true };
}

/**
 * Deletes all data except settings. Waits for in-flight agents/captures/analyses and blocks
 * new ones meanwhile, so nothing half-written survives the clear; then resets alarms and
 * re-runs the scheduled agents.
 */
export async function clearData(): Promise<null> {
  await exclusive(async () => {
    const settings = await getItem('settings');
    await browser.storage.local.clear();
    await setItem('settings', settings);
    await browser.alarms.clearAll(); // includes contest reminders, rescheduled by the contests agent
    await ensureAlarms();
  });
  await refreshStale();
  await updateBadge().catch(() => undefined);
  return null;
}
