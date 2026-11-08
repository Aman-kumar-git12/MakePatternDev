# Coding Journey — browser extension

Contests, problems of the day, coding time, submission stats and code analysis for LeetCode, Codeforces, CodeChef, AtCoder, GeeksforGeeks and takeUforward, in one popup.

Chrome, Edge, Brave and other Chromium browsers (Manifest V3), and Firefox 128+. Part of the [MakePattern](../../README.md) monorepo. Built with [WXT](https://wxt.dev), React 19, TypeScript and Tailwind CSS v4.

- [Features](#features)
- [Supported platforms](#supported-platforms)
- [Install](#install)
- [Setup](#setup)
- [Permissions](#permissions)
- [Privacy and data](#privacy-and-data)
- [Architecture](#architecture)
- [Development](#development)
- [Releasing](#releasing)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing and license](#contributing-and-license)

## Features

The popup has four sections.

### Daily

- **Problems of the day**: the LeetCode daily challenge, the GeeksforGeeks POTD, Striver's takeUforward POTD and Newton School's Question of the Day.
- **Auto-tick**: a POTD is checked off when you solve it.
  - LeetCode: live, as soon as an accepted submission is captured.
  - GeeksforGeeks: a few seconds after you leave the problem page (needs your GFG username), and on every sync.
  - takeUforward: a few seconds after you leave the problem page, when takeuforward.org reports it solved (you must be logged in there).
  - Newton School: read only from the page you open; it is not fetched in the background.
- The LeetCode link is the official daily-challenge link, so solving it counts towards your LeetCode streak.
- If a source is down, the last real question stays on screen marked *outdated*; a different question is never substituted.

### Contests

- Upcoming contests from LeetCode, Codeforces, CodeChef and AtCoder, with the next one highlighted and a live countdown.
- Reminders before each contest (60 and 10 minutes by default, configurable), per-contest reminder toggles, a toolbar badge with the number of contests today, and *Add to Google Calendar* links.

### Stats

- A platform dropdown: all platforms combined, or one of LeetCode, Codeforces, CodeChef, AtCoder, GeeksforGeeks or takeUforward.
- Time spent coding (per platform and per problem), counted only while a coding tab is focused and you are active, against a daily goal.
- Attempted, solved, accepted and wrong counts, a verdict breakdown, a heatmap, streaks, weakest topics and a revisit list.

### Analysis

- **Code editor** for pasting or writing a solution. It has line numbers and handles indentation:
  - Tab and Shift+Tab indent and outdent the selected lines.
  - Enter keeps the indent and adds a level after `{`, `(`, `[` or `:`.
  - A closing bracket outdents itself, and Backspace removes a whole indent level.
  - The indent size is taken from the code (2 spaces, 4 spaces or tabs).
  - Esc, then Tab, moves focus out of the editor.
- **Quick analysis** (instant, offline): a readability score, detected algorithms and patterns, and a complexity estimate from loop nesting.
- **AI review**, which talks only about complexity: time and space complexity, why, what the variables mean, and whether a better complexity exists and how to reach it. It runs through the local [complexity agent](../../agent/README.md) with your own API key for any of 13 providers: Groq, Google Gemini, OpenRouter, Mistral, Cerebras, GitHub Models, Hugging Face, OpenAI, Anthropic, DeepSeek, xAI, Together AI, or a local Ollama.
- Your recent LeetCode submissions (captured with their code) can be analysed with one click.

## Supported platforms

| Platform | Contests | Problem of the day | Submission history | Time tracking |
| --- | --- | --- | --- | --- |
| LeetCode | Yes | Yes | Yes: full history when logged in; otherwise public accepted list plus live capture | Yes |
| Codeforces | Yes | — | Yes (official API, by handle) | Yes |
| CodeChef | Yes | — | Yes (by handle) | Yes |
| AtCoder | Yes | — | Yes (via kenkoooo.com, by handle) | Yes |
| GeeksforGeeks | — | Yes | Yes (solved problems, by handle) | Yes |
| takeUforward | — | Yes | No (profile link only) | Yes |
| Newton School | — | Yes (read from the page you view) | — | Yes |
| HackerRank, Code360 | — | — | — | Yes |

GeeksforGeeks and takeUforward provide no official public developer APIs. GFG data comes from the endpoints its own website uses, and the TUF problem of the day is read from takeuforward.org/potd, so either may stop working if those sites change. leetcode.cn is not supported.

## Install

The extension is not on the Chrome Web Store yet. Install it from GitHub Releases:

**[Download coding-journey-extension.zip](https://github.com/Aman-kumar-git12/MakePatternDev/releases/latest/download/coding-journey-extension.zip)** (always the latest version, for Chrome, Edge and Brave)

The same zip is also kept in this folder: [`coding-journey-extension.zip`](coding-journey-extension.zip). On GitHub, open it and click **Download raw file**.

### Chrome, Edge, Brave

1. Download `coding-journey-extension.zip` from the link above, or from the [Releases page](https://github.com/Aman-kumar-git12/MakePatternDev/releases/latest).
2. Unzip it. You get one folder, `coding-journey-extension`, with `manifest.json` directly inside. Keep this folder somewhere permanent: the browser loads the extension from it.
3. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `coding-journey-extension` folder.
5. Pin **Coding Journey** from the puzzle-piece menu, then open its **Settings**.

Don't drag the zip onto the extensions page or select the zip itself: Chrome only installs `.crx` packages from the Chrome Web Store, so it must be loaded as an unzipped folder.

To update, download the new zip, replace the `coding-journey-extension` folder with the new one, and click the reload icon on the extension's card. Your data is kept.

### Firefox 128+

Releases ship the Chrome build only. For Firefox, build it from source (below) with `npm run build:firefox`, then open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and pick `dist/firefox-mv3/manifest.json`.

Temporary add-ons are removed when Firefox restarts; a permanent install needs Mozilla signing, which these builds don't have. Firefox may treat host permissions as optional: if contests or submissions don't load, allow the sites under *about:addons → Coding Journey → Permissions*. Firefox 128 is required because the live LeetCode capture uses a MAIN-world content script.

### Build from source

```bash
cd frontend/extension
npm install
npm run build            # Chrome:  dist/chrome-mv3
npm run build:firefox    # Firefox: dist/firefox-mv3
```

Then load the output folder as above.

## Setup

1. **Usernames.** In Settings, add your LeetCode, Codeforces, CodeChef, AtCoder, GeeksforGeeks and takeUforward usernames. Each is optional; stats and history import only for platforms you fill in. For the full LeetCode history (every verdict with code), stay logged in to leetcode.com in the same browser.
2. **Contests and POTDs.** Choose which contest platforms and POTD sources to show, the reminder times, your daily coding goal and the idle timeout.
3. **AI review (optional).**
   1. Start the agent: `cd agent && python app.py` (see the [agent README](../../agent/README.md)). It listens on `http://127.0.0.1:8001`.
   2. In Settings → **AI code review**, pick a provider (free tiers such as Groq or Gemini work), paste your API key and optionally a model. *Test connection* checks the agent is reachable.
   3. Open any analysis and click **Review with &lt;provider&gt;**.

## Permissions

| Permission | Why |
| --- | --- |
| `storage`, `unlimitedStorage` | Everything is stored locally; submissions with code can outgrow the default 10 MB quota. |
| `alarms` | Scheduled agent runs and contest reminders. |
| `notifications` | Contest reminders and the weekly report. |
| `tabs` | Read the active tab's URL to attribute coding time to the right platform and problem, and to notice when you leave a TUF or GFG problem page (POTD auto-tick). |
| `idle` | Stop counting time when you are away. |
| `codeforces.com`, `leetcode.com`, `www.codechef.com`, `atcoder.jp`, `kenkoooo.com` | Contests, POTDs and submission history. |
| `practiceapi.geeksforgeeks.org`, `authapi.geeksforgeeks.org` | GFG POTD, solved problems and profile. |
| `takeuforward.org` | Striver's problem of the day. |
| `localhost`, `127.0.0.1` (any port) | The local complexity agent used by the AI review. |
| Content scripts on `leetcode.com` and `my.newtonschool.co` | Live LeetCode submission capture; reading Newton School's Question of the Day from the page you view. |

## Privacy and data

There is no MakePattern server involved: the extension talks only to the sites below, directly from your browser.

### Network requests

| Host | What | Cookies sent? |
| --- | --- | --- |
| `codeforces.com/api` | Contests and your submissions (by handle) | Yes, so your Cloudflare clearance applies. The API calls are read-only and public. |
| `leetcode.com/graphql` | Contests, daily problem, problem titles and tags | No |
| `leetcode.com/graphql` (`userStatus`, `submissionDetails`) | Which account is logged in; verifying a live-captured submission | Yes (your LeetCode session) |
| `leetcode.com/api/submissions/` | Your full submission history including code; verifying a live capture | Yes (your LeetCode session) |
| `www.codechef.com` | Contests and your recent submissions (by handle) | No |
| `atcoder.jp` | Contest list page | No |
| `kenkoooo.com` | Your AtCoder submissions (by handle) | No |
| `practiceapi.geeksforgeeks.org`, `authapi.geeksforgeeks.org` | GFG POTD, your solved problems and profile (by handle) | No |
| `takeuforward.org/potd` | Striver's POTD page | First with cookies (so it can report the problem solved when you're logged in), then without as a fallback |
| `localhost` / `127.0.0.1` | The AI review, via the local agent | No. The selected provider's API key is sent in an `X-API-Key` header. |
| Site favicons | Platform icons in the popup | Loaded as images with `no-referrer` |

The AI review request is made **only when you click _Review with …_**. It goes to the agent URL from settings and contains the code, its language and title, the provider, the model and that provider's key. The agent forwards it to the provider you chose and returns only the complexity review. Because the extension only has host permission for `localhost` and `127.0.0.1`, a remote agent URL won't work.

On leetcode.com, two content scripts (`leetcode-hook`, `leetcode-bridge`) watch the page's own submit and check requests to capture your verdict and code as you submit. They never modify requests and send nothing over the network themselves. The background then verifies each capture with LeetCode before storing it; captures that can't be verified are kept but marked `unverified`. On my.newtonschool.co, a content script only reads the Question of the Day card the site has already rendered.

### Storage

- Settings, contests, POTDs, submissions (with captured code), time tracked and analyses are stored in `chrome.storage.local` on your device. Short-lived state (time tracker, POTD watcher) lives in `chrome.storage.session`.
- TUF reader diagnostics (last 20 runs, no personal data) are kept under `tufDiagnostics` for troubleshooting.
- The options page can export all data as JSON or clear it. Exports never include API keys, and clearing keeps only your settings.

### API keys

- The AI review keys (one per provider) are stored in `chrome.storage.local` with your settings, are never logged or exported, and are sent only to the agent URL.
- At start-up the background asks the browser to restrict `storage.local` to extension pages (`setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })`).
- **Residual risk:** Chrome has historically accepted that call only for `storage.session`, and Firefox doesn't have it. On those browsers, content scripts can technically read `storage.local`. This extension's content scripts never touch extension storage and page scripts can't reach it, so exposure would need a compromised leetcode.com renderer. Use a key with a spending limit if that matters to you.

## Architecture

```
┌──────────── popup / options (React) ───────────┐
│  Daily · Contests · Stats · Analysis · Settings│
└──────────────┬───────────────────▲─────────────┘
   runtime.sendMessage             │ storage.onChanged (useStorage hook)
               ▼                   │
┌──────── background service worker ─────────────┐        ┌──────────────────────┐
│ router: authorize + parseMessage (lib/messages)│        │ content scripts       │
│ registry: agents, alarms, run tracking         │◀───────│ leetcode-hook (MAIN)  │
│  contests · potd · potdWatcher · submissions   │ verdict│ leetcode-bridge       │
│  timeTracker · codeAnalysis · coach · reminders│  + code│ newtonschool          │
└──────┬─────────────────────────┬───────────────┘        └──────────────────────┘
       │ fetch (lib/http)        │ storage.local / storage.session (lib/storage)
       ▼                         ▼
 LeetCode, Codeforces, CodeChef,   local data on your device
 AtCoder, kenkoooo, GFG, TUF,
 local agent (127.0.0.1:8001)
```

- **Agents** (`src/agents/`) are small independent jobs registered in `registry.ts`. Scheduled agents run on `chrome.alarms` (and catch up when the browser starts); event agents react to tab, focus and idle events. The options page shows each agent's status and has a **Run** button.
- **Messages** (`src/lib/messages.ts`) are shape-checked. Privileged messages (clear data, run agents, settings, AI review) are accepted only from the extension's own pages. LeetCode captures are accepted only from the bridge content script in the top frame of a leetcode.com tab, over a per-page secret channel, and are then verified server-side with LeetCode.
- **Storage** (`src/lib/storage.ts`) has typed keys with defaults, merges settings added in later versions, and migrates old settings.
- **UI** (`src/components/`, `src/entrypoints/popup`, `src/entrypoints/options`) reads storage through the `useStorage` hook and re-renders on changes.

| Agent | Trigger | What it does |
| --- | --- | --- |
| Contest (`contests/`) | Every 3 h | Fetches contests, schedules reminder alarms, updates the badge |
| Problem of the day (`potd/`) | Every 1 h | LeetCode, GFG and takeUforward POTDs; auto-ticks solved ones |
| POTD watcher (`potdWatcher.ts`) | Tab events | After you leave a TUF or GFG problem page, re-checks that platform (throttled) to tick the POTD |
| Submission (`submissions.ts`) | Every 30 min, plus live | Codeforces, AtCoder, CodeChef and GFG by handle; your LeetCode history when logged in; live LeetCode capture |
| Time tracking (`timeTracker.ts`) | Tab, focus and idle events, plus a 1-minute tick | Active time per platform and per problem |
| Code analysis (`codeAnalysis/`) | On demand | `heuristics.ts` (offline quick analysis) and `complexity.ts` (AI review through the local agent) |
| Coach (`coach.ts`) | Hourly check | Weekly report notification on Sunday evening |
| Reminders (`reminders.ts`) | Contest alarms | Contest reminder notifications |

## Development

Requirements: Node.js 22+ and npm.

```bash
cd frontend/extension
npm install          # also runs `wxt prepare`
npm run dev          # opens a browser with the extension loaded and hot reload
```

| Script | What it does |
| --- | --- |
| `npm run dev` / `npm run dev:firefox` | Development build with hot reload (Chrome / Firefox) |
| `npm run build` / `npm run build:firefox` | Production build to `dist/chrome-mv3` / `dist/firefox-mv3` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run package` | Chrome build packaged as `dist/coding-journey-extension.zip` (one ready-to-load `coding-journey-extension/` folder inside) |
| `npm run zip` / `npm run zip:firefox` / `npm run zip:all` | WXT's own zips in `dist/` (Chrome / Firefox / both plus sources) |
| `npm run release` | Type check, tests, then `package` |

- **Tests** live in `tests/` and run with Vitest. Browser APIs come from WXT's `fakeBrowser`, network calls are mocked, and site parsers are tested against saved fixtures in `tests/fixtures/`. No test touches the network.
- **Icons** are generated with `node scripts/gen-icons.mjs`.
- CI (`../../.github/workflows/ci.yml`) runs the type check, tests and build on every push.

## Releasing

1. Bump `"version"` in `package.json` and commit.
2. Tag the commit `ext-v<version>` and push the tag:
   ```bash
   git tag ext-v0.2.0 && git push origin ext-v0.2.0
   ```
3. The **extension-release** workflow (`../../.github/workflows/extension-release.yml`) checks that the tag matches `package.json`, type-checks, runs the tests, builds `coding-journey-extension.zip`, and attaches it to a GitHub Release for that tag. Because the file name never changes, `releases/latest/download/coding-journey-extension.zip` always serves the newest version. It can also be run manually from the Actions tab to get the zip as a workflow artifact.

Locally, `npm run release` runs the same checks and writes `dist/coding-journey-extension.zip`.

## Project structure

```
extension/
├── public/icon/               toolbar and store icons
├── scripts/gen-icons.mjs      icon generator
├── src/
│   ├── agents/                background jobs
│   │   ├── registry.ts        agent registry, alarms, run tracking
│   │   ├── router.ts          message handling
│   │   ├── contests/          contest fetchers + agent
│   │   ├── potd/              POTD fetchers, TUF reader, done marks
│   │   ├── potdWatcher.ts     auto-tick after leaving a TUF/GFG problem
│   │   ├── submissions.ts     history import + live LeetCode capture
│   │   ├── timeTracker.ts     active-time tracking
│   │   ├── codeAnalysis/      offline heuristics + AI review
│   │   ├── coach.ts           weekly report
│   │   └── reminders.ts       contest reminders
│   ├── components/            popup sections and shared UI (incl. CodeEditor)
│   ├── entrypoints/           background, popup, options, content scripts
│   ├── hooks/useStorage.ts    storage-backed React state
│   ├── lib/                   storage, messages, http, platforms, stats, complexityAgent, codeEditing
│   └── styles.css             Tailwind + design tokens
├── tests/                     Vitest tests and fixtures
├── wxt.config.ts              manifest, permissions, build config
└── package.json
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Malformed "…" message` or other errors right after a rebuild | The old background worker is still running. Click the reload icon on the extension's card in `chrome://extensions` after every rebuild, and check the card's path is `frontend/extension/dist/chrome-mv3`. |
| TUF problem of the day shows *unavailable* or *outdated* | takeuforward.org may be down or may have changed its page. The card shows the reason; the last 20 reader runs are logged under `tufDiagnostics` and in the service-worker console as `[tuf-potd]`. |
| TUF or GFG POTD isn't ticked after solving | TUF: be logged in to takeuforward.org in the same browser. GFG: add your GFG username in Settings. Both re-check a few seconds after you leave the problem page. |
| AI review says it can't reach the agent | Start it with `python app.py` in `agent/`, then use *Test connection* in Settings → AI code review. The URL must be `localhost` or `127.0.0.1`. |
| AI review says a model was not found or is retired | Providers retire models. Clear the Model field to use the default (the agent then picks an available model automatically), or type a current model name. |
| Contests or submissions don't load in Firefox | Allow the sites under *about:addons → Coding Journey → Permissions*. |
| LeetCode history is incomplete | Log in to leetcode.com in the same browser; logged out, only public accepted submissions and live captures are available. |

## Contributing and license

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for setup and checks. Released under the [MIT License](../../LICENSE).
