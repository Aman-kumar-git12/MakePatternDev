import React, { useState } from 'react';
import { Eye, Edit3, Sparkles } from 'lucide-react';

interface NotesEditorProps {
  problemStatement: string;
  notes: string;
  onChangeProblemStatement: (val: string) => void;
  onChangeNotes: (val: string) => void;
}

export const NotesEditor: React.FC<NotesEditorProps> = ({
  problemStatement,
  notes,
  onChangeProblemStatement,
  onChangeNotes,
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const defaultTemplate = `### 💡 Intuition
Write down your initial thoughts and intuition when reading the problem.

### 🚀 Approach & Pattern
- Algorithm/Data Structure used (e.g. Two Pointers, Sliding Window, Monotonic Stack)
- Why this approach works best

### 📝 Step-by-Step Algorithm
1. Step 1: Initialize pointers or data structures.
2. Step 2: Traverse array/tree/graph.
3. Step 3: Handle conditions and update answer.
4. Step 4: Return result.

### 🧪 Dry Run
\`\`\`
nums = [2, 7, 11, 15], target = 9
i=0: num=2, complement=7, seen={} -> seen={2: 0}
i=1: num=7, complement=2, seen={2: 0} -> found! return [0, 1]
\`\`\`

### ⚠️ Edge Cases
- Empty array or single element
- Negative numbers or duplicate values
- Extremely large inputs (integer overflow)

### ⏱️ Complexity
- **Time Complexity:** O(...)
- **Space Complexity:** O(...)
`;

  return (
    <div className="space-y-3.5">
      {/* Problem Statement Card */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-3.5 shadow-md">
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-2">
          <span>Problem Statement</span>
        </h3>
        <textarea
          rows={2}
          value={problemStatement}
          onChange={(e) => onChangeProblemStatement(e.target.value)}
          placeholder="Paste or write the complete problem statement, input/output formats, and constraints..."
          className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed resize-y"
        />
      </div>

      {/* Solution Notes & Explanation Card */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-3.5 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Solution Notes & Step-by-Step Explanation
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            {!notes.trim() && (
              <button
                type="button"
                onClick={() => onChangeNotes(defaultTemplate)}
                className="text-[11px] text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded-md border border-blue-500/30 bg-blue-500/10 flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Insert DSA Template</span>
              </button>
            )}

            <div className="flex items-center bg-[#0A0F1D] border border-slate-700/80 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-md transition ${
                  activeTab === 'edit'
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Edit3 className="w-3 h-3" />
                <span className="text-[11px]">Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-md transition ${
                  activeTab === 'preview'
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span className="text-[11px]">Preview</span>
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'edit' ? (
          <textarea
            rows={7}
            value={notes}
            onChange={(e) => onChangeNotes(e.target.value)}
            placeholder="Write your intuition, numbered step-by-step approach, dry run, edge cases, and personal insights..."
            className="w-full bg-[#0A0F1D] border border-slate-700/80 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono leading-relaxed resize-y"
          />
        ) : (
          <div className="min-h-[160px] bg-[#0A0F1D] border border-slate-700/80 rounded-lg p-4 text-xs text-slate-200 prose prose-invert max-w-none leading-relaxed overflow-x-auto whitespace-pre-wrap font-sans">
            {notes.trim() ? (
              notes
            ) : (
              <span className="text-slate-500 italic">No notes written yet. Switch to Edit to write notes.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
