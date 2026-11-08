import { Activity, AlertTriangle, ExternalLink as LinkIcon, CalendarCheck, CheckCircle2, Clock, Flame, Hourglass, ListRestart, Loader2, Medal, Send, Target, TrendingDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { useNow, useStorage } from '../hooks/useStorage';
import { PLATFORMS, prettyProblem } from '../lib/platforms';
import {
  activityByDay,
  bestStreak,
  currentStreak,
  isActiveDay,
  revisitList,
  summarize,
  tagStats,
  timeTotals,
  VERDICT_LABEL,
  VERDICTS,
} from '../lib/stats';
import { addDays, formatDuration, localDate, relativeAgo } from '../lib/time';
import type { DayTime, PlatformId, PlatformProfile, Verdict } from '../lib/types';
import { PlatformSelect, type PlatformChoice } from './PlatformSelect';
import { Heatmap } from './Heatmap';
import { importStatus } from './importStatus';
import { BarList, Button, Card, cx, Empty, ExternalLink, PlatformIcon, platformVars, SectionTitle, StatTile } from './ui';

const RANGES = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: 'all', label: 'All time', days: 0 },
] as const;

type HandlePlatform = 'codeforces' | 'leetcode' | 'codechef' | 'atcoder' | 'gfg' | 'tuf';
const HANDLE_PLATFORMS: HandlePlatform[] = ['leetcode', 'codeforces', 'codechef', 'atcoder', 'gfg', 'tuf'];
/** Platforms whose submission history is imported from the handle. */
const IMPORTS_HISTORY: HandlePlatform[] = ['leetcode', 'codeforces', 'codechef', 'atcoder', 'gfg'];
/** Platforms that only report solved problems (no wrong attempts), so acceptance is unknown. */
const SOLVED_ONLY: PlatformId[] = ['gfg'];
/** Platforms where only coding time is tracked: none of them has a public API for submission history. */
const TIME_ONLY_NOTE: Partial<Record<PlatformId, string>> = {
  tuf: 'takeUforward has no public API for importing history, so only your coding time on takeuforward.org is tracked. Your username is used for the profile link.',
  hackerrank: 'Coding time only — HackerRank has no public API for importing your submission history.',
  code360: 'Coding time only — Code360 has no public API for importing your submission history.',
};
const PROFILE_URL: Record<HandlePlatform, (h: string) => string> = {
  leetcode: (h) => `https://leetcode.com/u/${encodeURIComponent(h)}/`,
  codeforces: (h) => `https://codeforces.com/profile/${encodeURIComponent(h)}`,
  codechef: (h) => `https://www.codechef.com/users/${encodeURIComponent(h)}`,
  atcoder: (h) => `https://atcoder.jp/users/${encodeURIComponent(h)}`,
  gfg: (h) => `https://www.geeksforgeeks.org/user/${encodeURIComponent(h)}/`,
  tuf: (h) => `https://takeuforward.org/profile/${encodeURIComponent(h)}`,
};
const isHandlePlatform = (p: PlatformChoice): p is HandlePlatform => (HANDLE_PLATFORMS as string[]).includes(p);


/** Platforms always offered in the Stats filter, even before there's any data for them. */
const ALWAYS_LISTED: PlatformId[] = ['leetcode', 'codeforces'];

const VERDICT_COLOR: Record<Verdict, string> = {
  AC: 'var(--good)',
  WA: 'var(--critical)',
  TLE: '#f59e0b',
  MLE: '#a855f7',
  RE: '#ec4899',
  CE: '#64748b',
  OTHER: 'var(--text-3)',
};


