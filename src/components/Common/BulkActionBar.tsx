import React, { useMemo, useState } from 'react';
import {
  X,
  FolderInput,
  CircleDot,
  Gauge,
  Tag,
  Tags,
  Star,
  StarOff,
  Trash2,
  Loader2,
  Check,
} from 'lucide-react';
import type { BulkActionRequest, Difficulty, Folder, QuestionStatus } from '../../types/dsa';

type BulkPayload = Omit<BulkActionRequest, 'question_ids'>;
type Panel = 'move' | 'status' | 'difficulty' | 'add_tags' | 'remove_tags' | null;

interface BulkActionBarProps {
  count: number;
  folders: Folder[];
  /** Tags present on the selected questions (offered for removal). */
  selectedTags?: string[];
  onAction: (payload: BulkPayload) => Promise<void>;
  onClear: () => void;
}

const STATUSES: QuestionStatus[] = ['Not Started', 'In Progress', 'Solved', 'Needs Revision'];
const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

const flattenFolders = (nodes: Folder[], depth = 0): Array<{ id: string; label: string }> =>
  nodes.flatMap((f) => [
    { id: f.id, label: `${'  '.repeat(depth)}${depth ? '└ ' : ''}${f.name}` },
    ...flattenFolders(f.subfolders || [], depth + 1),
  ]);

const parseTags = (raw: string) =>
  Array.from(new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))).slice(0, 30);

/**
 * Sticky action bar for multi-selected questions. On phones it docks to the bottom of the
 * screen and wraps; option panels open inline above the buttons.
 */
export const BulkActionBar: React.FC<BulkActionBarProps> = ({ count, folders, selectedTags = [], onAction, onClear }) => {
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string>('');
  const [status, setStatus] = useState<QuestionStatus>('Solved');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [tagText, setTagText] = useState('');
  const folderOptions = useMemo(() => flattenFolders(folders), [folders]);

  if (count === 0) return null;

  const run = async (payload: BulkPayload) => {
    setBusy(true);
    setError(null);
    try {
      await onAction(payload);
      setPanel(null);
      setTagText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setBusy(false);
    }
  };

  const togglePanel = (p: Panel) => {
    setError(null);
    setPanel((cur) => (cur === p ? null : p));
  };

  const btn = (p: Panel, Icon: React.ElementType, label: string) => (
    <button
      type="button"
      className={`mp-btn ${panel === p ? 'mp-btn-primary' : ''}`}
      onClick={() => togglePanel(p)}
      disabled={busy}
      aria-expanded={panel === p}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );

  const applyBtn = (onClick: () => void, disabled = false) => (
    <button type="button" className="mp-btn mp-btn-primary" onClick={onClick} disabled={busy || disabled}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      Apply
    </button>
  );

  return (
    <div
      className="fixed sm:sticky inset-x-0 bottom-0 sm:bottom-4 z-40 sm:mx-auto sm:max-w-3xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="region"
      aria-label="Bulk actions"
    >
      <div className="mp-card shadow-2xl shadow-black/50 p-3 space-y-2.5 rounded-b-none sm:rounded-2xl">
        {panel && (
          <div className="flex flex-wrap items-center gap-2 pb-2.5 border-b" style={{ borderColor: 'var(--border-subtle, rgba(148,163,184,0.2))' }}>
            {panel === 'move' && (
              <>
                <label className="text-xs mp-muted" htmlFor="bulk-folder">Move to</label>
                <select id="bulk-folder" className="mp-input !w-auto flex-1 min-w-[10rem]" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                  <option value="">No folder (unfiled)</option>
                  {folderOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {applyBtn(() => run({ action: 'move', folder_id: folderId || null }))}
              </>
            )}
            {panel === 'status' && (
              <>
                <label className="text-xs mp-muted" htmlFor="bulk-status">Status</label>
                <select id="bulk-status" className="mp-input !w-auto flex-1" value={status} onChange={(e) => setStatus(e.target.value as QuestionStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                {applyBtn(() => run({ action: 'set_status', status }))}
              </>
            )}
            {panel === 'difficulty' && (
              <>
                <label className="text-xs mp-muted" htmlFor="bulk-diff">Difficulty</label>
                <select id="bulk-diff" className="mp-input !w-auto flex-1" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                {applyBtn(() => run({ action: 'set_difficulty', difficulty }))}
              </>
            )}
            {(panel === 'add_tags' || panel === 'remove_tags') && (
              <>
                <label className="text-xs mp-muted" htmlFor="bulk-tags">
                  {panel === 'add_tags' ? 'Add tags' : 'Remove tags'}
                </label>
                <input
                  id="bulk-tags"
                  className="mp-input flex-1 min-w-[10rem]"
                  placeholder="comma, separated"
                  value={tagText}
                  onChange={(e) => setTagText(e.target.value)}
                  list={panel === 'remove_tags' ? 'bulk-tag-options' : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && parseTags(tagText).length) void run({ action: panel, tags: parseTags(tagText) });
                  }}
                />
                {panel === 'remove_tags' && (
                  <datalist id="bulk-tag-options">
                    {selectedTags.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                )}
                {applyBtn(() => run({ action: panel, tags: parseTags(tagText) }), parseTags(tagText).length === 0)}
                {panel === 'remove_tags' && selectedTags.length > 0 && (
                  <div className="w-full flex flex-wrap gap-1">
                    {selectedTags.slice(0, 12).map((t) => (
                      <button key={t} type="button" className="mp-chip" onClick={() => setTagText((cur) => (cur ? `${cur}, ${t}` : t))}>
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold mr-1" aria-live="polite">
            {count} selected
          </span>
          {btn('move', FolderInput, 'Move')}
          {btn('status', CircleDot, 'Status')}
          {btn('difficulty', Gauge, 'Difficulty')}
          {btn('add_tags', Tag, 'Add tag')}
          {btn('remove_tags', Tags, 'Remove tag')}
          <button type="button" className="mp-btn" onClick={() => run({ action: 'bookmark' })} disabled={busy} title="Bookmark selected">
            <Star className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bookmark</span>
          </button>
          <button type="button" className="mp-btn" onClick={() => run({ action: 'unbookmark' })} disabled={busy} title="Remove bookmarks">
            <StarOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Unbookmark</span>
          </button>
          <button type="button" className="mp-btn mp-btn-danger" onClick={() => run({ action: 'delete' })} disabled={busy}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Delete</span>
          </button>
          <button type="button" className="mp-btn ml-auto" onClick={onClear} disabled={busy} aria-label="Clear selection">
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
        {error && (
          <p className="text-xs text-rose-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
