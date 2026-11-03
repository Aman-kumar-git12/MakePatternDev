import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Link2, Sparkles, Search, Loader2, ExternalLink, Lock, CheckCircle, ArrowLeft } from 'lucide-react';
import type { Folder, LeetCodeProblem, LeetCodeSearchItem, Question, QuestionStatus } from '../../types/dsa';
import { api, ApiError } from '../../services/api';
import { SafeHtml } from '../Common/SafeHtml';

interface ImportLeetCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  /** Called after a successful import with the created question. */
  onImported: (question: Question) => void | Promise<void>;
  /** Open a question that's already tracked. */
  onOpenExisting: (questionId: string) => void;
  initialQuery?: string;
  initialFolderId?: string;
}

const flattenFolders = (list: Folder[], depth = 0): Array<{ id: string; name: string; depth: number }> => {
  let result: Array<{ id: string; name: string; depth: number }> = [];
  for (const f of list) {
    result.push({ id: f.id, name: f.name, depth });
    if (f.subfolders?.length) result = result.concat(flattenFolders(f.subfolders, depth + 1));
  }
  return result;
};

/** URLs, slugs ("two-sum") and numbers ("1") go straight to a preview; free text searches. */
const isDirectReference = (q: string) =>
  /leetcode\.(com|cn)\/problems\//i.test(q) || /^\d+$/.test(q.trim()) || /^[a-z0-9]+(-[a-z0-9]+)+$/.test(q.trim());

const conflictInfo = (err: unknown): { message: string; questionId: string } | null => {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const detail = (err.data as { detail?: unknown } | null)?.detail;
  if (detail && typeof detail === 'object' && 'question_id' in detail) {
    const d = detail as { message?: string; question_id: string };
    return { message: d.message || 'Already in your tracker.', questionId: d.question_id };
  }
  return null;
};