export function StatsTab() {
  const subs = useStorage('submissions');
  const time = useStorage('time');
  const potdDone = useStorage('potdDone');
  const settings = useStorage('settings');
  const profiles = useStorage('profiles');
  const agentStatus = useStorage('agentStatus');
  const now = useNow(60_000);
  // Recomputed when the date changes, so a popup left open past midnight isn't stale.
  const today = localDate(now);
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('7d');
  // Always opens on LeetCode (the choice isn't remembered between popup opens).
  const [platform, setPlatformState] = useState<PlatformChoice>('leetcode');
  const setPlatform = (p: PlatformChoice) => {
    setPlatformState(p);
  };

  // Platforms worth offering: any with a saved handle, submissions or tracked time.
  const options = useMemo(() => {
    if (!subs || !time || !settings) return [];
    const solved = new Map<PlatformId, Set<string>>();
    for (const s of subs) if (s.verdict === 'AC') (solved.get(s.platform) ?? solved.set(s.platform, new Set()).get(s.platform)!).add(s.problemKey);
    const secs = new Map<PlatformId, number>();
    for (const day of Object.values(time))
      for (const [p, t] of Object.entries(day) as [PlatformId, DayTime[PlatformId]][]) if (t) secs.set(p, (secs.get(p) ?? 0) + t.total);
    // LeetCode and Codeforces are always selectable; other platforms appear once there's activity
    // or a username for them.
    const ids = (Object.keys(PLATFORMS) as PlatformId[]).filter(
      (p) =>
        ALWAYS_LISTED.includes(p) ||
        solved.has(p) ||
        secs.has(p) ||
        subs.some((s) => s.platform === p) ||
        (isHandlePlatform(p) && settings.handles[p].trim()) ||
        p === platform,
    );
    const totalSolved = [...solved.values()].reduce((n, set) => n + set.size, 0);
    const totalSecs = [...secs.values()].reduce((a, b) => a + b, 0);
    return [
      { id: 'all' as const, hint: `${totalSolved} solved · ${formatDuration(totalSecs)}` },
      ...ids
        .sort((a, b) => (secs.get(b) ?? 0) - (secs.get(a) ?? 0))
        .map((id) => ({ id, hint: `${solved.get(id)?.size ?? 0} solved · ${formatDuration(secs.get(id) ?? 0)}` })),
    ];
  }, [subs, time, settings, platform]);

  const data = useMemo(() => {
    if (!subs || !time || !potdDone) return null;
    // Scope every input to the chosen platform; everything below is then computed as usual.
    const only = platform === 'all' ? null : platform;
    const pSubs = only ? subs.filter((s) => s.platform === only) : subs;
    const pTime: Record<string, DayTime> = only
      ? Object.fromEntries(Object.entries(time).map(([d, day]) => [d, day[only] ? { [only]: day[only] } : {}]))
      : time;
    const pPotd: Record<string, string[]> = only
      ? Object.fromEntries(Object.entries(potdDone).map(([d, keys]) => [d, keys.filter((k) => k.startsWith(`${only}:`))]))
      : potdDone;
    const r = RANGES.find((x) => x.id === range)!;
    const fromDate = r.days ? addDays(today, -(r.days - 1)) : '0000-00-00';
    const fromTs = r.days ? new Date(`${fromDate}T00:00:00`).getTime() : 0;
    const inRange = pSubs.filter((s) => s.ts >= fromTs);
    const days = activityByDay(pSubs, pTime, pPotd);
    const rangeDays = [...days.entries()].filter(([d]) => d >= fromDate);
    // "Active" means the same thing as for streaks: something solved (an AC or a POTD).
    const activeDays = rangeDays.filter(([, a]) => isActiveDay(a)).length;
    // Days with any tracked coding time (solved or not).
    const codingDays = rangeDays.filter(([, a]) => a.seconds > 0).length;
    const best = rangeDays.reduce<[string, number] | null>((b, [d, a]) => (a.seconds > (b?.[1] ?? 0) ? [d, a.seconds] : b), null);
    const rangeTime = timeTotals(pTime, fromDate);
    let problemSec = 0;
    for (const [d, day] of Object.entries(pTime)) {
      if (d < fromDate) continue;
      for (const t of Object.values(day)) if (t) for (const sec of Object.values(t.problems)) problemSec += sec;
    }
    // Acceptance ignores solved-only platforms: they never report wrong attempts, which would inflate it.
    const accSubs = only ? pSubs : pSubs.filter((x) => !SOLVED_ONLY.includes(x.platform));
    return {
      summary: summarize(pSubs, fromTs),
      acceptance: summarize(accSubs, fromTs),
      excludedFromAcceptance: only ? [] : SOLVED_ONLY.filter((p) => inRange.some((x) => x.platform === p)),
      time: rangeTime,
      problemSec: Math.min(problemSec, rangeTime.total),
      todaySec: timeTotals(pTime, today).total,
      todayAllSec: timeTotals(time, today).total,
      weekSec: timeTotals(pTime, addDays(today, -6)).total,
      allSec: timeTotals(pTime, '0000-00-00').total,
      activeDays,
      codingDays,
      avgPerCodingDay: codingDays ? rangeTime.total / codingDays : 0,
      bestDay: best,
      tags: tagStats(inRange, r.days === 7 ? 2 : 3).slice(0, 5),
      revisit: revisitList(pSubs, 8),
      days,
      streak: currentStreak((d) => isActiveDay(days.get(d)), today),
      best: bestStreak([...days.entries()].filter(([, a]) => isActiveDay(a)).map(([d]) => d)),
    };
  }, [subs, time, potdDone, range, platform, today]);

  if (!data || !settings) return null;
  const { summary: s } = data;
  const single = platform === 'all' ? null : platform;
  const handle = single && isHandlePlatform(single) ? settings.handles[single].trim() : '';
  const noHandles = single
    ? isHandlePlatform(single) && !handle
    : !Object.values(settings.handles).some((h) => h.trim());
  const scopeName = single ? PLATFORMS[single].name : 'all platforms';
  const rangeLabel = RANGES.find((r) => r.id === range)!.label.toLowerCase();
  const goalSec = settings.dailyGoalMinutes * 60;
  const todaySub = single
    ? data.todayAllSec > 0
      ? `${Math.round((data.todaySec / data.todayAllSec) * 100)}% of today's total`
      : undefined
    : goalSec
      ? `${Math.min(100, Math.round((data.todaySec / goalSec) * 100))}% of goal`
      : undefined;
  const importsHistory = single ? isHandlePlatform(single) && IMPORTS_HISTORY.includes(single) : true;
  const sync = importStatus(agentStatus?.submissions, single);
  const showSync = importsHistory && (single ? single === 'leetcode' || !!handle : !noHandles);
  const excluded = data.excludedFromAcceptance.map((p) => PLATFORMS[p].short).join(', ');
  // LeetCode's own profile numbers, only when they belong to the username in settings.
  const lcProfile = single === 'leetcode' && profiles?.leetcode && handle && profiles.leetcode.handle.toLowerCase() === handle.toLowerCase() ? profiles.leetcode : undefined;

  return (
    <div className="space-y-3">
      <PlatformSelect value={platform} options={options} onChange={setPlatform} />

      {showSync && (sync.running || sync.error) && (
        <p
          className={cx('flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px]', sync.error && !sync.running ? 'bg-[color-mix(in_srgb,var(--critical)_10%,var(--card))] text-critical' : 'bg-surface-2 text-ink-2')}
          role="status"
        >
          {sync.running ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <AlertTriangle size={12} aria-hidden />}
          <span className="min-w-0 flex-1">
            {sync.running
              ? `Importing ${single ? PLATFORMS[single].name : 'your submissions'}…`
              : `${single ? `${PLATFORMS[single].name} import failed: ` : ''}${sync.error}`}
          </span>
        </p>
      )}

      <div className="segmented" role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Hero: time spent coding */}
      <div className="card overflow-hidden" style={single ? platformVars(single) : undefined}>
        <div className={cx('px-3.5 pt-3 pb-3', single ? 'plat-gradient' : 'brand-gradient text-white')}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            {single ? <PlatformIcon platform={single} size={16} /> : <Hourglass size={12} aria-hidden />}
            Time spent {single ? `on ${scopeName}` : 'coding'} · {rangeLabel}
          </div>
          <div className="tabular mt-0.5 text-[30px] leading-none font-extrabold tracking-tight">{formatDuration(data.time.total)}</div>
          <div className="mt-1.5 text-[11px]">
            {data.codingDays} coding day{data.codingDays === 1 ? '' : 's'} · avg {formatDuration(Math.round(data.avgPerCodingDay))} per coding day
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line">
          <MiniStat label="Today" value={formatDuration(data.todaySec)} sub={todaySub} />
          <MiniStat label="Last 7 days" value={formatDuration(data.weekSec)} />
          <MiniStat label="All time" value={formatDuration(data.allSec)} />
        </div>
        {single && handle && isHandlePlatform(single) && (
          <a
            href={PROFILE_URL[single](handle)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 border-t border-line px-3.5 py-2 text-[11px] text-ink-2 hover:bg-surface-2"
          >
            <PlatformIcon platform={single} size={14} />
            <span className="min-w-0 flex-1 truncate">
              Your handle: <b className="text-ink">{handle}</b>
            </span>
            <span className="font-semibold text-accent">View profile</span>
            <LinkIcon size={11} className="text-accent" aria-hidden />
          </a>
        )}
        {data.bestDay && (
          <div className="border-t border-line px-3.5 py-2 text-[11px] text-ink-2">
            <Medal size={12} className="mr-1 inline text-[#f59e0b]" aria-hidden />
            Best day: <b>{formatDuration(data.bestDay[1])}</b> on{' '}
            {new Date(`${data.bestDay[0]}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>

      {noHandles && (
        <Card>
          <p className="text-xs text-ink-2">
            {single
              ? isHandlePlatform(single) && IMPORTS_HISTORY.includes(single)
                ? `Add your ${scopeName} handle to import your full submission history from ${scopeName}.`
                : `Add your ${scopeName} username to link your ${scopeName} profile here.`
              : 'Add your Codeforces, LeetCode, CodeChef, AtCoder and GeeksforGeeks handles to import submission history. LeetCode submissions are also captured live while you code.'}
          </p>
          <Button variant="primary" className="mt-2" onClick={() => void browser.runtime.openOptionsPage()}>
            {single ? `Add ${scopeName} ${isHandlePlatform(single) && IMPORTS_HISTORY.includes(single) ? 'handle' : 'username'}` : 'Add handles'}
          </Button>
        </Card>
      )}

      {single && TIME_ONLY_NOTE[single] && (
        <p className="rounded-xl border border-dashed border-line px-3 py-2 text-[11px] text-ink-2">{TIME_ONLY_NOTE[single]}</p>
      )}

      {single === 'gfg' && profiles?.gfg && profiles.gfg.handle === handle && <GfgProfileCard p={profiles.gfg} />}
      {single === 'leetcode' && lcProfile && <LeetCodeProfileCard p={lcProfile} />}

      <div className="grid grid-cols-3 gap-2">
        {lcProfile?.totalSolved !== undefined && range === 'all' ? (
          // LeetCode's public history only lists recent submissions; its profile has the real total.
          <StatTile icon={<CheckCircle2 size={11} />} label="Solved" value={lcProfile.totalSolved} sub="LeetCode profile" />
        ) : (
          <StatTile icon={<CheckCircle2 size={11} />} label="Solved" value={s.solved} sub={`of ${s.attempted} tried`} />
        )}
        {single && SOLVED_ONLY.includes(single) ? (
          <StatTile icon={<Target size={11} />} label="Acceptance" value="n/a" sub={`${scopeName} shares solved only`} />
        ) : data.acceptance.totalSubs === 0 && data.excludedFromAcceptance.length ? (
          <StatTile icon={<Target size={11} />} label="Acceptance" value="n/a" sub={`${excluded} shares solved only`} />
        ) : (
          <StatTile
            icon={<Target size={11} />}
            label="Acceptance"
            value={`${Math.round(data.acceptance.acceptanceRate * 100)}%`}
            sub={excluded ? `${data.acceptance.acceptedSubs} accepted · excl. ${excluded}` : `${data.acceptance.acceptedSubs} accepted`}
          />
        )}
        <StatTile icon={<Send size={11} />} label="Submissions" value={s.totalSubs} sub={`${s.wrongSubs} wrong`} />
        <StatTile icon={<Flame size={11} />} label="Streak" value={data.streak} sub="days now" />
        <StatTile icon={<Medal size={11} />} label="Best streak" value={data.best} sub="days" />
        <StatTile icon={<CalendarCheck size={11} />} label="Active days" value={data.activeDays} sub={`solved something · ${rangeLabel}`} />
      </div>

      <Card>
        <SectionTitle icon={<Activity size={13} />}>Activity</SectionTitle>
        <Heatmap days={data.days} today={today} />
      </Card>

      <Card>
        <SectionTitle icon={<Clock size={13} />}>{single ? `Where your ${scopeName} time went` : 'Time per platform'}</SectionTitle>
        {single ? (
          data.time.total === 0 ? (
            <Empty>
              No time tracked on {scopeName} {range === 'all' ? 'yet' : `in the last ${rangeLabel}`}. Open a problem there to start.
            </Empty>
          ) : (
            <p className="text-[11.5px] text-ink-2">
              {data.problemSec === 0 ? (
                <>
                  <b className="text-ink">{formatDuration(data.time.total)}</b> on {scopeName} pages, not on a specific problem.
                </>
              ) : (
                <>
                  <b className="text-ink">{formatDuration(data.problemSec)}</b> on specific problems
                  {data.time.total - data.problemSec >= 60 && (
                    <>
                      {' '}
                      · <b className="text-ink">{formatDuration(data.time.total - data.problemSec)}</b> elsewhere on {scopeName}
                    </>
                  )}
                </>
              )}
            </p>
          )
        ) : data.time.perPlatform.length ? (
          <BarList
            format={formatDuration}
            rows={data.time.perPlatform.map((p) => ({
              key: p.platform,
              label: (
                <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                  <PlatformIcon platform={p.platform} size={16} />
                  {PLATFORMS[p.platform].name}
                  <span className="font-normal text-ink-3">{Math.round((p.seconds / Math.max(1, data.time.total)) * 100)}%</span>
                </span>
              ),
              value: p.seconds,
              platform: p.platform,
            }))}
          />
        ) : (
          <Empty>No coding time tracked yet. Open a problem on any platform.</Empty>
        )}
        {data.time.topProblems.length > 0 && (
          <div className="mt-3 border-t border-line pt-2.5">
            <p className="mb-1.5 text-[11px] font-semibold text-ink-3">Most time spent on</p>
            <ul className="space-y-1.5">
              {data.time.topProblems.map((p) => (
                <li key={p.key} className="flex items-center gap-2 text-[11.5px]">
                  <PlatformIcon platform={p.platform} size={16} named />
                  <span className="min-w-0 flex-1 truncate font-medium">{prettyProblem(p.key)}</span>
                  <span className="tabular shrink-0 font-semibold">{formatDuration(p.seconds)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={<Send size={13} />} right={<span className="text-[10.5px] text-ink-3">{s.totalSubs} submissions</span>}>
          Verdicts
        </SectionTitle>
        {s.totalSubs ? (
          <>
            <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Verdict distribution">
              {VERDICTS.filter((v) => s.verdicts[v] > 0).map((v) => (
                <div
                  key={v}
                  title={`${VERDICT_LABEL[v]}: ${s.verdicts[v]} (${Math.round((s.verdicts[v] / s.totalSubs) * 100)}%)`}
                  style={{ width: `${(s.verdicts[v] / s.totalSubs) * 100}%`, background: VERDICT_COLOR[v] }}
                  className="border-r-2 border-card last:border-r-0"
                />
              ))}
            </div>
            <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
              {VERDICTS.filter((v) => s.verdicts[v] > 0).map((v) => (
                <li key={v} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: VERDICT_COLOR[v] }} />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{VERDICT_LABEL[v]}</span>
                  <span className="tabular font-semibold">{s.verdicts[v]}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Empty>No submissions in this range.</Empty>
        )}
      </Card>

      {!single && s.perPlatform.length > 0 && (
        <section>
          <SectionTitle>Per platform</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {s.perPlatform.map((p) => (
              <div key={p.platform} className="plat-hero rounded-2xl p-2.5" style={platformVars(p.platform)}>
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold">
                  <PlatformIcon platform={p.platform} size={20} />
                  {PLATFORMS[p.platform].name}
                </div>
                <div className="tabular mt-1.5 text-[18px] leading-none font-extrabold">
                  {p.solved}
                  <span className="text-[11px] font-semibold text-ink-3"> solved</span>
                </div>
                <div className="mt-1 text-[10.5px] text-ink-3">
                  {p.attempted} tried · {p.subs} subs
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.tags.length > 0 && (
        <Card>
          <SectionTitle icon={<TrendingDown size={13} />}>Weakest topics</SectionTitle>
          <BarList
            format={(v) => `${Math.round(v * 100)}% solved`}
            rows={data.tags.map((t) => ({
              key: t.tag,
              label: `${t.tag} · ${t.solved}/${t.attempted}`,
              value: t.rate,
              title: `${t.solved} of ${t.attempted} attempted problems solved · ${t.avgWrong.toFixed(1)} wrong attempts on average`,
            }))}
          />
        </Card>
      )}

      {data.revisit.length > 0 && (
        <section>
          <SectionTitle icon={<ListRestart size={13} />}>
            Revisit these <span className="font-semibold text-ink-3">(all time)</span>
          </SectionTitle>
          <ul className="space-y-1.5">
            {data.revisit.map((r) => (
              <li key={r.problemKey} className="card flex items-center gap-2 px-2.5 py-2" style={platformVars(r.platform)}>
                <ExternalLink href={r.url} className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold">
                  <PlatformIcon platform={r.platform} size={22} named />
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                </ExternalLink>
                <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', r.solved ? 'bg-surface-2 text-ink-3' : 'bg-[color-mix(in_srgb,var(--critical)_14%,transparent)] text-critical')}>
                  {r.reason}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10.5px] text-ink-3">Unsolved attempts and problems that took 3+ wrong submissions.</p>
        </section>
      )}

      {(() => {
        const scoped = single ? (subs ?? []).filter((x) => x.platform === single) : (subs ?? []);
        if (!scoped.length) return null;
        return (
          <p className="text-[10.5px] text-ink-3">
            {scoped.length} {single ? `${scopeName} ` : ''}submissions tracked · latest {relativeAgo(Math.max(...scoped.map((x) => x.ts)), now)}
            {showSync && sync.lastRun ? ` · last synced ${relativeAgo(sync.lastRun, now)}` : ''}
            {(!single || single === 'leetcode') && ` · Stay logged in to ${PLATFORMS.leetcode.name} in this browser to import its wrong answers too.`}
          </p>
        );
      })()}
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-2.5 py-2 text-center">
      <div className="text-[10px] font-semibold text-ink-3">{label}</div>
      <div className="tabular text-[13.5px] font-extrabold">{value}</div>
      {sub && <div className="text-[9.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

const GFG_DIFFICULTY_ORDER = ['School', 'Basic', 'Easy', 'Medium', 'Hard'];
const GFG_DIFFICULTY_COLOR: Record<string, string> = {
  School: '#94a3b8',
  Basic: '#38bdf8',
  Easy: 'var(--good)',
  Medium: '#f59e0b',
  Hard: 'var(--critical)',
};

/** GeeksforGeeks' own profile numbers: score, rank, POTD streak and solved split by difficulty. */
function GfgProfileCard({ p }: { p: PlatformProfile }) {
  const diffs = GFG_DIFFICULTY_ORDER.filter((d) => (p.byDifficulty?.[d] ?? 0) > 0);
  const total = diffs.reduce((n, d) => n + (p.byDifficulty?.[d] ?? 0), 0);
  return (
    <div className="plat-hero rounded-2xl p-3" style={platformVars('gfg')}>
      <div className="flex items-center gap-2">
        <PlatformIcon platform="gfg" size={22} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-extrabold">GeeksforGeeks profile{p.name ? ` · ${p.name}` : ''}</span>
        <span className="text-[10px] text-ink-3">updated {relativeAgo(p.fetchedAt)}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
        <ProfileNum label="Solved" value={p.totalSolved} />
        <ProfileNum label="Coding score" value={p.score} />
        <ProfileNum label="This month" value={p.monthlyScore} />
        <ProfileNum label="Institute rank" value={p.instituteRank ?? '–'} />
      </div>
      {total > 0 && (
        <>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Solved problems by difficulty">
            {diffs.map((d) => (
              <div
                key={d}
                title={`${d}: ${p.byDifficulty![d]}`}
                style={{ width: `${(p.byDifficulty![d]! / total) * 100}%`, background: GFG_DIFFICULTY_COLOR[d] ?? 'var(--text-3)' }}
                className="border-r-2 border-card last:border-r-0"
              />
            ))}
          </div>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {diffs.map((d) => (
              <li key={d} className="flex items-center gap-1 text-[10.5px]">
                <span className="h-2 w-2 rounded-sm" style={{ background: GFG_DIFFICULTY_COLOR[d] ?? 'var(--text-3)' }} />
                <span className="text-ink-2">{d}</span>
                <span className="tabular font-bold">{p.byDifficulty![d]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {(p.potdCurrentStreak !== undefined || p.potdLongestStreak !== undefined) && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-2">
          <Flame size={12} className="text-[var(--streak)]" aria-hidden />
          POTD streak <b className="text-ink">{p.potdCurrentStreak ?? 0}</b> days · longest <b className="text-ink">{p.potdLongestStreak ?? 0}</b>
        </div>
      )}
    </div>
  );
}

const LC_DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
const LC_DIFFICULTY_COLOR: Record<(typeof LC_DIFFICULTIES)[number], string> = { Easy: '#00b8a3', Medium: '#ffc01e', Hard: '#ef4743' };

/** LeetCode's own profile numbers: total solved, split by difficulty, ranking and contest rating. */
function LeetCodeProfileCard({ p }: { p: PlatformProfile }) {
  return (
    <div className="plat-hero rounded-2xl p-3" style={platformVars('leetcode')}>
      <div className="flex items-center gap-2">
        <PlatformIcon platform="leetcode" size={22} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-extrabold">LeetCode profile{p.name ? ` · ${p.name}` : ''}</span>
        <span className="text-[10px] text-ink-3">updated {relativeAgo(p.fetchedAt)}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
        <ProfileNum label="Solved" value={p.totalSolved} />
        <ProfileNum label="Ranking" value={p.ranking?.toLocaleString()} />
        <ProfileNum label="Contest rating" value={p.contestRating} />
        <ProfileNum label="Active this year" value={p.activeDays} />
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {LC_DIFFICULTIES.map((d) => {
          const solved = p.byDifficulty?.[d] ?? 0;
          const total = p.totalByDifficulty?.[d];
          return (
            <li key={d} className="text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: LC_DIFFICULTY_COLOR[d] }}>
                  {d}
                </span>
                <span className="tabular">
                  <b>{solved}</b>
                  {total ? <span className="text-ink-3"> / {total}</span> : null}
                </span>
              </div>
              {total ? (
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (solved / total) * 100)}%`, background: LC_DIFFICULTY_COLOR[d] }} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {(p.contestsAttended || p.streak !== undefined) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-2">
          {p.contestsAttended ? (
            <span>
              <Medal size={12} className="mr-1 inline text-[#f59e0b]" aria-hidden />
              {p.contestsAttended} contests{p.contestTopPercent !== undefined ? ` · top ${p.contestTopPercent}%` : ''}
            </span>
          ) : null}
          {p.streak !== undefined && (
            <span>
              <Flame size={12} className="mr-1 inline text-[var(--streak)]" aria-hidden />
              Submission streak <b className="text-ink">{p.streak}</b> days
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileNum({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="rounded-xl bg-card/70 px-1 py-1.5">
      <div className="tabular text-[15px] leading-tight font-extrabold">{value ?? '–'}</div>
      <div className="text-[9.5px] font-semibold text-ink-3">{label}</div>
    </div>
  );
}
