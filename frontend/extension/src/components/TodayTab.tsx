import { Check, Clock, ExternalLink as LinkIcon, RefreshCw, Sparkles, Target } from 'lucide-react';
import { browser } from 'wxt/browser';
import { useEffect, useRef, useState } from 'react';
import { useNow, useStorage } from '../hooks/useStorage';
import { send } from '../lib/messages';
import { formatDuration, localDate, relativeAgo } from '../lib/time';
import { NEWTON_SOURCE_URL, newtonKey, type NewtonQotdState } from '../lib/newtonQotd';
import type { Potd } from '../lib/types';
import { Button, cx, Difficulty, Empty, ErrorNote, IconButton, PlatformIcon, platformVars, ProgressRing, SectionTitle } from './ui';

const SOURCE_LABEL: Record<Potd['source'], string> = {
  leetcode: 'LeetCode daily',
  gfg: 'GFG POTD',
  tuf: 'TUF POTD',
  newton: 'Newton School QOTD',
};

/** "Daily" section: today's problems first, then today's coding time against the goal. */
export function TodayTab() {
  const now = useNow(30_000);
  const potd = useStorage('potd');
  const potdDone = useStorage('potdDone');
  const settings = useStorage('settings');
  const time = useStorage('time');
  const newton = useStorage('newtonQotd');
  const newtonError = useStorage('newtonQotdError');
  const [refreshing, setRefreshing] = useState(false);

  // If the TUF card would say "unavailable" (or only an old stand-in is cached), refresh the
  // problems of the day once when the popup opens instead of waiting for the hourly run.
  const retriedTuf = useRef(false);
  const needsTufRetry =
    !!potd &&
    !!settings &&
    settings.potdSources.tuf !== false &&
    potd.fetchedAt > 0 &&
    !potd.items.some((p) => p.source === 'tuf' && p.platform === 'tuf');
  useEffect(() => {
    if (!needsTufRetry || retriedTuf.current) return;
    retriedTuf.current = true;
    setRefreshing(true);
    void send({ type: 'runAgent', id: 'potd' })
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [needsTufRetry]);

  if (!potd || !potdDone || !settings || !time || newton === undefined) return null;
  const today = localDate(now);
  const done = new Set(potdDone[today] ?? []);
  // Hide picks from sources the user has since turned off (the cache may predate the change).
  // Hide disabled sources, and any old TUF stand-in (a LeetCode pick saved by earlier versions):
  // the TUF card only ever shows takeUforward's real problem of the day.
  const items = potd.items.filter(
    (p) => p.source in SOURCE_LABEL && settings.potdSources[p.source] !== false && !(p.source === 'tuf' && p.platform !== 'tuf'),
  );
  const tufUnavailable = settings.potdSources.tuf !== false && potd.fetchedAt > 0 && !items.some((p) => p.source === 'tuf');
  // Newton School's card comes from the last time you opened its page (never fetched in the background).
  const newtonOn = settings.potdSources.newton !== false;
  if (newtonOn && newton) items.push(newtonItem(newton, now));
  const allSourcesOff = !Object.values(settings.potdSources).some(Boolean);
  const total = items.length;
  const doneCount = items.filter((p) => done.has(p.key)).length;

  const todaySec = Object.values(time[today] ?? {}).reduce((s, p) => s + (p?.total ?? 0), 0);
  const goalSec = settings.dailyGoalMinutes * 60;
  const goalPct = goalSec ? Math.min(100, (todaySec / goalSec) * 100) : 0;
  const allDone = total > 0 && doneCount === total;

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([send({ type: 'runAgent', id: 'potd' }), send({ type: 'runAgent', id: 'contests' })]);
    setRefreshing(false);
  };

  const dateLabel = new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-3">
      {/* Daily summary */}
      <div className="card flex items-center gap-3.5 p-3.5">
        <ProgressRing
          value={total ? doneCount / total : 0}
          size={66}
          color={allDone ? 'var(--good)' : 'var(--brand-1)'}
          label={`${doneCount} of ${total} problems of the day done`}
        >
          <span className="tabular text-[17px] leading-none font-extrabold">
            {doneCount}
            <span className="text-[12px] font-bold text-ink-3">/{total}</span>
          </span>
          <span className="mt-0.5 text-[9px] font-semibold text-ink-3">done</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold text-ink-3">{dateLabel}</div>
          <div className="text-[14px] leading-snug font-extrabold tracking-tight">
            {allDone ? 'All daily problems solved 🎉' : total ? `${total - doneCount} problem${total - doneCount === 1 ? '' : 's'} left today` : "Today's problems"}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            <Clock size={12} className="text-ink-3" />
            <span className="tabular font-semibold">{formatDuration(todaySec)}</span>
            <span className="text-ink-3">{goalSec ? `of ${formatDuration(goalSec)} goal` : 'coded today · no daily goal set'}</span>
            {goalSec > 0 && goalPct >= 100 && <Target size={12} className="ml-auto text-good-text" aria-label="Goal reached" />}
          </div>
          {goalSec > 0 && (
            <div
              className="mt-1 h-1.5 rounded-full bg-surface-2"
              role="progressbar"
              aria-label="Daily coding goal"
              aria-valuenow={Math.round(goalPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              title={`${Math.round(goalPct)}% of daily coding goal`}
            >
              <div className={cx('h-1.5 rounded-full', goalPct >= 100 ? 'bg-good' : 'brand-gradient')} style={{ width: `${Math.max(goalPct, 2)}%` }} />
            </div>
          )}
        </div>
      </div>

      <section>
        <SectionTitle
          icon={<Sparkles size={13} />}
          right={
            <IconButton title="Refresh problems of the day" onClick={() => void refresh()} disabled={refreshing || allSourcesOff}>
              <RefreshCw size={13} className={cx(refreshing && 'animate-spin')} aria-hidden />
            </IconButton>
          }
        >
          Problems of the day
        </SectionTitle>
        {allSourcesOff ? (
          <div className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-ink-3">
            <p>All problem-of-the-day sources are turned off.</p>
            <Button variant="secondary" className="mt-2" onClick={() => void browser.runtime.openOptionsPage()}>
              Turn on in Settings
            </Button>
          </div>
        ) : items.length ? (
          <ul className="space-y-2">
            {items.map((p) => (
              <PotdRow
                key={p.source}
                p={p}
                done={done.has(p.key)}
                date={today}
                needsGfgHandle={p.source === 'gfg' && !settings.handles.gfg?.trim()}
              />
            ))}
            {tufUnavailable && <TufUnavailableRow reason={potd.errors.tuf} checking={refreshing} />}
            {newtonOn && !newton && <NewtonUnavailableRow error={newtonError?.error} />}
          </ul>
        ) : (
          <Empty>{potd.fetchedAt ? 'Could not load problems of the day.' : 'Fetching problems of the day…'}</Empty>
        )}
        {!allSourcesOff && <ErrorNote errors={potd.errors} />}
      </section>
    </div>
  );
}

function PotdRow({ p, done, date, needsGfgHandle }: { p: Potd; done: boolean; date: string; needsGfgHandle?: boolean }) {
  // TUF's A2Z picks link to other sites, but the pick itself is TUF's, so it wears TUF's identity.
  const identity = p.source === 'tuf' ? 'tuf' : p.platform;
  return (
    <li className="card plat-wash flex flex-wrap items-center gap-x-2 gap-y-1 py-2 pr-1.5 pl-1.5 transition hover:-translate-y-px" style={platformVars(identity)}>
      {/* 32px hit area around the 22px visual circle. */}
      <button
        type="button"
        onClick={() => void send({ type: 'togglePotdDone', date, key: p.key }).catch(() => undefined)}
        className="group/check flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full"
        title={done ? 'Mark as not done' : 'Mark as done'}
        aria-label={`${p.title}: ${done ? 'done — mark as not done' : 'mark as done'}`}
        aria-pressed={done}
      >
        <span
          className={cx(
            'flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition',
            done ? 'border-good bg-good text-white' : 'border-line bg-card group-hover/check:border-[var(--p)]',
          )}
        >
          {done && <Check size={13} strokeWidth={3} aria-hidden />}
        </span>
      </button>
      {/* The whole card opens the problem itself. */}
      <a href={p.url} target="_blank" rel="noreferrer" className="group flex min-w-0 flex-1 items-center gap-2.5" title={`Open ${p.title}`}>
        <PlatformIcon platform={identity} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="plat-ink text-[10.5px] font-bold">{SOURCE_LABEL[p.source]}</span>
            <Difficulty value={p.difficulty} />
            {p.outdated && (
              <span
                className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-semibold text-ink-2"
                title={`Couldn't refresh just now; showing the last question read${p.fetchedAt ? ` ${relativeAgo(p.fetchedAt)}` : ''}. Will retry automatically.`}
              >
                outdated
              </span>
            )}
          </div>
          <span className={cx('mt-0.5 block truncate text-[13.5px] font-bold group-hover:underline', done && 'text-ink-3 line-through')}>
            {p.title}
          </span>
          {(p.tags.length > 0 || p.note) && (
            <div className="mt-0.5 truncate text-[11px] text-ink-3">
              {p.tags.slice(0, 3).join(' · ')}
              {p.note && `${p.tags.length ? ' · ' : ''}${p.note}`}
            </div>
          )}
        </div>
      </a>
      {p.extraUrl && (
        <a
          href={p.extraUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
          title={extraLabel(p)}
          aria-label={extraLabel(p)}
        >
          <LinkIcon size={13} aria-hidden />
        </a>
      )}
      {needsGfgHandle && !done && (
        <button
          type="button"
          onClick={() => void browser.runtime.openOptionsPage()}
          className="basis-full cursor-pointer rounded-lg px-2 py-1 text-left text-[11px] font-semibold text-accent hover:bg-surface-2"
        >
          Add your GFG username in Settings to tick this automatically when you solve it →
        </button>
      )}
    </li>
  );
}

/**
 * The card for Newton School's featured question. Title and link come from one stored pair.
 * `fetchedAt` is when the extension read the page, never presented as the publication date.
 */
function newtonItem(n: NewtonQotdState, now: number): Potd {
  const seen = Date.parse(n.fetchedAt);
  const seenAgo = Number.isFinite(seen) ? relativeAgo(seen, now) : 'earlier';
  return {
    source: 'newton',
    platform: 'newton',
    key: newtonKey(n),
    title: n.title,
    // The card always opens Newton School's Question of the Day page (as requested), while the
    // question name is read from that page.
    url: NEWTON_SOURCE_URL,
    tags: [],
    date: '',
    note: n.stale
      ? `Couldn't read the latest — showing the question seen ${seenAgo}`
      : `Seen ${seenAgo} on Newton School · open its page to update`,
    extraUrl: NEWTON_SOURCE_URL,
  };
}

function extraLabel(p: Potd): string {
  if (p.source === 'newton') return 'Open Newton School Question of the Day';
  if (p.source === 'tuf') return `Open ${p.title} on takeUforward`;
  if (p.source === 'gfg') return 'Open GFG problem of the day page';
  return `Open ${p.title}`;
}

/** Until the Question of the Day page has been opened once, there is nothing honest to show. */
function NewtonUnavailableRow({ error }: { error?: string }) {
  return (
    <li className="card plat-wash flex items-center gap-2.5 py-2.5 pr-1.5 pl-3" style={platformVars('newton')} role="status">
      <a href={NEWTON_SOURCE_URL} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2.5" title="Open Newton School Question of the Day">
      <PlatformIcon platform="newton" size={32} />
      <div className="min-w-0 flex-1">
        <div className="plat-ink text-[10.5px] font-bold">{SOURCE_LABEL.newton}</div>
        <div className="text-[13px] font-bold">{error ? 'Couldn’t read the page' : 'Not loaded yet'}</div>
        <div className="text-[11px] text-ink-3">
          {error
            ? 'Reload the Question of the Day page while signed in. If it keeps failing, the page layout may have changed.'
            : 'Open (or reload) Newton School’s Question of the Day page once to show it here.'}
        </div>
        {error && (
          <div className="mt-0.5 truncate text-[10.5px] text-ink-3" title={error}>
            Reason: {error}
          </div>
        )}
      </div>
      </a>
      <a
        href={NEWTON_SOURCE_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
        title="Open Newton School Question of the Day"
        aria-label="Open Newton School Question of the Day"
      >
        <LinkIcon size={13} aria-hidden />
      </a>
    </li>
  );
}

/** Shown instead of a guessed question when takeUforward's problem of the day can't be read. */
function TufUnavailableRow({ reason, checking }: { reason?: string; checking?: boolean }) {
  return (
    <li className="card plat-wash flex items-center gap-2.5 py-2.5 pr-3 pl-3" style={platformVars('tuf')} role="status">
      <PlatformIcon platform="tuf" size={32} />
      <div className="min-w-0 flex-1">
        <div className="plat-ink text-[10.5px] font-bold">{SOURCE_LABEL.tuf}</div>
        <div className="text-[13px] font-bold">{checking ? 'Checking takeUforward…' : 'TUF POTD unavailable'}</div>
        <div className="text-[11px] text-ink-3">Couldn&apos;t read takeuforward.org/potd. Will retry automatically.</div>
        {reason && <div className="mt-0.5 truncate text-[10.5px] text-ink-3" title={reason}>Reason: {reason}</div>}
      </div>
    </li>
  );
}
