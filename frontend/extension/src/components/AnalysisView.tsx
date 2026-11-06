import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { browser } from 'wxt/browser';
import { useStorage } from '../hooks/useStorage';
import { send } from '../lib/messages';
import { missingSetup, selection } from '../lib/complexityAgent';
import type { Analysis } from '../lib/types';
import { Button, Card, cx, SectionTitle } from './ui';

const CONFIDENCE_LABEL = { high: 'likely', medium: 'probable', low: 'possible' } as const;

function ScoreRing({ value, max, label, grade }: { value: number; max: number; label: string; grade?: string }) {
  const pct = value / max;
  const tone = pct >= 0.85 ? 'var(--good)' : pct >= 0.55 ? 'var(--accent)' : 'var(--critical)';
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-2.5" title={`${label}: ${value}/${max}${grade ? ` · grade ${grade}` : ''}`}>
      <span className="sr-only">
        {label} {value} out of {max}
        {grade ? `, grade ${grade}` : ''}
      </span>
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform="rotate(-90 28 28)"
        />
        <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text)">
          {value}
        </text>
      </svg>
      <div aria-hidden>
        <div className="text-[11px] text-ink-3">
          {label}
          {grade ? ` · grade ${grade}` : ''}
        </div>
        <div className="text-xs font-medium">out of {max}</div>
      </div>
    </div>
  );
}

export function AnalysisView({ a }: { a: Analysis }) {
  const h = a.heuristic;
  const m = h.readability.metrics;
  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle right={<span className="text-[11px] text-ink-3">instant · offline</span>}>Quick analysis</SectionTitle>
        <div className="flex items-center justify-between gap-3">
          <ScoreRing value={h.readability.score} max={100} label="Readability" grade={h.readability.grade} />
          <div className="text-right">
            <div className="text-[11px] text-ink-3">Estimated time</div>
            <div className="tabular text-sm font-semibold">{h.complexity.time}</div>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-ink-3">{h.complexity.reason}</p>

        <div className="mt-3">
          <div className="mb-1 text-[11px] font-semibold text-ink-2">Algorithms & patterns detected</div>
          {h.algorithms.length ? (
            <ul className="space-y-1">
              {h.algorithms.map((alg) => (
                <li key={alg.name} className="text-xs">
                  <span className="font-medium">{alg.name}</span>{' '}
                  <span className="text-[11px] text-ink-3">
                    ({CONFIDENCE_LABEL[alg.confidence]}) — {alg.evidence}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-ink-3">No known pattern detected — try the AI review below.</p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          {[
            ['Lines', m.codeLines],
            ['Max nesting', m.maxNesting],
            ['Longest fn', m.longestFunction],
            ['Avg line', m.avgLineLength],
          ].map(([label, v]) => (
            <div key={label} className="rounded-md bg-surface-2 py-1">
              <div className="tabular text-sm font-semibold">{v}</div>
              <div className="text-[10px] text-ink-3">{label}</div>
            </div>
          ))}
        </div>

        {h.readability.issues.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-ink-2">
            {h.readability.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
      </Card>

      <AiReviewCard a={a} />
    </div>
  );
}

const AGENT_CONFIDENCE = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' } as const;

/**
 * The AI review. It talks only about complexity: Big-O time and space, why, and whether a better
 * complexity exists. It runs through the local complexity agent with the provider chosen in settings.
 */
function AiReviewCard({ a }: { a: Analysis }) {
  const settings = useStorage('settings');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!settings) return null;
  const { provider } = selection(settings.agent);
  const missing = missingSetup(settings.agent);
  const r = a.complexityAi;
  const running = busy || a.complexityAiStatus === 'running';
  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await send({ type: 'analyzeComplexity', analysisId: a.id });
    } catch (e) {
      // Also recorded on the analysis; shown here in case the write raced the popup.
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const shownError = a.complexityAiStatus === 'error' ? a.complexityAiError || error : error;
  return (
    <Card highlight={a.complexityAiStatus === 'done'}>
      <SectionTitle right={r && <span className="text-[11px] text-ink-3">{r.provider} · {r.model}</span>}>AI review · complexity</SectionTitle>
      {r && a.complexityAiStatus !== 'running' && (
        <div className="mb-2 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-md bg-surface px-2 py-1.5">
              <div className="text-[10px] text-ink-3">Time</div>
              <div className="tabular font-semibold">{r.time_complexity}</div>
            </div>
            <div className="rounded-md bg-surface px-2 py-1.5">
              <div className="text-[10px] text-ink-3">Space</div>
              <div className="tabular font-semibold">{r.space_complexity}</div>
            </div>
          </div>
          {r.time_explanation && (
            <p className="text-[11px] text-ink-2">
              <span className="font-semibold">Time: </span>
              {r.time_explanation}
            </p>
          )}
          {r.space_explanation && (
            <p className="text-[11px] text-ink-2">
              <span className="font-semibold">Space: </span>
              {r.space_explanation}
            </p>
          )}
          {r.variables.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-ink-2">
              {r.variables.map((v) => (
                <li key={v.name}>
                  <span className="font-mono font-semibold">{v.name}</span> = {v.meaning}
                </li>
              ))}
            </ul>
          )}
          {(r.suggestion || r.better_complexity) && (
            <div
              className={cx(
                'rounded-md px-2 py-1.5 text-[11px]',
                r.is_optimal
                  ? 'bg-[color-mix(in_srgb,var(--good)_12%,transparent)]'
                  : 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]',
              )}
            >
              <div className={cx('font-semibold', r.is_optimal ? 'text-good-text' : 'text-accent')}>
                {r.is_optimal ? '✓ Already optimal' : `Can be improved${r.better_complexity ? ` to ${r.better_complexity}` : ''}`}
              </div>
              {r.suggestion && <p className="mt-0.5 text-ink-2">{r.suggestion}</p>}
            </div>
          )}
          <p className="text-[10.5px] text-ink-3">{AGENT_CONFIDENCE[r.confidence]}</p>
        </div>
      )}
      {!r && !running && !shownError && (
        <p className="text-[11px] text-ink-2">
          Reviews only the complexity: Big-O time and space, why, and whether a faster or leaner approach exists. Uses {provider.label} through your local agent.
        </p>
      )}
      {running ? (
        <p className="flex items-center gap-2 text-xs text-ink-2" role="status">
          <Loader2 size={14} className="animate-spin" aria-hidden /> Asking {provider.label}…
        </p>
      ) : missing ? (
        <>
          <p className="text-[11px] text-ink-3">{missing}</p>
          <Button className="mt-2" onClick={() => void browser.runtime.openOptionsPage()}>
            Open settings
          </Button>
        </>
      ) : (
        <>
          {shownError && (
            <p className="text-xs text-critical" role="alert">
              ⚠ {shownError}
            </p>
          )}
          <Button variant={r ? 'secondary' : 'primary'} className="mt-2" onClick={() => void run()}>
            <Sparkles size={13} aria-hidden /> {shownError ? 'Retry' : r ? `Review again with ${provider.label}` : `Review with ${provider.label}`}
          </Button>
        </>
      )}
    </Card>
  );
}
