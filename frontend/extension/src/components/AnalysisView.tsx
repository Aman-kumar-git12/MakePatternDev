import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { browser } from 'wxt/browser';
import { useNow } from '../hooks/useStorage';
import { send } from '../lib/messages';
import type { Analysis } from '../lib/types';
import { Button, Card, cx, SectionTitle } from './ui';

const CONFIDENCE_LABEL = { high: 'likely', medium: 'probable', low: 'possible' } as const;
/** A review still "running" after this long almost certainly died with the service worker. */
const STALE_MS = 3 * 60_000;

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

export function AnalysisView({ a, hasKey }: { a: Analysis; hasKey: boolean }) {
  const h = a.heuristic;
  const m = h.readability.metrics;
  const now = useNow(15_000);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const startedAt = a.aiStartedAt ?? 0;
  const stale = a.aiStatus === 'running' && now - startedAt > STALE_MS;
  const requestReview = async () => {
    setRequesting(true);
    setRequestError('');
    try {
      await send({ type: 'analyzeAi', analysisId: a.id });
    } catch (e) {
      setRequestError(`Couldn't start the review: ${(e as Error).message}`);
    } finally {
      setRequesting(false);
    }
  };
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
            <p className="text-[11px] text-ink-3">No known pattern detected — try the Claude review.</p>
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

      <Card highlight={a.aiStatus === 'done'}>
        <SectionTitle right={a.aiModel && <span className="text-[11px] text-ink-3">{a.aiModel}</span>}>Claude review</SectionTitle>
        {a.aiStatus === 'idle' && (
          <>
            <p className="text-[11px] text-ink-2">
              Deep review: exact algorithms, complexity with justification, a 1–10 readability score, concrete improvements, edge-case risks and whether a better approach exists.
            </p>
            {hasKey ? (
              <Button variant="primary" className="mt-2" onClick={() => void requestReview()} disabled={requesting}>
                <Sparkles size={13} aria-hidden /> {requesting ? 'Starting…' : 'Review with Claude'}
              </Button>
            ) : (
              <Button className="mt-2" onClick={() => void browser.runtime.openOptionsPage()}>
                Add an Anthropic API key in settings
              </Button>
            )}
          </>
        )}
        {a.aiStatus === 'running' && !stale && (
          <p className="flex items-center gap-2 text-xs text-ink-2" role="status">
            <Loader2 size={14} className="animate-spin" aria-hidden /> Claude is reviewing your code… you can close the popup.
          </p>
        )}
        {(a.aiStatus === 'error' || stale) && (
          <>
            <p className="text-xs text-critical" role="alert">
              ⚠ {stale ? 'The review is taking too long and may have stopped.' : a.aiError || 'The review failed.'}
            </p>
            <Button className="mt-2" onClick={() => void requestReview()} disabled={requesting || !hasKey}>
              {requesting ? 'Retrying…' : 'Retry'}
            </Button>
          </>
        )}
        {requestError && (
          <p className="mt-2 text-xs text-critical" role="alert">
            {requestError}
          </p>
        )}
        {a.aiStatus === 'done' && a.ai && <AiReportView a={a} />}
      </Card>
    </div>
  );
}

function AiReportView({ a }: { a: Analysis }) {
  const r = a.ai!;
  return (
    <div className="space-y-2.5 text-xs">
      <p className="text-ink">{r.summary}</p>
      <div className="flex items-center justify-between gap-3">
        <ScoreRing value={r.readability.score} max={10} label="Readability" />
        <div className="text-right">
          <div className="text-[11px] text-ink-3">Approach</div>
          <div className="font-semibold">{r.approach}</div>
        </div>
      </div>
      <p className="text-[11px] text-ink-2">{r.readability.verdict}</p>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-md bg-surface px-2 py-1.5">
          <div className="text-[10px] text-ink-3">Time</div>
          <div className="tabular font-semibold">{r.timeComplexity}</div>
        </div>
        <div className="rounded-md bg-surface px-2 py-1.5">
          <div className="text-[10px] text-ink-3">Space</div>
          <div className="tabular font-semibold">{r.spaceComplexity}</div>
        </div>
      </div>
      <p className="text-[11px] text-ink-3">{r.complexityExplanation}</p>

      <List title="Algorithms" items={r.algorithms.map((x) => `${x.name} — ${x.role}`)} />
      {r.dataStructures.length > 0 && <p className="text-[11px]"><span className="font-semibold text-ink-2">Data structures: </span>{r.dataStructures.join(', ')}</p>}
      <List title="Readability strengths" items={r.readability.strengths} />
      <List title="Readability issues" items={r.readability.issues} />
      {r.improvements.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold text-ink-2">Improvements</div>
          <ol className="list-decimal space-y-1 pl-4">
            {r.improvements.map((i) => (
              <li key={i.title}>
                <span className="font-medium">{i.title}.</span> <span className="text-ink-2">{i.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <List title="Edge-case risks" items={r.edgeCaseRisks} tone="critical" />
      <div>
        <div className="mb-0.5 text-[11px] font-semibold text-ink-2">Optimal approach</div>
        <p className="text-ink-2">{r.optimalApproach}</p>
      </div>
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: 'critical' }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-semibold text-ink-2">{title}</div>
      <ul className={cx('list-disc space-y-0.5 pl-4', tone === 'critical' ? 'text-ink' : 'text-ink-2')}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
