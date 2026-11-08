import { Bell, BellOff, CalendarDays, Radio, RefreshCw, Trophy } from 'lucide-react';
import { useState } from 'react';
import { browser } from 'wxt/browser';
import { isLive } from '../agents/reminders';
import { useNow, useStorage } from '../hooks/useStorage';
import { send } from '../lib/messages';
import { PLATFORMS } from '../lib/platforms';
import { addDays, localDate, relativeAgo } from '../lib/time';
import type { Contest, ContestPlatform } from '../lib/types';
import { PAST_PER_PLATFORM } from '../agents/contests/fetchers';
import { ContestRow, NextContestCard, PastContestRow } from './ContestItem';
import { Button, cx, Empty, ErrorNote, PlatformIcon, platformVars, SectionTitle } from './ui';

const ALL: ContestPlatform[] = ['leetcode', 'codeforces', 'codechef', 'atcoder'];

function group(c: Contest, now: number): string {
  if (isLive(c, now)) return 'Live now';
  const day = localDate(c.start);
  const today = localDate(now);
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  // Today + the next 6 days = 7 calendar days, matching the "Next 7 days" count.
  if (day < addDays(today, 7)) return 'Next 7 days';
  return 'Later';
}
const ORDER = ['Live now', 'Today', 'Tomorrow', 'Next 7 days', 'Later'];

