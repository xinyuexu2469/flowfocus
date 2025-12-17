# FlowFocus Copilot Implementation Spec

This spec guides Copilot contributions to the FlowFocus project. Keep changes aligned with current code (React/Vite frontend, Express backend, Postgres, Clerk auth, Google Calendar import, AI via OpenAI).

## Objectives
- Maintain and extend a unified time/planning tool (Goals → Tasks → Time Blocks) with Kanban, Calendar, Daily/Monthly Gantt, AI assistants, and Google Calendar read-only import.
- Ensure auth-protected experiences and correct API/base URLs across environments.
- Preserve performance (no N+1, avoid blocking UI) and time-zone correctness.

## In Scope
- Frontend (Vite/React/TS) features under `src/` (Dashboard tabs, AI assistants, Calendar/Gantt/Kanban, Goals/Tasks views).
- Backend (Express) APIs under `backend/` (`/api/tasks`, `/api/time-segments`, `/api/projects`, `/api/goals`, `/api/ai/*`, `/api/google-calendar/*`, `/api/health`).
- Data persistence in Postgres (see `schema.sql` + migrations `backend/migrations/`).
- Auth via Clerk (frontend `ClerkProvider`, backend token validation) with optional dev bypass (`ALLOW_DEV_NO_AUTH=1`).
- Google Calendar OAuth and read-only event import.
- AI endpoints using OpenAI (graceful fallback if key missing).

## Out of Scope (current phase)
- Two-way Google Calendar write-back.
- Advanced CalendarSettings behaviors (sync frequency/conflict strategy) beyond current placeholders.
- Theming/notifications/data-export features that are marked “coming soon”.

## Functional Requirements (ground truth)
- Auth: `/dashboard`, `/calendar-settings`, `/auth/google/callback` are gated; signed-out users redirect to Clerk sign-in.
- Tasks: CRUD, date-filtered queries, status/priority/estimated minutes, etc.
- Goals: hierarchical support, CRUD, linkage to tasks.
- Kanban: column view with drag/drop, day/week ranges, quick edit.
- Calendar: show tasks + time segments; create/edit time segments; create from tasks.
- Daily Gantt: timeline, drag/resize, bulk actions, conflict warnings.
- Monthly Gantt: project rows, CRUD, progress display.
- AI Planning Assistant: natural language in → `/api/ai/planning` → summary/notes/tasks with workTimeBlocks → user confirms to create tasks/time blocks.
- AI Chat/Breakdown: `/api/ai/*`; must fail gracefully when `OPENAI_API_KEY` absent.
- Google Calendar: frontend route `/auth/google/callback`; backend endpoints `GET /api/google-calendar/auth/url`, `POST /api/google-calendar/auth/callback`, `POST /api/google-calendar/sync`; imported segments are read-only.
- Health: `GET /api/health` for monitoring.

## Non-Functional Requirements
- Performance: avoid N+1 and excessive sequential fetches; parallelize calendar/gantt data loads; keep bundle reasonable (code-split when needed).
- Time zone correctness: avoid date slicing that causes cross-day drift; use UTC-safe comparisons when filtering by date.
- Security: never expose secrets (DB URL, Clerk secret, OpenAI key) to frontend; validate Clerk tokens in prod; keep CORS allowlist aligned with frontend origin.
- Reliability: handle API errors with user-friendly toasts; keep read-only constraints for imported Google events.

## Data / Migrations
- Base schema in `schema.sql` (users, profiles, tasks, projects, goals, time_segments, etc.).
- Migrations: `backend/migrations/add_google_calendar.sql`, `backend/migrations/add_prd_fields.sql`.
- Migration runner: `cd backend && npm run db:init` (creates extension, applies schema + PRD fields + Google Calendar table if missing).

## Environment Variables
- Backend (`backend/.env`): `DATABASE_URL`, `PORT=4000`, `CLERK_SECRET_KEY`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `OPENAI_API_KEY`, optional `ALLOW_DEV_NO_AUTH=1`, `DEV_USER_ID`.
- Frontend (`.env.local`): `VITE_API_URL` (e.g., http://localhost:4000/api or https://flowfocus-izh9.onrender.com/api), `VITE_CLERK_PUBLISHABLE_KEY`.
- Do NOT place database/secret keys in frontend envs.

## Deployment (current)
- Split deploy on Render:
  - Frontend Static Site: needs `VITE_API_URL=https://flowfocus-izh9.onrender.com/api`, `VITE_CLERK_PUBLISHABLE_KEY=...`, SPA fallback via `public/_redirects` (`/* /index.html 200`).
  - Backend Web Service: env as above, `FRONTEND_URL=https://flowfocus-frontend.onrender.com`. Health at `/api/health`.
- One-link integrated deploy is not active (SERVE_FRONTEND removed); keep split assumption unless explicitly changed.

## Acceptance Criteria (for changes)
- Auth flows remain intact: signed-out users cannot access protected routes; signed-in users can reach Dashboard and Calendar Settings.
- API calls hit the configured `VITE_API_URL` and succeed against `/api` endpoints; no localhost leakage in production builds.
- Google Calendar import remains read-only; no edits to imported segments.
- AI flows degrade gracefully without `OPENAI_API_KEY` (return friendly guidance, no crashes).
- No secrets in frontend bundles or committed files; `.env` stays gitignored.
- Tests/build: `npm run build` (frontend) and `npm run db:init` (migrations) succeed locally.

## Open Questions / Follow-ups
- If moving to single-domain deploy, define build/start commands and env (SERVE_FRONTEND) before enabling.
- Clarify desired behavior for Google Calendar conflict strategy and sync frequency when implementing beyond placeholders.
- Define UX for notifications/theme/export once prioritized.

## How to use this spec
- Keep PRs aligned with scope and acceptance criteria.
- When adding features, update this spec section (scope/requirements/env) to reflect the new ground truth.
- When touching Google/AI/auth flows, double-check env var names and CORS origins.
