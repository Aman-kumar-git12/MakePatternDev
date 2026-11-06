import { browser } from 'wxt/browser';
import { errorMessage } from '../lib/http';
import { getItem, updateItem } from '../lib/storage';
import { coachAgent } from './coach';
import { codeAnalysisAgent } from './codeAnalysis';
import { contestsAgent } from './contests';
import { potdAgent } from './potd';
import { submissionsAgent } from './submissions';
import { timeTrackerAgent } from './timeTracker';
import type { AgentStatus } from '../lib/types';
import type { Agent } from './types';

export const AGENTS: Agent[] = [contestsAgent, potdAgent, submissionsAgent, timeTrackerAgent, codeAnalysisAgent, coachAgent];

/** Used when an agent doesn't set `timeoutMs` (generous: a first LeetCode history import pages slowly). */
export const DEFAULT_AGENT_TIMEOUT_MS = 10 * 60_000;
/** `clearData` waits at most this long for in-flight work before clearing anyway. */
const MAX_DRAIN_MS = 60_000;

export const agentTimeoutMs = (agent: Agent) => agent.timeoutMs ?? DEFAULT_AGENT_TIMEOUT_MS;

/** In-flight runs by agent id (in-memory: a fresh service worker has none). */
const running = new Map<string, Promise<string>>();
/** Every in-flight background job that writes storage (agent runs, captures, analyses). */
const jobs = new Set<Promise<unknown>>();
/** Set while an exclusive operation (clearData) runs; new jobs wait for it. */
let gate: Promise<void> | null = null;

/** Registers a background job so `exclusive()` can wait for it. Returns the same promise. */
export function track<T>(p: Promise<T>): Promise<T> {
  jobs.add(p);
  p.then(
    () => jobs.delete(p),
    () => jobs.delete(p),
  );
  return p;
}

/** Resolves once no exclusive operation is running. Await before starting a tracked job. */
export async function whenOpen(): Promise<void> {
  while (gate) await gate;
}

/** True while `exclusive()` is draining/clearing (for tests and diagnostics). */
export const isPaused = () => gate !== null;

/**
 * Runs `fn` with every other background job stopped: blocks new agent runs, waits for the
 * in-flight ones (up to `MAX_DRAIN_MS`), then runs `fn`. Don't start agents from inside `fn`
 * — they would wait for the gate `fn` holds; start them after it resolves.
 */
export async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  await whenOpen();
  let release!: () => void;
  gate = new Promise<void>((r) => (release = r));
  try {
    const deadline = Date.now() + MAX_DRAIN_MS;
    while (jobs.size && Date.now() < deadline) {
      await Promise.race([Promise.allSettled([...jobs]), new Promise((r) => setTimeout(r, deadline - Date.now()))]);
    }
    return await fn();
  } finally {
    gate = null;
    release();
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export function runAgent(id: string): Promise<string> {
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) return Promise.reject(new Error(`Unknown agent "${id}"`));
  // Blocked while data is being cleared: run once the clear is done.
  if (gate) return whenOpen().then(() => runAgent(id));
  // Don't run the same agent twice concurrently (alarm + manual click).
  const inFlight = running.get(id);
  if (inFlight) return inFlight;

  const job = (async () => {
    const startedAt = Date.now();
    await updateItem('agentStatus', (s) => ({ ...s, [id]: { ...s[id], running: true, startedAt } }));
    try {
      const message = await withTimeout(track(agent.run()), agentTimeoutMs(agent), agent.name);
      await updateItem('agentStatus', (s) => ({ ...s, [id]: { running: false, startedAt, lastRun: Date.now(), ok: true, message } }));
      return message;
    } catch (e) {
      const message = errorMessage(e);
      await updateItem('agentStatus', (s) => ({ ...s, [id]: { running: false, startedAt, lastRun: Date.now(), ok: false, message } }));
      throw e;
    } finally {
      running.delete(id);
    }
  })();
  running.set(id, job);
  track(job).catch(() => undefined);
  return job;
}

/**
 * Clears `running` flags left behind by a service worker that was killed mid-run. Called on
 * every worker start. Runs live only in this worker's memory, so a persisted `running` flag
 * without an in-memory run is dead whatever its age; the message says whether it had also
 * exceeded the agent's timeout (`startedAt` + `agentTimeoutMs`).
 */
export async function recoverAgentStatus(now = Date.now()): Promise<number> {
  const isStale = (id: string, st: AgentStatus | undefined) => !!st?.running && !running.has(id);
  if (!Object.entries(await getItem('agentStatus')).some(([id, st]) => isStale(id, st))) return 0; // skip the write
  let fixed = 0;
  await updateItem('agentStatus', (s) => {
    const next = { ...s };
    for (const [id, st] of Object.entries(s)) {
      if (!isStale(id, st)) continue;
      const agent = AGENTS.find((a) => a.id === id);
      const overdue = st.startedAt !== undefined && !!agent && now - st.startedAt > agentTimeoutMs(agent);
      next[id] = {
        ...st,
        running: false,
        ok: false,
        message: overdue ? 'Timed out — will retry' : 'Interrupted (the background worker restarted) — will retry',
      };
      fixed++;
    }
    return next;
  });
  return fixed;
}

// --- Scheduling ------------------------------------------------------------------------

export const AGENT_ALARM = 'agent|';
export const TICK = 'tick';

/** Creates missing alarms, recreates ones whose period changed, and drops alarms of removed agents. */
export async function ensureAlarms(): Promise<void> {
  const existing = new Map((await browser.alarms.getAll()).map((a) => [a.name, a]));
  const wanted = new Map<string, { periodInMinutes: number; delayInMinutes?: number }>();
  for (const agent of AGENTS) {
    if (agent.trigger !== 'schedule' || !agent.periodMinutes) continue;
    wanted.set(AGENT_ALARM + agent.id, { periodInMinutes: agent.periodMinutes, delayInMinutes: 1 });
  }
  wanted.set(TICK, { periodInMinutes: 1 });
  for (const [name, info] of wanted) {
    if (existing.get(name)?.periodInMinutes !== info.periodInMinutes) await browser.alarms.create(name, info);
  }
  for (const name of existing.keys()) {
    if (name.startsWith(AGENT_ALARM) && !wanted.has(name)) await browser.alarms.clear(name);
  }
}

/** Runs scheduled agents whose data is older than their period (alarms don't fire while the browser is closed). */
export async function refreshStale(): Promise<void> {
  const status = await getItem('agentStatus');
  const now = Date.now();
  for (const agent of AGENTS) {
    if (agent.trigger !== 'schedule' || !agent.periodMinutes) continue;
    const last = status[agent.id]?.lastRun ?? 0;
    if (now - last > agent.periodMinutes * 60_000) runAgent(agent.id).catch(() => undefined);
  }
}
