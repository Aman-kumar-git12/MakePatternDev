import type { SupportedLanguage } from '../types/dsa';
import { api } from '../services/api';
import {
  compareOutput,
  compareStdout,
  detectJsSignature,
  formatValue,
  orderArgs,
  parseInput,
  type CaseOutcome,
  type JsSignature,
} from './harness';
import { PYTHON_WORKER_SOURCE } from './pythonWorkerSource';
import { JS_WORKER_SOURCE } from './jsWorkerSource';

export const CASE_TIMEOUT_MS = 5000;
const PY_LOAD_TIMEOUT_MS = 90000;

export interface RunCase {
  id: string;
  title: string;
  input: string;
  expected: string;
}

export interface CaseResult {
  id: string;
  title: string;
  input: string;
  outcome: CaseOutcome;
  actual: string | null;
  expected: string;
  stdout: string;
  error: string | null;
  line: number | null;
  ms: number | null;
  warning: string | null;
}

export interface RunSummary {
  results: CaseResult[];
  /** Problem with the code as a whole (syntax error, unsupported shape...). */
  fatal: string | null;
  fatalLine: number | null;
  passed: number;
  compared: number;
}

export type RunStatus = (msg: string) => void;

interface WorkerReply {
  id: number;
  ok: boolean;
  value?: unknown;
  stdout?: string;
  error?: string;
  line?: number | null;
  ms?: number;
  warning?: string | null;
  design?: boolean;
  in_place?: boolean;
}

class TimeoutError extends Error {}

/** A Web Worker that is reused across runs and killed/recreated on timeout. */
class SandboxWorker {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, (r: WorkerReply) => void>();
  private source: string;
  private url: string | null = null;

  constructor(source: string) {
    this.source = source;
  }

  get alive() {
    return this.worker !== null;
  }

  private ensure(): Worker {
    if (this.worker) return this.worker;
    if (!this.url) this.url = URL.createObjectURL(new Blob([this.source], { type: 'text/javascript' }));
    const w = new Worker(this.url);
    w.onmessage = (e: MessageEvent<WorkerReply>) => {
      const cb = this.pending.get(e.data.id);
      if (cb) {
        this.pending.delete(e.data.id);
        cb(e.data);
      }
    };
    w.onerror = (e) => {
      e.preventDefault();
      const msg = e.message || 'Worker crashed';
      this.pending.forEach((cb, id) => cb({ id, ok: false, error: msg }));
      this.pending.clear();
      this.kill();
    };
    this.worker = w;
    return w;
  }

  kill(reason = 'Run cancelled'): void {
    this.worker?.terminate();
    this.worker = null;
    // Settle anything still waiting, so no caller hangs and no later run inherits its callbacks.
    const waiting = [...this.pending.entries()];
    this.pending.clear();
    waiting.forEach(([id, cb]) => cb({ id, ok: false, error: reason }));
  }

