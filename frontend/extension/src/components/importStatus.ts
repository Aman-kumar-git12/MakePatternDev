import { PLATFORMS } from '../lib/platforms';
import type { AgentStatus, PlatformId } from '../lib/types';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Import state of one platform (or all, with `null`), read from the submission agent's
 * status in storage 'agentStatus'. The agent reports per-platform failures in its message
 * as "<Platform name> failed: <reason>".
 */
export function importStatus(status: AgentStatus | undefined, platform: PlatformId | null): { running: boolean; lastRun?: number; error?: string } {
  if (!status) return { running: false };
  let error: string | undefined;
  if (status.message) {
    if (platform) {
      const m = status.message.match(new RegExp(`${escapeRe(PLATFORMS[platform].name)} failed: ([^·;]+)`));
      if (m) error = m[1]!.trim();
    } else if (status.ok === false || /failed:/.test(status.message)) {
      const failed = [...status.message.matchAll(/([A-Za-z]+) failed:/g)].map((m) => m[1]);
      error = failed.length ? `${failed.join(', ')} import failed` : status.message;
    }
  }
  // A run that failed as a whole (e.g. timed out) affects every platform.
  if (!error && status.ok === false) error = status.message || 'Import failed';
  return { running: !!status.running, lastRun: status.lastRun, error };
}
