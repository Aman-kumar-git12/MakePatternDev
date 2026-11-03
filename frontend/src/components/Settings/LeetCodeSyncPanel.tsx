import React, { useState } from 'react';
import { RefreshCw, Loader2, Trophy, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import type { Folder, LeetCodeProfile, LeetCodeSyncResult } from '../../types/dsa';

interface LeetCodeSyncPanelProps {
  initialUsername?: string | null;
  folders: Folder[];
  /** Called after a sync changed tracker data (statuses / imports) and saved the username. */
  onSynced: (result: LeetCodeSyncResult) => void | Promise<void>;
}

const flatten = (list: Folder[], depth = 0): Array<{ id: string; name: string; depth: number }> =>
  list.flatMap((f) => [{ id: f.id, name: f.name, depth }, ...flatten(f.subfolders || [], depth + 1)]);

const ProfileStats: React.FC<{ profile: LeetCodeProfile }> = ({ profile }) => {
  const rows: Array<{ key: 'Easy' | 'Medium' | 'Hard'; color: string }> = [
    { key: 'Easy', color: '#34d399' },
    { key: 'Medium', color: '#facc15' },
    { key: 'Hard', color: '#fb7185' },
  ];
  return (
    <div className="mp-card-alt p-3 space-y-2.5">
      <div className="flex items-center gap-3">
        {profile.avatar && <img src={profile.avatar} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />}
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{profile.real_name || 'LeetCode profile'}</div>
          {profile.ranking != null && (
            <div className="text-xs mp-muted flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Rank {profile.ranking.toLocaleString()}
            </div>
          )}
        </div>
        <div className="ml-auto text-right">
          <div className="text-xl font-extrabold tabular-nums">{profile.solved.All}</div>
          <div className="text-[10px] mp-faint">of {profile.total.All} solved</div>
        </div>
      </div>
      {rows.map((r) => {
        const solved = profile.solved[r.key] || 0;
        const total = profile.total[r.key] || 0;
        const pct = total ? Math.round((solved / total) * 100) : 0;
        return (
          <div key={r.key} className="text-xs">
            <div className="flex justify-between mb-0.5">
              <span style={{ color: r.color }} className="font-semibold">
                {r.key}
              </span>
              <span className="mp-faint tabular-nums">
                {solved} / {total}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: r.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Link a LeetCode username, view public profile stats, and sync recent accepted
 * submissions into the tracker (marks tracked problems Solved, optionally imports the rest).
 */
export const LeetCodeSyncPanel: React.FC<LeetCodeSyncPanelProps> = ({ initialUsername, folders, onSynced }) => {
  const [username, setUsername] = useState(initialUsername || '');
  const [importMissing, setImportMissing] = useState(false);
  const [folderId, setFolderId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LeetCodeSyncResult | null>(null);
  const [profile, setProfile] = useState<LeetCodeProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const flat = flatten(folders);

  const handlePreviewProfile = async () => {
    if (!username.trim()) return;
    setLoadingProfile(true);
    setError(null);
    try {
      setProfile(await api.getLeetCodeProfile(username.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile not found');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSync = async () => {
    if (!username.trim()) {
      setError('Enter your LeetCode username');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.syncLeetCode({
        username: username.trim(),
        import_missing: importMissing,
        folder_id: importMissing ? folderId || null : null,
      });
      setResult(res);
      setProfile(res.profile);
      await onSynced(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="LeetCode username"
          className="mp-input"
          aria-label="LeetCode username"
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handlePreviewProfile();
            }
          }}
        />
        <button type="button" className="mp-btn shrink-0" onClick={handlePreviewProfile} disabled={loadingProfile || !username.trim()}>
          {loadingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          View profile
        </button>
      </div>

      {profile && <ProfileStats profile={profile} />}

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none mp-muted">
          <input type="checkbox" checked={importMissing} onChange={(e) => setImportMissing(e.target.checked)} className="accent-yellow-300" />
          Also import recently solved problems that aren't in my tracker yet
        </label>
        {importMissing && (
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="mp-input" aria-label="Folder for imported problems">
            <option value="">No folder (unfiled)</option>
            {flat.map((f) => (
              <option key={f.id} value={f.id}>
                {' '.repeat(f.depth * 3)}
                {f.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <button type="button" className="mp-btn mp-btn-primary w-full sm:w-auto" onClick={handleSync} disabled={busy}>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        Sync recent accepted submissions
      </button>
      <p className="text-[11px] mp-faint">
        Uses LeetCode's public profile data (your last ~20 accepted submissions). No LeetCode password needed.
      </p>

      {error && (
        <p className="text-xs text-rose-400" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="mp-card-alt p-3 text-xs space-y-1.5" role="status">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> Synced @{result.username}
          </div>
          <div className="mp-muted">
            {result.newly_solved.length} marked solved · {result.imported} imported · {result.already_solved} already solved
          </div>
          {result.newly_solved.length > 0 && (
            <div className="mp-faint">Newly solved: {result.newly_solved.slice(0, 8).join(', ')}{result.newly_solved.length > 8 ? '…' : ''}</div>
          )}
        </div>
      )}
    </div>
  );
};
