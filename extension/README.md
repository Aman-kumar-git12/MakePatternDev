# Coding Journey (browser extension)

A Chrome (and Firefox 128+) extension for your competitive-programming life:

- **Upcoming contests** from LeetCode, Codeforces, CodeChef and AtCoder. The next contest is highlighted with a live countdown, and you get reminders (60 and 10 minutes before by default), a badge count and Add to Google Calendar links.
- **Problems of the day**: the LeetCode daily, the GFG POTD, Striver's takeUforward POTD and Newton School's Question of the Day. The LeetCode, GFG and takeUforward ones are checked off automatically when you get an accepted submission.
- **Time tracking** per platform and per problem. It only counts while a coding tab is focused and you're active.
- **Submission stats**: attempted, solved, accepted and wrong counts, a verdict breakdown, a heatmap, streaks, weakest topics and a revisit list.
- **Code analysis**: an instant offline readability score, detected algorithms and a complexity estimate. With your own Anthropic API key you also get a deep Claude review.

## Install

The extension isn't on the Chrome Web Store yet, so you install it from a GitHub release.

### Chrome, Edge, Brave (and other Chromium browsers)

1. Download `coding-journey-extension-<version>-chrome.zip` from the
   [latest release](https://github.com/Aman-kumar-git12/MakePatternDev/releases/latest).
2. Unzip it into a folder you'll keep (Chrome loads it from there, so don't delete it).
3. Open `chrome://extensions` (Edge: `edge://extensions`), turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder (the one containing `manifest.json`).
5. Pin **Coding Journey** from the puzzle-piece menu, then open its **Settings** to add your handles.

To update: download the new zip, replace the folder's contents, and click the reload icon on the
extension's card in `chrome://extensions`. Your data is kept.

> Chrome only installs `.crx` packages from the Chrome Web Store, so a downloaded `.crx` would be
> blocked. That's why releases ship a zip for "Load unpacked".

### Firefox (128+)

1. Download `coding-journey-extension-<version>-firefox.zip` from the same release.
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick the zip
   (or `manifest.json` inside the unzipped folder).

Temporary add-ons are removed when Firefox restarts. A permanent Firefox install needs the add-on
to be signed by Mozilla (addons.mozilla.org), which these releases are not.

### Making a release (maintainers)

1. Bump `"version"` in `package.json`, commit.
2. Tag the commit `ext-v<version>` (e.g. `git tag ext-v0.2.0 && git push origin ext-v0.2.0`).
3. The **extension-release** GitHub Action type-checks, runs the tests, builds the Chrome and
   Firefox zips plus a sources zip, and attaches them to a GitHub Release for that tag.

Locally, `npm run release` does the same checks and writes the zips to `dist/`.

## Agents

All the work is done by small independent agents in the background service worker (`src/agents/`). The options page shows each agent's status and has a **Run** button for each.

| Agent | Trigger | What it does |
| --- | --- | --- |
| Contest (`contests/`) | every 3h | Fetches contests, schedules reminder alarms, updates the badge |
| Problem of the day (`potd/`) | every 1h | LeetCode, GFG and takeUforward POTDs; a daily Codeforces pick at your rating |
| Submission (`submissions.ts`) | every 30m + live | Codeforces `user.status`, AtCoder (kenkoooo), your full LeetCode history when logged in, and live LeetCode capture (verdict + code) |
| Time tracking (`timeTracker.ts`) | tab/focus/idle events + 1-min tick | Active time per platform and per problem |
| Code analysis (`codeAnalysis/`) | on demand | `heuristics.ts` (offline) and `claude.ts` (structured Claude review) |
| Coach (`coach.ts`) | hourly check | Weekly report notification on Sunday evening |

## Data sources

| What | Source | Notes |
| --- | --- | --- |
| Codeforces contests, picks, submissions | `codeforces.com/api` | Official API. Requests are spaced 2s apart and send cookies so Cloudflare clearance applies. |
| LeetCode contests, POTD | `leetcode.com/graphql` | Unofficial |
| LeetCode submission history | `leetcode.com/api/submissions/` using your logged-in session | Every verdict plus code. Logged out, it falls back to public accepted-only data for your username, plus live capture. |
| CodeChef contests | `codechef.com/api/list/contests/all` | Unofficial |
| AtCoder contests | parsed from `atcoder.jp/contests/` | Covered by a fixture test |
| AtCoder submissions | `kenkoooo.com/atcoder/atcoder-api/v3` | Community API |
| GFG POTD | `practiceapi.geeksforgeeks.org/api/vr/problems-of-day/problem/today/` | Unofficial |
| TUF (Striver) POTD | read from the embedded data on `takeuforward.org/potd` (`potd/tuf.ts`) | No public API. If the page changes, it falls back to a daily pick from the A2Z sheet (`potd/tufSheet.ts`). Covered by a fixture test. |

If a source fails, the last good data stays on screen with a warning.

