import React, { useState } from 'react';
import { User as UserIcon, KeyRound, Download, LogOut, Trash2, Loader2, Check, Code2, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { Folder, LeetCodeSyncResult } from '../../types/dsa';
import { LeetCodeSyncPanel } from '../Settings/LeetCodeSyncPanel';
import { displayName } from '../../utils/user';

interface SettingsViewProps {
  folders: Folder[];
  onDataChanged: () => void | Promise<void>;
  onOpenCurricula: () => void;
}

const Section: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; danger?: boolean }> = ({
  title,
  icon: Icon,
  children,
  danger,
}) => (
  <section className="mp-card p-4 sm:p-5 space-y-3" style={danger ? { borderColor: 'rgba(244,63,94,0.35)' } : undefined}>
    <h2 className={`text-sm font-bold flex items-center gap-2 ${danger ? 'text-rose-400' : ''}`}>
      <Icon className="w-4 h-4" />
      {title}
    </h2>
    {children}
  </section>
);

const Feedback: React.FC<{ ok?: string | null; err?: string | null }> = ({ ok, err }) => (
  <>
    {ok && (
      <p className="text-xs text-emerald-400 flex items-center gap-1" role="status">
        <Check className="w-3.5 h-3.5" /> {ok}
      </p>
    )}
    {err && (
      <p className="text-xs text-rose-400" role="alert">
        {err}
      </p>
    )}
  </>
);

export const SettingsView: React.FC<SettingsViewProps> = ({ folders, onDataChanged, onOpenCurricula }) => {
  const { user, setCurrentUser, replaceToken, logout } = useAuth();

  // Profile
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  // Data / sessions
  const [exportBusy, setExportBusy] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);

  // Delete
  const [deletePw, setDeletePw] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileErr(null);
    setProfileMsg(null);
    try {
      const updated = await api.updateMe({ full_name: fullName.trim() });
      setCurrentUser(updated);
      setProfileMsg('Profile saved');
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setProfileBusy(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    if (newPw.length < 6) {
      setPwErr('New password must be at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwErr('New passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      const res = await api.changePassword(currentPw, newPw);
      if (res.access_token) replaceToken(res.access_token);
      setPwMsg('Password changed. Other devices were signed out.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setPwBusy(false);
    }
  };

  const handleExport = async () => {
    setExportBusy(true);
    setExportErr(null);
    try {
      await api.downloadExport();
    } catch (err) {
      setExportErr(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportBusy(false);
    }
  };

  const handleLogoutAll = async () => {
    setLogoutAllBusy(true);
    try {
      await api.logoutAll();
    } catch {
      // even if the call fails, sign out locally
    } finally {
      setLogoutAllBusy(false);
      logout();
    }
  };

  const confirmPhrase = 'delete my account';
  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirm.trim().toLowerCase() !== confirmPhrase) {
      setDeleteErr(`Type "${confirmPhrase}" to confirm.`);
      return;
    }
    setDeleteBusy(true);
    setDeleteErr(null);
    try {
      await api.deleteAccount(deletePw);
      logout();
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : 'Could not delete account');
      setDeleteBusy(false);
    }
  };

  const handleSynced = async (res: LeetCodeSyncResult) => {
    if (user && res.username !== user.leetcode_username) {
      setCurrentUser({ ...user, leetcode_username: res.username });
    }
    await onDataChanged();
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-xs mp-muted">Signed in as {user?.email}</p>
      </div>

      <Section title="Profile" icon={UserIcon}>
        <form onSubmit={saveProfile} className="flex flex-col sm:flex-row gap-2">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={displayName(user)}
            className="mp-input"
            aria-label="Display name"
            maxLength={100}
          />
          <button type="submit" className="mp-btn mp-btn-primary shrink-0" disabled={profileBusy}>
            {profileBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </form>
        <Feedback ok={profileMsg} err={profileErr} />
      </Section>

      <Section title="LeetCode" icon={Code2}>
        <LeetCodeSyncPanel initialUsername={user?.leetcode_username} folders={folders} onSynced={handleSynced} />
      </Section>

      <Section title="Starter curricula" icon={GraduationCap}>
        <p className="text-xs mp-muted">Add a curated, pattern-ordered list of interview problems to your workspace.</p>
        <button type="button" className="mp-btn" onClick={onOpenCurricula}>
          Browse curricula
        </button>
      </Section>

      <Section title="Change password" icon={KeyRound}>
        <form onSubmit={changePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Current password" className="mp-input" required />
          <input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password (min 6)" className="mp-input" required minLength={6} />
          <input type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirm new password" className="mp-input" required />
          <div className="sm:col-span-3">
            <button type="submit" className="mp-btn mp-btn-primary" disabled={pwBusy}>
              {pwBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Update password
            </button>
          </div>
        </form>
        <Feedback ok={pwMsg} err={pwErr} />
      </Section>

      <Section title="Your data & sessions" icon={Download}>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="mp-btn" onClick={handleExport} disabled={exportBusy}>
            {exportBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export all data (JSON)
          </button>
          <button type="button" className="mp-btn" onClick={handleLogoutAll} disabled={logoutAllBusy}>
            {logoutAllBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            Sign out of all devices
          </button>
        </div>
        <Feedback err={exportErr} />
      </Section>

      <Section title="Delete account" icon={Trash2} danger>
        <p className="text-xs mp-muted">
          Permanently deletes your account, folders, questions, solutions, notes, test cases, bookmarks and share links. Export your data first if you want a copy.
        </p>
        <form onSubmit={handleDelete} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input type="password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} placeholder="Password" className="mp-input" required />
          <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={`Type "${confirmPhrase}"`} className="mp-input" aria-label="Type confirmation phrase" required />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="mp-btn mp-btn-danger"
              disabled={deleteBusy || deleteConfirm.trim().toLowerCase() !== confirmPhrase || !deletePw}
            >
              {deleteBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete my account permanently
            </button>
          </div>
        </form>
        <Feedback err={deleteErr} />
      </Section>
    </div>
  );
};