  send(msg: Record<string, unknown>, timeoutMs: number): Promise<WorkerReply> {
    const w = this.ensure();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.kill(); // the only way to stop an infinite loop
        reject(new TimeoutError(`Timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
      this.pending.set(id, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
      w.postMessage({ ...msg, id });
    });
  }
}

const pyWorker = new SandboxWorker(PYTHON_WORKER_SOURCE);
const jsWorker = new SandboxWorker(JS_WORKER_SOURCE);
let pyLoaded = false;

/** Only the latest run may use the shared workers; starting a new run cancels the previous one. */
let currentRun = 0;
/** True while a run is executing; only then does a new run need to kill the workers. */
let runInProgress = false;
class CancelledError extends Error {}
const ensureCurrent = (token: number) => {
  if (token !== currentRun) throw new CancelledError('Run cancelled');
};

/** Stop any run in progress (e.g. when the run panel goes away). */
export function cancelRuns(): void {
  if (!runInProgress) return;
  currentRun++;
  pyWorker.kill();
  jsWorker.kill();
  pyLoaded = false;
}

function emptySummary(cases: RunCase[], fatal: string, line: number | null = null): RunSummary {
  return {
    fatal,
    fatalLine: line,
    passed: 0,
    compared: 0,
    results: cases.map((c) => ({
      id: c.id, title: c.title, input: c.input, outcome: 'error', actual: null, expected: c.expected,
      stdout: '', error: null, line: null, ms: null, warning: null,
    })),
  };
}

function finish(results: CaseResult[]): RunSummary {
  const compared = results.filter((r) => r.outcome !== 'ran').length;
  return { results, fatal: null, fatalLine: null, passed: results.filter((r) => r.outcome === 'pass').length, compared };
}

function fromReply(c: RunCase, r: WorkerReply): CaseResult {
  if (!r.ok) {
    return {
      id: c.id, title: c.title, input: c.input, outcome: 'error', actual: null, expected: c.expected,
      stdout: r.stdout || '', error: r.error || 'Unknown error', line: r.line ?? null, ms: r.ms ?? null, warning: null,
    };
  }
  return {
    id: c.id, title: c.title, input: c.input, outcome: compareOutput(r.value, c.expected),
    actual: formatValue(r.value) + (r.in_place ? '  (modified in place)' : ''), expected: c.expected,
    stdout: r.stdout || '', error: null, line: null, ms: r.ms ?? null, warning: r.warning ?? null,
  };
}

function timeoutResult(c: RunCase): CaseResult {
  return {
    id: c.id, title: c.title, input: c.input, outcome: 'timeout', actual: null, expected: c.expected, stdout: '',
    error: `Time limit exceeded (${CASE_TIMEOUT_MS / 1000}s). Infinite loop or too slow?`, line: null, ms: CASE_TIMEOUT_MS, warning: null,
  };
}

async function runPython(code: string, cases: RunCase[], onStatus: RunStatus, token: number): Promise<RunSummary> {
  const prepare = async (): Promise<WorkerReply> => {
    if (!pyLoaded || !pyWorker.alive) {
      onStatus('Loading Python runtime… (first run downloads ~10 MB)');
      await pyWorker.send({ type: 'init' }, PY_LOAD_TIMEOUT_MS).then((r) => {
        if (!r.ok) throw new Error(r.error || 'Could not load the Python runtime');
      });
      pyLoaded = true;
    }
    return pyWorker.send({ type: 'prepare', code }, CASE_TIMEOUT_MS);
  };

  let prep: WorkerReply;
  try {
    prep = await prepare();
  } catch (e) {
    if (e instanceof TimeoutError) return emptySummary(cases, 'Your code timed out while loading (top-level infinite loop?).');
    pyLoaded = false;
    return emptySummary(cases, `${(e as Error).message}. Check your connection and try again.`);
  }
  if (!prep.ok) return emptySummary(cases, prep.error || 'Could not run the code', prep.line ?? null);

  const results: CaseResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    ensureCurrent(token);
    onStatus(`Running ${i + 1}/${cases.length}…`);
    const args = parseInput(c.input).map((a) => ({ name: a.name, value: a.value }));
    try {
      if (!pyWorker.alive) {
        const again = await prepare();
        if (!again.ok) throw new Error(again.error);
      }
      results.push(fromReply(c, await pyWorker.send({ type: 'call', args }, CASE_TIMEOUT_MS)));
    } catch (e) {
      results.push(e instanceof TimeoutError ? timeoutResult(c) : { ...timeoutResult(c), outcome: 'error', error: (e as Error).message, ms: null });
    }
  }
  return finish(results);
}

async function runJavaScript(code: string, cases: RunCase[], onStatus: RunStatus, token: number): Promise<RunSummary> {
  const detected = detectJsSignature(code);
  if (!detected) {
    return emptySummary(cases, "Couldn't find a function to call. Define it like `var twoSum = function(nums, target) { … }`.");
  }
  if ('design' in detected) {
    return emptySummary(cases, "Design-style problems (a class whose methods are called in sequence) aren't supported by the runner yet.");
  }
  const sig: JsSignature = detected;
  const prepare = () => jsWorker.send({ type: 'prepare', code, sig }, CASE_TIMEOUT_MS);
  let prep: WorkerReply;
  try {
    prep = await prepare();
  } catch {
    return emptySummary(cases, 'Your code timed out while loading (top-level infinite loop?).');
  }
  if (!prep.ok) return emptySummary(cases, prep.error || 'Could not run the code', prep.line ?? null);

  const results: CaseResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    ensureCurrent(token);
    onStatus(`Running ${i + 1}/${cases.length}…`);
    const { values, warning } = orderArgs(sig.params, parseInput(c.input));
    try {
      if (!jsWorker.alive) await prepare();
      const r = fromReply(c, await jsWorker.send({ type: 'call', values }, CASE_TIMEOUT_MS));
      results.push({ ...r, warning: r.warning || warning });
    } catch (e) {
      results.push(e instanceof TimeoutError ? timeoutResult(c) : { ...timeoutResult(c), outcome: 'error', error: (e as Error).message, ms: null });
    }
  }
  return finish(results);
}

async function runJudge0(language: SupportedLanguage, code: string, cases: RunCase[], onStatus: RunStatus, token: number): Promise<RunSummary> {
  const results: CaseResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    ensureCurrent(token);
    onStatus(`Running ${i + 1}/${cases.length} on the server…`);
    const base = { id: c.id, title: c.title, input: c.input, expected: c.expected, warning: null, line: null };
    try {
      const r = await api.runJudge0(language, code, c.input);
      const ms = r.time != null ? Math.round(Number(r.time) * 1000) : null;
      const status = r.status || '';
      if (/compil/i.test(status)) {
        return emptySummary(cases, `Compilation error:\n${r.compile_output || status}`);
      }
      if (/time limit/i.test(status)) {
        results.push({ ...base, outcome: 'timeout', actual: null, stdout: r.stdout, error: status, ms });
      } else if (!/accepted|wrong answer/i.test(status)) {
        results.push({ ...base, outcome: 'error', actual: null, stdout: r.stdout, error: [status, r.stderr].filter(Boolean).join('\n'), ms });
      } else {
        results.push({ ...base, outcome: compareStdout(r.stdout, c.expected), actual: r.stdout.trimEnd(), stdout: r.stderr ? `stderr:\n${r.stderr}` : '', error: null, ms });
      }
    } catch (e) {
      return emptySummary(cases, (e as Error).message || 'The code execution service failed.');
    }
  }
  return finish(results);
}

export async function runTests(
  language: SupportedLanguage,
  code: string,
  cases: RunCase[],
  onStatus: RunStatus,
  opts: { judge0Enabled: boolean },
): Promise<RunSummary> {
  // A new run supersedes any run still going (switching tabs used to leave the old one running
  // on the shared worker, which then mixed stale code and false timeouts into the new run).
  if (runInProgress) {
    pyWorker.kill();
    jsWorker.kill();
    pyLoaded = false;
  }
  const token = ++currentRun;
  runInProgress = true;
  try {
    return await runLatest(language, code, cases, onStatus, opts, token);
  } catch (e) {
    if (e instanceof CancelledError) return emptySummary(cases, 'Run cancelled.');
    throw e;
  } finally {
    if (token === currentRun) runInProgress = false;
  }
}

async function runLatest(
  language: SupportedLanguage,
  code: string,
  cases: RunCase[],
  onStatus: RunStatus,
  opts: { judge0Enabled: boolean },
  token: number,
): Promise<RunSummary> {
  if (!code.trim()) return emptySummary(cases, 'Write some code first.');
  if (cases.length === 0) return { results: [], fatal: 'Add a test case (or use custom input) to run.', fatalLine: null, passed: 0, compared: 0 };
  if (language === 'python') return runPython(code, cases, onStatus, token);
  if (language === 'javascript') return runJavaScript(code, cases, onStatus, token);
  if (!opts.judge0Enabled) {
    return emptySummary(cases, 'Running C++/Java needs a Judge0 server configured on the backend (JUDGE0_URL / JUDGE0_API_KEY). Python and JavaScript run right in your browser.');
  }
  return runJudge0(language, code, cases, onStatus, token);
}

export function supportsInBrowser(language: SupportedLanguage): boolean {
  return language === 'python' || language === 'javascript';
}
