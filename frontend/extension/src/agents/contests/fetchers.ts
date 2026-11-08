import { fetchJson, fetchText, leetcodeGraphql } from '../../lib/http';
import type { Contest, ContestPlatform } from '../../lib/types';

/** How many finished contests to keep (and show) per platform. */
export const PAST_PER_PLATFORM = 4;

/** Each fetcher returns upcoming/live contests plus its platform's most recent finished ones. */
export async function fetchCodeforces(): Promise<Contest[]> {
  const res = await fetchJson<{
    status: string;
    comment?: string;
    result: { id: number; name: string; phase: string; startTimeSeconds?: number; durationSeconds: number }[];
  }>('https://codeforces.com/api/contest.list?gym=false');
  if (res.status !== 'OK') throw new Error(`Codeforces: ${res.comment ?? res.status}`);
  return res.result
    .filter((c) => (c.phase === 'BEFORE' || c.phase === 'CODING' || c.phase === 'FINISHED') && c.startTimeSeconds)
    .map((c) => ({
      id: `codeforces:${c.id}`,
      platform: 'codeforces',
      name: c.name,
      url: `https://codeforces.com/contests/${c.id}`,
      start: c.startTimeSeconds! * 1000,
      durationSec: c.durationSeconds,
    }));
}

export async function fetchLeetCode(): Promise<Contest[]> {
  type Node = { title: string; titleSlug: string; startTime: number; duration: number };
  const data = await leetcodeGraphql<{ upcomingContests: Node[]; pastContests?: { data: Node[] } }>(
    `{ upcomingContests { title titleSlug startTime duration }
       pastContests(pageNo: 1, numPerPage: ${PAST_PER_PLATFORM}) { data { title titleSlug startTime duration } } }`,
  );
  return [...data.upcomingContests, ...(data.pastContests?.data ?? [])].map((c) => ({
    id: `leetcode:${c.titleSlug}`,
    platform: 'leetcode',
    name: c.title,
    url: `https://leetcode.com/contest/${c.titleSlug}`,
    start: c.startTime * 1000,
    durationSec: c.duration,
  }));
}

interface CodeChefContest {
  contest_code: string;
  contest_name: string;
  contest_start_date_iso: string;
  contest_duration: string;
}

export async function fetchCodeChef(): Promise<Contest[]> {
  const res = await fetchJson<{
    status: string;
    future_contests?: CodeChefContest[];
    present_contests?: CodeChefContest[];
    past_contests?: CodeChefContest[];
  }>('https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all');
  if (res.status !== 'success') throw new Error(`CodeChef: ${res.status}`);
  const past = (res.past_contests ?? []).slice(0, PAST_PER_PLATFORM);
  return [...past, ...(res.present_contests ?? []), ...(res.future_contests ?? [])]
    .map((c) => ({
      id: `codechef:${c.contest_code}`,
      platform: 'codechef' as const,
      name: c.contest_name,
      url: `https://www.codechef.com/${c.contest_code}`,
      start: Date.parse(c.contest_start_date_iso),
      durationSec: Number(c.contest_duration) * 60,
    }))
    .filter((c) => Number.isFinite(c.start) && Number.isFinite(c.durationSec));
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, e: string) => ENTITIES[e] ?? '').trim();

/** Parses one contest table of https://atcoder.jp/contests/ (service workers have no DOMParser). */
function parseAtCoderTable(section: string): Contest[] {
  const contests: Contest[] = [];
  for (const row of section.split('<tr').slice(1)) {
    const time = row.match(/<time[^>]*>([^<]+)<\/time>/)?.[1];
    const link = row.match(/<a href="\/contests\/([^"/?#]+)"[^>]*>([^<]+)<\/a>/);
    const dur = row.match(/<td class="text-center">\s*(\d{1,3}):(\d{2})\s*<\/td>/);
    if (!time || !link || !dur) continue;
    // "2026-11-07 21:00:00+0900" -> "2026-11-07T21:00:00+09:00"
    const iso = time.trim().replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    const start = Date.parse(iso);
    if (!Number.isFinite(start)) continue;
    contests.push({
      id: `atcoder:${link[1]!}`,
      platform: 'atcoder',
      name: decode(link[2] ?? link[1] ?? ''),
      url: `https://atcoder.jp/contests/${link[1]}`,
      start,
      durationSec: Number(dur[1]) * 3600 + Number(dur[2]) * 60,
    });
  }
  return contests;
}

const atCoderSection = (html: string, id: string) => html.split(`id="${id}"`)[1]?.split('</table>')[0];

/** The "Upcoming Contests" table. */
export function parseAtCoderUpcoming(html: string): Contest[] {
  const section = atCoderSection(html, 'contest-table-upcoming');
  if (!section) throw new Error('AtCoder: upcoming table not found (page layout changed?)');
  return parseAtCoderTable(section);
}

/** The "Recent Contests" table (finished contests, newest first); empty if the page has none. */
export function parseAtCoderRecent(html: string): Contest[] {
  const section = atCoderSection(html, 'contest-table-recent');
  return section ? parseAtCoderTable(section).slice(0, PAST_PER_PLATFORM) : [];
}

export async function fetchAtCoder(): Promise<Contest[]> {
  const html = await fetchText('https://atcoder.jp/contests/?lang=en');
  return [...parseAtCoderRecent(html), ...parseAtCoderUpcoming(html)];
}

export const CONTEST_FETCHERS: Record<ContestPlatform, () => Promise<Contest[]>> = {
  leetcode: fetchLeetCode,
  codeforces: fetchCodeforces,
  codechef: fetchCodeChef,
  atcoder: fetchAtCoder,
};
