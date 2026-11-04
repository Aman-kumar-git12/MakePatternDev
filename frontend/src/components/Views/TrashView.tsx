import React, { useCallback, useEffect, useState } from 'react';
import { Trash2, RotateCcw, Loader2, FileText, Folder as FolderIcon, Layers, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import type { TrashItem } from '../../types/dsa';
import { pushToast } from '../../hooks/useUndoToasts';

interface TrashViewProps {
  /** Re-sync tree/list/summary after a restore. */
  onDataChanged: () => void | Promise<void>;
}

const timeAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};

const expiresIn = (iso: string): string => {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(days)) return '';
  if (days <= 0) return 'expires today';
  return days === 1 ? 'expires in 1 day' : `expires in ${days} days`;
};

const kindIcon = (kind: TrashItem['kind']) => (kind === 'folder' ? FolderIcon : kind === 'bulk' ? Layers : FileText);

const describe = (item: TrashItem): string => {
  const parts: string[] = [];
  if (item.folder_count > 0) parts.push(`${item.folder_count} folder${item.folder_count === 1 ? '' : 's'}`);
  if (item.question_count > 0) parts.push(`${item.question_count} question${item.question_count === 1 ? '' : 's'}`);
  return parts.join(' · ') || (item.kind === 'question' ? 'Question' : 'Empty');
};

/** Soft-deleted items, restorable for 30 days. */
export const TrashView: React.FC<TrashViewProps> = ({ onDataChanged }) => {
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  /** Item awaiting a second click to delete permanently (this can't be undone). */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [emptying, setEmptying] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.listTrash();
      setError(null);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load trash');
      setItems([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .listTrash()
      .then((list) => {
        if (alive) setItems(list);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Could not load trash');
        setItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleRestore = async (item: TrashItem) => {
    setBusyId(item.id);
    try {
      const res = await api.restoreTrashItem(item.id);
      setItems((prev) => (prev ? prev.filter((x) => x.id !== item.id) : prev));
      const n = res.restored_questions;
      pushToast({
        message: `Restored “${item.title}”${n ? ` (${n} question${n === 1 ? '' : 's'})` : ''}`,
        tone: 'success',
        duration: 3500,
      });
      await onDataChanged();
    } catch (err) {
      pushToast({ message: err instanceof Error ? err.message : 'Restore failed', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteForever = async (item: TrashItem) => {
    setConfirmDeleteId(null);
    setBusyId(item.id);
    try {
      await api.deleteTrashItem(item.id);
      setItems((prev) => (prev ? prev.filter((x) => x.id !== item.id) : prev));
      pushToast({ message: `Permanently deleted “${item.title}”`, duration: 3000 });
    } catch (err) {
      pushToast({ message: err instanceof Error ? err.message : 'Delete failed', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleEmpty = async () => {
    setEmptying(true);
    try {
      const res = await api.emptyTrash();
      setItems([]);
      setConfirmEmpty(false);
      pushToast({ message: `Emptied trash (${res.deleted} item${res.deleted === 1 ? '' : 's'})`, duration: 3000 });
    } catch (err) {
      pushToast({ message: err instanceof Error ? err.message : 'Could not empty trash', tone: 'error' });
    } finally {
      setEmptying(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 animate-fade-in">
      <div className="mp-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Trash</h2>
            <p className="text-xs mp-muted">Deleted folders and questions are kept for 30 days, then removed for good.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className="mp-btn" onClick={() => void load()} aria-label="Refresh trash">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {items && items.length > 0 && !confirmEmpty && (
            <button type="button" className="mp-btn mp-btn-danger" onClick={() => setConfirmEmpty(true)}>
              <Trash2 className="w-3.5 h-3.5" />
              Empty trash
            </button>
          )}
        </div>
      </div>

      {confirmEmpty && (
        <div className="mp-card p-4 flex flex-col sm:flex-row sm:items-center gap-3" role="alertdialog" aria-label="Confirm empty trash" style={{ borderColor: 'rgba(244,63,94,0.35)' }}>
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <p className="text-xs flex-1">
            Permanently delete all {items?.length ?? 0} item{items?.length === 1 ? '' : 's'} in the trash? This can't be undone.
          </p>
          <div className="flex gap-2">
            <button type="button" className="mp-btn" onClick={() => setConfirmEmpty(false)} disabled={emptying}>
              Cancel
            </button>
            <button type="button" className="mp-btn mp-btn-danger" onClick={handleEmpty} disabled={emptying} autoFocus>
              {emptying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete forever
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      {items === null ? (
        <div className="flex items-center justify-center py-16" role="status">
          <Loader2 className="w-5 h-5 animate-spin mp-muted" />
          <span className="sr-only">Loading trash…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="mp-card p-10 text-center space-y-2">
          <Trash2 className="w-8 h-8 mx-auto mp-faint" />
          <p className="text-sm font-semibold">Trash is empty</p>
          <p className="text-xs mp-muted">Deleted questions and folders show up here so you can restore them.</p>
        </div>
      ) : (
        <ul className="mp-card divide-y" style={{ borderColor: 'var(--border-subtle, rgba(148,163,184,0.15))' }}>
          {items.map((item) => {
            const Icon = kindIcon(item.kind);
            const busy = busyId === item.id;
            return (
              <li key={item.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: 'inherit' }}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Icon className="w-4 h-4 shrink-0 mp-muted" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" title={item.title}>
                      {item.title}
                    </p>
                    <p className="text-[11px] mp-muted">
                      {describe(item)} · deleted {timeAgo(item.deleted_at)} · {expiresIn(item.expires_at)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" className="mp-btn mp-btn-primary" onClick={() => handleRestore(item)} disabled={busy}>
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Restore
                  </button>
                  {confirmDeleteId === item.id ? (
                    <>
                      <button
                        type="button"
                        className="mp-btn mp-btn-danger"
                        onClick={() => handleDeleteForever(item)}
                        disabled={busy}
                        aria-label={`Confirm: delete ${item.title} forever`}
                        autoFocus
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Confirm
                      </button>
                      <button type="button" className="mp-btn" onClick={() => setConfirmDeleteId(null)} disabled={busy}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="mp-btn mp-btn-danger"
                      onClick={() => setConfirmDeleteId(item.id)}
                      disabled={busy}
                      aria-label={`Delete ${item.title} forever`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete forever</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
