# DSA Learning Tracker 🚀

A modern full-stack web application designed for students and software engineers practicing Data Structures & Algorithms, preparing for coding interviews, and tracking their problem-solving journey.

Built with **React + TypeScript + Vite + Tailwind CSS** on the frontend, and **FastAPI + Python + SQLAlchemy + Alembic** on the backend.

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

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, `@monaco-editor/react`, `lucide-react`, `canvas-confetti`.
- **Backend**: FastAPI (Python 3), SQLAlchemy ORM, Alembic migrations, Pydantic v2, Python-Jose (JWT), BCrypt.
- **Database**: PostgreSQL (with SQLite zero-config fallback for testing).

---

## 🚀 Getting Started

### 1. Run the Backend

```bash
cd backend

# Create virtual environment (if not already created)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start FastAPI server
python run.py
```
- API Base: `http://localhost:8000/api`
- Interactive Swagger Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

### 2. Run the Frontend

```bash
cd frontend

# Install dependencies (if not already installed)
npm install

# Start Vite dev server
npm run dev
```
- Web Application: `http://localhost:5173/`

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dsa_tracker
SQLITE_FALLBACK=true
JWT_SECRET=your_jwt_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
PORT=8000
HOST=0.0.0.0
CLIENT_URL=http://localhost:5173
```

> **Note on Database:** If PostgreSQL is running locally, set `DATABASE_URL`. If PostgreSQL is not yet running, `SQLITE_FALLBACK=true` ensures the backend immediately starts and seeds without crashing.

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_TITLE=DSA Learning Tracker
```

---

## 🧪 Automated Tests

To run the backend test suite:

```bash
cd backend
source venv/bin/activate
PYTHONPATH=. pytest
```
Testing covers:
- Health check
- Recursive folder tree building and counts
- Circular folder move prevention (returns 400)
- Bookmark toggle
- Global search
- Progress aggregation