## Develop

```bash
npm install
npm run dev          # opens Chrome with the extension loaded and hot reload
npm test             # vitest: parsers, heuristics, stats
npm run typecheck
npm run build        # -> dist/chrome-mv3 (load unpacked at chrome://extensions)
npm run build:firefox  # -> dist/firefox-mv3 (about:debugging -> Load Temporary Add-on)
npm run zip          # Chrome zip   (npm run zip:all = Chrome + Firefox + sources)
```

Icons are generated by `node scripts/gen-icons.mjs`.

## Browser support

- **Chrome / Edge / Brave** (Manifest V3): everything works.
- **Firefox 128+**: built as Manifest V3 too (`manifestVersion: 3` in `wxt.config.ts`; WXT would otherwise build MV2, where `browser.action` and MAIN-world content scripts don't exist). 128 is the first version with MAIN-world content scripts, which the live LeetCode capture needs. Firefox may treat host permissions as optional: if contests or submissions don't load, allow the sites under *about:addons → Coding Journey → Permissions*. `storage.local.setAccessLevel` doesn't exist in Firefox (see Privacy).
- **leetcode.cn is not supported.** The live capture only runs on leetcode.com: submissions are stored and verified against leetcode.com's API, and leetcode.cn ids and URLs would collide with them.

## Privacy

There is no server of ours: the extension talks only to the sites below, from your browser.

### Network requests

| Host | What | Cookies sent? |
| --- | --- | --- |
| `codeforces.com/api` | contests, POTD pick, your submissions (by handle) | **Yes**, so your Cloudflare clearance applies. The API calls are read-only and public. |
| `leetcode.com/graphql` | contests, daily problem, problem titles/tags | No |
| `leetcode.com/graphql` (`userStatus`, `submissionDetails`) | which account is logged in; verifying a live-captured submission | **Yes** (your LeetCode session) |
| `leetcode.com/api/submissions/` | your full submission history incl. code; verifying a live capture | **Yes** (your LeetCode session) |
| `www.codechef.com` | contests, your recent submissions (by handle) | No |
| `atcoder.jp` | contest list page | No |
| `kenkoooo.com` | your AtCoder submissions (by handle) | No |
| `practiceapi.geeksforgeeks.org`, `authapi.geeksforgeeks.org` | GFG POTD, your solved problems and profile (by handle) | No |
| `takeuforward.org/potd` | Striver's POTD page | **Yes** (`potd/tuf.ts` sends cookies; the page is public) |
| `api.anthropic.com` | the Claude review | No — your API key is sent in a header |
| site favicons (`<platform>/favicon.ico`) | icons in the popup | Loaded as images, with `no-referrer` |

The Anthropic request is made **only when you click _Review with Claude_** (or *Retry*). It contains the code being reviewed, its language, and the problem title, URL and verdict when known — nothing else. It goes directly from your browser to Anthropic with your own key.

On leetcode.com the extension also injects two content scripts (`leetcode-hook`, `leetcode-bridge`) that watch the page's own submit/check requests to capture your verdict and code as you submit. They never modify requests and send nothing over the network themselves; the background then checks each capture with LeetCode (rows above) before storing it. Captures that can't be checked (e.g. LeetCode unreachable) are kept but marked `unverified`.

### Storage

Everything — settings, contests, POTDs, submissions (with captured code), time tracked and analyses — is stored in `chrome.storage.local` on your device (`unlimitedStorage` is requested so a long history doesn't hit the 10 MB quota). Short-lived time-tracker state lives in `chrome.storage.session`. Export your data or clear it from the options page; the export never includes the API key, and clearing keeps only your settings.

### Your Anthropic API key

The key is stored in `chrome.storage.local` with your settings and is never logged or exported. At start-up the background asks the browser to restrict `storage.local` to extension pages (`storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })`). **Residual risk:** Chrome has historically accepted that call only for `storage.session`, and Firefox doesn't have it, so on those browsers content scripts *technically* can read `storage.local`. Our content scripts never touch extension storage and page scripts can't reach it, so exposure would need a compromised leetcode.com renderer process. Use a key with a spending limit if that matters to you.

### Permissions

- `storage`, `unlimitedStorage` — local data, see above.
- `alarms` — scheduled agent runs and contest reminders. `notifications` — reminders and the weekly report.
- `tabs` — read the active tab's URL so time is attributed to the right platform/problem (the time tracker runs on many sites, including ones without host permissions).
- `idle` — stop counting time when you're away.
- host permissions — exactly the hosts in the table above; nothing else.

### Message hardening

The background only accepts privileged messages (clear data, run agents, settings, AI review…) from the extension's own pages, and only accepts LeetCode captures from its content script in the top frame of a leetcode.com tab. Every message is shape-checked. The page→extension capture channel uses a per-page secret set up before any page script runs; because the MAIN world is shared with the page, the authoritative check is the server-side verification described above.
