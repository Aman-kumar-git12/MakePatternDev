# DSA Learning Tracker 🚀

A modern full-stack web application designed for students and software engineers practicing Data Structures & Algorithms, preparing for coding interviews, and tracking their problem-solving journey.

Built with **React + TypeScript + Vite + Tailwind CSS** on the frontend, and **FastAPI + MongoDB** on the backend.

Inspired by the dark-themed structured course tracker layout with recursive folders, Monaco code editor, solution tabs, bookmarking, and progress calculations.

---

## 📸 Key Features

1. **Unlimited Recursive Folder & File Hierarchy**:
   - Create, rename, move, and delete folders with no artificial nesting limit.
   - Prevent circular hierarchies (e.g. moving a folder into one of its descendants is blocked).
   - Dynamic folder completion counts (`12/28`) and live progress bars calculated recursively from descendant questions.
   - Full context menus on folders and question files.

2. **Dashboard Matching Reference Design**:
   - Starry night hero banner with mountain summit illustration and glowing achievement flag.
   - 5 KPI metric cards: **Solved**, **In Progress**, **Needs Revision**, **Total Questions**, and **Overall Progress** with circular percentage ring and progress bar.
   - **Continue Learning**: Direct access to in-progress problems with folder breadcrumb and difficulty pill.
   - **Your Folders**: Top folder overview with question completion ratio.
   - **Quick Actions**: One-click New Folder and New Question modals.
   - **Recent Activity**: Chronological list of recently opened/edited problems.

3. **Question Workspace**:
   - Breadcrumb navigation (`DSA / Arrays / Fundamentals / Two Sum`).
   - Title inline editor, difficulty selector (Easy, Medium, Hard), status switcher with celebration confetti on **Solved**!
   - One-click bookmark toggle and tags pill list.
   - Debounced autosave with live indicator (`All changes saved`, `Saving...`, `Unsaved edits`).
   - 4 Dedicated Tabs:
     - **Notes**: Rich problem statement, Intuition, Approach, Numbered step-by-step algorithm, Dry run, Edge cases, personal notes with Edit/Preview markdown toggle.
     - **Code**: **Monaco Editor** integration with dark theme (`vs-dark`), C++, Python, and Java syntax highlighting, multiple named solutions (`Optimal Approach`, `Brute Force`, etc.), solution tabs, copy code button, time & space complexity inputs.
     - **Examples**: Test cases, sample inputs, sample outputs, constraints.
     - **Complexity**: Visual side-by-side comparison matrix of all solutions.

4. **Bookmarks System**:
   - Dedicated Bookmarks view in the sidebar.
   - Filters for topic, difficulty, and completion status.
   - Bookmark toggle from anywhere without duplicating question data.

5. **Search & Navigation**:
   - `Ctrl/Cmd + K` instant global search modal across titles, problem statements, notes, tags, and folders.
   - Direct click-to-open navigation.

---

## ✨ What's new in 2.0

- **Spaced-repetition reviews** — solving a problem schedules reviews (1 → 3 → 7 → 14 → 30 → 60 → 120 days). Rate each review Again / Hard / Good / Easy from the "Due today" queue.
- **Streaks & activity heatmap** — every solve, review and attempt is logged; streaks respect your local timezone.
- **Real LeetCode integration** (public GraphQL): search & import problems with real title, difficulty, tags, statement and example test cases; daily challenge; refresh a problem's statement; sync your recent accepted submissions by LeetCode username.
- **Starter curricula** — "Core Interview Patterns" (118 problems) and "Beginner Foundations" (34), verified against LeetCode.
- **Attempts & time tracking** per problem, with a stopwatch.
- **Run your code against test cases** — Python (Pyodide) and JavaScript run in the browser with no setup; C++/Java run via Judge0 when the backend has a key.
- **Copy a shared pattern** into your own workspace.
- **Account settings** — change password (signs out other sessions), sign out everywhere, export all data as JSON, delete account.
- Any email works for sign-up/login — emails are never verified, by design.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Monaco editor, DOMPurify.
- **Backend**: FastAPI, Pydantic v2, PyJWT, bcrypt, httpx.
- **Database**: MongoDB (single source of truth — Atlas in production).

## 🚀 Getting Started

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # set MONGODB_URI (and JWT_SECRET for production)
python run.py          # http://localhost:8000/api, docs at /docs in development
```

### Tests

```bash
cd backend && python -m pytest -q
```

Tests run on an in-memory MongoDB (mongomock) and never touch a real database. CI runs them on every push (`.github/workflows/backend.yml`).

### Frontend

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Set `VITE_API_BASE_URL` to point at a non-default backend.

## 🔐 Production configuration

| Variable | Notes |
|---|---|
| `MONGODB_URI` | **Required.** No credentials are stored in code. |
| `JWT_SECRET` | **Required**, ≥ 32 random chars. Startup aborts otherwise. |
| `ENVIRONMENT` | Auto-detected as `production` on Render/Vercel/Fly/Railway. |
| `JUDGE0_URL`, `JUDGE0_API_KEY`, `JUDGE0_API_HOST` | Optional. Enables C++/Java execution (RapidAPI or self-hosted Judge0). |
| `CLIENT_URL`, `CORS_ORIGINS` | Allowed frontend origins (plus `make-pattern*.vercel.app` previews). |

## 📦 Repository layout & deployment

This is a monorepo: `backend/` (FastAPI) and `frontend/` (Vite). CI (`.github/workflows/ci.yml`) runs backend tests and frontend lint + build on every push.

- **Vercel** (frontend): Project → Settings → Root Directory = `frontend`.
- **Render** (backend): Root Directory = `backend`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
