import React from 'react';
import { Clock, HardDrive, Award } from 'lucide-react';
import type { Solution } from '../../types/dsa';

interface ComplexityTabProps {
  solutions: Solution[];
}

export const ComplexityTab: React.FC<ComplexityTabProps> = ({ solutions }) => {
  return (
    <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-lg shadow-black/20 space-y-6">
      <div>
        <h3 className="text-sm font-bold text-white mb-1">Time & Space Complexity Comparison</h3>
        <p className="text-xs text-slate-400">
          Compare algorithmic efficiency across all saved approaches for this problem
        </p>
      </div>

      {solutions.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">
          No solutions recorded yet. Add solutions in the Code tab to see side-by-side complexity analysis.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {solutions.map((sol, idx) => {
            const isOptimal =
              sol.title.toLowerCase().includes('optimal') ||
              (sol.time_complexity && (sol.time_complexity.includes('O(1)') || sol.time_complexity.includes('O(n)'))) ||
              idx === 0;

            return (
              <div
                key={sol.id}
                className={`p-5 rounded-xl border flex flex-col justify-between transition ${
                  isOptimal
                    ? 'bg-blue-950/20 border-blue-500/40 shadow-lg shadow-blue-500/10'
                    : 'bg-[#0A0F1D] border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-200 truncate">{sol.title}</span>
                    {isOptimal && (
                      <span className="flex items-center space-x-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <Award className="w-3 h-3" />
                        <span>Best</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    {/* Time Complexity */}
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-yellow-300" />
                        <span>Time:</span>
                      </div>
                      <span className="font-bold text-yellow-300">
                        {sol.time_complexity || <span className="text-slate-500 font-normal italic font-sans">Not set</span>}
                      </span>
                    </div>

                    {/* Space Complexity */}
                    <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-slate-400">
                        <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                        <span>Space:</span>
                      </div>
                      <span className="font-bold text-purple-300">{sol.space_complexity || 'O(1)'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="uppercase tracking-wider font-semibold">{sol.language}</span>
                  <span>{sol.code.split('\n').length} lines of code</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
