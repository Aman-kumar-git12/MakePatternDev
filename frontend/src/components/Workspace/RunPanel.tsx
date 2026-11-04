import React, { useEffect, useRef, useState } from 'react';
import { Play, Loader2, CheckCircle2, XCircle, AlertTriangle, Clock, Terminal, ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { RunConfig, SupportedLanguage, TestCase } from '../../types/dsa';
import { api } from '../../services/api';
import { cancelRuns, runTests, supportsInBrowser, type CaseResult, type RunSummary } from '../../runner';

let configPromise: Promise<RunConfig> | null = null;
function loadRunConfig(): Promise<RunConfig> {
  if (!configPromise) {
    configPromise = api.getRunConfig().catch(() => {
      configPromise = null;
      return { judge0_enabled: false, languages: ['python', 'javascript'] } as RunConfig;
    });
  }
  return configPromise;
}

interface RunPanelProps {
  code: string;
  language: SupportedLanguage;
  testCases: TestCase[];
  /** Optional heading override (e.g. which solution is being run). */
  label?: string;
}

const OUTCOME_STYLE: Record<CaseResult['outcome'], { text: string; cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  pass: { text: 'Passed', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10', Icon: CheckCircle2 },
  fail: { text: 'Wrong answer', cls: 'text-rose-400 border-rose-500/30 bg-rose-500/10', Icon: XCircle },
  error: { text: 'Error', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10', Icon: AlertTriangle },
  timeout: { text: 'Timed out', cls: 'text-orange-400 border-orange-500/30 bg-orange-500/10', Icon: Clock },
  ran: { text: 'Ran', cls: 'text-sky-400 border-sky-500/30 bg-sky-500/10', Icon: Terminal },
};

const Block: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-slate-200' }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5">{label}</div>
    <pre className={`text-[11px] font-mono whitespace-pre-wrap break-all bg-[#080C14] border border-slate-800 rounded-lg px-2 py-1.5 max-h-40 overflow-auto ${tone}`}>
      {value || ' '}
    </pre>
  </div>
);

const ResultRow: React.FC<{ r: CaseResult; defaultOpen: boolean }> = ({ r, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const style = OUTCOME_STYLE[r.outcome];
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800/40 transition"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
        <span className="text-xs font-medium text-slate-200 truncate flex-1 min-w-0">{r.title}</span>
        {r.ms != null && <span className="text-[10px] text-slate-500 font-mono shrink-0">{r.ms} ms</span>}
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${style.cls}`}>
          <style.Icon className="w-3 h-3" />
          {r.outcome === 'ran' ? 'No expected output' : style.text}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-800">
          <Block label="Input" value={r.input} />
          {r.error ? (
            <Block label={r.line ? `Error (line ${r.line})` : 'Error'} value={r.error} tone="text-amber-300" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Block label="Your output" value={r.actual ?? ''} tone={r.outcome === 'fail' ? 'text-rose-300' : 'text-emerald-300'} />
              <Block label="Expected" value={r.expected || '— (none saved)'} tone="text-slate-300" />
            </div>
          )}
          {r.stdout && <Block label="Stdout" value={r.stdout} tone="text-slate-400" />}
          {r.warning && (
            <p className="text-[11px] text-amber-300/90 flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{r.warning}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const RunPanel: React.FC<RunPanelProps> = ({ code, language, testCases, label }) => {
  const [config, setConfig] = useState<RunConfig | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customExpected, setCustomExpected] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    loadRunConfig().then((c) => mounted.current && setConfig(c));
    return () => {
      mounted.current = false;
      cancelRuns(); // a run from a panel that's gone must not keep using the shared worker
    };
  }, []);

  const inBrowser = supportsInBrowser(language);
  const judge0Enabled = !!config?.judge0_enabled;
  const disabledReason = !inBrowser && !judge0Enabled ? 'Needs a Judge0 key on the server to run C++/Java' : null;

  const execute = async (mode: 'tests' | 'custom') => {
    if (running || disabledReason) return;
    const cases =
      mode === 'tests'
        ? testCases.map((tc, i) => ({ id: tc.id, title: tc.title || `Case ${i + 1}`, input: tc.input || '', expected: tc.expected_output || '' }))
        : [{ id: 'custom', title: 'Custom input', input: customInput, expected: customExpected }];
    setRunning(true);
    setSummary(null);
    setStatus(inBrowser ? 'Starting…' : 'Sending to server…');
    try {
      const res = await runTests(language, code, cases, (m) => mounted.current && setStatus(m), { judge0Enabled });
      if (mounted.current) setSummary(res);
    } catch (e) {
      if (mounted.current) setSummary({ results: [], fatal: (e as Error).message || 'Run failed', fatalLine: null, passed: 0, compared: 0 });
    } finally {
      if (mounted.current) {
        setRunning(false);
        setStatus('');
      }
    }
  };

  const allPassed = summary && !summary.fatal && summary.compared > 0 && summary.passed === summary.compared;

  return (
    <div className="bg-[#0A0F1D] border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-sm min-w-0">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider truncate">{label || 'Run your code'}</span>
          <span className="text-[10px] text-slate-500 font-mono shrink-0">
            {language}
            {inBrowser ? ' · in browser' : judge0Enabled ? ' · Judge0' : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCustomOpen((o) => !o)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-[11px] hover:bg-slate-800 transition"
          >
            {customOpen ? 'Hide custom input' : 'Custom input'}
          </button>
          <button
            type="button"
            onClick={() => execute('tests')}
            disabled={running || !!disabledReason || testCases.length === 0}
            title={disabledReason || (testCases.length === 0 ? 'Add a test case first' : `Run ${testCases.length} saved test case(s)`)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Run tests{testCases.length ? ` (${testCases.length})` : ''}</span>
          </button>
        </div>
      </div>

      {disabledReason && (
        <p className="text-[11px] text-slate-400 bg-slate-800/40 border border-slate-800 rounded-lg px-2.5 py-1.5">
          {disabledReason}. Python and JavaScript run right in your browser — switch the solution language to try them.
          For C++/Java, the program should read the test input from stdin and print the answer.
        </p>
      )}
      {!disabledReason && !inBrowser && (
        <p className="text-[11px] text-slate-500">Your program reads each test case's input from stdin; its printed output is compared with the expected output.</p>
      )}

      {customOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="min-w-0">
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5">Input</label>
            <textarea
              rows={3}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={inBrowser ? 'nums = [2,7,11,15], target = 9' : '4\n2 7 11 15\n9'}
              className="w-full bg-[#0D1527] border border-slate-700/80 rounded-lg p-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5">
              Expected <span className="normal-case font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={customExpected}
              onChange={(e) => setCustomExpected(e.target.value)}
              placeholder="[0,1]"
              className="w-full bg-[#0D1527] border border-slate-700/80 rounded-lg p-2 text-xs font-mono text-emerald-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={() => execute('custom')}
              disabled={running || !!disabledReason}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold flex items-center gap-1.5 transition"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Run custom input</span>
            </button>
          </div>
        </div>
      )}

      {running && status && (
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5" role="status" aria-live="polite">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{status}</span>
        </div>
      )}

      {summary && (
        <div className="space-y-2" aria-live="polite">
          {summary.fatal ? (
            <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-2 whitespace-pre-wrap break-words">
              {summary.fatalLine ? <strong>Line {summary.fatalLine}: </strong> : null}
              {summary.fatal}
            </div>
          ) : (
            <div className={`text-xs font-semibold ${allPassed ? 'text-emerald-400' : summary.compared ? 'text-rose-400' : 'text-sky-400'}`}>
              {summary.compared
                ? `${summary.passed}/${summary.compared} passed${allPassed ? ' 🎉' : ''}`
                : `Ran ${summary.results.length} case(s) — no expected outputs to compare`}
              {summary.results.length > summary.compared && summary.compared > 0 && (
                <span className="text-slate-500 font-normal"> · {summary.results.length - summary.compared} without expected output</span>
              )}
            </div>
          )}
          {!summary.fatal &&
            summary.results.map((r) => <ResultRow key={r.id} r={r} defaultOpen={r.outcome !== 'pass' || summary.results.length === 1} />)}
        </div>
      )}
    </div>
  );
};
