import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { recoverInterruptedAnalyses } from '../agents/codeAnalysis';
import { handleNotificationClick, handleReminderAlarm, updateBadge } from '../agents/reminders';
import { AGENT_ALARM, ensureAlarms, recoverAgentStatus, refreshStale, runAgent, TICK } from '../agents/registry';
import { handleMessage } from '../agents/router';
import { registerTimeTracker, trackNow } from '../agents/timeTracker';
import { errorMessage } from '../lib/http';
import type { Reply, SenderInfo } from '../lib/messages';
import { getItem, pruneOrphanAnalyses } from '../lib/storage';

/**
 * Keeps `storage.local` (which holds the Anthropic API key) away from content scripts where
 * the browser allows it. Chrome's `setAccessLevel` historically only accepted
 * `storage.session`; on browsers that reject it for `local` (and Firefox, which lacks it),
 * content scripts can technically read `storage.local` — see README "Privacy". Our content
 * scripts never use extension storage, so restricting it breaks nothing.
 */
async function restrictStorageAccess() {
  const local = browser.storage.local as { setAccessLevel?: (o: { accessLevel: 'TRUSTED_CONTEXTS' }) => Promise<void> };
  try {
    await local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
  } catch {
    /* unsupported for storage.local here — residual risk documented in the README */
  }
}

/** One-off clean-ups when the extension is updated. */
async function migrate() {
  const subs = await getItem('submissions');
  await pruneOrphanAnalyses(new Set(subs.map((s) => s.id)));
}

const logError = (what: string) => (e: unknown) => console.warn(`[coding-journey] ${what}:`, errorMessage(e));

export default defineBackground(() => {
  // Listeners must be registered synchronously so events can wake the worker.
  registerTimeTracker();

  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    await ensureAlarms();
    if (reason === 'update') await migrate().catch(logError('migration'));
    await refreshStale();
    if (reason === 'install') await browser.runtime.openOptionsPage();
  });

  browser.runtime.onStartup.addListener(async () => {
    await ensureAlarms();
    await refreshStale();
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === TICK) {
      await trackNow();
      await updateBadge();
    } else if (alarm.name.startsWith(AGENT_ALARM)) {
      await runAgent(alarm.name.slice(AGENT_ALARM.length)).catch(() => undefined);
    } else {
      await handleReminderAlarm(alarm.name);
    }
  });

  browser.notifications.onClicked.addListener((id) => void handleNotificationClick(id));

  browser.runtime.onMessage.addListener((msg: unknown, sender, sendResponse: (r: Reply) => void) => {
    handleMessage(msg, sender as SenderInfo).then(
      (data) => sendResponse({ ok: true, data }),
      (e) => sendResponse({ ok: false, error: errorMessage(e) }),
    );
    return true; // keep the channel open for the async response
  });

  // Runs on every worker start (not only browser start): anything persisted as "running"
  // belonged to a previous, now dead, worker.
  void restrictStorageAccess();
  recoverAgentStatus().catch(logError('agent status recovery'));
  recoverInterruptedAnalyses().catch(logError('analysis recovery'));
  ensureAlarms().catch(logError('alarms'));
});
