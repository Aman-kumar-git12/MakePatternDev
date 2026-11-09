import React, { useEffect, useRef, useState } from 'react';
import { Timer, Play, Pause, RotateCcw, Check, Loader2 } from 'lucide-react';
import type { Question } from '../../types/dsa';
import { api } from '../../services/api';
import { formatMinutes } from '../../utils/format';

interface AttemptLoggerProps {
  question: Question;
  onLogged: (updated: Question) => void;
}

const formatClock = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Compact stopwatch + "log attempt" control. Each logged attempt increments the
 * attempt counter and adds the minutes to the question's total time.
 */
export const AttemptLogger: React.FC<AttemptLoggerProps> = ({ question, onLogged }) => {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [minutesInput, setMinutesInput] = useState('');
  const [solved, setSolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  // Reset when switching questions.
  useEffect(() => {
    setRunning(false);
    setElapsed(0);
    setMinutesInput('');
    setSolved(false);
    setError(null);
    startedAtRef.current = null;
    baseRef.current = 0;
  }, [question.id]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsed(baseRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const toggle = () => {
    if (running) {
      baseRef.current = elapsed;
      startedAtRef.current = null;
      setRunning(false);
      setMinutesInput(String(Math.max(1, Math.round(elapsed / 60))));
    } else {
      startedAtRef.current = Date.now();
      setRunning(true);
    }
  };

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    baseRef.current = 0;
    startedAtRef.current = null;
    setMinutesInput('');
  };

  const handleLog = async () => {
    setError(null);
    const fromTimer = Math.round(elapsed / 60);
    const parsed = minutesInput.trim() === '' ? fromTimer : Number(minutesInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 600) {
      setError('Minutes must be between 0 and 600');
      return;
    }
    setBusy(true);
    try {
      const updated = await api.logAttempt(question.id, parsed, solved || undefined);
      onLogged(updated);
      reset();
      setSolved(false);
      setFlash(`Logged ${parsed}m`);
      setTimeout(() => setFlash(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log attempt');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mp-card-alt px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>
        <Timer className="w-3.5 h-3.5" />
        <span>Attempts: {question.attempts ?? 0}</span>
        <span className="mp-faint">·</span>
        <span>Time: {formatMinutes(question.time_spent_minutes)}</span>
      </div>

      <div className="flex items-center gap-1.5 ml-auto flex-wrap">
        <span
          className="font-mono tabular-nums px-2 py-0.5 rounded-md"
          style={{ backgroundColor: 'var(--bg-input)', color: running ? '#facc15' : 'var(--text-primary)' }}
          aria-live="polite"
        >
          {formatClock(elapsed)}
        </span>
        <button type="button" className="mp-btn !px-2 !py-1" onClick={toggle} title={running ? 'Pause timer' : 'Start timer'}>
          {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{running ? 'Pause' : 'Start'}</span>
        </button>
        <button type="button" className="mp-btn !px-2 !py-1" onClick={reset} title="Reset timer" disabled={elapsed === 0 && !running}>
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <input
          type="number"
          min={0}
          max={600}
          inputMode="numeric"
          value={minutesInput}
          onChange={(e) => setMinutesInput(e.target.value)}
          placeholder={String(Math.round(elapsed / 60))}
          className="mp-input !w-16 !py-1 !px-2 text-xs"
          aria-label="Minutes spent"
          title="Minutes spent (edit to override timer)"
        />
        <span className="mp-faint">min</span>
        <label className="flex items-center gap-1 cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={solved} onChange={(e) => setSolved(e.target.checked)} className="accent-yellow-300" />
          Solved it
        </label>
        <button type="button" className="mp-btn mp-btn-primary !py-1" onClick={handleLog} disabled={busy}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Log attempt
        </button>
        {flash && <span className="text-emerald-400 font-semibold">{flash}</span>}
        {error && <span className="text-rose-400">{error}</span>}
      </div>
    </div>
  );
};
