import { ArrowLeft, Code2, FileCode2, History, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useStorage } from '../hooks/useStorage';
import { send } from '../lib/messages';
import { relativeAgo } from '../lib/time';
import type { Analysis, Submission } from '../lib/types';
import { AnalysisView } from './AnalysisView';
import { Button, cx, Empty, IconButton, PlatformIcon, platformVars, SectionTitle } from './ui';

/** Set by the background on browser-captured LeetCode submissions it couldn't confirm yet. */
const isUnverified = (s: Submission) => s.unverified === true;

export function AnalyzeTab() {
  const subs = useStorage('submissions');
  const analyses = useStorage('analyses');
  const settings = useStorage('settings');
  const [openId, setOpenId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showAll, setShowAll] = useState(false);

  if (!subs || !analyses || !settings) return null;
  const openAnalysis = (id: string | null) => {
    setOpenId(id);
    setConfirmDelete(false);
    setDeleteError('');
  };
  const hasKey = !!settings.ai.apiKey.trim();
  const open = openId ? analyses[openId] : undefined;

  const run = async (req: { submissionId?: string; code?: string }) => {
    setBusy(true);
    setError('');
    try {
      const a = await send<Analysis>({ type: 'analyze', ...req, withAi: false });
      openAnalysis(a.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (open) {
    // There is no message to re-create a deleted analysis, so deleting asks for confirmation.
    const remove = async () => {
      setDeleting(true);
      setDeleteError('');
      try {
        await send({ type: 'deleteAnalysis', analysisId: open.id });
        setConfirmDelete(false);
        setOpenId(null);
      } catch (e) {
        setDeleteError(`Couldn't delete: ${(e as Error).message}`);
      } finally {
        setDeleting(false);
      }
    };
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <IconButton title="Back to analyses" onClick={() => openAnalysis(null)}>
            <ArrowLeft size={14} aria-hidden />
          </IconButton>
          <div className="min-w-0 flex-1 truncate text-xs font-semibold">{open.title}</div>
          <IconButton title="Delete analysis" pressed={confirmDelete} onClick={() => setConfirmDelete((v) => !v)}>
            <Trash2 size={13} aria-hidden />
          </IconButton>
        </div>
        {confirmDelete && (
          <div className="card flex items-center gap-2 px-3 py-2 text-[11.5px]" role="alertdialog" aria-label="Delete this analysis?">
            <span className="min-w-0 flex-1">Delete this analysis? This can't be undone.</span>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button className="text-critical" onClick={() => void remove()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        )}
        {deleteError && (
          <p className="text-[11px] text-critical" role="alert">
            {deleteError}
          </p>
        )}
        <AnalysisView a={open} hasKey={hasKey} />
        <details className="rounded-lg border border-line">
          <summary className="cursor-pointer px-2.5 py-1.5 text-[11px] text-ink-2">Show code ({open.heuristic.language})</summary>
          <pre className="scroll-thin max-h-56 overflow-auto px-2.5 pb-2 text-[11px] leading-snug">{open.code}</pre>
        </details>
      </div>
    );
  }

  const captured = [...subs].filter((s) => s.code).reverse().slice(0, 8);
  const allAnalyses = Object.values(analyses).sort((a, b) => b.createdAt - a.createdAt);
  const recent = showAll ? allAnalyses : allAnalyses.slice(0, 6);
  const scoreTone = (v: number, max: number) =>
    v / max >= 0.85 ? 'text-good-text' : v / max >= 0.55 ? 'text-accent' : 'text-critical';

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <span className="brand-gradient flex h-6 w-6 items-center justify-center rounded-lg text-white">
            <Code2 size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-bold">Analyze a solution</div>
            <div className="text-[10.5px] text-ink-3">Readability, patterns &amp; complexity{hasKey ? ' · plus Claude review' : ''}</div>
          </div>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste a solution (C++, Java, Python, JS, Go…)"
          spellCheck={false}
          aria-label="Code to analyze"
          className="scroll-thin block h-28 w-full resize-y bg-surface-2 p-3 font-mono text-[11px] leading-relaxed outline-none placeholder:text-ink-3 focus:bg-card"
        />
        <div className="flex items-center gap-2 border-t border-line px-3 py-2">
          <span className="text-[10.5px] text-ink-3">{code.trim() ? `${code.split('\n').length} lines` : 'Runs instantly, offline'}</span>
          <Button variant="primary" className="ml-auto" disabled={busy || !code.trim()} onClick={() => void run({ code })}>
            <Sparkles size={13} /> {busy ? 'Analyzing…' : 'Analyze'}
          </Button>
        </div>
        {error && <p className="px-3 pb-2 text-[11px] text-critical">{error}</p>}
      </div>

      <section>
        <SectionTitle icon={<FileCode2 size={13} />}>Your recent LeetCode submissions</SectionTitle>
        {captured.length ? (
          <ul className="space-y-1.5">
            {captured.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run({ submissionId: s.id })}
                  style={platformVars(s.platform)}
                  className="card flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left transition hover:-translate-y-px disabled:opacity-60"
                  title={`Analyze ${s.title}`}
                >
                  <PlatformIcon platform={s.platform} size={24} named />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold">{s.title}</span>
                    <span className="text-[10.5px] text-ink-3">
                      {relativeAgo(s.ts)}
                      {isUnverified(s) && (
                        <span className="ml-1.5 rounded-full border border-line px-1.5 text-[10px] font-semibold text-ink-2" title="Captured in the browser but not yet confirmed by LeetCode's submission history">
                          unverified
                        </span>
                      )}
                    </span>
                  </span>
                  <span
                    className={cx(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                      s.verdict === 'AC'
                        ? 'bg-[color-mix(in_srgb,var(--good)_14%,transparent)] text-good-text'
                        : 'bg-[color-mix(in_srgb,var(--critical)_14%,transparent)] text-critical',
                    )}
                  >
                    {s.verdict === 'AC' ? '✓ Accepted' : `✗ ${s.verdict}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Submit a solution on LeetCode and it shows up here with its code, ready to analyze.</Empty>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <SectionTitle
            icon={<History size={13} />}
            right={
              allAnalyses.length > 6 && (
                <button
                  type="button"
                  className="min-h-8 cursor-pointer rounded-lg px-1.5 text-[11px] font-semibold text-accent hover:underline"
                  aria-expanded={showAll}
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? 'Show fewer' : `Show all (${allAnalyses.length})`}
                </button>
              )
            }
          >
            Past analyses
          </SectionTitle>
          <ul className="space-y-1.5">
            {recent.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => openAnalysis(a.id)}
                  className="card flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition hover:-translate-y-px"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold">{a.title}</span>
                    <span className="text-[10.5px] text-ink-3">
                      {a.heuristic.language} · {a.heuristic.complexity.time} · {relativeAgo(a.createdAt)}
                    </span>
                  </span>
                  <span className={cx('tabular shrink-0 text-[13px] font-extrabold', scoreTone(a.heuristic.readability.score, 100))} title="Readability score">
                    <span className="sr-only">Readability </span>
                    {a.heuristic.readability.score}
                    <span className="text-[10px] font-semibold text-ink-3">/100</span>
                  </span>
                  {a.ai && (
                    <span className="brand-gradient shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" title="Claude review score">
                      <span className="sr-only">Claude review score </span>AI {a.ai.readability.score}/10
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
