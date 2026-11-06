export type AgentTrigger = 'schedule' | 'event' | 'on-demand';

/**
 * An agent is one self-contained job the background worker runs: fetching contests,
 * fetching problems of the day, syncing submissions, tracking time, analysing code…
 * Each reports its last run in `agentStatus` so the options page can show health.
 */
export interface Agent {
  id: string;
  name: string;
  description: string;
  trigger: AgentTrigger;
  /** For scheduled agents. */
  periodMinutes?: number;
  /** A run taking longer than this is reported as failed (default 10 min, see registry). */
  timeoutMs?: number;
  /** Returns a short human-readable status line. */
  run: () => Promise<string>;
}