export function ContestsTab() {
  const now = useNow();
  const contests = useStorage('contests');
  const settings = useStorage('settings');
  const overrides = useStorage('reminderOverrides');
  // Opens on all platforms; the user can narrow it to one.
  const [filter, setFilter] = useState<ContestPlatform | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  if (!contests || !settings || !overrides) return null;

  const enabled = ALL.filter((p) => settings.contestPlatforms[p]);
  const upcoming = contests.items.filter((c) => enabled.includes(c.platform) && c.start + c.durationSec * 1000 > now);
  // A filter for a platform that's turned off behaves as "All".
  const activeFilter = filter !== 'all' && !enabled.includes(filter) ? 'all' : filter;
  const items = upcoming.filter((c) => activeFilter === 'all' || c.platform === activeFilter);
  const [next, ...rest] = items;
  // The last few finished contests: newest first, for the selected platform or across all of them.
  // A contest that ended since the last refresh is still in `items`, so it counts too.
  const finished = new Map([...(contests.past ?? []), ...contests.items].map((c) => [c.id, c]));
  const recent = [...finished.values()]
    .filter((c) => enabled.includes(c.platform) && (activeFilter === 'all' || c.platform === activeFilter))
    .filter((c) => c.start + c.durationSec * 1000 <= now)
    .sort((a, b) => b.start - a.start)
    .slice(0, PAST_PER_PLATFORM);
  const reminderOn = (id: string) => overrides[id] ?? settings.remindersEnabled;

  const groups = new Map<string, Contest[]>();
  for (const c of rest) {
    const g = group(c, now);
    groups.set(g, [...(groups.get(g) ?? []), c]);
  }

  const today = localDate(now);
  const liveCount = upcoming.filter((c) => isLive(c, now)).length;
  const todayCount = upcoming.filter((c) => localDate(c.start) === today || isLive(c, now)).length;
  const weekCount = upcoming.filter((c) => isLive(c, now) || localDate(c.start) < addDays(today, 7)).length;
  const remindersOn = upcoming.filter((c) => reminderOn(c.id)).length;
  // Contests whose bell differs from the global default because the user flipped it.
  const overridden = upcoming.filter((c) => overrides[c.id] !== undefined && overrides[c.id] !== settings.remindersEnabled);
  const offsets = settings.reminderOffsets;
  const offsetsText = offsets.length ? `${offsets.join(' & ')} min before` : 'no reminder times set';
  const reminderSummary = settings.remindersEnabled
    ? `Reminders on for ${remindersOn} of ${upcoming.length} · ${offsetsText}`
    : remindersOn > 0
      ? `Reminders off by default · on for ${remindersOn} contest${remindersOn === 1 ? '' : 's'} you picked${offsets.length ? ` · ${offsetsText}` : ''}`
      : 'Reminders are off';

  // There is no "clear override" message, so reset pins each changed contest back to the default.
  const resetOverrides = async () => {
    setResetting(true);
    setResetError('');
    const results = await Promise.allSettled(
      overridden.map((c) => send({ type: 'setReminder', contestId: c.id, on: settings.remindersEnabled })),
    );
    if (results.some((r) => r.status === 'rejected')) setResetError("Couldn't reset every contest — try again.");
    setResetting(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await send({ type: 'runAgent', id: 'contests' }).catch(() => undefined);
    setRefreshing(false);
  };

  return (
    <div className="space-y-3">
      {/* At-a-glance overview */}
      <div className="grid grid-cols-3 gap-2">
        <Overview icon={<Radio size={12} />} label="Live now" value={liveCount} tone={liveCount ? 'text-critical' : undefined} />
        <Overview icon={<CalendarDays size={12} />} label="Today" value={todayCount} />
        <Overview icon={<Trophy size={12} />} label="Next 7 days" value={weekCount} />
      </div>

      <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 py-0.5" role="group" aria-label="Filter by platform">
        <button
          type="button"
          onClick={() => setFilter('all')}
          aria-pressed={activeFilter === 'all'}
          className={cx('chip cursor-pointer pl-2.5', activeFilter === 'all' ? 'border-transparent bg-ink text-surface' : 'text-ink-2 hover:bg-surface-2')}
        >
          All · {upcoming.length}
        </button>
        {enabled.map((p) => {
          const active = activeFilter === p;
          const count = upcoming.filter((c) => c.platform === p).length;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setFilter(active ? 'all' : p)}
              aria-pressed={active}
              style={platformVars(p)}
              className={cx('chip cursor-pointer', active ? 'plat-solid border-transparent' : 'text-ink hover:bg-surface-2')}
            >
              <PlatformIcon platform={p} size={18} />
              {PLATFORMS[p].name}
              <span className={cx('tabular', !active && 'text-ink-3')}>{count}</span>
            </button>
          );
        })}
      </div>

      {next ? (
        <NextContestCard contest={next} now={now} reminderOn={reminderOn(next.id)} />
      ) : (
        <Empty>{contests.fetchedAt ? 'No upcoming contests on these platforms.' : 'Fetching contests…'}</Empty>
      )}

      {ORDER.filter((g) => groups.has(g)).map((g) => (
        <section key={g}>
          <SectionTitle right={<span className="text-[10.5px] text-ink-3">{groups.get(g)!.length}</span>}>{g}</SectionTitle>
          <ul className="space-y-2">
            {groups.get(g)!.map((c) => (
              <ContestRow key={c.id} contest={c} now={now} reminderOn={reminderOn(c.id)} />
            ))}
          </ul>
        </section>
      ))}

      {recent.length > 0 && (
        <section>
          <SectionTitle right={<span className="text-[10.5px] text-ink-3">last {recent.length}</span>}>Recent contests</SectionTitle>
          <ul className="space-y-2">
            {recent.map((c) => (
              <PastContestRow key={c.id} contest={c} now={now} />
            ))}
          </ul>
        </section>
      )}

      <ErrorNote errors={contests.errors} />

      <div className="card px-3 py-1.5 text-[11px] text-ink-2">
        <div className="flex items-center gap-2">
          {settings.remindersEnabled || remindersOn > 0 ? (
            <Bell size={13} className="shrink-0 text-accent" aria-hidden />
          ) : (
            <BellOff size={13} className="shrink-0 text-ink-3" aria-hidden />
          )}
          <span className="min-w-0 flex-1">{reminderSummary}</span>
          <button
            type="button"
            className="min-h-8 shrink-0 cursor-pointer rounded-lg px-1.5 font-semibold text-accent hover:underline"
            onClick={() => void browser.runtime.openOptionsPage()}
          >
            Change
          </button>
        </div>
        {overridden.length > 0 && (
          <div className="flex items-center gap-2 border-t border-line pt-1">
            <span className="min-w-0 flex-1 text-ink-3">
              You changed the bell on {overridden.length} contest{overridden.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className="min-h-8 shrink-0 cursor-pointer rounded-lg px-1.5 font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void resetOverrides()}
              disabled={resetting}
            >
              {resetting ? 'Resetting…' : 'Reset per-contest choices'}
            </button>
          </div>
        )}
        {resetError && (
          <p className="pb-1 text-critical" role="alert">
            {resetError}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 text-[10.5px] text-ink-3">
        {contests.fetchedAt > 0 && <span>Updated {relativeAgo(contests.fetchedAt, now)} · times in your timezone</span>}
        <Button variant="ghost" className="ml-auto min-h-8 px-2" title="Refresh contests" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw size={12} className={cx(refreshing && 'animate-spin')} aria-hidden /> Refresh
        </Button>
      </div>
    </div>
  );
}

function Overview({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: string }) {
  return (
    <div className="card px-2.5 py-2">
      <div className={cx('flex items-center gap-1 text-[10px] font-semibold text-ink-3', tone)}>
        {icon}
        {label}
      </div>
      <div className={cx('tabular text-[18px] leading-tight font-extrabold', tone)}>{value}</div>
    </div>
  );
}
