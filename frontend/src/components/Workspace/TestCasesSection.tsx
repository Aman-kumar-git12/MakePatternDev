import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, FlaskConical, AlertCircle, Sparkles } from 'lucide-react';
import type { TestCase } from '../../types/dsa';

interface TestCasesSectionProps {
  questionId: string;
  testCases: TestCase[];
  onAddTestCase: (testCase: {
    title?: string;
    input?: string;
    expected_output?: string;
    notes?: string;
    position?: number;
  }) => Promise<void>;
  onUpdateTestCase: (id: string, updates: Partial<TestCase>) => Promise<void>;
  onDeleteTestCase: (id: string) => Promise<void>;
}

export const TestCasesSection: React.FC<TestCasesSectionProps> = ({
  testCases,
  onAddTestCase,
  onUpdateTestCase,
  onDeleteTestCase,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editInput, setEditInput] = useState('');
  const [editOutput, setEditOutput] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newInput, setNewInput] = useState('');
  const [newOutput, setNewOutput] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startEditing = (tc: TestCase) => {
    setEditingId(tc.id);
    setEditTitle(tc.title);
    setEditInput(tc.input);
    setEditOutput(tc.expected_output);
    setEditNotes(tc.notes || '');
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await onUpdateTestCase(id, {
        title: editTitle,
        input: editInput,
        expected_output: editOutput,
        notes: editNotes,
      });
      setEditingId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update test case');
    }
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      await onAddTestCase({
        title: newTitle.trim(),
        input: newInput.trim(),
        expected_output: newOutput.trim(),
        notes: newNotes.trim(),
        position: testCases.length,
      });
      setNewTitle('');
      setNewInput('');
      setNewOutput('');
      setNewNotes('');
      setIsAddingNew(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add test case');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPresetEdgeCase = (presetTitle: string, presetNotes: string) => {
    setIsAddingNew(true);
    setNewTitle(presetTitle);
    setNewNotes(presetNotes);
  };

  return (
    <div className="bg-[#0D1527] border border-slate-800 rounded-xl p-4 shadow-md space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Useful Test Cases</span>
              <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {testCases.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Verify dry runs against edge cases, extreme constraints, and common pitfalls
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddingNew(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-600/20 transition self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Test Case</span>
        </button>
      </div>

      {/* Preset Quick Badges */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
        <span className="text-[11px] text-slate-500">Quick Edge Cases:</span>
        {[
          { title: 'Empty Input', notes: 'Checks null/empty collection handling' },
          { title: 'Single Element', notes: 'Guards against loop out-of-bounds or off-by-one errors' },
          { title: 'Duplicate Values', notes: 'Tests set uniqueness or collision handling' },
          { title: 'Negative Numbers', notes: 'Important for binary search, prefix sums, math constraints' },
          { title: 'Already Sorted', notes: 'Validates optimal best-case or pivot selection' },
          { title: 'Maximum Constraints', notes: 'Integer overflow and O(n²) time limit exceeded risk' },
        ].map((preset) => (
          <button
            key={preset.title}
            onClick={() => addPresetEdgeCase(preset.title, preset.notes)}
            className="text-[11px] px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-blue-300 transition"
          >
            + {preset.title}
          </button>
        ))}
      </div>

      {/* New Test Case Form */}
      {isAddingNew && (
        <form onSubmit={handleAddNew} className="bg-[#090F1D] border border-blue-500/30 rounded-xl p-3.5 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-300 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create New Test Case</span>
            </span>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Title / Description <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Single-element array, All negative numbers, Max constraint"
              className="w-full bg-[#0D1527] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Input</label>
              <textarea
                rows={2}
                value={newInput}
                onChange={(e) => setNewInput(e.target.value)}
                placeholder="nums = [1], target = 1"
                className="w-full bg-[#0D1527] border border-slate-700/80 rounded-lg p-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Expected Output</label>
              <textarea
                rows={2}
                value={newOutput}
                onChange={(e) => setNewOutput(e.target.value)}
                placeholder="[0]"
                className="w-full bg-[#0D1527] border border-slate-700/80 rounded-lg p-2 text-xs font-mono text-emerald-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Edge Case Notes <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="e.g. Must handle len(nums) == 1 without out-of-index exception"
              className="w-full bg-[#0D1527] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-md shadow-blue-600/30 flex items-center space-x-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Test Case'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Test Case Cards List */}
      {testCases.length === 0 && !isAddingNew ? (
        <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl space-y-1">
          <FlaskConical className="w-6 h-6 mx-auto text-slate-600 mb-1" />
          <p className="font-medium text-slate-400">No test cases saved for this question yet</p>
          <p className="text-[11px] text-slate-500">
            Click "Add Test Case" or pick an edge case preset above to store useful inputs & outputs.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {testCases.map((tc, idx) => {
            const isEditing = editingId === tc.id;

            if (isEditing) {
              return (
                <div key={tc.id} className="bg-[#090F1D] border border-blue-500/40 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Edit Test Case #{idx + 1}</span>
                    <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:text-white">
                      Cancel
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-[#0D1527] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <textarea
                      rows={2}
                      value={editInput}
                      onChange={(e) => setEditInput(e.target.value)}
                      placeholder="Input"
                      className="w-full bg-[#0D1527] border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200"
                    />
                    <textarea
                      rows={2}
                      value={editOutput}
                      onChange={(e) => setEditOutput(e.target.value)}
                      placeholder="Expected Output"
                      className="w-full bg-[#0D1527] border border-slate-700 rounded-lg p-2 text-xs font-mono text-emerald-300"
                    />
                  </div>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notes"
                    className="w-full bg-[#0D1527] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 text-xs border border-slate-700 rounded-lg text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(tc.id)}
                      className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={tc.id}
                className="bg-[#090F1D] border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-3 shadow-sm transition group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      #{idx + 1}
                    </span>
                    <h4 className="text-xs font-bold text-white group-hover:text-blue-300 transition">
                      {tc.title}
                    </h4>
                  </div>

                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => startEditing(tc)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                      title="Edit Test Case"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteTestCase(tc.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                      title="Delete Test Case"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Input & Output boxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {tc.input && (
                    <div className="bg-[#0D1527] border border-slate-800 rounded-lg p-2 font-mono">
                      <span className="text-[10px] font-sans text-slate-500 block mb-0.5 uppercase tracking-wider font-semibold">
                        Input
                      </span>
                      <pre className="text-slate-200 text-[11px] whitespace-pre-wrap break-all">{tc.input}</pre>
                    </div>
                  )}

                  {tc.expected_output && (
                    <div className="bg-[#0D1527] border border-slate-800 rounded-lg p-2 font-mono">
                      <span className="text-[10px] font-sans text-slate-500 block mb-0.5 uppercase tracking-wider font-semibold">
                        Expected Output
                      </span>
                      <pre className="text-emerald-400 text-[11px] whitespace-pre-wrap break-all">{tc.expected_output}</pre>
                    </div>
                  )}
                </div>

                {tc.notes && (
                  <div className="mt-2 text-[11px] text-yellow-300 bg-[#fef08a]/15 border border-[#fef08a]/30 rounded-lg px-2.5 py-1 flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{tc.notes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
