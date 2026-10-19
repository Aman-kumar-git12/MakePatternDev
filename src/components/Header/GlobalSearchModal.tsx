import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Folder, FileText, ChevronRight, Star } from 'lucide-react';
import { api } from '../../services/api';
import type { SearchResult } from '../../types/dsa';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuestion: (questionId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectQuestion,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await api.search(query.trim());
        setResults(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const difficultyColors = {
    Easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    Medium: 'text-yellow-300 bg-[#fef08a]/15 border border-[#fef08a]/30',
    Hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0D1527] border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl relative text-slate-100 overflow-hidden">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-[#0A0F1D]">
          <Search className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions, topics, notes, or folders... (Esc to close)"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            ESC
          </span>
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
              Searching questions and folders...
            </div>
          ) : !query.trim() ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Type to search questions across all folders, topics, or solution notes
            </div>
          ) : results && results.total_results === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No matching questions or folders found for &ldquo;<span className="text-white font-medium">{query}</span>&rdquo;
            </div>
          ) : (
            <>
              {/* Questions Section */}
              {results && results.questions.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                    Questions ({results.questions.length})
                  </h4>
                  <div className="space-y-1.5">
                    {results.questions.map((q) => (
                      <div
                        key={q.id}
                        onClick={() => {
                          onSelectQuestion(q.id);
                          onClose();
                        }}
                        className="p-3 rounded-xl bg-slate-900/60 hover:bg-blue-600/10 border border-slate-800/80 hover:border-blue-500/30 cursor-pointer transition flex items-center justify-between group"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap">
                              <h5 className="font-semibold text-sm text-slate-100 group-hover:text-blue-300 transition truncate">
                                {q.title}
                              </h5>
                              {/* Difficulty tag right to question title */}
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                                  difficultyColors[q.difficulty] || 'text-slate-400'
                                }`}
                              >
                                {q.difficulty}
                              </span>
                              {q.is_bookmarked && (
                                <Star className="w-3.5 h-3.5 text-yellow-300 fill-[#fef08a] flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate">
                              {q.folder_path || 'DSA'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Folders Section */}
              {results && results.folders.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">
                    Folders ({results.folders.length})
                  </h4>
                  <div className="space-y-1.5">
                    {results.folders.map((f) => (
                      <div
                        key={f.id}
                        className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center space-x-3"
                      >
                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                          <Folder className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-200 truncate">{f.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{f.path}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
