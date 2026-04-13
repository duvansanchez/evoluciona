# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project overview
- Monorepo with:
  - Frontend: React 18 + Vite + TypeScript (`src/`)
  - Backend: FastAPI + SQLAlchemy + SQL Server (`backend/`)
- Frontend default dev URL: `http://localhost:8081`
- Backend API base used by frontend: `http://localhost:3001/api`
- Health check: `GET /health`

## Essential development commands

### Frontend (run from repository root)
- Install deps: `npm i`
- Dev server: `npm run dev -- --port 8081 --strictPort`
- Build: `npm run build`
- Build (dev mode): `npm run build:dev`
- Lint: `npm run lint`
- Run all frontend tests once: `npm run test`
- Watch frontend tests: `npm run test:watch`
- Run a single frontend test file: `npm run test -- src/test/example.test.ts`

### Backend (run from `backend/`)
- Create venv (Windows): `python -m venv venv` then `venv\Scripts\activate`
- Install deps: `pip install -r requirements.txt`
- Initialize/seed DB tables/data: `python -m app.seed`
- Run API (used by current frontend): `python main.py`
- Alternative uvicorn dev run: `python -m uvicorn main:app --reload --host 0.0.0.0 --port 3001`
- Run backend tests: `pytest test_api.py -v`
- Run a single backend test: `pytest test_api.py -k health_check -v`

## Environment and configuration
- Use two separate `.env` files:
  - `backend/.env` for FastAPI/backend settings (`DB_*`, `GMAIL_*`, `DEBUG`, TTS settings)
  - root `.env` for frontend Vite variables (`VITE_API_URL`, optional external integration URLs)
- `VITE_API_URL` should normally remain `http://localhost:3001/api` for local development.
- Backend currently assumes SQL Server (`mssql+pyodbc`) and defaults to Windows Authentication when user/password are empty.

## High-level architecture

### Frontend flow (`src/`)
- `main.tsx` bootstraps React and includes a `crypto.randomUUID` polyfill for non-secure HTTP contexts.
- `App.tsx` composes global providers and routing:
  - `QueryClientProvider` (TanStack Query)
  - Theme + tooltip + toast providers
  - `BrowserRouter` routes rendered inside `components/Layout.tsx`
- `services/api.ts` is the main client-side integration boundary:
  - Centralizes REST calls for goals, phrases, questions, reports, routines, reminders, stats, goal folders, and external integrations.
  - Pages generally consume this module directly rather than creating per-feature API clients.
- `pages/` are feature-oriented screens (`Goals`, `Questions`, `Phrases`, `Rutina`, `Progress`, etc.), each orchestrating calls to `services/api.ts`.

### Backend flow (`backend/`)
- `main.py` is the FastAPI entrypoint and startup orchestrator:
  - Imports routers via `app.api.api_router`
  - Runs `init_db()` and startup-time SQL migration guards (`IF NOT EXISTS` DDL blocks)
  - Configures permissive CORS for local development
  - Initializes APScheduler-based report jobs and reminder job synchronization
- `app/api/routes/` contains domain routers (`goals`, `phrases`, `questions`, `reports`, `rutinas`, `stats`, `reminders`, `goal_folders`, `subgoals`).
- `app/services/` contains business logic and cross-cutting workflows (CRUD services, reporting, scheduler state/history, email/TTS/reminders).
- `app/models/models.py` defines SQLAlchemy ORM models/tables for all domains (objectives, phrases, questions/sessions, routines, report artifacts).
- `app/db/database.py` provides lazy engine/session factory creation and `get_db` dependency injection for route handlers.

### Data/reporting/scheduling design
- Reporting is generated server-side from SQL queries in `stats_service.py`, aggregating answer/skip/feedback data by period.
- Scheduler config and history are file-backed JSON under `backend/data/` (`report_schedule.json`, `report_history.json`), while report content data itself comes from DB queries.
- Weekly report automation is initialized at API startup; reminder jobs are also synchronized at startup.

## Repository-specific working rules
- Do not perform `git commit` or `git push` unless explicitly requested.
- Project documentation files should go under `docs/proyect/` unless explicitly instructed otherwise.
- Prefer matching existing API/data conventions:
  - Dates as ISO (`YYYY-MM-DD`)
  - Frontend/backend contract centered on `/api/*` routes from this FastAPI service.
