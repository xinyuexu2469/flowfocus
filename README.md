# FlowFocus

An all-in-one time management and planning app: Kanban, Calendar, Daily/Monthly Gantt, plus Clerk auth, Google Calendar sync, and AI assistants.


## Demo

- Video demo: https://youtu.be/yHXxK1KXC94
	
- Live (frontend): https://flowfocus-frontend.onrender.com

- Live (backend API): https://flowfocus-izh9.onrender.com

## Features

- Kanban / Task list
- Calendar + time segments
- Daily Gantt / Monthly Gantt
- Clerk authentication
- Google Calendar OAuth + sync (read-only import)
- AI planning/chat/task breakdown (via OpenAI)

## PRD (Product Requirements)

### 1. Background & Problem

Many productivity tools split “task lists” and “calendar/time blocks”, which creates friction:

- Tasks stay as To‑dos without a concrete schedule
- Calendars record events but don’t close the loop with goals and tasks
- Planning takes time, gets disrupted by existing commitments, and lacks conflict handling/visualization

FlowFocus aims to unify “Goals → Tasks → Time blocks” in one place, so plans can actually be executed.

### 2. Goals & Success Metrics

**Product goals**

- Let users do planning and execution end-to-end: break down tasks, schedule, execute, review
- Reduce the cost of scheduling tasks (AI assistance + visual editing/dragging)

**Success metrics (measurable)**

- Task-created → scheduled-into-time-block conversion rate
- Daily completions and completion rate (per user)
- Adoption rate of AI Planning Assistant outputs (how much users keep)
- Calendar/Gantt load time (P95) and interaction jank rate

### 3. Target Users

- Students: exam-week study plans, assignments/deadlines
- Knowledge workers: multi-project context switching, meeting-heavy weeks, need protected focus blocks
- Freelancers: organize by project/stage, track weekly/monthly progress

### 4. Core User Journey (MVP)

1) Sign in and enter `Dashboard` (auth required)

2) Use tabs to manage work:

- Goals: create/maintain goal hierarchy
- Tasks: date-based task list (create/edit/complete)
- Kanban: column-based organization with drag-and-drop
- Calendar: calendar view for tasks and time segments
- Daily Gantt: day timeline scheduling (visual blocks + conflict cues)
- Monthly Gantt: project-level month planning/progress

3) Use AI Planning Assistant: describe in natural language → generate tasks + time blocks → user confirms → create in one click

4) (Optional) Google Calendar sync: authorize → backend pulls events → shown as read-only time segments in Calendar/Daily Gantt for availability and conflict reference

### 5. Functional Requirements (by module)

#### 5.1 Authentication (Clerk)

- Signed-in required to access: `/dashboard`, `/calendar-settings`, `/auth/google/callback`
- If signed out, redirect to Clerk sign-in
- Backend validates users via `Authorization: Bearer <token>`; local dev can use `ALLOW_DEV_NO_AUTH=1`

#### 5.2 Goals

- Support hierarchical goals (e.g., life/stage tiers)
- CRUD goals
- Link goals to tasks (long-term → short-term breakdown)

#### 5.3 Tasks

- Create/edit/delete/complete tasks
- Typical fields: title, description, priority, deadline, planned_date, estimated_minutes, tags, status
- Fetch tasks by date for daily planning and scheduling

#### 5.4 Kanban

- Column-based task view with drag-and-drop across columns
- Day/week time range support for planning
- Quick task editing entry (e.g., double click)

#### 5.5 Calendar

- Show tasks (as events) and time segments
- Create/edit time segments
- Create time segments from tasks (scheduling)

#### 5.6 Daily Gantt

- Timeline view of daily time segments
- Drag/resize blocks and bulk actions (via BulkActionToolbar)
- Conflict detection and warning (OverlapWarning)

#### 5.7 Monthly Gantt

- Project rows showing monthly planning/progress bars
- Project CRUD (ProjectForm, AddProjectButton, etc.)

#### 5.8 AI Assistant

**AI Planning Assistant**

- Accept natural-language input (tasks, deadlines, availability, fixed events, etc.)
- Backend `/api/ai/planning` returns: summary, notesForUser, tasks[] (with workTimeBlocks)
- Frontend previews the plan; user confirms and creates tasks/time blocks

**AI Chat / Task Breakdown**

- Backend endpoints under `/api/ai/*`
- If `OPENAI_API_KEY` is not configured, return a graceful fallback response (no frontend crash)

