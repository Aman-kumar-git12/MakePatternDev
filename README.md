# MakePattern Web App

The React single-page app for MakePattern: a DSA practice tracker with nested pattern folders, a Monaco code workspace, spaced-repetition reviews, LeetCode import and an in-browser code runner. It installs as a PWA and keeps working offline.

It talks to the separate FastAPI backend service over REST.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Testing and quality](#testing-and-quality)
- [Deployment](#deployment)
- [Accessibility](#accessibility)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Pattern folders**: unlimited nested folders of questions, with live completion counts and progress bars. Folders and questions can be created, renamed, moved (circular moves are blocked) and deleted.
- **Question workspace**:
  - Notes in Markdown, with an edit/preview toggle.
  - A Monaco code editor (Python, C++, Java, JavaScript) holding several named solutions per question.
  - Test cases, and a complexity tab comparing the solutions.
  - An attempt logger with a stopwatch.
  - Autosave, with a status indicator.
- **Run your code**:
  - Python runs in the browser through Pyodide, and JavaScript runs in a Web Worker. Neither needs any setup.
  - C++ and Java run through Judge0 when the backend has a Judge0 key.
- **Spaced-repetition reviews**:
  - Solving a question schedules reviews, which you rate Again, Hard, Good or Easy in the review queue.
  - The queue still works offline: ratings are queued and synced when you're back online.
- **LeetCode**:
  - Search and import problems with their statement, tags and examples.
  - See the daily challenge.
  - Sync your recent accepted submissions by username.
- **Starter curricula**: ready-made problem sets you can add to your workspace.
- **Progress**: activity heatmap, streaks and a dashboard of what to continue next.
- **Organisation**: bookmarks, global search (`/` or `Ctrl/⌘ + K`), multi-select bulk actions, and a trash where deletions can be undone and restored.
- **Sharing**: share a pattern as a public read-only link (`/shared/:id`); others can copy it into their own workspace.
- **Data**:
  - Export all your data as JSON.
  - Import a backup. Imports go into a new folder and never overwrite existing data.
- **Personalisation**:
  - Light, dark or system theme, plus a high-contrast mode and reduced motion.
  - Editor theme and font size, and interface scale.
  - Readable (Atkinson Hyperlegible) or dyslexia-friendly (OpenDyslexic) fonts.
  - Focus mode for distraction-free practice.
  - Optional single-key shortcuts.
- **Installable PWA**: works offline after the first visit, and shows a "new version available" prompt instead of updating silently.
- **Responsive**: works on phones, tablets and desktops.

## Tech stack

| Area | Choice |
|---|---|
| UI | React 19, TypeScript |
| Build | Vite 8 (Rolldown) |
| Styling | Tailwind CSS 4 |
| Routing | React Router 7 |
| Editor | Monaco (`@monaco-editor/react`) |
| Code runner | Pyodide 0.29.5 (from jsDelivr) and Web Workers; Judge0 through the backend |
| Sanitising | DOMPurify, for user and LeetCode HTML |
| Icons | lucide-react |
| Lint | Oxlint |

## Getting started

### Prerequisites

- Node.js 22 or newer and npm.
- The backend running locally (see the backend's README); by default it serves `http://localhost:8000/api`.

### Install and run

```bash
cd frontend
cp .env.example .env      # optional; the defaults below work for local development
npm install
npm run dev               # http://localhost:5173
```

Register with any email and password. Emails are not verified, by design. Signing in with an unknown email creates the account.

## Configuration

Vite reads variables from `.env` at build time. Only `VITE_`-prefixed variables reach the browser, so never put secrets in them.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api` on localhost, otherwise the hosted backend | Base URL of the backend API. A missing `/api` suffix is added automatically. |
| `VITE_API_URL` | — | Legacy alias, used only when `VITE_API_BASE_URL` is unset. |

`.env.example` also lists `VITE_APP_TITLE`, but the app doesn't currently read it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server with hot reload |
| `npm run build` | Type-checks (`tsc -b`) and builds to `dist/`, including the generated service worker |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Runs Oxlint |
| `node scripts/runner-selfcheck.ts` | Self-check of the code-runner harness (input parsing, output comparison) |

## Architecture

```
            ┌────────────── Browser ──────────────────────────────────────┐
            │                                                              │
 index.html │  main.tsx → App (React Router)                               │
            │     ├─ /login, /register         (public routes)             │
            │     ├─ /shared/:id               (public, read-only share)    │
            │     └─ /, /patterns, /question/:id, /revision, … → MainAppShell
            │            │                                                 │
            │            ├─ context/  Auth · Preferences · Theme           │
            │            ├─ app/      view routing, data + action hooks    │
            │            ├─ lazy views (Workspace, Reviews, Settings, …)   │
            │            └─ runner/   Pyodide / JS Web Workers ──┐          │
            │                                                   │         │
            │  services/api.ts  (fetch, JWT, timezone header) ───┼─────────┼──► backend /api
            │  offline/         review cache + queued ratings    │         │      (Judge0 for C++/Java)
            │  sw.js            precached shell and assets       │         │
            └────────────────────────────────────────────────────┴─────────┘
```

- **Routing**:
  - `App.tsx` defines the public routes (login, register and shared patterns).
  - Every signed-in path renders the same `MainAppShell`, which picks the view from the URL (`app/useViewRouting.ts`).
  - Unknown paths redirect to `/`.
- **State**:
  - React context holds auth (`AuthContext`) and preferences (`PreferencesContext`), which are kept in `localStorage` and synced to the server.
  - Feature data lives in hooks under `app/` (`useAppData`, `useFolderActions`, `useQuestionActions`, `useModalState`).
- **API client** (`services/api.ts`):
  - A single typed client. It adds the `Authorization: Bearer <JWT>` header and the browser's timezone, so streaks and "today" match the user's day.
  - It signs the user out when a request comes back 401.
  - `services/pendingWrites.ts` makes logout wait for in-flight autosaves.
- **Code runner** (`runner/`):
  - Python (Pyodide) and JavaScript run in Web Workers, with a 5-second limit per test case.
  - C++ and Java go to the backend's Judge0 proxy. The Run panel disables them when the server reports `judge0_enabled: false`.
- **Lazy loading**: the workspace, list views, reviews, settings and shared-pattern views are split into separate chunks (`app/lazyViews.tsx`), so the first page load only ships the app shell. React and React Router go in a separate `react-vendor` chunk that browsers can keep cached across deploys.
- **PWA**:
  - At build time, a Vite plugin in `vite.config.ts` generates `/sw.js` from `sw/sw.template.js`, embedding a build id and the list of every JS/CSS asset.
  - The service worker precaches the shell and assets. A new deploy produces a new worker, and the app shows an update prompt (`pwa/`) instead of forcing a reload.
  - The worker is registered only in production builds.
- **Offline reviews** (`offline/`):
  - The last review queue is cached per user.
  - Ratings made offline are queued, then sent in batches to `POST /reviews/batch`. Each rating carries an id, so a retried send never counts it twice.

## Project structure

```
frontend/
├── index.html
├── public/                 static files: favicon, PWA icons, manifest, hero image
├── scripts/
│   └── runner-selfcheck.ts
├── sw/
│   └── sw.template.js      service worker template (build generates /sw.js)
├── src/
│   ├── main.tsx            entry point
│   ├── App.tsx             routes
│   ├── index.css           Tailwind and theme tokens
│   ├── app/                app shell, view routing, data/action hooks, lazy views
│   ├── components/
│   │   ├── Auth/           route guards
│   │   ├── Common/         shared UI: bulk bar, undo toast, offline banner, …
│   │   ├── Dashboard/
│   │   ├── Header/         header and global search
│   │   ├── Modals/         create/rename/move/delete, LeetCode import, curricula, share
│   │   ├── Progress/       activity heatmap
│   │   ├── Settings/       appearance, import, LeetCode sync
│   │   ├── Sidebar/
│   │   ├── Views/          list views, reviews, trash, settings, shared pattern
│   │   └── Workspace/      question workspace, Monaco editor, run panel, notes
│   ├── context/            auth, preferences, theme
│   ├── hooks/              autosave, review queue, selection, undo toasts
│   ├── offline/            offline review cache and sync
│   ├── pages/              login and register
│   ├── pwa/                service-worker registration and update flow
│   ├── runner/             in-browser code runner and harness
│   ├── services/           API client, pending-write registry
│   ├── shortcuts/          keyboard shortcuts
│   ├── types/              shared TypeScript types
│   └── utils/
├── vercel.json             headers and SPA rewrites
└── vite.config.ts
```

## Keyboard shortcuts

Press `?` in the app to see this list. Single-key shortcuts can be turned off in **Settings → Appearance**. Shortcuts are ignored while you type in a field or while a dialog is open.

| Keys | Action |
|---|---|
| `/` or `Ctrl/⌘ + K` | Search |
| `?` | Show keyboard shortcuts |
| `n` | New question |
| `Esc` | Close dialog / exit focus mode |
| `g` then `d` / `p` / `r` / `b` / `s` | Go to Dashboard / My patterns / Reviews / Bookmarks / Settings |
| `j` / `k` | Next / previous question in a list |
| `Enter` or `o` | Open the selected question |
| `r` | Start the review queue |
| `f` | Toggle focus mode (in a question) |
| `b` | Bookmark the question |

## Testing and quality

```bash
npm run lint                        # Oxlint
npm run build                       # type-check and production build
node scripts/runner-selfcheck.ts    # code-runner harness checks
```

Run `npm run lint` and `npm run build` before pushing. Backend behaviour is covered by the backend's own test suite.

## Deployment

The app is a static build and is deployed on **Vercel**:

1. In Vercel, set the project's **Root Directory** to `frontend`.
2. Leave the build command (`npm run build`) and output directory (`dist`) at their Vite defaults.
3. Set `VITE_API_BASE_URL` to your backend URL, for example `https://<your-backend>/api`. Make sure the backend's `CLIENT_URL` / `CORS_ORIGINS` allow the deployed origin.

[`vercel.json`](vercel.json) does three things:

- **SPA rewrites**: every path except `sw.js`, `manifest.webmanifest`, `icons/` and `assets/` serves `index.html`, so deep links work.
- **Service worker**: `sw.js` is never cached (`no-cache, no-store`) and is allowed to control the whole site (`Service-Worker-Allowed: /`), so updates reach users promptly.
- **Assets**: hashed files under `/assets/` are cached for a year (`immutable`).

Any static host works if it applies the same rewrite rule and doesn't cache `sw.js`.

## Accessibility

- Every theme has a high-contrast mode, and reduced motion can be turned on.
- Interface scale and the editor font size are adjustable, and readable or dyslexia-friendly fonts are available.
- Dialogs trap focus and close with `Esc`, and the shortcut overlay is an accessible dialog.
- Everything can be used from the keyboard, and the single-key shortcuts can be turned off.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Requests fail with network or CORS errors | Make sure the backend is running and `VITE_API_BASE_URL` points to it (including `/api`). Add the frontend origin to the backend's `CORS_ORIGINS`. |
| The first request after a while is slow | The hosted backend sleeps when idle. The app pings it on load (`api.warmup()`), but the first call can still take a few seconds. |
| C++/Java "Run" is disabled | The backend has no Judge0 key. Python and JavaScript still run in the browser. |
| Python run is slow the first time | Pyodide (about 10 MB) downloads from jsDelivr on first use and is cached afterwards. |
| An old version keeps loading after a deploy | Accept the "new version available" prompt, or hard-reload. Check that the host isn't caching `sw.js`. |
| The service worker doesn't run in dev | Expected: it's registered only in production builds. Use `npm run build && npm run preview`. |

## Contributing

Run `npm run lint` and `npm run build` before opening a pull request.

## License

MIT
