import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Trophy, CalendarDays, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { ActivityResponse, ProgressSummary } from '../../types/dsa';
import { localDateKey } from '../../utils/dates';
import { formatMinutes } from '../../utils/format';

interface ActivityHeatmapProps {
  /** Change this value to force a refetch (e.g. after solving/reviewing). */
  refreshKey?: unknown;
  summary?: ProgressSummary | null;
  compact?: boolean;
}

const WEEKS = 53;
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const level = (count: number, max: number) => {
  if (count <= 0) return 0;
  if (max <= 1) return 4;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
};

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ refreshKey, summary, compact = false }) => {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    api
      .getActivity(365)
      .then((res) => {
        if (alive) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'Could not load activity'));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  // Show the most recent weeks first on narrow screens.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [data]);

  const { weeks, max, monthMarkers } = useMemo(() => {
    const byDate = new Map((data?.days || []).map((d) => [d.date, d]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (WEEKS - 1) * 7 - today.getDay()); // align to Sunday
    const cols: Array<Array<{ key: string; date: Date; count: number; solved: number; reviewed: number; future: boolean }>> = [];
    const markers: Array<{ col: number; label: string }> = [];
    let maxCount = 0;
    const cursor = new Date(start);
    for (let w = 0; w < WEEKS; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const key = localDateKey(cursor);
        const entry = byDate.get(key);
        const count = entry?.count || 0;
        maxCount = Math.max(maxCount, count);
        if (cursor.getDate() === 1 || (w === 0 && d === 0)) {
          markers.push({ col: w, label: MONTHS[cursor.getMonth()] });
        }
        col.push({
          key,
          date: new Date(cursor),
          count,
          solved: entry?.solved || 0,
          reviewed: entry?.reviewed || 0,
          future: cursor > today,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(col);
    }
    return { weeks: cols, max: maxCount, monthMarkers: markers };
  }, [data]);

  const tiles = [
    { label: 'Current streak', value: `${data?.current_streak ?? summary?.current_streak ?? 0}d`, icon: Flame, color: '#fb923c' },
    { label: 'Longest streak', value: `${data?.longest_streak ?? summary?.longest_streak ?? 0}d`, icon: Trophy, color: '#facc15' },
    { label: 'Active days', value: `${data?.total_active_days ?? summary?.active_days ?? 0}`, icon: CalendarDays, color: '#60a5fa' },
    { label: 'Solved this week', value: `${summary?.solved_this_week ?? 0}`, icon: CheckCircle2, color: '#34d399' },
    { label: 'Time tracked', value: formatMinutes(summary?.total_time_minutes), icon: Clock, color: '#c084fc' },
  ];

  const totalActions = (data?.days || []).reduce((acc, d) => acc + d.count, 0);

  return (
    <section className="mp-card p-4 sm:p-5 space-y-4" aria-label="Activity and streaks">
      <div className={`grid gap-2.5 ${compact ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="mp-card-alt px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mp-faint">
                <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                {t.label}
              </div>
              <div className="text-xl font-extrabold mt-0.5 tabular-nums">{t.value}</div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider mp-muted">
            {totalActions} activities in the last year
          </h3>
          {!data && !error && <Loader2 className="w-3.5 h-3.5 animate-spin mp-faint" />}
        </div>
        {error ? (
          <p className="text-xs text-rose-400">{error}</p>
        ) : (
          <div ref={scrollRef} className="overflow-x-auto custom-scrollbar pb-1">
            <div className="inline-flex gap-1.5 min-w-max">
              <div className="grid grid-rows-7 gap-[3px] pt-4 text-[9px] mp-faint pr-1">
                {DAY_LABELS.map((l, i) => (
                  <span key={i} className="h-[11px] leading-[11px]">
                    {l}
                  </span>
                ))}
              </div>
              <div>
                <div className="relative h-4 text-[9px] mp-faint">
                  {monthMarkers.map((m) => (
                    <span key={`${m.col}-${m.label}`} className="absolute" style={{ left: m.col * 14 }}>
                      {m.label}
                    </span>
                  ))}
                </div>
                <div className="grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label="Daily activity heatmap">
                  {weeks.flat().map((cell) => (
                    <div
                      key={cell.key}
                      className={`w-[11px] h-[11px] rounded-[2px] ${cell.future ? 'opacity-0' : `mp-heat-${level(cell.count, max)}`}`}
                      title={
                        cell.future
                          ? undefined
                          : `${cell.date.toDateString()}: ${cell.count} ${cell.count === 1 ? 'activity' : 'activities'}` +
                            (cell.count ? ` (${cell.solved} solved, ${cell.reviewed} reviewed)` : '')
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-end gap-1 mt-2 text-[10px] mp-faint">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={`w-[11px] h-[11px] rounded-[2px] mp-heat-${l}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
};
