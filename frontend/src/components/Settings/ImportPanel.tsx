import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileJson, Loader2, Check, X, FolderOpen } from 'lucide-react';
import { api } from '../../services/api';
import type { DataImportResult } from '../../types/dsa';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_QUESTIONS = 5000;

interface Preview {
  fileName: string;
  sizeKb: number;
  exportedAt?: string;
  folders: number;
  questions: number;
  solutions: number;
  testCases: number;
  payload: unknown;
}

const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/** Validate a MakePattern export client-side and summarise it before uploading. */
const buildPreview = async (file: File): Promise<Preview> => {
  if (file.size > MAX_BYTES) throw new Error(`File is ${(file.size / 1048576).toFixed(1)} MB — the limit is 10 MB.`);
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const obj = data as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object' || obj.format !== 'makepattern-export') {
    throw new Error('Not a MakePattern export. Use a file downloaded from "Export all data (JSON)".');
  }
  if (obj.version !== undefined && obj.version !== 1) {
    throw new Error(`Unsupported export version ${String(obj.version)}.`);
  }
  const questions = count(obj.questions);
  if (questions > MAX_QUESTIONS) throw new Error(`This export has ${questions} questions; the import limit is ${MAX_QUESTIONS}.`);
  return {
    fileName: file.name,
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    exportedAt: typeof obj.exported_at === 'string' ? obj.exported_at : undefined,
    folders: count(obj.folders),
    questions,
    solutions: count(obj.solutions),
    testCases: count(obj.test_cases),
    payload: data,
  };
};

interface ImportPanelProps {
  /** Re-sync workspace data after a successful import. */
  onImported?: () => void | Promise<void>;
}

/** Restore a JSON backup. Everything lands under a new "Imported …" folder; nothing is overwritten. */
export const ImportPanel: React.FC<ImportPanelProps> = ({ onImported }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<DataImportResult | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      setPreview(await buildPreview(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read file');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.importData(preview.payload);
      setResult(res);
      setPreview(null);
      await onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs mp-muted">
        Restore a backup made with “Export all data”. It’s added under a new folder — your current data is never overwritten.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-xl border-2 border-dashed p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left transition ${
          dragOver ? 'border-[#fef08a] bg-[#fef08a]/5' : ''
        }`}
        style={dragOver ? undefined : { borderColor: 'var(--border-default, rgba(148,163,184,0.3))' }}
      >
        <FileJson className="w-6 h-6 mp-muted shrink-0" aria-hidden />
        <p className="text-xs mp-muted flex-1">Drop a <code>.json</code> export here, or</p>
        <button type="button" className="mp-btn" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload className="w-3.5 h-3.5" />
          Choose file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Choose a MakePattern export file"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>

      {preview && (
        <div className="mp-card-alt rounded-xl p-3 space-y-2" aria-live="polite">
          <p className="text-xs font-semibold break-all">
            {preview.fileName} <span className="mp-muted font-normal">· {preview.sizeKb} KB</span>
            {preview.exportedAt && (
              <span className="mp-muted font-normal"> · exported {new Date(preview.exportedAt).toLocaleDateString()}</span>
            )}
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              ['Folders', preview.folders],
              ['Questions', preview.questions],
              ['Solutions', preview.solutions],
              ['Test cases', preview.testCases],
            ].map(([label, n]) => (
              <li key={label as string} className="mp-card px-2.5 py-2">
                <span className="block text-base font-bold tabular-nums">{n}</span>
                <span className="mp-muted">{label}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="mp-btn mp-btn-primary" onClick={handleImport} disabled={busy || preview.questions + preview.folders === 0}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Import {preview.questions} question{preview.questions === 1 ? '' : 's'}
            </button>
            <button type="button" className="mp-btn" onClick={() => setPreview(null)} disabled={busy}>
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2" role="status">
          <p className="text-xs text-emerald-400 flex items-center gap-1 flex-1">
            <Check className="w-3.5 h-3.5 shrink-0" />
            Imported {result.questions} questions, {result.folders} folders, {result.solutions} solutions and {result.test_cases} test cases into “
            {result.root_folder_name}”.
          </p>
          <button type="button" className="mp-btn" onClick={() => navigate('/patterns')}>
            <FolderOpen className="w-3.5 h-3.5" />
            Open in My Patterns
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
