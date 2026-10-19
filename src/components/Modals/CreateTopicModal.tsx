import React, { useState } from 'react';
import { X, FolderPlus, Sparkles, Loader2 } from 'lucide-react';

interface CreateTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTopic: (name: string, description?: string, tags?: string[]) => Promise<void>;
}

export const CreateTopicModal: React.FC<CreateTopicModalProps> = ({
  isOpen,
  onClose,
  onCreateTopic,
}) => {
  const [topicName, setTopicName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicName.trim()) {
      setError('Topic name is required');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onCreateTopic(topicName.trim(), description.trim(), []);
      // Reset form
      setTopicName('');
      setDescription('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create topic');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-lg bg-[#0C1222] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/80 text-slate-100">
        {/* Subtle Top Accent Glow */}
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 shadow-md">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create New Topic</h2>
              <p className="text-xs text-slate-400">
                Create a top-level DSA topic to organize patterns
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Form - purely for main topic creation */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="topic-name">
              Topic Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="topic-name"
              type="text"
              required
              autoFocus
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              placeholder="e.g. Arrays, Strings, Trees, Dynamic Programming"
              className="w-full px-3.5 py-2.5 bg-[#090E1A] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="topic-desc">
              Description <span className="text-slate-500 text-[11px] font-normal">(Optional)</span>
            </label>
            <textarea
              id="topic-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary or focus of this topic..."
              className="w-full px-3.5 py-2 bg-[#090E1A] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Topic</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