#### 5.9 Google Calendar Integration (read-only import)

- Frontend route: `/auth/google/callback` receives `code`
- Backend:
	- `GET /api/google-calendar/auth/url` generates the consent URL
	- `POST /api/google-calendar/auth/callback` exchanges `code` for tokens and stores them
	- `POST /api/google-calendar/sync` imports upcoming events into time segments (marked read-only)
- Business rule: imported Google time segments must not be editable in-app

### 6. Non-Functional Requirements

- Performance: avoid serial N+1 in Calendar/Daily Gantt fetching; parallelize requests where possible
- Time zones: avoid off-by-one-day issues when comparing/filtering by date
- Security:
	- Frontend env must not contain `DATABASE_URL`, `CLERK_SECRET_KEY`, `OPENAI_API_KEY`
	- Backend must validate Clerk tokens (do not enable `ALLOW_DEV_NO_AUTH` in production)
- Reliability: backend exposes `GET /api/health` for monitoring/troubleshooting

### 7. Out of Scope (for now)

- Advanced Google Calendar settings shown in `CalendarSettings` (sync frequency, conflict resolution, etc.) are UI placeholders (coming soon) and not part of MVP acceptance
- Google Calendar is currently a read-only import; no two-way write-back

### 8. Milestones (suggested)

- M1: Stable “tasks ↔ time blocks” loop (Tasks + Calendar + Daily Gantt)
- M2: Polish AI Planning Assistant end-to-end (generate → confirm → create)
- M3: Stable Google Calendar auth + read-only sync (errors, retry, status)
- M4: Strengthen linkage between Monthly Gantt (projects) and Goals

## Tech Stack

- Frontend: Vite + React + TypeScript + Tailwind
- Backend: Node.js + Express
- DB: Postgres (e.g. Neon)
- Auth: Clerk
- Calendar integration: Google Calendar API
- AI: OpenAI API

## Local Development

### 1) Install deps

```bash
cd /path/to/flowfocus
npm install

cd backend
npm install
```

### 2) Configure environment variables

#### Backend (`backend/.env`)

Create `backend/.env` (this file is gitignored):

```dotenv
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB?sslmode=require
PORT=4000

# Auth (Clerk)
CLERK_SECRET_KEY=sk_...

# CORS allowlist (frontend origin)
FRONTEND_URL=http://localhost:5173

# Google Calendar
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback

# AI
OPENAI_API_KEY=sk-proj-...

# Dev only (optional)
ALLOW_DEV_NO_AUTH=1
DEV_USER_ID=00000000-0000-0000-0000-000000000001
```

Notes:
- `ALLOW_DEV_NO_AUTH=1` is for local development only; do not enable it in production.
- Never put `CLERK_SECRET_KEY` / `OPENAI_API_KEY` / database credentials into frontend env vars.

#### Frontend (`.env.local`)

Create `.env.local` in repo root:

```dotenv
VITE_API_URL=http://localhost:4000/api
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

### 3) Initialize database

This repo includes `schema.sql` and backend migrations.

```bash
cd backend
npm run db:init
```

### 4) Run (frontend + backend)

```bash
cd /path/to/flowfocus
npm run dev:all
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Health check: http://localhost:4000/api/health

## Deployment (Render)

This repo is currently deployed as a split frontend/backend setup:

- Frontend (Static Site)
	- Env:
		- `VITE_API_URL=https://flowfocus-izh9.onrender.com/api`
		- `VITE_CLERK_PUBLISHABLE_KEY=pk_...`
	- SPA route fallback: `public/_redirects` contains `/* /index.html 200`

- Backend (Web Service)
	- Env:
		- `DATABASE_URL=...`
		- `CLERK_SECRET_KEY=sk_...`
		- `FRONTEND_URL=https://flowfocus-frontend.onrender.com`
		- `GOOGLE_CLIENT_ID=...`
		- `GOOGLE_CLIENT_SECRET=...`
		- `GOOGLE_REDIRECT_URI=https://flowfocus-frontend.onrender.com/auth/google/callback`
		- `OPENAI_API_KEY=sk-proj-...`

## Troubleshooting

- Frontend can't reach backend
	- Ensure the frontend has been rebuilt/redeployed and `VITE_API_URL` points to backend `/api`.
	- Ensure backend `FRONTEND_URL` matches the frontend origin (CORS allowlist).
- Google Calendar auth fails
	- Google Console OAuth Redirect URI must exactly match `GOOGLE_REDIRECT_URI`.
