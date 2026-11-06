import { Bell, BellOff, CalendarPlus, ExternalLink as LinkIcon } from 'lucide-react';
import { isLive } from '../agents/reminders';
import { send } from '../lib/messages';
import { PLATFORMS } from '../lib/platforms';
import { formatCountdown, formatDuration, formatStart, googleCalendarUrl } from '../lib/time';
import type { Contest } from '../lib/types';
import { cx, ExternalLink, IconButton, PlatformIcon, platformVars } from './ui';

export function setContestReminder(c: Contest, on: boolean) {
  return send({ type: 'setReminder', contestId: c.id, on });
}

function ReminderButton({ contest, on }: { contest: Contest; on: boolean }) {
  return (
    <IconButton
      title={on ? `Reminders on for ${contest.name} — click to mute` : `Reminders off for ${contest.name} — click to enable`}
      onClick={() => void setContestReminder(contest, !on).catch(() => undefined)}
    >
      {on ? <Bell size={14} className="text-accent" aria-hidden /> : <BellOff size={14} aria-hidden />}
    </IconButton>
  );
}

function CalendarButton({ c }: { c: Contest }) {
  return (
    <a
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
      href={googleCalendarUrl(`${c.name} (${PLATFORMS[c.platform].name})`, c.start, c.durationSec, c.url)}
      target="_blank"
      rel="noreferrer"
      title="Add to Google Calendar"
      aria-label={`Add ${c.name} to Google Calendar`}
    >
      <CalendarPlus size={14} aria-hidden />
    </a>
  );
}

function splitCountdown(ms: number): [string, string][] {
  const t = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0
    ? [[String(d), 'days'], [pad(h), 'hrs'], [pad(m), 'min']]
    : [[pad(h), 'hrs'], [pad(m), 'min'], [pad(sec), 'sec']];
}

/** Hero card for the next (or live) contest, washed in that platform's color. */
export function NextContestCard({ contest, now, reminderOn }: { contest: Contest; now: number; reminderOn: boolean }) {
  const live = isLive(contest, now);
  const endsIn = contest.start + contest.durationSec * 1000 - now;
  const p = PLATFORMS[contest.platform];
  return (
    <div className="plat-hero rounded-2xl p-3.5 shadow-[var(--shadow)]" style={platformVars(contest.platform)}>
      <div className="flex items-center gap-2.5">
        <PlatformIcon platform={contest.platform} size={36} />
        <div className="min-w-0 flex-1">
          <div className={cx('text-[10.5px] font-bold tracking-wide uppercase', live ? 'text-critical' : 'plat-ink')}>
            {live ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="live-dot h-2 w-2 rounded-full bg-critical" /> Live now on {p.name}
              </span>
            ) : (
              `Next contest · ${p.name}`
            )}
          </div>
          <ExternalLink href={contest.url} className="block truncate text-[15px] leading-snug font-extrabold tracking-tight">
            {contest.name}
          </ExternalLink>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="mb-1 text-[10px] font-semibold text-ink-3">{live ? 'Ends in' : 'Starts in'}</div>
          <div className="flex gap-1.5" role="timer" aria-label={`${live ? 'Ends' : 'Starts'} in ${formatCountdown(live ? endsIn : contest.start - now)}`}>
            {splitCountdown(live ? endsIn : contest.start - now).map(([v, unit]) => (
              <div key={unit} className="time-block">
                <div className="tabular text-[16px] leading-none font-extrabold">{v}</div>
                <div className="mt-0.5 text-[8.5px] font-semibold text-ink-3 uppercase">{unit}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <CalendarButton c={contest} />
          <ReminderButton contest={contest} on={reminderOn} />
          <a
            href={contest.url}
            target="_blank"
            rel="noreferrer"
            className="plat-solid ml-1 inline-flex min-h-8 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold shadow-sm hover:brightness-95"
            title={`${live ? 'Enter' : 'Register on'} ${p.name}`}
          >
            {live ? 'Enter' : 'Register'} <LinkIcon size={12} aria-hidden />
          </a>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-ink-2">
        {formatStart(contest.start, now)} · {formatDuration(contest.durationSec)}
      </div>
    </div>
  );
}

/** Compact contest card; contests within 24h are tinted and show a countdown. */
export function ContestRow({ contest, now, reminderOn }: { contest: Contest; now: number; reminderOn: boolean }) {
  const live = isLive(contest, now);
  const soon = !live && contest.start - now < 86_400_000;
  const p = PLATFORMS[contest.platform];
  return (
    <li
      className={cx('card flex items-center gap-2.5 py-2 pr-1.5 pl-2.5', (live || soon) && 'plat-wash', live && 'ring-1 ring-critical')}
      style={platformVars(contest.platform)}
    >
      <PlatformIcon platform={contest.platform} size={28} />
      <div className="min-w-0 flex-1">
        <ExternalLink href={contest.url} className="block truncate text-[13px] font-bold">
          {contest.name}
        </ExternalLink>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-3">
          <span className="plat-ink shrink-0 font-semibold">{p.name}</span>
          <span>·</span>
          <span className="truncate">{formatStart(contest.start, now)}</span>
          <span>·</span>
          <span className="shrink-0">{formatDuration(contest.durationSec)}</span>
        </div>
      </div>
      {(live || soon) && (
        <span
          className={cx('tabular shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold', live ? 'bg-critical text-[var(--on-critical)]' : 'time-block')}
          title={live ? 'Live now' : 'Starts in'}
        >
          {live ? 'LIVE' : formatCountdown(contest.start - now)}
        </span>
      )}
      <div className="flex shrink-0 items-center">
        <CalendarButton c={contest} />
        <ReminderButton contest={contest} on={reminderOn} />
      </div>
    </li>
  );
}
