import React, { useEffect, useState } from 'react';
import { X, GraduationCap, Loader2, Download, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import type { Curriculum, ImportedCollection } from '../../types/dsa';

interface CurriculaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (result: ImportedCollection) => void | Promise<void>;
}

/** Picker for curated starter problem lists (imported as a folder tree of real LeetCode problems). */
export const CurriculaModal: React.FC<CurriculaModalProps> = ({ isOpen, onClose, onImported }) => {
  const [items, setItems] = useState<Curriculum[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<ImportedCollection | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDone(null);
    setError(null);
    let alive = true;
    api
      .getCurricula()
      .then((c) => alive && setItems(c))
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'Could not load curricula'));
    return () => {
      alive = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImport = async (c: Curriculum) => {
    setBusyId(c.id);
    setError(null);
    try {
      const res = await api.importCurriculum(c.id);
      setDone(res);
      await onImported(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm animate-fade-in"
      style={{ backgroundColor: 'var(--bg-overlay)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Starter curricula"
    >
      <div className="mp-card w-full sm:max-w-2xl max-h-[92vh] flex flex-col !rounded-b-none sm:!rounded-2xl">
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}>
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Starter curricula</h2>
              <p className="text-xs mp-muted">Import a ready-made, pattern-ordered problem list into your workspace</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="mp-btn !px-2" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar space-y-3">
          {done && (
            <div className="mp-card-alt p-3 flex items-center gap-2 text-xs text-emerald-400" role="status">
              <CheckCircle className="w-4 h-4" />
              Imported {done.questions_imported} problems into “{done.folder_name}”.
            </div>
          )}
          {error && (
            <p className="text-xs text-rose-400" role="alert">
              {error}
            </p>
          )}
          {!items && !error && (
            <div className="flex items-center gap-2 text-xs mp-muted py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {items?.map((c) => (
            <div key={c.id} className="mp-card-alt p-3.5 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold">{c.name}</h3>
                  <p className="text-xs mp-muted mt-0.5">{c.description}</p>
                </div>
                <button
                  type="button"
                  className="mp-btn mp-btn-primary shrink-0"
                  disabled={busyId !== null}
                  onClick={() => handleImport(c)}
                >
                  {busyId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Import {c.problem_count}
                </button>
              </div>
              {c.patterns.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.patterns.map((p) => (
                    <span key={p} className="mp-chip">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
