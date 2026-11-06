# Contributing

## Layout

| Folder | What it is | Stack |
|---|---|---|
| `backend/` | REST API | FastAPI, MongoDB |
| `frontend/` | Web app | React, Vite, Tailwind |
| `frontend/extension/` | Coding Journey browser extension (separate npm package) | WXT, React, Tailwind |

Each folder is its own package with its own dependencies and README.

## Local setup

```bash
docker compose up -d                 # local MongoDB on :27017 (optional)

cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                 # MONGODB_URI=mongodb://localhost:27017 for the local DB
python run.py

cd ../frontend && npm install && npm run dev
cd extension && npm install && npm run dev   # from frontend/
```

Never point a development `.env` at the production database.

## Before opening a pull request

```bash
cd backend   && python -m pytest -q
cd frontend  && npm run lint && npm run build
cd frontend/extension && npm run typecheck && npm test
```

CI (`.github/workflows/ci.yml`) runs the same checks on every push.

## Branches and commits

- Branch off `main` (`feat/...`, `fix/...`); don't commit to `main` directly.
- Use short conventional messages: `feat(extension): ...`, `fix(backend): ...`, `docs: ...`.