export const ImportLeetCodeModal: React.FC<ImportLeetCodeModalProps> = ({
  isOpen,
  onClose,
  folders,
  onImported,
  onOpenExisting,
  initialQuery = '',
  initialFolderId,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<LeetCodeSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<LeetCodeProblem | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [folderId, setFolderId] = useState<string>(initialFolderId || '');
  const [status, setStatus] = useState<QuestionStatus>('Not Started');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ message: string; questionId: string } | null>(null);
  const [done, setDone] = useState(false);
  const searchSeq = useRef(0);

  const flatList = useMemo(() => flattenFolders(folders), [folders]);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setFolderId(initialFolderId || '');
      setPreview(null);
      setResults([]);
      setError(null);
      setConflict(null);
      setDone(false);
    }
  }, [isOpen, initialQuery, initialFolderId]);

  // Debounced LeetCode search for free-text queries.
  useEffect(() => {
    if (!isOpen || preview) return;
    const q = query.trim();
    if (q.length < 2 || isDirectReference(q)) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchLeetCode(q, 10);
        if (seq === searchSeq.current) setResults(res);
      } catch (err) {
        if (seq === searchSeq.current) setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, isOpen, preview]);

  if (!isOpen) return null;

  const loadPreview = async (ref: string) => {
    setError(null);
    setConflict(null);
    setLoadingPreview(true);
    try {
      const p = await api.getLeetCodeProblem(ref);
      setPreview(p);
      if (p.already_tracked && p.question_id) {
        setConflict({ message: 'This problem is already in your tracker.', questionId: p.question_id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Problem not found on LeetCode');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmitQuery = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (isDirectReference(q)) void loadPreview(q);
    else if (results[0]) void loadPreview(results[0].slug);
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    setError(null);
    setConflict(null);
    try {
      const created = await api.importLeetCode(preview.slug, folderId || null, status);
      setDone(true);
      await onImported(created);
      setTimeout(() => onClose(), 700);
    } catch (err) {
      const c = conflictInfo(err);
      if (c) setConflict(c);
      else setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm animate-fade-in"
      style={{ backgroundColor: 'var(--bg-overlay)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Import from LeetCode"
    >
      <div className="mp-card w-full sm:max-w-2xl max-h-[92vh] flex flex-col relative !rounded-b-none sm:!rounded-2xl">
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3 min-w-0">
            {preview ? (
              <button type="button" className="mp-btn !px-2" onClick={() => { setPreview(null); setConflict(null); }} title="Back to search">
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                <Link2 className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold">Import from LeetCode</h2>
              <p className="text-xs mp-muted">Real title, difficulty, tags, statement and examples</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="mp-btn !px-2" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar space-y-4">
          {done ? (
            <div className="py-10 text-center text-emerald-400 space-y-2">
              <CheckCircle className="w-10 h-10 mx-auto" />
              <p className="text-sm font-semibold">Imported!</p>
            </div>
          ) : !preview ? (
            <>
              <form onSubmit={handleSubmitQuery} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 mp-faint" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setError(null);
                    }}
                    placeholder="Search “two sum”, or paste a URL, slug, or number (e.g. 42)"
                    className="mp-input !pl-9"
                    aria-label="Search LeetCode"
                  />
                </div>
                <button type="submit" className="mp-btn mp-btn-primary" disabled={!query.trim() || loadingPreview}>
                  {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Preview'}
                </button>
              </form>

              {searching && (
                <div className="flex items-center gap-2 text-xs mp-muted">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching LeetCode…
                </div>
              )}

              {results.length > 0 && (
                <ul className="space-y-1.5">
                  {results.map((r) => (
                    <li key={r.slug}>
                      <button
                        type="button"
                        onClick={() => (r.already_tracked && r.question_id ? onOpenExisting(r.question_id) : void loadPreview(r.slug))}
                        className="w-full mp-card-alt px-3 py-2 flex items-center justify-between gap-2 text-left hover:border-[var(--border-hover)] transition"
                      >
                        <span className="min-w-0 truncate text-sm">
                          <span className="mp-faint font-mono mr-1.5">{r.frontend_id}.</span>
                          {r.title}
                          {r.is_paid_only && <Lock className="inline w-3 h-3 ml-1.5 mp-faint" aria-label="Premium" />}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          {r.already_tracked && <span className="mp-chip !text-emerald-400">Tracked · open</span>}
                          <span className={`mp-chip mp-diff-${r.difficulty}`}>{r.difficulty}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!searching && query.trim().length >= 2 && !isDirectReference(query) && results.length === 0 && !error && (
                <p className="text-xs mp-faint">No matches yet — keep typing, or paste the problem URL.</p>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold break-words">
                    <span className="mp-faint font-mono mr-1.5">{preview.frontend_id}.</span>
                    {preview.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className={`mp-chip mp-diff-${preview.difficulty}`}>{preview.difficulty}</span>
                    {preview.acceptance_rate != null && (
                      <span className="mp-chip">{preview.acceptance_rate.toFixed(1)}% acceptance</span>
                    )}
                    {preview.is_paid_only && (
                      <span className="mp-chip">
                        <Lock className="w-3 h-3" /> Premium
                      </span>
                    )}
                    {preview.tags.map((t) => (
                      <span key={t} className="mp-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <a href={preview.url} target="_blank" rel="noopener noreferrer" className="mp-btn !py-1">
                  <ExternalLink className="w-3.5 h-3.5" /> LeetCode
                </a>
              </div>

              {preview.statement_html ? (
                <div className="max-h-56 overflow-y-auto custom-scrollbar mp-card-alt p-3">
                  <SafeHtml html={preview.statement_html} />
                </div>
              ) : (
                <p className="text-xs mp-faint">
                  {preview.is_paid_only ? 'Statement is premium-only; title, tags and difficulty will still be imported.' : 'No statement available.'}
                </p>
              )}

              {preview.examples.length > 0 && (
                <p className="text-xs mp-muted">{preview.examples.length} example(s) will be added as test cases.</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold space-y-1">
                  <span className="mp-muted uppercase tracking-wider">Folder</span>
                  <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="mp-input">
                    <option value="">No folder (unfiled)</option>
                    {flatList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {' '.repeat(f.depth * 3)}
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold space-y-1">
                  <span className="mp-muted uppercase tracking-wider">Status</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value as QuestionStatus)} className="mp-input">
                    <option>Not Started</option>
                    <option>In Progress</option>
                    <option>Solved</option>
                    <option>Needs Revision</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {conflict && (
            <div className="mp-card-alt p-3 flex flex-wrap items-center justify-between gap-2 text-xs" role="status">
              <span>{conflict.message}</span>
              <button type="button" className="mp-btn mp-btn-primary !py-1" onClick={() => onOpenExisting(conflict.questionId)}>
                Open it
              </button>
            </div>
          )}
          {error && (
            <p className="text-xs text-rose-400" role="alert">
              {error}
            </p>
          )}
        </div>

        {preview && !done && (
          <div className="p-4 sm:p-5 flex justify-end gap-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <button type="button" className="mp-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="mp-btn mp-btn-primary" onClick={handleImport} disabled={importing || Boolean(conflict)}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {importing ? 'Importing…' : 'Import problem'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
