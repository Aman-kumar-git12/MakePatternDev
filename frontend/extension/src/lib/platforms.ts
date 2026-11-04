import type { PlatformId } from './types';

export interface PlatformMeta {
  name: string;
  short: string;
  home: string;
  /** Short text used where the platform's icon can't load. */
  mono: string;
  /** The site's own favicon, shown inside a round mark. */
  icon: string;
}

export const PLATFORMS: Record<PlatformId, PlatformMeta> = {
  leetcode: { name: 'LeetCode', short: 'LC', home: 'https://leetcode.com', mono: 'LC', icon: 'https://leetcode.com/favicon.ico' },
  codeforces: { name: 'Codeforces', short: 'CF', home: 'https://codeforces.com', mono: 'CF', icon: 'https://codeforces.com/favicon.ico' },
  codechef: { name: 'CodeChef', short: 'CC', home: 'https://www.codechef.com', mono: 'CC', icon: 'https://www.codechef.com/favicon.ico' },
  atcoder: { name: 'AtCoder', short: 'AC', home: 'https://atcoder.jp', mono: 'AC', icon: 'https://atcoder.jp/favicon.ico' },
  gfg: { name: 'GeeksforGeeks', short: 'GFG', home: 'https://www.geeksforgeeks.org', mono: 'GfG', icon: 'https://www.geeksforgeeks.org/favicon.ico' },
  tuf: { name: 'takeUforward', short: 'TUF', home: 'https://takeuforward.org', mono: 'TUF', icon: 'https://takeuforward.org/favicon.ico' },
  hackerrank: { name: 'HackerRank', short: 'HR', home: 'https://www.hackerrank.com', mono: 'HR', icon: 'https://www.hackerrank.com/favicon.ico' },
  code360: { name: 'Code360', short: 'C360', home: 'https://www.naukri.com/code360', mono: '360', icon: 'https://www.naukri.com/favicon.ico' },
  newton: { name: 'Newton School', short: 'NS', home: 'https://my.newtonschool.co', mono: 'NS', icon: 'https://my.newtonschool.co/favicon.ico' },
};

/** CSS custom properties that scope a subtree to a platform's identity colors. */
export function platformStyle(platform: PlatformId): Record<string, string> {
  return { '--p': `var(--plat-${platform})`, '--p-fg': `var(--plat-${platform}-fg)` };
}

/** `leetcode:two-sum` -> `Two Sum`, `codeforces:1843C` -> `1843C`. */
export function prettyProblem(problemKey: string): string {
  const [platform, ...rest] = problemKey.split(':');
  const id = rest.join(':');
  // AtCoder task ids: abc300_a -> ABC300 A
  if (platform === 'atcoder') return id.replace(/_/g, ' ').toUpperCase();
  // Codeforces 1843C / CodeChef FLOW001 are codes, not titles.
  if (platform === 'codeforces' || platform === 'codechef') return `Problem ${id}`;
  if (!/[-_]/.test(id) && !/^[a-z]/.test(id)) return id;
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => (/^\d/.test(w) ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');
}

export interface DetectedPage {
  platform: PlatformId;
  /** Null when the page is on a coding platform but not on a specific problem. */
  problemKey: string | null;
}

const HOSTS: [RegExp, PlatformId][] = [
  [/(^|\.)leetcode\.(com|cn)$/, 'leetcode'],
  [/(^|\.)codeforces\.(com|ml)$/, 'codeforces'],
  [/(^|\.)codechef\.com$/, 'codechef'],
  [/(^|\.)atcoder\.jp$/, 'atcoder'],
  [/(^|\.)geeksforgeeks\.org$/, 'gfg'],
  [/(^|\.)takeuforward\.org$/, 'tuf'],
  [/(^|\.)hackerrank\.com$/, 'hackerrank'],
  [/^my\.newtonschool\.co$/, 'newton'],
];

/**
 * Maps a URL to the coding platform it belongs to and, when it is a problem page,
 * a stable problem key such as `leetcode:two-sum` or `codeforces:1843C`.
 */
export function detectPage(rawUrl: string | undefined): DetectedPage | null {
  if (!rawUrl) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (/(^|\.)naukri\.com$/.test(host)) {
    if (!path.startsWith('/code360')) return null;
    const m = path.match(/^\/code360\/problems\/([^/?#]+)/);
    return { platform: 'code360', problemKey: m ? `code360:${m[1]}` : null };
  }

  const platform = HOSTS.find(([re]) => re.test(host))?.[1];
  if (!platform) return null;
  return { platform, problemKey: problemKeyFromPath(platform, path) };
}

function problemKeyFromPath(platform: PlatformId, path: string): string | null {
  let m: RegExpMatchArray | null;
  switch (platform) {
    case 'leetcode':
      m = path.match(/^\/problems\/([^/]+)/);
      return m ? `leetcode:${m[1]!.toLowerCase()}` : null;
    case 'codeforces':
      m =
        path.match(/^\/(?:contest|gym)\/(\d+)\/problem\/(\w+)/) ??
        path.match(/^\/problemset\/problem\/(\d+)\/(\w+)/);
      return m ? `codeforces:${m[1]}${m[2]!.toUpperCase()}` : null;
    case 'codechef':
      m = path.match(/^\/(?:[\w-]+\/)?problems\/([\w-]+)/);
      return m ? `codechef:${m[1]!.toUpperCase()}` : null;
    case 'atcoder':
      m = path.match(/^\/contests\/[^/]+\/tasks\/([^/?#]+)/);
      return m ? `atcoder:${m[1]}` : null;
    case 'gfg':
      m = path.match(/^\/problems\/([^/]+)/);
      return m ? `gfg:${m[1]!.toLowerCase()}` : null;
    case 'hackerrank':
      m = path.match(/\/challenges\/([^/]+)/);
      return m ? `hackerrank:${m[1]}` : null;
    case 'tuf':
      m = path.match(/^\/practice\/[^/]+\/([^/?#]+)/) ?? path.match(/\/problems?\/([^/?#]+)/);
      return m ? `tuf:${decodeURIComponent(m[1]!).toLowerCase()}` : null;
    case 'newton':
      m = path.match(/^\/question-of-the-day\/question\/([A-Za-z0-9_-]+)/);
      return m ? `newton:${m[1]!.toLowerCase()}` : null;
    default:
      return null;
  }
}
