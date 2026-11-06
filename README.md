# MakePattern

A tracker for practising Data Structures and Algorithms (DSA). It combines a web workspace for problems, notes and solutions with spaced-repetition reviews, LeetCode sync, an in-browser code runner, a browser extension that follows your daily coding across platforms, and an AI agent that reviews the time and space complexity of your code.

[![CI](https://github.com/Aman-kumar-git12/MakePatternDev/actions/workflows/ci.yml/badge.svg)](https://github.com/Aman-kumar-git12/MakePatternDev/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Contents

- [What's inside](#whats-inside)
- [Features](#features)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Repository layout](#repository-layout)
- [Configuration](#configuration)
- [Testing and CI](#testing-and-ci)
- [Deployment](#deployment)
- [Security and privacy](#security-and-privacy)
- [Contributing](#contributing)
- [License](#license)

## What's inside

| Service | What it is | Stack | Docs |
|---|---|---|---|
| **Backend** | REST API for accounts, folders, questions, solutions, reviews and LeetCode sync | FastAPI, MongoDB | [backend/README.md](backend/README.md) |
| **Frontend** | The MakePattern web app (installable as an offline-capable PWA) | React 19, TypeScript, Vite, Tailwind CSS | [frontend/README.md](frontend/README.md) |
| **Extension** | *Coding Journey*: a browser extension for daily problems, contests, stats and code analysis | WXT, React, Tailwind CSS | [frontend/extension/README.md](frontend/extension/README.md) |

**Get the extension:** download [Chrome / Edge / Brave](frontend/extension/releases/coding-journey-extension-0.1.0-chrome.zip) or [Firefox](frontend/extension/releases/coding-journey-extension-0.1.0-firefox.zip), unzip it, then load it via `chrome://extensions` → Developer mode → Load unpacked. See the [install guide](frontend/extension/README.md#install).
| **Agent** | A REST service that reviews code for time and space complexity using your own LLM API key | FastAPI, 13 LLM providers | [agent/README.md](agent/README.md) |

## Features

**Web app**
- **Organisation:** folders nested to any depth, with progress per folder, a dashboard, bookmarks and global search (`Ctrl/Cmd + K`).
- **Question workspace:** notes, a Monaco code editor (the editor used in VS Code) with several named solutions, test cases and a side-by-side complexity comparison.
- **Spaced-repetition reviews:** reviews after 1, 3, 7, 14, 30, 60 and 120 days, rated Again / Hard / Good / Easy, with streaks and an activity heatmap.
- **LeetCode:** search and import problems with their statements and examples, see the daily challenge, and sync your accepted submissions.
- **Starter curricula:** "Core Interview Patterns" (118 problems) and "Beginner Foundations" (34).
- **Code runner:** Python and JavaScript run in the browser with no setup; C++ and Java run through Judge0 when it is configured.
- **Productivity:** PWA with offline support, keyboard shortcuts, focus mode, themes, bulk actions, undo and trash, JSON import and export, and sharing.
- **Accounts:** any email address works for sign-up and sign-in. Emails are never verified, by design.

**Browser extension (Coding Journey)**
- **Daily problems:** the problem of the day from LeetCode, GeeksforGeeks, takeUforward and Newton School, ticked automatically soon after you solve it.
- **Contests:** upcoming contests across platforms, with reminders.
- **Stats:** per-platform stats and time spent coding.
- **Analysis:** an offline code analysis with a code editor that handles indentation, plus an AI review that talks only about complexity.

**Complexity agent**
- Reviews code for time and space complexity, says why, and says whether a faster approach exists.
- Uses your own key with Groq, Gemini, OpenRouter, Mistral, Cerebras, GitHub Models, Hugging Face, OpenAI, Anthropic, DeepSeek, xAI or Together, or a local Ollama model with no key.

## Architecture

```
                         ┌──────────────────────────┐
  browser ──────────────▶│ frontend (Vercel, PWA)   │
                         └────────────┬─────────────┘
                                      │ REST /api (JWT)
                                      ▼
                         ┌──────────────────────────┐       ┌──────────────┐
                         │ backend (FastAPI, Render)│──────▶│ MongoDB Atlas│
                         └────────────┬─────────────┘       └──────────────┘
                                      │ LeetCode GraphQL, Judge0 (optional)
                                      ▼
                               external services

  extension (popup + background worker) ──▶ LeetCode, Codeforces, GFG, TUF, … (read-only)
          │
          └── AI review ──▶ agent (localhost:8001) ──▶ your chosen LLM provider
```

- **MongoDB** is the only database. Tests use an in-memory mock, so they never touch a real database.
- **The extension** keeps its data in the browser. It talks to coding platforms directly, and to the agent only when you ask for an AI review.
- **The agent** runs on your own machine and is separate from the backend. Your API key never reaches MakePattern's servers.

## Quick start

Prerequisites:
- Python 3.10 or newer
- Node.js 22
- a MongoDB database: local via Docker, or a MongoDB Atlas connection string

```bash
git clone --recurse-submodules https://github.com/Aman-kumar-git12/MakePatternDev.git
cd MakePatternDev   # already cloned? run: git submodule update --init

# 1. Database (optional: local MongoDB on :27017)
docker compose up -d

# 2. Backend: http://localhost:8000/api
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env              # set MONGODB_URI (mongodb://localhost:27017 for the local DB)
python run.py

# 3. Frontend: http://localhost:5173 (new terminal)
cd frontend && npm install && npm run dev

# 4. Extension (optional, new terminal)
cd frontend/extension && npm install && npm run build
#    then load frontend/extension/dist/chrome-mv3 via chrome://extensions → Load unpacked

# 5. Complexity agent (optional): http://127.0.0.1:8001 (new terminal)
cd agent
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Each service's README covers its full setup and configuration.

## Repository layout

```
.
├── backend/                FastAPI API: app/routers, app/schemas, app/services, tests/
├── frontend/               React + Vite web app
│   └── extension/          Coding Journey browser extension (separate npm package)
├── agent/                  Complexity agent (git submodule: makePatternAgent; python app.py)
├── .github/workflows/      ci.yml (all services) and extension-release.yml (release zips)
├── docker-compose.yml      local MongoDB for development
├── CONTRIBUTING.md
└── LICENSE
```

`frontend/extension` is a separate package with its own `package.json` and `node_modules`. The web app's Vite and lint configs deliberately ignore that folder.

## Configuration

Each service reads its own environment variables. Copy the `.env.example` next to it and fill in the values.

| Service | File | Key settings |
|---|---|---|
| Backend | `backend/.env` | `MONGODB_URI` (required), `JWT_SECRET` (required in production, at least 32 random characters), `CLIENT_URL` / `CORS_ORIGINS`, optional `JUDGE0_*` |
| Frontend | `frontend/.env` | `VITE_API_BASE_URL` (backend URL) |
| Agent | `agent/.env` | All optional: host, port, rate limit, fallback provider keys |
| Extension | none | Configured in its Settings page (usernames, agent URL, provider keys) |

Never commit `.env` files; only the `.env.example` files are tracked.

## Testing and CI

| Service | Command | Notes |
|---|---|---|
| Backend | `cd backend && python -m pytest -q` | In-memory MongoDB (mongomock) |
| Agent | `cd agent && python -m pytest -q` | All providers mocked, no keys needed (tested in its own repo, not this CI) |
| Frontend | `cd frontend && npm run lint && npm run build` | |
| Extension | `cd frontend/extension && npm run typecheck && npm test` | Vitest with a fake browser API |

[`ci.yml`](.github/workflows/ci.yml) runs the backend, frontend and extension checks on every push and pull request. [`extension-release.yml`](.github/workflows/extension-release.yml) builds the extension zips and publishes a GitHub Release when a tag like `ext-v0.1.0` is pushed.

## Deployment

| Service | Host | Settings |
|---|---|---|
| Frontend | Vercel | Root Directory `frontend`; set `VITE_API_BASE_URL` |
| Backend | Render | Root Directory `backend`; build `pip install -r requirements.txt`; start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; set `MONGODB_URI` and `JWT_SECRET` |
| Extension | GitHub Releases | Push a tag `ext-v<version>` matching `frontend/extension/package.json` |
| Agent | Your machine | Runs locally with `python app.py`. It has no authentication of its own, so don't expose it publicly. |

## Security and privacy

- **No credentials in code:** production refuses to start without `MONGODB_URI` and a strong `JWT_SECRET`.
- **Passwords and sessions:** passwords are hashed with bcrypt. JWTs carry a token version, so changing your password or choosing "sign out everywhere" ends all other sessions.
- **Rate limiting:** authentication and other sensitive endpoints are rate-limited.
- **Extension:** keeps all its data in the browser. Provider API keys are never exported or synced, and the AI review sends code only to your local agent.
- **Agent:** uses your key for one request at a time and never stores or logs it.

To report a security issue, please contact the maintainer privately rather than opening a public issue.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the checks to run before a pull request, and branch and commit conventions.

## License

[MIT](LICENSE) © Aman Kumar
