const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date, YYYY-MM-DD. */
export function localDate(ts: number = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(date: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days, 12).getTime());
}

/** ISO-ish week key (Monday-based), e.g. 2026-11-02 for the week starting Monday 2 Nov. */
export function weekKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const offset = (d.getDay() + 6) % 7;
  return localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset, 12).getTime());
}

/** 3725 -> "1h 2m", 59 -> "59s". */
export function formatDuration(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Countdown: "02:14:33" under a day, "3d 4h" beyond. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  if (d >= 1) return `${d}d ${Math.floor((s % 86400) / 3600)}h`;
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function formatStart(ts: number, now: number = Date.now()): string {
  const time = new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const day = localDate(ts);
  const today = localDate(now);
  if (day === today) return `Today · ${time}`;
  if (day === addDays(today, 1)) return `Tomorrow · ${time}`;
  const date = new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${date} · ${time}`;
}

export function relativeAgo(ts: number, now: number = Date.now()): string {
  const s = Math.round((now - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Google Calendar "add event" link. */
export function googleCalendarUrl(title: string, start: number, durationSec: number, details: string): string {
  const fmt = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(start)}/${fmt(start + durationSec * 1000)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Small deterministic string hash (FNV-1a), used for daily picks. */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
