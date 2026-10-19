import React, { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, RefreshCw, Power, Globe, ShieldCheck, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import type { Folder, ShareResponse } from '../../types/dsa';

interface SharePatternModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder | null;
}

export const SharePatternModal: React.FC<SharePatternModalProps> = ({
  isOpen,
  onClose,
  folder,
}) => {
  const [shareData, setShareData] = useState<ShareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && folder) {
      loadShareData();
    } else {
      setShareData(null);
      setError(null);
      setCopied(false);
    }
  }, [isOpen, folder]);

  const loadShareData = async () => {
    if (!folder) return;
    setLoading(true);
    setError(null);
    try {
      try {
        const data = await api.getFolderShare(folder.id);
        setShareData(data);
      } catch {
        // If not created yet, create it
        const created = await api.createFolderShare(folder.id);
        setShareData(created);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load share settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!folder || !shareData) return;
    setUpdating(true);
    setError(null);
    try {
      const updated = await api.updateFolderShare(folder.id, !shareData.is_active);
      setShareData(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update share status');
    } finally {
      setUpdating(false);
    }
  };

  const handleRevoke = async () => {
    if (!folder) return;
    const confirmed = window.confirm(
      'Are you sure you want to revoke this link? Anyone with the previous link will immediately lose access, and a new link will be created.'
    );
    if (!confirmed) return;

    setUpdating(true);
    setError(null);
    try {
      const regenerated = await api.revokeFolderShare(folder.id);
      setShareData(regenerated);
      setCopied(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share link');
    } finally {
      setUpdating(false);
    }
  };

  const getFullShareUrl = (shareId: string) => {
    return `${window.location.origin}/shared/${shareId}`;
  };

  const handleCopyLink = async () => {
    if (!shareData) return;
    const url = getFullShareUrl(shareData.share_id);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!isOpen || !folder) return null;

  const isAllTopics = folder?.id === 'all';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0D1527] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-100 animate-scale-in">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {isAllTopics ? 'Share All Patterns' : 'Share Pattern'}
            </h2>
            <p className="text-xs text-slate-400 truncate max-w-xs">
              {isAllTopics ? 'The complete list of topics and questions' : folder.name}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
            <p className="text-xs text-slate-400">Loading sharing settings...</p>
          </div>
        ) : shareData ? (
          <div className="space-y-5">
            {/* Security / Read-only notice */}
            <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-blue-300">Read-Only Live Access</p>
                <p className="text-slate-400">
                  {isAllTopics
                    ? 'Anyone with this link can view your entire pattern tracker with all topics, subtopics, questions, and solutions in read-only mode.'
                    : 'Anyone with this link can view this pattern, all its subtopics, questions, and solutions in read-only mode. They cannot make any changes.'}
                </p>
              </div>
            </div>

            {/* Status Indicator & Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-[#0A0F1D] border border-slate-800 rounded-xl">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    shareData.is_active ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-600'
                  }`}
                />
                <div>
                  <div className="text-sm font-medium text-white flex items-center space-x-1.5">
                    <span>{shareData.is_active ? 'Public link is active' : 'Public link is disabled'}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {shareData.is_active
                      ? 'Accessible to anyone with the URL'
                      : 'Access is currently blocked for all visitors'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleActive}
                disabled={updating}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  shareData.is_active
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                } disabled:opacity-50`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{shareData.is_active ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>

            {/* Share URL Input & Copy Button */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Shareable URL
              </label>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={getFullShareUrl(shareData.share_id)}
                    className="w-full bg-[#0A0F1D] border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 font-mono focus:outline-none select-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl font-medium text-xs transition active:scale-95 shadow-md ${
                    copied
                      ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Revoke and Actions */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <button
                type="button"
                onClick={handleRevoke}
                disabled={updating}
                className="text-xs text-red-400 hover:text-red-300 flex items-center space-x-1.5 p-1.5 rounded hover:bg-red-950/30 transition disabled:opacity-50"
                title="Revoking will immediately invalidate the existing link and generate a new one"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${updating ? 'animate-spin' : ''}`} />
                <span>Revoke & Reissue Link</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
