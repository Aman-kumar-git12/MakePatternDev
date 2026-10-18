import React from 'react';

interface ExamplesTabProps {
  questionTitle: string;
}

export const ExamplesTab: React.FC<ExamplesTabProps> = ({ questionTitle }) => {
  return (
    <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-lg shadow-black/20 space-y-6">
      <div>
        <h3 className="text-sm font-bold text-white mb-1">Examples & Test Cases</h3>
        <p className="text-xs text-slate-400">Sample inputs, outputs, and edge test scenarios for {questionTitle}</p>
      </div>

      <div className="space-y-4">
        {/* Example 1 */}
        <div className="bg-[#0A0F1D] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-400">Example 1 (Standard Case)</span>
          </div>
          <div className="space-y-2 font-mono text-xs">
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-slate-300">
              <span className="text-slate-500 font-semibold">Input: </span>
              <span>nums = [2, 7, 11, 15], target = 9</span>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-emerald-400">
              <span className="text-slate-500 font-semibold">Output: </span>
              <span>[0, 1]</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans pt-1">
              Because nums[0] + nums[1] == 9, we return [0, 1].
            </p>
          </div>
        </div>

        {/* Example 2 */}
        <div className="bg-[#0A0F1D] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-400">Example 2 (Duplicates Case)</span>
          </div>
          <div className="space-y-2 font-mono text-xs">
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-slate-300">
              <span className="text-slate-500 font-semibold">Input: </span>
              <span>nums = [3, 2, 4], target = 6</span>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-emerald-400">
              <span className="text-slate-500 font-semibold">Output: </span>
              <span>[1, 2]</span>
            </div>
          </div>
        </div>

        {/* Constraints Card */}
        <div className="bg-[#0A0F1D] border border-slate-800 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Constraints & Bounds
          </h4>
          <ul className="list-disc list-inside text-xs text-slate-400 space-y-1 font-mono">
            <li>2 &le; nums.length &le; 10<sup>4</sup></li>
            <li>-10<sup>9</sup> &le; nums[i] &le; 10<sup>9</sup></li>
            <li>-10<sup>9</sup> &le; target &le; 10<sup>9</sup></li>
            <li>Only one valid answer exists.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
