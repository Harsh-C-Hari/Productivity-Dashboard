# Productivity Dashboard

A gaming-inspired, dark-themed Progressive Web App for tracking college and software
project work: tasks, deadlines, a weekly timetable, and automatic urgency scoring —
built to be installed on your phone or desktop and used every day.

![stack](https://img.shields.io/badge/React-Vite-8B5CF6) ![stack](https://img.shields.io/badge/FastAPI-SQLite-3B82F6)

---

## Features

- **Dashboard** — today's tasks, overdue tasks, upcoming deadlines, quick stats (with a
  completion-rate donut chart), and a recent-activity feed.
- **Quick Capture** — a floating `+` button, available on every page, for creating a task
  in seconds (title, description, deadline, estimated effort, category).
- **Task Manager** — full CRUD with category, deadline, estimated effort, status,
  progress, and an attachments field (placeholder for a future file-upload feature).
- **Smart Urgency** — every task is automatically tagged Critical / High / Medium / Low
  based on remaining time, estimated effort, and current progress (see
  [`backend/app/urgency.py`](backend/app/urgency.py)). Shown as a colored badge and as a
  HUD-style progress ring.
- **Weekly Timetable** — an editable, color-tagged weekly class/schedule grid.
- **Study Hub** — subjects, assignments, notes, resources, and study sessions, with
  its own analytics and in-page search.
- **Project Workspace** — projects broken into phases, features, todos, bugs, and
  milestones, with a drag-and-drop Kanban board and drag-to-reorder roadmap, a
  markdown documentation editor, resources, a timeline feed, and analytics.
- **AI Workspace** — track every AI assistant you work with (Claude, GPT, Gemini, ...),
  their conversations, a reusable prompt library, project zip snapshots handed off to/
  from an AI, structured session handoff notes, token usage logging with per-account
  totals and a personal refresh-reminder countdown, and durable knowledge articles.
- **Authentication** — email/password accounts with bcrypt-hashed passwords, short-lived
  JWT access tokens paired with rotating opaque refresh tokens, per-device session
  management (view/revoke active sessions, "log out everywhere"), and password-strength
  validation. See [`backend/app/security.py`](backend/app/security.py).
- **Project Collaboration** — invite teammates onto a project by email, assign them a
  role (Owner / Admin / Member / Viewer, or a custom role built from granular
  permissions), manage pending invitations, and transfer project ownership — all from
  the project's **Team** tab. Every membership/role change is enforced server-side by
  RBAC middleware, never just hidden in the UI.
- **Global Search** — `Ctrl/Cmd+K` command palette that searches across Tasks, Study
  Hub, Project Workspace, and AI Workspace in one place.
- **Browser Notifications** — opt-in alerts when a task enters its final hour before
  deadline, when it becomes overdue, and for your own AI Workspace token-refresh
  reminders.
- **Installable PWA** — add it to your home screen on mobile or desktop; works offline
  for the app shell.
- **Gaming-inspired dark UI** — purple + blue + cyan accents, glassmorphism panels,
  smooth Framer Motion animations.

---

## Tech Stack

| Layer      | Tech |
|------------|------|
| Frontend   | React, Vite, TypeScript, Tailwind CSS, shadcn/ui-style components, Framer Motion, React Router |
| Backend    | FastAPI (Python) |
| Database   | SQLite (via SQLAlchemy) |
| State      | React Query (server state) + Context API (notifications) |
| Icons      | Lucide React |
| Charts     | Recharts |
| Notifications | Browser Notification API |

---

## Project Structure

