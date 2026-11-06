import { addDays, formatDuration, localDate } from '../lib/time';
import type { DayActivity } from '../lib/stats';

const WEEKS = 17;
const LEVELS = [0, 1, 2, 4, 7]; // problems solved thresholds for heat-1..heat-4

function level(solved: number) {
  let l = 0;
  for (let i = 1; i < LEVELS.length; i++) if (solved >= LEVELS[i]!) l = i;
  return l;
}

/** "0", "1", "2–3", "4–6", "7+" — the numeric range each colour step stands for. */
function levelRange(l: number): string {
  const lo = LEVELS[l]!;
  const next = LEVELS[l + 1];
  if (next === undefined) return `${lo}+`;
  return next - 1 === lo ? String(lo) : `${lo}–${next - 1}`;
}

/**
 * Problems solved on a day. `total` is de-duplicated by the stats layer (a POTD that also has
 * an accepted submission counts once), unlike `solved + potdTotal`.
 */
export function solvedOnDay(a: DayActivity | undefined): number {
  return a?.total ?? 0;
}

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** GitHub-style calendar of problems solved per day (sequential single-hue ramp). */
export function Heatmap({ days, today = localDate() }: { days: Map<string, DayActivity>; today?: string }) {
  const d = new Date(`${today}T12:00:00`);
  const mondayOffset = (d.getDay() + 6) % 7;
  const start = addDays(today, -mondayOffset - (WEEKS - 1) * 7);
  const columns: string[][] = [];
  for (let w = 0; w < WEEKS; w++) columns.push(Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));

  // Text summary of the grid, so the information isn't conveyed by colour alone.
  let total = 0;
  let activeDays = 0;
  let best: [string, number] | null = null;
  for (const date of columns.flat()) {
    if (date > today) continue;
    const n = solvedOnDay(days.get(date));
    if (!n) continue;
    total += n;
    activeDays++;
    if (!best || n > best[1]) best = [date, n];
  }
  const summary = total
    ? `${total} problem${total === 1 ? '' : 's'} solved on ${activeDays} day${activeDays === 1 ? '' : 's'} in the last ${WEEKS} weeks; best day ${dayLabel(best![0])} with ${best![1]}.`
    : `No problems solved in the last ${WEEKS} weeks.`;

  return (
    <div>
      <div className="flex gap-[3px]" role="img" aria-label={summary}>
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {col.map((date) => {
              if (date > today) return <div key={date} className="h-[13px] w-[13px]" />;
              const a = days.get(date);
              const solved = solvedOnDay(a);
              const tip = `${dayLabel(date)}: ${solved} solved${a?.seconds ? ` · ${formatDuration(a.seconds)} coding` : ''}`;
              return (
                <div
                  key={date}
                  title={tip}
                  className="h-[13px] w-[13px] rounded-[3px] hover:outline hover:outline-1 hover:outline-[var(--text-2)]"
                  style={{ background: `var(--heat-${level(solved)})` }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10.5px] text-ink-2" aria-hidden>
        {summary}
      </p>
      <ul className="mt-1 flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-[10px] text-ink-3" aria-label="Legend: problems solved per day">
        {LEVELS.map((_, l) => (
          <li key={l} className="inline-flex items-center gap-1">
            <span className="h-[10px] w-[10px] rounded-[2px] border border-line" style={{ background: `var(--heat-${l})` }} aria-hidden />
            {levelRange(l)}
          </li>
        ))}
        <li>solved / day</li>
      </ul>
    </div>
  );
}