```
productivity-dashboard/
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app, CORS, startup seeding
│   │   ├── database.py         # SQLAlchemy engine/session (SQLite)
│   │   ├── models.py           # ORM models (Task, Project, Session, ProjectMember, ...)
│   │   ├── schemas.py          # Pydantic request/response models
│   │   ├── security.py         # Password hashing, JWT + refresh-token issuance
│   │   ├── auth_dependencies.py# get_current_user + RBAC (require_project_access)
│   │   ├── urgency.py          # Smart Urgency scoring engine
│   │   ├── activity_log.py     # Shared activity-feed/timeline logging helper
│   │   ├── project_helpers.py  # Shared Project Workspace lookups
│   │   └── routers/            # One router per resource (auth, tasks, timetable,
│   │                           # study_hub, projects + phases/features/todos/bugs/
│   │                           # milestones, project_members, project_invitations,
│   │                           # roles, permissions, ai_* (AI Workspace), search,
│   │                           # dashboard, analytics, notifications, ...)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ui/                # shadcn-style primitives (Button, Card, Dialog, ...)
    │   │   ├── layout/            # Sidebar, MobileNav, TopBar, AppLayout, GlobalSearch
    │   │   ├── auth/               # Login/Register forms, protected-route guard
    │   │   ├── dashboard/          # QuickStats, TodayTasks, OverdueTasks, ...
    │   │   ├── tasks/               # TaskCard, TaskForm, TaskList, QuickCapture, UrgencyRing
    │   │   ├── timetable/            # WeeklyTimetable, TimetableCard, TimetableSlotForm
    │   │   ├── study-hub/             # Subjects, Assignments, Notes, Resources, Sessions
    │   │   ├── project-workspace/      # Phases, Features, Todos, Bugs, Milestones, Roadmap
    │   │   ├── ai-workspace/            # AI Accounts, Conversations, Prompts, Handoffs
    │   │   └── collaboration/            # Members, Invitations, Roles, Permissions, Settings
    │   ├── pages/                          # Dashboard, Tasks, Timetable, StudyHub,
    │   │                                   # ProjectDetail, AIWorkspace, Profile, auth/
    │   ├── hooks/                           # React Query hooks (one per resource)
    │   ├── context/                          # NotificationContext (permissions + in-app toasts)
    │   ├── lib/                                # api client, auth client, date/urgency helpers
    │   └── types/                                # shared TypeScript types
    └── public/                                    # PWA icons
```

---

## Running it locally

You need **Python 3.10+** and **Node 18+** installed. Two terminals, one for each service.

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API is now live at `http://127.0.0.1:8000` (interactive docs at `/docs`). On first
run it automatically creates `backend/dashboard.db` (SQLite) and seeds it with a handful
of realistic sample tasks and a sample timetable, so the app isn't empty on first load.

Optional environment variables (all have safe local-dev defaults):

| Variable | Default | Purpose |
|---|---|---|
| `AUTH_SECRET_KEY` | a fixed, obviously-fake dev string | JWT signing key. **Must** be set to a long random value in any real deployment. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh token / session lifetime. |

### 2. Frontend (Vite + React)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. In dev mode, Vite proxies any `/api/*` request to
`http://127.0.0.1:8000` (see `vite.config.ts`), so no extra configuration is needed.

You'll land on the **Register** screen first — create an account (email + password, 8+
characters with at least one letter and one number). Sample tasks, timetable entries,
and study-hub data are seeded into the database on first boot so the app isn't empty
once you're signed in.

---

## Building for production

```bash
cd frontend
npm run build      # outputs to frontend/dist
npm run preview    # optional: serve the production build locally
```

Serve `frontend/dist` with any static file host (or behind the same reverse proxy as the
FastAPI app). If the frontend and backend are on different origins in production, set
`VITE_API_BASE_URL` in `frontend/.env` (see `.env.example`) to the backend's full URL
before building.

For the backend in production, run behind a process manager, e.g.:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## Installing as a PWA

Once the frontend is running (dev or a served production build):

- **Desktop Chrome/Edge**: click the install icon in the address bar, or the menu →
  "Install Productivity Dashboard".
- **Android Chrome**: menu → "Add to Home screen".
- **iOS Safari**: Share button → "Add to Home Screen".

Push-style notifications require you to click **Enable alerts** (top bar) or the
**Notifications** card in Settings, and to grant the browser permission prompt.

---

## How Smart Urgency works

Each task's urgency tier is computed fresh on every read (not stored), from three
signals:

1. **Remaining time** until the deadline.
2. **Outstanding effort** — estimated effort hours × (1 − progress).
3. **Time pressure** — outstanding effort ÷ remaining time. A ratio ≥ 1 means there
   isn't enough runway left at a normal pace.

Those combine into four tiers (Critical / High / Medium / Low), with tasks overdue or
due within a day always landing on Critical. The full logic (with comments) is in
[`backend/app/urgency.py`](backend/app/urgency.py); the frontend mirrors it in
[`frontend/src/lib/urgency.ts`](frontend/src/lib/urgency.ts) so form previews (like
Quick Capture) can show the badge before saving.

---

## Notes & known limitations (Version 1.0 scope)

- Accounts and JWT-based authentication are built in (see `backend/app/security.py`),
  and Project Workspace supports multi-user collaboration (roles, permissions,
  invitations) — but the app is still local-first, single-deployment, and has no
  invitation-email sending (invite links must be shared manually).
- Attachments are a placeholder field (comma-separated filenames) — no file upload yet
  outside of Project Workspace documents/resources and AI Workspace project zips.
- Notifications are checked while the tab is open, not via a push service, so the app
  needs to be open (it can be in a background tab) for alerts to fire.
- SQLite is file-based; back up `backend/dashboard.db` if you want to preserve data
  across machines.
- No automated test suite (frontend or backend) yet — see `AI_HANDOFF.md` for details.
