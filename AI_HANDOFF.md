# AI_HANDOFF.md

# AI Development Handoff

Project: Personal Productivity System

Current Version: 1.0.0 (Invitation System + Notification Center)

Status: Feature-complete per task brief (Parts 1-8) pending a live
build/boot verification -- this sandbox had no network access for
`npm install`/`pip install` across both sessions that built this
feature, so only static verification (syntax checks, `py_compile`,
import-resolution) has been done. See "Session 11" at the bottom and
"Next Task" below for the exact verification steps still owed before
tagging a real release.

Last Updated:
2026-08-01 (Conversation 8, continuation -- Invitation System
Completion & Notification Center, Parts 5-8: mobile optimization
pass, UX polish, placeholder sweep, doc sync. See CHANGELOG.md
"[1.0.0] - Invitation System Completion & Notification Center" and
this file's "Session 11" section at the bottom.)

---

# Authorization Merge Progress

This section is the source of truth for the 5-phase merge bringing the
Authorization & Multi-user Data Isolation implementation (from the
older `authorisation-fixed` branch) into `main`, without losing any of
main's newer features (profile image picker, AI Workspace
improvements, notification improvements, ZIP manager fixes, mobile UI
polish). Whoever picks up the next phase in a new conversation should
be able to read this and know exactly what's already done.

- **Phase 1: COMPLETE** — Foundation: added
  `backend/app/ownership_helpers.py` (new, verbatim from the auth
  branch); applied the auth branch's `database.py` (adds
  `run_startup_migrations()`) and `main.py` (calls it on startup) in
  full; added `user_id` ownership columns to `models.py` for Task,
  TimetableSlot, Subject, StudySession, the AI Workspace/Conversation
  family, and KnowledgeArticle; kept main's wider `avatar_url` in both
  `models.py` and `schemas.py` rather than the auth branch's narrower
  version. See `CHANGELOG.md` → "Merge Phase 1/5 — Foundation" for
  full detail.
- **Phase 2: COMPLETE** — 24 backend router/helper files (pure
  auth/ownership-filtering changes, no competing feature work) ported
  verbatim from the `authorisation-fixed` branch. See `CHANGELOG.md` →
  "Merge Phase 2/5 — Bulk Authorization Routers" for the full file
  list.
- **Phase 3: COMPLETE** — verified `bugs.py`, `project_zips.py`,
  `notification_helpers.py`, and `project_invitations.py` were already
  in their correct final state; no code changes required. See
  `CHANGELOG.md` → "Merge Phase 3/5 — Authorization Verification
  (Bugs, ZIPs, Invitations)" for the verification detail.
- **Phase 4: COMPLETE** — added `frontend/src/lib/queryClient.ts`
  (new, verbatim from the auth branch); applied the auth branch's
  `App.tsx` (imports `queryClient` instead of constructing it inline)
  and `AuthContext.tsx` (`clearSession` now calls `queryClient.clear()`
  so no user's cached data survives into the next login on a shared
  device); `Profile.tsx` investigated and confirmed to need no
  changes — the auth branch's version differs only in its older
  avatar-input UI, with no authorization-specific content. See
  `CHANGELOG.md` → "Merge Phase 4/5 — Frontend Session Isolation" for
  full detail.
- **Phase 5: COMPLETE** — full verification pass against the true
  original `main.zip` (not just prior phases' intermediate zips). Found
  and fixed one genuine issue: the root-level `.gitignore` from
  original `main` had gone missing somewhere in Phases 1-4 (restored
  verbatim, confirmed byte-identical). Every authorization/ownership
  helper call site, every `.query(` call site, every personal-data and
  project-scoped endpoint, and every feature named in the task brief
  (avatar upload chain, Notification Center, invitation resend, AI
  Workspace, ZIP Manager, Dashboard widgets, mobile UI) was checked and
  confirmed correct. Backend `py_compile`s clean; frontend `tsc
  --noEmit` passes with zero errors. See `CHANGELOG.md` → "Merge Phase
  5/5 — Final Verification" for the full sweep detail.

### Merge complete — closing summary

The 5-phase merge bringing the Authorization & Multi-user Data
Isolation implementation into `main` is done. **31 files** differ from
the original pre-merge `main` (4 foundation, 24 bulk auth routers, 3
frontend session-isolation files, plus the new `ownership_helpers.py`
and `queryClient.ts` counted within those totals), and every other file
in the project was verified byte-identical to original `main` -- one
accidentally-dropped `.gitignore` was the only casualty found across
all 5 phases, and it's been restored. Nothing from main's newer feature
work (profile image picker, AI Workspace improvements, notification
improvements, ZIP manager fixes, mobile UI polish) was lost in the
process.

Authorization now covers the app in two layers. **Project Content**
(Projects and everything hanging off a `project_id` — Phases, Features,
Todos, Bugs, Milestones, Documents, Project Resources, Timeline,
Conversations/Zips/Handoffs/Knowledge-Articles when project-attached)
is gated by `require_project_access`/`get_accessible_project_ids`,
which check actual project membership and role permissions rather than
trusting a caller-supplied id. **Personal data** (Tasks, Timetable,
Subjects and everything under Study Hub, AI Accounts and everything
that hangs off one, Prompt Templates, standalone Knowledge Articles) is
gated by a `user_id` column added to each top-level table (with
inherited-ownership children resolving their parent first), enforced
either via the shared `owned_query`/`get_owned_or_404` helpers or an
equivalent local join-filter, and always 404s rather than 403s on a
mismatch so a resource's existence is never leaked to someone who
doesn't own it. Endpoints that previously had no auth dependency at all
(e.g. `token_trackers.py`, `user_preferences.py`,
`notification_preferences.py`) now require `get_current_user` and
enforce these rules like everything else.

---

# Current Development Focus

The current feature being developed is:

> Invitation System Completion & Notification Center (Conversation 8)

Goal:

Finish the Invitation System without SMTP (in-app notifications,
/invite/{token} landing page, owner Resend action), add a
Notification Center as a new top-level module wired to invitations,
and add a Dashboard widget, then a mobile optimization pass, UX
polish, and a placeholder sweep. All 8 parts of the task brief are
now done -- see this file's "Session 11" section at the bottom for
the full breakdown, and "Next Task" for the live-verification steps
that are the only thing standing between this and a real release.

---

# Overall Project Status

## Completed

- Dashboard
- Task Manager
- Smart Urgency Engine
- Notifications
- Weekly Timetable
- Progressive Web App
- Study Hub
- File Uploads
- Analytics
- Search
- Dashboard Integration
- Project Workspace (backend + frontend)
- AI Workspace (backend: models + schemas + routers + analytics + search)
- Collaboration Backend (Project Members, Project Invitations, Roles,
  Permissions, User Preferences, Notification Preferences, Activity
  Log APIs, RBAC helpers)
- Identity & Security Backend (registration, login/logout, JWT +
  refresh rotation, sessions, password/email flows, authorization
  middleware)
- Backend Stabilization & Security Audit (session 7: found and
  closed the gap where that authorization middleware was never wired
  into the Project Workspace / AI Workspace content routers it was
  meant to protect -- see CHANGELOG.md)
- Identity & Security: Frontend Identity Layer (session 8, this
  session -- auth context, login/register/password-reset/email-
  verification pages, protected routes, profile + session management,
  wired end-to-end against the session 3/7 backend; see CHANGELOG.md
  and this file's "Session 8" section)
- Identity Integration Fix Pass (session 9 -- fixed
  `schemas.UserOut` missing `email_verified`, so `/me`/`/status`/every
  Identity endpoint now returns it; updated `VerifyEmail.tsx` and
  `Profile.tsx` to show a real verified/unverified state; audited the
  full Identity frontend/backend contract for drift, no further
  issues found; see CHANGELOG.md and this file's "Session 9" section)
- Release Audit & Polish (session 10 / Conversation 7 -- full static
  engineering audit, genuine issues fixed, docs synchronized, packaged
  as v1.0.0-rc1)
- Invitation System completion without SMTP -- in-app notifications on
  create/accept/reject/cancel, `/invite/{token}` landing page, real
  owner Resend action, inline "copy link" on send (session 11 /
  Conversation 8)
- Notification Center core (backend model/router + frontend page,
  sidebar/mobile-nav/topbar badges w/ live counts, Dashboard widget --
  session 11 / Conversation 8)
- Mobile optimization pass + UX polish + placeholder sweep for the
  above (session 11 / Conversation 8, continuation) -- see "Session 11"
  section at the bottom for the itemized list of genuine issues found
  and fixed

## In Progress

None -- Conversation 8's task brief (Parts 1-8) is done. Live
build/boot verification is still owed (see "Next Task" below) before
this is a real release rather than a statically-verified one.

## Planned

Git Sync Engine

AI Workspace: dashboard integration

Collaboration: dashboard integration

Calendar

Backup Manager

---

# Current Architecture

Frontend

React

TypeScript

Vite

Tailwind

React Query

Framer Motion

Backend

FastAPI

SQLAlchemy

SQLite

Pydantic

Offline First

SQLite is the runtime database.

GitHub synchronization will be implemented later.

---

# Current Branch

main

(or update accordingly)

---

# Current Module

Collaboration Backend

Status

Database foundation (previous session: models + schemas for User,
Permission, Role, ProjectMember, ProjectInvitation, Session,
UserPreference, NotificationPreference, extended Project/ActivityLog)
now has a full backend API layer (this session): CRUD routers for
Project Members, Project Invitations, Roles, Permissions, Users, User
Preferences, Notification Preferences, and a filterable/paginated
Activity Log API, plus reusable RBAC helpers in `project_helpers.py`
(`is_owner`, `has_role`, `get_effective_permission_keys`,
`has_permission`, `can_invite`, `can_manage_members`,
`can_manage_project`, etc.) ready for the next session's authorization
middleware. No authentication/JWT/login, no frontend -- out of scope
per this session's task brief. See Session Summary below for what was
built and verified.

AI Workspace and Project Workspace (previous modules) remain fully
complete and were not touched this session.

---

# Current Objective

Build the backend collaboration layer containing

Project Members (list/get/add/update role/update status/remove,
transfer ownership, leave project)

Project Invitations (create/list/accept/reject/cancel/expire)

Roles (list/create/update/delete, assign/remove permissions)

Permissions (list/get/lookup-by-key/validate)

User Preferences (theme/language/timezone/dashboard layout/sidebar
state/default project/AI preferences)

Notification Preferences (email/browser/task/project/AI/reminders)

Activity Log (recent project/user activity, filter/paginate/sort/search)

Reusable Project helper/service functions for the next session's
authorization middleware (Authentication, JWT, login, current-user
APIs, permission enforcement -- not started this session)

---

# Existing Modules

Dashboard

Task Manager

Study Hub

Timetable

Notifications

Upload System

Search

Analytics

Project Workspace (backend + frontend, complete end-to-end)

AI Workspace (backend complete: models + schemas + routers + analytics
+ search; no frontend yet)

Collaboration Backend (backend complete: models + schemas + routers +
RBAC helpers; no auth/frontend yet)

These modules are complete and should only be extended.

Do NOT rewrite them.

---

# Existing Shared Systems

Already implemented

Smart Urgency Engine

File Upload Helper

Activity Logging

Dashboard Widgets

Notification Context

React Query Pattern

Glassmorphism Design

Reuse these systems.

Never duplicate functionality.

---

# Files Frequently Modified

Backend

backend/main.py

backend/models.py

backend/schemas.py

backend/database.py

backend/routers/

Frontend

frontend/src/hooks/

frontend/src/pages/

frontend/src/components/

frontend/src/services/

frontend/src/types/

frontend/src/utils/

Documentation

README.md

PROJECT_CONTEXT.md

ARCHITECTURE.md

DATABASE_SCHEMA.md

CHANGELOG.md

AI_HANDOFF.md

---

# Current Database

Current tables

Tasks

Subjects

Topics

Assignments

Notes

Resources

StudySessions

Timetable

ActivityLog

Projects (models + schemas + router, complete)

ProjectPhases (models + schemas + router, complete)

Features (models + schemas + router, complete)

ProjectTodos (models + schemas + router, complete)

Bugs (models + schemas + router, complete)

Milestones (models + schemas + router, complete)

ProjectResources (models + schemas + router, complete)

ProjectDocuments (models + schemas + router, complete)

TimelineEvents (models + schemas + router, complete)

AIAccounts (models + schemas + router, complete)

Conversations (models + schemas + router, complete)

PromptTemplates (models + schemas + router, complete)

ProjectZips (models + schemas + router, complete)

AIHandoffs (models + schemas + router, complete)

TokenTrackers (models + schemas + router, complete)

KnowledgeArticles (models + schemas + router, complete)

Users (models + schemas + router, complete -- no auth/login, identity
CRUD only)

Permissions (models + schemas + router, complete -- seeded catalog)

Roles (models + schemas + router, complete -- 4 seeded system roles)

ProjectMembers (models + schemas + router, complete)

ProjectInvitations (models + schemas + router, complete)

Sessions (models + schemas, no router yet -- belongs to the
authentication session)

UserPreferences (models + schemas + router, complete)

NotificationPreferences (models + schemas + router, complete)

ActivityLog (extended with user_id/project_id/action/entity_type/
entity_id; read API complete via routers/activity.py)

Future

SyncMetadata

---

# Development Rules

Always

Read

PROJECT_CONTEXT.md

ARCHITECTURE.md

DATABASE_SCHEMA.md

AI_HANDOFF.md

before changing code.

Never rewrite existing architecture.

Always extend.

Maintain compatibility.

---

# Coding Standards

Use existing code style.

Use existing hooks.

Reuse components.

Keep pages thin.

Business logic belongs in hooks/backend.

Avoid duplicate code.

---

# Dashboard Rules

Every module must expose dashboard widgets.

Never build isolated modules.

Dashboard is always the application's home.

---

# Upload Rules

Reuse existing upload helpers.

Never create another upload implementation.

---

# Smart Urgency

Already exists.

Reuse.

Never duplicate.

Future modules should consume the existing urgency engine.

---

# Search

Current

Study Hub Search

Future

Global Search

Every future module should expose searchable entities.

---

# Git Sync

Not implemented.

Planned architecture

SQLite

↓

Export

↓

Structured JSON/Markdown

↓

Git

↓

Private GitHub Repository

↓

Pull

↓

Import

↓

SQLite

GitHub is synchronization.

SQLite remains the database.

---

# Current TODO

Backend

✅ Create Project models (Project, ProjectPhase, Feature, ProjectTodo,
Bug, Milestone, ProjectResource, ProjectDocument, TimelineEvent)

✅ Create schemas (Create/Update/Out/Summary for all 9 models)

✅ Relationships (SQLAlchemy relationship() + cascade, indexes)

✅ CRUD routers (projects, phases, features, todos, bugs, milestones,
documents, project_resources, timeline, analytics)

✅ Dashboard integration

Frontend

✅ Project page (`Projects.tsx`)

✅ Project cards

✅ Roadmap

✅ Todo list (built as a filterable list, not a drag-and-drop Kanban
board -- see Architectural Decisions)

✅ Milestones

✅ Documentation

✅ Bug Tracker

✅ Analytics

✅ Dashboard widgets

✅ Testing (`tsc -b` clean, `vite build` succeeds)

✅ Production build

---

# Current TODO (AI Workspace)

Backend

✅ Create AI Workspace models (AIAccount, Conversation, PromptTemplate,
ProjectZip, AIHandoff, TokenTracker, KnowledgeArticle)

✅ Create schemas (Create/Update/Out/Summary/Validation for all 7
models, plus AIWorkspaceSummary aggregate)

✅ Relationships (SQLAlchemy relationship() + cascade/orphan, indexes;
new relationships added to the existing Project model)

✅ CRUD routers (ai_accounts, conversations, prompt_templates,
project_zips, ai_handoffs, token_trackers, knowledge_articles) --
registered in main.py

✅ AIWorkspaceSummary wired up (`GET /api/ai-analytics/summary`), plus
a metric-by-metric analytics breakdown router (`ai_analytics.py`)

✅ Global Search extended to span AI accounts, conversations, prompt
templates, knowledge articles, project zips, AI handoffs

⬜ Dashboard integration (out of scope this session, per task brief --
"Do NOT build dashboard widgets")

Frontend

⬜ Not started (out of scope for this session)

---

Update this section whenever something is discovered.

- CORS is wide open (`allow_origins=["*"]` in `backend/app/main.py`).
  This is intentional for a localhost-only, single-user, offline-first
  app (see PROJECT_CONTEXT.md), but should be tightened if this is
  ever exposed beyond localhost.
- `frontend/src/components/ui/badge.tsx` (the generic shadcn-style
  `Badge` primitive) is unused -- every screen uses the app's own
  `StatusBadge`/`UrgencyBadge` instead. Left in place rather than
  deleted since it's part of the shared `ui/` primitive set and may
  still get used later, but flagged here per the "no dead files"
  principle.
- No automated test suite exists (backend or frontend). This session's
  and prior sessions' verification has been `tsc -b` / `vite build` /
  `pyflakes` / manual `TestClient` smoke calls, not real test files.
- No live-browser manual QA has been done on the Kanban board, phase
  drag-reorder, or Global Search added this session -- verified via
  compilation, build, and backend smoke tests only.
- `recharts` (used by the Analytics views) is still one large chunk
  (~350 KB) inside the main bundle; further route/tab-level
  `React.lazy` splitting of `ProjectAnalyticsView.tsx` /
  `StudyAnalytics.tsx` would shrink initial load further but wasn't
  done this session.
- AI Workspace has no routers yet, so its models/schemas are inert --
  `models.Base.metadata.create_all()` will create the 7 new tables on
  next backend start, but nothing writes to or reads from them until
  routers exist. Not a bug, just the expected state of a
  "models + schemas first" session (same as Project Workspace's first
  session).
- `AIAccount.api_key_env_var`'s "looks like a real secret" check
  (`_looks_like_a_real_secret` in `schemas.py`) is a heuristic
  (rejects anything that isn't `[A-Z][A-Z0-9_]*` or is over 100 chars),
  not a guarantee -- it will not catch every possible real key, and a
  determined user could still type a fake-looking value. It exists to
  catch accidental paste-ins, not as a security boundary.

---

# Architectural Decisions

Decision 1

SQLite remains the primary database.

Reason

Offline-first architecture.

Decision 2

GitHub will be used only for synchronization.

Reason

Avoid cloud infrastructure.

Decision 3

Every feature is a self-contained module.

Reason

Scalability.

Decision 4

Dashboard remains the application's central entry point.

Reason

Unified user experience.

Decision 5

Project Todos are rendered as a filterable list (mirrors the existing
Task Manager's `TaskList`/`TaskCard`), not a drag-and-drop Kanban
board, even though earlier planning notes said "Kanban-style Todo
Board."

Reason

The rest of the app has no drag-and-drop UI anywhere, and introducing
one for a single view would mean a new dependency and a new
interaction pattern the rest of the app doesn't share. The list view
already supports status filtering (To do / In progress / Done / All),
which covers the same underlying need. If a Kanban board is still
wanted, it should be a deliberate, scoped addition -- and if it is
added, the same drag-and-drop pattern should probably also be applied
to Phase reordering (currently up/down buttons) for consistency.

Decision 6

Roadmap, Documentation, Milestones, Features, Todos, Bug Tracker,
Resources, Timeline, and Analytics were built as tabs inside one
`ProjectDetail.tsx` page rather than 9 separate top-level routes.

Reason

`SubjectDetail.tsx` already established this exact pattern (tabs:
Overview/Assignments/Notes/Resources/Sessions) for the Study Hub.
Following it keeps the two feature areas consistent and avoids two
different navigation shapes existing side by side in the same app.

Decision 7

AI Workspace's relationship to Project uses two different cascade
strategies, not one: `ProjectZip` cascade-deletes with its Project
(`ON DELETE CASCADE` + `cascade="all, delete-orphan"`), but
`Conversation`/`AIHandoff`/`KnowledgeArticle` only get un-scoped
(`ON DELETE SET NULL`, no relationship cascade) when their Project is
deleted.

Reason

A `ProjectZip` is a snapshot *of* a specific project -- it has no
meaning once that project is gone, so it should be owned and cascade
with it, exactly like `ProjectResource`/`ProjectDocument` already do.
A `Conversation`, `AIHandoff`, or `KnowledgeArticle`, by contrast, can
reasonably reference more than one project over its lifetime, or none
at all (a general debugging conversation, a cross-cutting handoff
note, a knowledge article about the toolchain rather than any one
project) -- deleting the project shouldn't destroy that history. This
mirrors the existing `ProjectPhase -> Feature/ProjectTodo/Bug/
Milestone` split already documented in DATABASE_SCHEMA.md (phase
deletion orphans, doesn't delete).

Decision 8

`AIAccount.api_key_env_var` stores only the *name* of an environment
variable, never a real API key, and both `models.py`'s docstring and a
`schemas.py` `field_validator` enforce this.

Reason

PROJECT_CONTEXT.md's Security section ("Never expose secrets. Never
hardcode tokens. ... Sensitive values belong in environment
variables.") already established this pattern for the future GitHub
PAT in Git Sync (see SYNC_ARCHITECTURE.md). AI Workspace needed the
same guarantee for AI provider API keys, so it reuses the same
convention rather than inventing a new one.

Decision 9

Every AI Workspace model got a `*Validation` Pydantic schema
(`AIAccountValidation`, etc.) this session, even though no Git Sync
Import Engine exists yet to use them.

Reason

SYNC_ARCHITECTURE.md's Import Engine will need to validate each
entity's exported JSON before writing it back into SQLite, for every
synced table, not just AI Workspace's. Defining the AI Workspace half
of that contract now (while the table shapes are already fresh in
context) is cheap and keeps the future Import Engine's job additive
rather than requiring it to design new schemas per table type at that
point. This mirrors how `ProjectWorkspaceSummary` was "defined but not
yet wired to a router" in Project Workspace's first session --
speculative-but-cheap schema work is acceptable when it directly
serves a documented future architecture (SYNC_ARCHITECTURE.md), not
speculative in general.

---

# Future Modules

Priority

1

Project Workspace -- complete (backend + frontend)

2

AI Workspace -- in progress (backend foundation this session: models +
schemas; routers next, then frontend)

3

Git Sync Engine

4

Global Search -- complete (added as part of a Project Workspace polish
session; see Session Summary further down)

5

Calendar

6

Backup Manager

---

# If Conversation Ends

Before stopping

Always provide

Completed work

Created files

Modified files

Deleted files

Remaining work

Known issues

Architecture decisions

Migration steps

Testing status

Next recommended task

Nothing should remain undocumented.

---

# Instructions For Next AI

Read

PROJECT_CONTEXT.md

ARCHITECTURE.md

DATABASE_SCHEMA.md

AI_HANDOFF.md

Inspect the latest project.

Understand the current architecture.

Do not recreate functionality.

Continue from the current codebase.

Maintain coding style.

Reuse existing systems.

Keep backward compatibility.

Always update this file before finishing the conversation.

---

# Session Summary

Current Session (Session 5 -- AI Workspace: Backend Routers)

Built the AI Workspace CRUD routers on top of the previous session's
models + schemas, per this session's explicit "DO NOT recreate
models/schemas, build ONLY the AI Workspace backend APIs" scope. No
model, schema, or existing router/page/hook/component was touched or
rewritten; every new file is additive, and `main.py` only gained new
`include_router(...)` calls.

Implemented:

- `backend/app/routers/ai_accounts.py` -- full CRUD; filter by
  provider/status; search (name/description); sort (name/created_at/
  updated_at); pagination; `/summary` (workspace-wide) and
  `/{id}/summary` (`AIAccountSummary` rollup: conversation/zip/handoff
  counts, total tokens, last-active timestamp); `POST /{id}/touch` to
  bump `updated_at` as a "mark used" signal, since no `last_used_at`/
  `is_default` column exists (see Known Issues)
- `backend/app/routers/conversations.py` -- full CRUD; filter by
  account/project/status; search (title/summary); sort; pagination;
  `/{id}/summary` (`ConversationSummary` rollup); `clear_project`
  convenience flag; logs "Conversation Started"/"Conversation
  Finished" to ActivityLog + TimelineEvent (when project-scoped) on
  create / status->completed transition
- `backend/app/routers/prompt_templates.py` -- full CRUD; category/
  favorites filtering (`category="favorite"`, see Known Issues);
  search (title/description/content); `/recent`, `/categories`,
  `POST /{id}/duplicate`, `POST /{id}/use` (increments `usage_count`)
- `backend/app/routers/project_zips.py` -- metadata CRUD + the actual
  file lifecycle (`POST /upload`, `POST /{id}/replace`, `DELETE`),
  reusing `uploads.py` (`save_upload`/`delete_upload`) exactly as
  `project_resources.py` does -- no second upload implementation, no
  Git Sync. `GET /current?project_id=` returns the most recent
  snapshot; filter by project/account/conversation
- `backend/app/routers/ai_handoffs.py` -- full CRUD; search across
  completed_work/remaining_work/next_objective/known_issues;
  `GET /latest` scoped by any combination of project/account/
  conversation; logs "Handoff Added" to ActivityLog + TimelineEvent
- `backend/app/routers/token_trackers.py` -- full CRUD for the usage-
  log rows Conversation 1 actually modeled (input/output/total tokens,
  cost, model); `/summary` and `/accounts/{id}/total` rollups backing
  `TokenUsageSummary`/`TokenTrackerAccountTotal`; best-effort
  `POST /accounts/{id}/mark-limited` / `mark-refreshed` that log
  ActivityLog events only, since there's no persisted limit/refresh/
  notify state to update (see Known Issues -- this is a scope gap
  versus the task brief's "settings" description of TokenTracker, not
  a bug)
- `backend/app/routers/knowledge_articles.py` -- full CRUD; project/
  category/source/tag filtering; pinned/favorites via `category`
  value (see Known Issues); search (title/content); logs "Knowledge
  Article Created" to ActivityLog + TimelineEvent
- `backend/app/routers/ai_analytics.py` -- `GET /summary` wires up
  `AIWorkspaceSummary` (computed on the fly from every child table,
  same philosophy as `analytics.get_workspace_analytics`), plus one
  endpoint per requested metric: conversations-per-project,
  conversations-per-provider, prompt-categories, zip-upload-count,
  knowledge-articles, provider-usage, conversation-status,
  token-limits-reached (derived from ActivityLog, see above)
- `backend/app/routers/search.py` -- extended (not rewritten) to
  additionally search AI accounts, conversations, prompt templates,
  knowledge articles, project zips, and AI handoffs; existing Task/
  Study Hub/Project Workspace search entries untouched
- `backend/app/main.py` -- registers all 8 new routers (7 CRUD +
  `ai_analytics`), after Project Workspace and before `search`/
  `dashboard` (unchanged ordering rationale: `ai_analytics` lazily
  imports sibling serializers the same way `projects.py` does)

Verified:

- `python -m py_compile` and a full `ast.parse` on every new router --
  clean, no syntax errors
- Every field referenced in each router was manually cross-checked
  against the actual `models.py` column names and `schemas.py`
  Create/Update/Out field names (not assumed from the task brief,
  which in a few places names things slightly differently -- see
  Known Issues)
- **Not verified this session**: no live `TestClient`/SQLite smoke
  test was run (previous sessions' standard verification step) --
  this container has no network access and the Python environment
  here does not have `fastapi`/`sqlalchemy`/`pydantic` installed, and
  `pip install` could not reach PyPI. The next session (or the user,
  locally) should run `uvicorn app.main:app --reload` and hit each new
  endpoint at least once before trusting this as fully tested; the
  code is written and cross-checked but not executed.

Known issues / scope gaps versus the task brief (all due to "DO NOT
redesign the database" taking precedence over the brief's feature
descriptions where the two conflict):

- The task brief described `TokenTracker` as a per-account *settings*
  object (`enabled`, `limit_reached`, `refresh_time`, `notify_enabled`,
  `notify_offset`, `status`) with a "countdown calculation reusable by
  the frontend." Conversation 1 actually modeled `TokenTracker` as an
  append-only *usage log* (input/output/total tokens, cost, model) --
  see `models.py`'s docstring. This session built full CRUD/analytics
  for the usage-log shape that exists, and added `mark-limited`/
  `mark-refreshed` endpoints that only write ActivityLog entries (no
  state to persist against). A real countdown/notify feature needs a
  small additive migration -- new columns on `AIAccount` or a new
  `TokenTrackerSettings` table -- and should be scoped as its own
  follow-up rather than smuggled into this session as a schema change.
- The task brief asked for "Default account selection" and "Last used
  updates" on AI Accounts. There's no `is_default`/`last_used_at`
  column. `POST /{id}/touch` bumps `updated_at` as a practical stand-
  in for "last used" (sort accounts by `updated_at desc` for a
  "recently used" list); "default" has no natural single-column home
  and was left out rather than guessed at -- recommend adding an
  `is_default` boolean column in a small follow-up migration if the
  frontend needs a persisted default rather than a client-side
  preference.
- The task brief asked for "Conversation numbering." `Conversation`
  has no ordinal/number column; a per-account ordinal can be derived
  client-side from `started_at` ordering via the existing `list`
  endpoint's sort, or added as a follow-up column if a stable,
  gap-free number is required.
- "Pinned" (Knowledge Articles) and "Favorites" (Prompt Templates,
  Knowledge Articles) have no boolean columns; both reuse the existing
  `category` text field (`category="pinned"` / `category="favorite"`)
  rather than adding columns, mirroring how the task brief's own
  "prompt_library"/"knowledge_base" file names were mapped onto the
  actual `prompt_templates`/`knowledge_articles` names Conversation 1
  already chose (see File Naming note below).
- File naming: the task brief asked for `prompt_library.py`,
  `zip_manager.py`, `handoffs.py`, and `token_tracker.py`. This session
  used `prompt_templates.py`, `project_zips.py`, `ai_handoffs.py`, and
  `token_trackers.py` instead, matching the model/schema class names
  Conversation 1 already established (`PromptTemplate`, `ProjectZip`,
  `AIHandoff`, `TokenTracker`) and AI_HANDOFF.md's own previously
  recorded "Next Task" plan, rather than introducing a second naming
  convention for the same entities.

Implemented (previous session, unchanged this session):

- `backend/app/models.py` -- 7 new SQLAlchemy models (`AIAccount`,
  `Conversation`, `PromptTemplate`, `ProjectZip`, `AIHandoff`,
  `TokenTracker`, `KnowledgeArticle`) and 4 new enums (`AIProvider`,
  `AIAccountStatus`, `ConversationStatus`, `KnowledgeSource`), appended
  in a new "AI Workspace" section. `ProjectZip` cascade-deletes with
  its Project (owned, mirrors ProjectResource); `Conversation`/
  `AIHandoff`/`KnowledgeArticle` only get un-scoped (`SET NULL`, no
  cascade) since they can span or outlive a single project (see
  Architectural Decision 7). `AIAccount.api_key_env_var` stores only
  an environment variable *name*, never a real key (Decision 8).
- `backend/app/schemas.py` -- `Create`/`Update`/`Out` for all 7 models;
  `AIAccountSummary`/`ConversationSummary` per-entity rollups plus a
  top-level `AIWorkspaceSummary` aggregate (same two-tier pattern as
  `ProjectSummary`/`ProjectWorkspaceSummary`); a `*Validation` schema
  per model for the future Git Sync Import Engine (Decision 9); a
  `field_validator` rejecting `api_key_env_var` values that look like
  a real pasted-in secret; a shared `_clean_str_list` normalizer for
  every JSON-encoded-list field.
- `DATABASE_SCHEMA.md` -- replaced the old "Future Claude Workspace"
  sketch with full field tables (all 7 tables), the Project<->AI
  Workspace relationship diagram, cascade rules, and index docs;
  updated the Database Overview tree and Long-Term Database Vision
  tree.
- `CHANGELOG.md` -- new `[Unreleased] - AI Workspace: Backend
  Foundation` entry added above the existing Project Workspace
  entries (which are untouched).

Verified:

- `python -m pyflakes app/models.py app/schemas.py` -- clean
- All 7 new models created against a real (in-memory) SQLite engine
  via `Base.metadata.create_all()`; rows created, related, and
  round-tripped through their relationships successfully
- Cascade/orphan behavior specifically exercised and confirmed:
  deleting an `AIAccount` cascades to its `Conversation`/
  `TokenTracker` rows but leaves `ProjectZip`/`AIHandoff` rows in
  place with their FK set to NULL; deleting a `Project` cascades to
  its `ProjectZip` rows but leaves `Conversation`/`AIHandoff`/
  `KnowledgeArticle` rows in place with their FK set to NULL
- All new Pydantic schemas exercised directly: `Create`/`Update`
  validators (including the `api_key_env_var` secret-shape rejection
  and the JSON-list-field cleaning), `Out.model_validate(...,
  from_attributes=True)`, a `Validation` schema, and the
  `AIWorkspaceSummary` aggregate
- Full app re-verified unaffected after the change: `app.main.app`
  still boots (102 routes, same as before -- no new routers were
  registered, per task scope), and `TestClient` calls to
  `/api/tasks`, `/api/dashboard`, and `/api/search` all still return
  200 with no changes to their behavior

Replace this section every development session.

---

# Next Task

Conversation 8's task brief (Invitation System Completion &
Notification Center, Parts 1-8) is functionally done. What's left is
entirely verification, not new work:

1. **Live backend boot.** `pip install -r requirements.txt &&
   uvicorn app.main:app --reload`. Confirm `/docs` loads, all routers
   register (including the new `notifications` router), and
   `Base.metadata.create_all` creates the new `notifications` table
   with no errors.
2. **Live frontend build.** `npm install && npm run build` (runs
   `tsc -b && vite build`). This session's verification was
   syntax-only (`ts.transpileModule` has no access to dependency
   types), so this is the first REAL type-check the new/changed
   files will get -- pay particular attention to: React Query hook
   generic inference in `useNotificationCenter.ts`, the
   `InvitationPreview` type actually matching what the backend
   returns, and prop-type consistency across `InvitationRow.tsx` /
   `InvitationDetailsDialog.tsx` / `InvitationList.tsx` (`onResend`/
   `resending`/`canManage` were added to two components' props this
   session and threaded through from a third -- a real type-check is
   the first thing that would catch a missed prop).
3. **Manual click-through**, in order:
   - Create an invitation to an existing user's email -> confirm they
     get a Notification with working Accept/Reject inline.
   - Create an invitation to a brand-new email -> copy the link from
     the new inline "Copy invite link" success screen in
     `InviteMemberDialog` -> open it in a private window -> accept as
     a new anonymous user -> confirm the "account created, sign in to
     access it" messaging makes sense.
   - Resend an expired invitation -> confirm the link changes and
     works.
   - Mark-all-read, delete a notification, check the sidebar/
     mobile-nav/topbar badge counts update within ~30s (or
     immediately, for actions taken in the same session).
   - Resize to a narrow (360-390px) viewport and click through
     Dashboard, Notifications, `/invite/{token}`, the Team tab,
     Project Settings (all 6 tabs, especially Danger Zone), and the
     Invite/Role dialogs -- these are exactly the areas this
     session's mobile pass touched.
4. **ESLint** (`npm run lint`) -- not attempted, same network
   constraint as every other check.

Known gaps, accepted as out of scope for this task brief (documented,
not silently left):
- Anonymous invitation acceptance creates a passwordless `User` row
  (pre-existing `get_or_create_user_by_email` behavior, unchanged) --
  the landing page explains this but doesn't solve it; would need a
  real registration/password-set flow, which is beyond "extend, don't
  redesign."
- `accept`/`reject` by token don't verify the signed-in session's
  email matches `invitation.email` -- flagged in the UI only, not
  enforced server-side. Pre-existing endpoint behavior.
- No live push/websocket for badge updates -- relies on React Query's
  30s poll plus same-session cache invalidation. Cross-session/
  cross-tab updates (the owner seeing an invitee's Accept in real
  time) will lag up to 30s. This is exactly what "Realtime
  Collaboration" (an explicitly allowed placeholder category) would
  fix; not attempted here.

Otherwise, per the Planned list in Overall Project Status, Git Sync
Engine is next in priority order.

# AI Workspace Frontend Session (2026-07-31)

## Completed Work
Built the complete AI Workspace frontend module on top of the
already-complete backend (models/schemas/routers untouched). All 7
entities (AIAccount, Conversation, PromptTemplate, ProjectZip,
AIHandoff, TokenTracker, KnowledgeArticle) have full CRUD UI, wired to
React Query hooks and the existing dark-glassmorphism component
library (Card, Dialog, Select, StatusBadge, etc). `tsc -b` and
`vite build` both pass clean; `eslint` reports zero problems on the
new files.

## Created Files
- `frontend/src/lib/aiWorkspaceMeta.ts` -- status/provider badge meta,
  `FAVORITE_CATEGORY`/`PINNED_CATEGORY` constants, and the
  localStorage-backed default-account helper.
- `frontend/src/hooks/useAIAccounts.ts`, `useConversations.ts`,
  `usePromptTemplates.ts`, `useProjectZips.ts`, `useAIHandoffs.ts`,
  `useTokenTrackers.ts`, `useKnowledgeArticles.ts`, `useAIAnalytics.ts`
- `frontend/src/components/ai-workspace/AIAccountsView.tsx`,
  `ConversationsView.tsx`, `PromptLibraryView.tsx`,
  `ZipManagerView.tsx`, `AIHandoffsView.tsx`, `KnowledgeBaseView.tsx`,
  `AIWorkspaceDashboardView.tsx`, `AIAnalyticsView.tsx`,
  `AIWorkspaceSettingsView.tsx`
- `frontend/src/pages/AIWorkspace.tsx` -- top-level page, sub-nav +
  nested `<Routes>` for all 9 sections.
- `frontend/src/components/dashboard/AIWorkspaceWidget.tsx` --
  self-fetching widget (mirrors `OpenBugsWidget`'s pattern).

## Modified Files
- `frontend/src/types/index.ts`, `frontend/src/lib/api.ts` -- added
  every AI Workspace type/endpoint.
- `frontend/src/App.tsx` -- added `ai-workspace/*` route.
- `frontend/src/components/layout/Sidebar.tsx`,
  `MobileNav.tsx` -- added "AI Workspace" nav item after Projects.
- `frontend/src/components/layout/GlobalSearch.tsx` -- added type
  labels for the 6 AI Workspace search-result types (paths already
  matched what `routers/search.py` emits, e.g. `/ai-workspace/accounts`).
- `frontend/src/pages/Dashboard.tsx` -- mounted `AIWorkspaceWidget`
  (self-hides when there's no AI Workspace data yet).

## Implementation Notes / Deliberate Scope Decisions
1. **Routing, not just tabs.** `routers/search.py` already emits paths
   like `/ai-workspace/conversations/{id}`, so AI Workspace is real
   nested routes (`pages/AIWorkspace.tsx` renders `<Routes>` for
   `accounts`, `conversations(/:id)`, `prompts`, `zips`, `handoffs`,
   `knowledge`, `analytics`, `settings`), not just client-side Tabs
   state -- otherwise search/deep-links would 404.
2. **Token Tracker is a usage log, not a countdown.** There is no
   `refresh_time`/`notify_enabled`/`is_default`/`last_used_at` column
   anywhere (confirmed by reading `routers/token_trackers.py`'s own
   docstring/`mark-limited`/`mark-refreshed`, which only write
   `ActivityLog` rows). Built the real thing instead: token totals in
   Analytics, per-account totals on AI Accounts, and a "recent limit
   events" list from `/api/ai-analytics/token-limits-reached`. No
   countdown timer exists anywhere in the UI.
3. **Default account is a client-side preference** (localStorage,
   `lib/aiWorkspaceMeta.ts`), not a backend field, per this file's own
   Known Issues note recommending exactly that instead of a schema
   change.
4. **Favorites/pinned reuse `category`** (`"favorite"`/`"pinned"`)
   exactly like the backend routers already do -- no client-side
   invention here, just matching what's already there.
5. **Dashboard integration is decoupled from `DashboardOut`.**
   `AIWorkspaceWidget` queries `/api/ai-analytics/summary` directly
   rather than waiting on a `/api/dashboard` schema change (explicitly
   out of scope per this file's earlier "Next Task" note).
6. Conversations don't literally have "Created/Modified/Deleted Files,
   Testing Status, Architecture Decisions" fields as the original task
   brief listed -- those are `AIHandoff` fields. The Conversation
   detail view surfaces the conversation's real fields and links out
   to its related Handoffs for that information, rather than
   fabricating columns that don't exist.

## Testing Completed
- `npx tsc -b` -- passes, zero errors.
- `npx vite build` -- succeeds (see `AIWorkspace-*.js` chunk, ~88KB /
  18KB gzip).
- `npx eslint` on every new/modified file -- zero problems.
- Not yet run: a live backend + manual click-through (no dev server
  was started this session). Recommend `npm run dev` +
  `uvicorn app.main:app --reload` side by side as the first step next
  session, then click through each of the 9 tabs once with real data.

## Remaining Work
- Manual/browser QA against a running backend (create/edit/delete
  round-trips, upload flow, responsive check at mobile width).
- Nothing else from the original brief is outstanding at the
  component level; all 9 pages exist and are wired to real endpoints.

---

---

# AI Workspace Verification & Polish Session (2026-07-31, session 4)

## Context
The task brief for this session claimed AI Workspace frontend was
"complete" and asked for a full release-prep pass (notifications,
UX/perf/accessibility polish, dead-code sweep, full test matrix, doc
sync, and a packaged release ZIP). The frontend described in the
"AI Workspace Frontend Session" note above does exist and matches that
note closely -- but this file's own earlier sections (Current Module,
CHANGELOG.md) still say frontend is "not yet started," and CHANGELOG.md
had no entry for it at all. That gap between docs was flagged rather
than silently resolved one way or the other.

Given the size of the full brief (10 parts) versus one session, this
session did NOT attempt all of it. It verified the existing frontend
against the real backend, closed one concrete functionality gap (see
below), and fixed one small UX gap -- rather than claim broader parts
(full a11y audit, exhaustive polish, release ZIP) were done when they
weren't.

## Completed Work
- Found `useAccountTokenTotal`/`useMarkAccountTokenLimited`/
  `useMarkAccountTokenRefreshed`/`useRecordTokenUsage`/
  `useDeleteTokenTracker` (in `useTokenTrackers.ts`) were fully built in
  a prior session but called from **no component anywhere**. Built
  `TokenRefreshCountdown.tsx` + `useTokenRefreshScheduler.ts` to
  actually use the first three (live countdown badge from a
  user-set local reminder, "Limited"/"Refreshed" quick actions,
  browser notifications), mounted on every `AIAccountsView` card.
  `useRecordTokenUsage`/`useDeleteTokenTracker` remain unused --
  there's no UI for manually logging a usage entry yet; flagged below,
  not built, since it wasn't in this session's Part 1 scope (countdown/
  badges/refresh display) and a usage-logging form is its own small
  feature.
- Added a one-click favorite toggle on `PromptLibraryView` cards (was
  edit-dialog-only, silent on success) with a toast, closing the
  "Prompt favorited" notification gap from the task brief.
- Live-verified (via `fastapi.testclient.TestClient` against the real
  SQLite-backed app, not just static reads): AI account create, global
  search, token usage recording + account total, mark-limited/
  mark-refreshed, and prompt favoriting all round-trip correctly.
- Re-ran `tsc -b`, `eslint src` (whole frontend, not just new files),
  and `vite build` -- all clean. 4 pre-existing warnings in unrelated
  shared-UI files (`ProjectIcon.tsx`, `badge.tsx`, `button.tsx`,
  `NotificationContext.tsx`) were left as-is; not AI-Workspace-related
  and outside this session's stated scope.

## Created Files
- `frontend/src/components/ai-workspace/TokenRefreshCountdown.tsx`
- `frontend/src/hooks/useTokenRefreshScheduler.ts`

## Modified Files
- `frontend/src/lib/aiWorkspaceMeta.ts` -- added
  `get/setTokenRefreshReminder`, `getAllTokenRefreshReminders`.
- `frontend/src/components/ai-workspace/AIAccountsView.tsx` -- mounts
  `TokenRefreshCountdown` per card.
- `frontend/src/components/ai-workspace/AIWorkspaceSettingsView.tsx` --
  updated copy to describe the new reminder (still accurate: still
  client-only, still not a real backend value).
- `frontend/src/components/ai-workspace/PromptLibraryView.tsx` --
  one-click favorite toggle + toast.
- `frontend/src/components/layout/AppLayout.tsx` -- mounts
  `useTokenRefreshScheduler()`.
- `CHANGELOG.md` -- added the missing entry for the prior frontend
  session plus this session's changes.

## Explicitly NOT Done This Session (be honest with the next AI)
- Parts 2-10 of the original brief were only partially addressed:
  notification coverage for "Conversation unfinished"/"Missing AI
  handoff" was not built (no schema-backed definition of "unfinished"
  exists); "last limit reached" display was not built (no persisted
  timestamp exists to read -- would need to query `ActivityLog` by
  account, unverified); no accessibility/keyboard-shortcut audit was
  performed; no broader dead-code sweep beyond the token-tracker hooks
  found unused; no release ZIP was packaged as part of this repo (the
  user was given the updated project directly).
- Do not mark AI Workspace "production-ready" based on this session
  alone -- it's verified working end-to-end for the flows tested above,
  not exhaustively QA'd.

## Next Planned Modules (per task brief, deliberately not started)
The next session(s) should begin:
1. Authentication & Authorization
2. Cloud Collaboration Foundation
3. Hackathon Hub
4. Git Sync Engine (see `SYNC_ARCHITECTURE.md`)

None of these were touched or scaffolded this session.

---

---

# Collaboration & Identity: Database Foundation Session (2026-07-31, session 5)

## Context
Task brief: "Build ONLY the collaboration-ready database foundation"
for evolving Projects into a collaborative container (Users, Roles,
Permissions, ProjectMembers, ProjectInvitations, Sessions,
UserPreferences, NotificationPreferences), explicitly excluding
frontend, auth APIs, login pages, dashboard changes, cloud sync, and
realtime collaboration. This session inspected PROJECT_CONTEXT.md,
ARCHITECTURE.md, DATABASE_SCHEMA.md, ENGINEERING_GUIDELINES.md,
SYNC_ARCHITECTURE.md, this file, and CHANGELOG.md before writing any
code, then read `models.py`/`schemas.py`/`database.py` in full to match
existing conventions exactly (string UUID PKs via `gen_id()`,
Base/Create/Update/Out Pydantic schemas, JSON-encoded Text columns for
lists, `ondelete=` paired with ORM cascade only where truly owned).

## Completed Work
- Added 8 new SQLAlchemy models in `models.py`: `User`, `Permission`,
  `Role`, `ProjectMember`, `ProjectInvitation`, `Session`,
  `UserPreference`, `NotificationPreference`, plus 6 new enums
  (`ProjectVisibility`, `ProjectType`, `UserStatus`, `AuthProvider`,
  `MemberStatus`, `InvitationStatus`).
- Extended `Project` (additive): `owner_id`, `visibility`,
  `collaboration_enabled`, `project_type`.
- Extended `ActivityLog` (additive): `user_id`, `project_id`, `action`,
  `entity_type`, `entity_id`.
- Added matching Pydantic schemas in `schemas.py` for every new table
  (`Base`/`Create`/`Update`/`Out`), plus `UserSummary`,
  `ProjectCollaborationSummary`, and `UserValidation` (future Git Sync
  import validation, same role as `AIAccountValidation`).
- Updated documentation: ARCHITECTURE.md (new "Project Collaboration
  Architecture" section covering ownership/membership/RBAC/permission
  flow/invitation flow/auth prep/future cloud collaboration/future
  Hackathon integration), DATABASE_SCHEMA.md (new "Collaboration &
  Identity Tables" section, extended Project/ActivityLog entries,
  updated overview tree, cascade rules, long-term vision tree),
  PROJECT_CONTEXT.md (new "Project Collaboration" section, updated
  Pending modules and Long-Term Roadmap), CHANGELOG.md (full entry).

## Created Files
None -- everything is additive to the existing `models.py`/`schemas.py`
(new tables, new columns, new schemas), no new files were needed.

## Modified Files
- `backend/app/models.py`
- `backend/app/schemas.py`
- `ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `PROJECT_CONTEXT.md`
- `CHANGELOG.md`

## Architecture Decisions
1. **No `RolePermission` join table.** Not in the requested model list;
   `Role.permission_keys` is a JSON-encoded `list[str]` instead,
   matching the existing `Project.tags`/`AIHandoff.created_files`
   convention. `Permission` stays a real catalog table. Flagged in
   ARCHITECTURE.md rather than silently added.
2. **`ActivityLog` was extended, not duplicated.** The task brief asked
   for "a reusable activity log," but one already exists
   (`activity_log` table + `activity_log.py` helper). Added optional
   `user_id`/`project_id`/`action`/`entity_type`/`entity_id` columns
   instead of introducing a second, overlapping table -- avoids two
   sources of truth for "what happened," matching
   ENGINEERING_GUIDELINES.md Rule 3 ("Never duplicate logic").
3. **`Role.project_id` is nullable, not required.** NULL = global role
   (the 4 seeded defaults); a future project-specific custom role sets
   it. Avoids a second Role table or a "scope" enum later.
4. **Ownership (`Project.owner_id`) is SET NULL, not CASCADE.** Deleting
   a User must never delete their Projects -- ownership is associated,
   not owned, mirroring how `Conversation.project_id` already treats
   "associated but not owned" relationships in this codebase.
5. **Future auth metadata lives on `User` now** (`password_hash`,
   `auth_provider`, `external_auth_id`) rather than a separate
   not-yet-existing `Credential` table, since the task brief listed
   this explicitly as future metadata for the User model, not a
   distinct entity. No endpoint sets these fields yet.

## Known Issues / Things To Watch
- `dashboard_layout`/`ai_preferences`/`reminder_preferences` are typed
  `dict` on the Pydantic `Out` schemas but stored as JSON-encoded Text
  in the database -- this exactly mirrors how `tags`/`variables` are
  `List[str]` on the Pydantic side but Text in the database; the
  `json.dumps`/`json.loads` conversion is expected to happen in router
  code, same as every existing JSON-encoded column. Not a bug, just
  flagging it for whoever writes the first router against these
  tables.
- No seed data/migration script exists yet for the 4 default roles
  (Owner/Admin/Member/Viewer) or the permission catalog -- explicitly a
  data/router concern per the task brief's scope, not built this
  session.
- `ActivityLog.project` relationship was initially added one-sided (on
  `ActivityLog` only); the cascade test caught that `project_id` wasn't
  actually being nulled on Project deletion until the reciprocal
  `Project.activity_log_entries` collection was added. Worth
  remembering for any future "associated, not owned" relationship: both
  sides need `back_populates` for SQLAlchemy to null the FK on delete,
  not just the child side.

## Testing Completed
- `Base.metadata.create_all()` against a real SQLite engine -- builds
  all 33 tables (25 existing + 8 new) with zero errors.
- `fastapi.testclient.TestClient` against the real app -- 162 routes
  (unchanged from before this session), `/api/dashboard` and
  `/openapi.json` both return 200.
- Full CRUD + cascade round-trip against a real in-memory SQLite
  engine: created Users/Roles/Permissions/a Project/ProjectMembers/a
  ProjectInvitation/UserPreference/NotificationPreference/Session/an
  ActivityLog row; verified Project deletion cascades
  ProjectMember/ProjectInvitation and un-scopes (nulls, doesn't delete)
  the ActivityLog row's `project_id` while leaving `user_id` intact;
  verified User deletion cascades ProjectMember/Session/
  UserPreference/NotificationPreference while leaving other Users'
  data untouched.
- `schemas.py` validators exercised directly: `UserCreate` correctly
  rejects a short/plaintext-looking `password_hash`; `RoleCreate`
  correctly trims/drops blank `permission_keys` entries.

## Remaining Work (per task brief, next sessions)
Per the task brief and this file's own "Next Planned Modules" note:

Conversation 2: Authentication APIs, authorization middleware
(resolving the Permission Flow sketched in ARCHITECTURE.md),
invitations (accept/reject endpoints), permissions, backend
collaboration services. Also a reasonable place to add the seed
script for the 4 default roles + permission catalog.

Conversation 3: Frontend authentication, member management,
collaboration UI, project settings.

Conversation 4: Security review, testing, documentation, release
preparation, packaging.

None of these were started this session, matching the task brief's
explicit "DO NOT IMPLEMENT" list.

---

---

# Collaboration Backend: API Layer Session (2026-07-31, session 6)

## Context
Task brief: build the complete backend collaboration layer on top of
the collaboration-ready database foundation from session 5 (User /
ProjectMember / ProjectInvitation / Role / Permission / Session /
UserPreference / NotificationPreference / extended ActivityLog).
Explicitly no authentication/JWT/login/frontend. This session read
PROJECT_CONTEXT.md, ARCHITECTURE.md, DATABASE_SCHEMA.md,
ENGINEERING_GUIDELINES.md, SYNC_ARCHITECTURE.md, this file, and
CHANGELOG.md first, then inspected `models.py` (confirmed all 8
collaboration models already exist) and `schemas.py` (confirmed every
Base/Create/Update/Out schema for them already exists too, including
`UserSummary`/`ProjectCollaborationSummary`/`UserValidation`) before
writing any router code, plus `routers/projects.py` and
`project_helpers.py`/`activity_log.py` to match existing conventions
(string UUID PKs, `get_X_or_404` helpers, `serialize_X` functions that
convert JSON-Text columns to Python objects, `log_activity` calls on
meaningful writes).

## Completed Work
- Extended `project_helpers.py` (additive) with RBAC helpers:
  `get_project_owner`, `get_membership`, `is_member`, `is_owner`,
  `has_role`, `get_effective_permission_keys`, `has_permission`,
  `is_admin`, `can_invite`, `can_manage_members`, `can_manage_project`,
  `count_active_owners`, `get_or_create_user_by_email`.
- Extended `activity_log.py` (additive) with `log_activity_event`,
  a sibling of the existing `log_activity` that also writes the
  `user_id`/`project_id`/`action`/`entity_type`/`entity_id` columns;
  `log_activity`'s original signature and every existing call site are
  untouched.
- Built 8 new routers, all registered in `main.py`:
  - `routers/users.py` -- plain identity CRUD (list/get/create/
    update/delete + a `/summary` rollup). Not an auth API; exists
    because every other router below needs a `User` row to reference
    and none existed yet.
  - `routers/permissions.py` -- list/get/lookup-by-key/validate
    (the brief's required minimum) plus create/update/delete for
    catalog management.
  - `routers/roles.py` -- CRUD + assign/remove permissions; blocks
    renaming/reassigning/deleting the 4 system roles; blocks deleting
    a role still assigned to members.
  - `routers/project_members.py` -- list/get/add/update (role and/or
    status)/remove, `/summary` (ProjectCollaborationSummary),
    `/transfer-ownership`, `/leave`. Blocks any change that would
    leave a project with zero active Owners.
  - `routers/project_invitations.py` -- project-scoped create/list/
    cancel/expire, plus token-scoped get/accept/reject
    (`/api/invitations/{token}/...`, since the invitee holds a token,
    not a project id). Validates duplicate pending invitations and
    existing active membership before creating one. `accept` uses
    `get_or_create_user_by_email` to materialize the invitee's `User`
    row (still no auth) and creates/reactivates their `ProjectMember`.
  - `routers/user_preferences.py` / `routers/notification_preferences.py`
    -- per-user CRUD, lazily auto-creating the row with column defaults
    on first GET (mirrors how the rest of the app treats "every X
    implicitly has a Y" relationships).
  - `routers/activity.py` -- one fully-filterable `_query_activity`
    helper (project_id/user_id/action/entity_type/entity_id/date
    range/text search/sort/pagination) wrapped by three GET endpoints
    (general, per-project, per-user). Read-only; no new write path.
- Added `_seed_collaboration_if_empty()` in `main.py` (same pattern as
  `_seed_if_empty`/`_seed_study_hub_if_empty`): seeds an 11-permission
  catalog (`view_project`, `manage_project`, `view_members`,
  `invite_members`, `manage_members`, `manage_roles`, `view_tasks`,
  `manage_tasks`, `manage_documents`, `view_ai_workspace`,
  `manage_ai_workspace`) and the 4 system roles (Owner = all
  permissions, Admin = all except `manage_project`, Member = task/doc/
  AI-workspace management + read access, Viewer = read-only).
- Updated documentation: PROJECT_CONTEXT.md, ARCHITECTURE.md,
  CHANGELOG.md, and this file.

## Created Files
- `backend/app/routers/users.py`
- `backend/app/routers/permissions.py`
- `backend/app/routers/roles.py`
- `backend/app/routers/project_members.py`
- `backend/app/routers/project_invitations.py`
- `backend/app/routers/user_preferences.py`
- `backend/app/routers/notification_preferences.py`
- `backend/app/routers/activity.py`

## Modified Files
- `backend/app/project_helpers.py`
- `backend/app/activity_log.py`
- `backend/app/main.py`
- `PROJECT_CONTEXT.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`

## Architecture Decisions
1. **`permission_overrides` is additive-only (grants on top of the
   role), not a grant/deny structure.** The column is a plain
   JSON `list[str]` per its existing model comment; a richer structure
   would need a schema/model change, which the task brief said not to
   do. `get_effective_permission_keys` documents this choice inline so
   a future authorization session can extend it deliberately if
   deny-overrides are ever needed.
2. **The project owner is treated as implicitly having every
   permission and the "Owner" role**, even without (or in addition to)
   an explicit `ProjectMember`/`Role` row, since `Project.owner_id` is
   the real source of truth for ownership. `is_admin` treats Owner as a
   superset of Admin for the same reason.
3. **"Update member role" and "update member status" share one PATCH
   endpoint** (`ProjectMemberUpdate` already covers both fields) rather
   than two separate routes -- matches this app's existing single-PATCH
   convention (e.g. `update_project`) and avoids inventing two near-
   identical endpoints for one schema.
4. **Invitation accept/reject/expire live under `/api/invitations/
   {token}`, not `/api/projects/{project_id}/invitations/{id}`.** The
   invitee holds an opaque token (the future email-link identifier per
   `ProjectInvitation`'s own docstring), not the project id or the
   invitation's row id. Create/list/cancel/expire-by-id stay
   project-scoped since those are actions the project's own members
   take.
5. **A "Cancel invitation" sets `status=revoked`, not a new "cancelled"
   enum value.** `InvitationStatus` already has `revoked`, which is
   exactly this state (pending invite withdrawn before response); no
   model change needed.
6. **`routers/users.py` was added even though the task brief only
   listed Project Members / Invitations / Roles / Permissions / User
   Preferences / Notification Preferences / Activity Log.** It is
   explicitly *not* an authentication API (no password check, no
   session issuance, no login) -- it is the minimum plain-CRUD needed
   for `add_member`/`accept_invitation`/preferences endpoints to have a
   `User` row to reference, since `UserCreate`/`UserOut` schemas
   already existed unused. Flagged here rather than silently added,
   per this file's own instruction to document decisions.

## Known Issues / Things To Watch
- **This session's sandbox had no network access, so `pip install
  fastapi/uvicorn/sqlalchemy/pydantic` was not possible and the app
  could not actually be booted or hit via `TestClient`/`/openapi.json`
  this time** (unlike session 4, whose handoff notes a live
  `TestClient` run). Verification this session was: (a) `python -m
  py_compile` on every new/modified file -- all pass; (b) a scripted
  cross-check of every `models.X`/`schemas.X`/enum-member/column-name
  reference in the new code against the actual class bodies in
  `models.py`/`schemas.py` -- zero mismatches found; (c) a full manual
  trace of the ownership-transfer, last-owner-protection, and
  invitation-lifecycle logic. This is real but not a substitute for an
  actual boot test -- **the next session should run one first** (`pip
  install -r requirements.txt && uvicorn app.main:app` or equivalent,
  then hit `/openapi.json` and a few round-trips) before building
  further on top of this.
- No email sending exists (out of scope per the brief) -- accepting an
  invitation is entirely token-driven; there's no notification to the
  invitee that they were invited.
- `routers/users.py`'s `create_user`/`update_user` accept a raw
  `password_hash` field passthrough (the column already exists on
  `User`) but nothing hashes a plaintext password before it gets here --
  that's still the next session's job. Don't call this "password
  support"; it's just an unenforced passthrough column.
- `Session` (the DB model in `models.py`) and `sqlalchemy.orm.Session`
  share a name. Every new router imports the ORM one as `Session` (for
  the `db: Session = Depends(get_db)` type hint) and reaches the model
  one via `models.Session` -- never imported directly by that bare
  name. Keep doing this in any future router that touches the
  `Session` (auth sessions) table.

## Testing Completed
- `python -m py_compile` on every new/modified backend file: clean.
- Scripted regex cross-check of every `models.<Name>`/`schemas.<Name>`
  reference, every `models.<Enum>.<member>` reference, and every
  `.<column>` attribute access used in the new routers/helpers against
  the actual class/enum definitions in `models.py`/`schemas.py`: zero
  unresolved references.
- Manual trace of: add member (duplicate-membership 409, missing-user
  404, `IntegrityError` race-condition fallback), update member
  (last-owner-protection blocking both role-demotion and status-
  removal), remove member (last-owner block), transfer ownership
  (self-transfer rejection, non-member rejection, previous owner
  demoted to Admin, `Project.owner_id` and the new owner's `role_id`
  updated together), leave project (last-owner block), create
  invitation (duplicate-pending-invitation 409, existing-active-member
  409), accept invitation (lazy expiry resolution, user
  find-or-create, membership reactivate-or-create), route-ordering
  around `/summary` vs `/{member_id}` to avoid a path-matching
  collision.
- **Not completed this session:** an actual live boot / `TestClient`
  run, an OpenAPI schema diff, and a real SQLite round-trip -- blocked
  by the sandbox's lack of network access this time (see "Known
  Issues" above). Flagging this explicitly rather than claiming a live
  test that didn't happen.

## Remaining Work (per task brief, next sessions)
Per the task brief and session 5's own "Next Planned Modules" note,
this session completed the "backend collaboration services" and
"permissions" portions early. Still remaining:

Authentication APIs (login/registration are still explicitly not
implemented -- `routers/users.py` is plain CRUD only), JWT issuance,
authorization middleware that actually calls `has_permission`/
`can_manage_members`/etc. from `project_helpers.py` as a FastAPI
dependency, current-user (`/api/me`) endpoints, and a real boot/
integration test of everything built in sessions 5-6 together.

After that: frontend authentication, member management UI,
collaboration UI, project settings UI (per session 5's "Conversation
3" note) -- not started, not scaffolded.

---

# Identity & Security: Backend Authentication + Authorization Session (2026-07-31, session 7)

## Context
Session 5 built the collaboration database foundation. Session 6 built
the collaboration CRUD/RBAC-helper API layer but explicitly left
authentication and authorization middleware unbuilt (see its "Remaining
Work" above), and also flagged that it had no network access to boot
the app. This session had network access, built the full backend
Identity & Security layer, and booted/tested everything live.

## Completed Work
- **Password hashing & policy** (`security.py`): bcrypt via passlib
  (`pwd_context.hash`/`.verify`), timing-safe by construction;
  `validate_password_strength` as a list of `(predicate, message)`
  rules (min 8 / max 128 chars, needs a letter and a digit) so future
  policy changes are additive.
- **JWT access tokens**: HS256, `sub`(user id)/`sid`(session id)/`exp`
  claims, 30-minute default lifetime (`ACCESS_TOKEN_EXPIRE_MINUTES` env
  override). Stateless (no DB hit to validate the signature itself),
  but `auth_dependencies.get_current_user` still loads the referenced
  `Session` row every request so revoking that Session invalidates
  every access token tied to it immediately.
- **Opaque rotating refresh tokens**: `secrets.token_urlsafe(48)`,
  never a JWT; only `hash_token()`'s SHA-256 digest is ever persisted
  (`Session.refresh_token_hash`). `POST /api/auth/refresh` rotates on
  every call -- old token stops working the instant the new one is
  issued. Verified live: reusing a refresh token after it's been
  rotated correctly returns 401.
- **`routers/auth.py`**: register (auto-logs-in, issues tokens),
  login (accepts username-or-email, dummy-hash timing-safe-equivalent
  compare on unknown users, blocks suspended/deactivated accounts,
  flips a leftover `invited` status to `active` on first real login),
  logout (revokes the *current* session only), refresh, revoke (works
  without a valid access token -- revokes by refresh token directly,
  idempotent), `GET /me`, `GET /status` (never 401s -- for UI that
  branches on auth state), `PATCH /me` (+ dedicated `/me/avatar`,
  `/me/display-name`, `/me/email` -- email change requires current
  password and resets `email_verified`), `POST /me/deactivate` (soft
  delete, requires password, revokes every session), `POST
  /change-password` (requires current password, revokes every session
  including the one making the request -- verified live that the
  access token used to make the change stops working immediately
  after), password-reset request/confirm and email-verification
  request/confirm (token issuance + validation only, no email ever
  sent -- see "Architecture Decisions" below).
- **`routers/sessions.py`**: list (with `is_current` computed by
  comparing each row's id to the requesting token's `sid` claim, not a
  stored column), current, revoke-one (404s if the session doesn't
  belong to the caller -- can't be used to probe other users' session
  ids), revoke-others, logout-all. All verified live.
- **`auth_dependencies.py`**: `get_current_user` /
  `get_current_user_optional` / `get_current_user_and_session`
  (authentication); `require_membership` / `require_role` /
  `require_permission` / `require_owner` / `require_admin`
  (authorization factories -- call with e.g.
  `Depends(require_permission("manage_members"))`, they read
  `project_id` off the route's own path params). Every authorization
  check delegates to session 5/6's `project_helpers.py` functions --
  no permission logic duplicated anywhere in this new code.
- **Authorization wired into the existing collaboration routers** (see
  CHANGELOG.md for the exact per-endpoint mapping) --
  `project_members.py`, `project_invitations.py`, `roles.py`,
  `permissions.py`. Verified live with a real 3-user, 1-project
  scenario: Owner succeeds at everything; a `Member`-role user is
  blocked (403) from `manage_members`/`invite_members` actions but can
  still read; a non-member is blocked (403) from reading; an anonymous
  caller gets 401; only the actual Owner can transfer ownership;
  invitation accept-by-token still works fully unauthenticated.
- **Schema**: `User` gained 5 additive nullable columns (see
  CHANGELOG.md "Extended"). `password_hash`/`auth_provider`/
  `external_auth_id`/`Session` needed zero changes -- session 5's
  "future-ready" design held up exactly as intended.

## Created Files
- `backend/app/security.py`
- `backend/app/auth_dependencies.py`
- `backend/app/routers/auth.py`
- `backend/app/routers/sessions.py`

## Modified Files
- `backend/app/models.py` -- `User` gained
  `email_verified`/`email_verification_token`/
  `email_verification_expires_at`/`password_reset_token`/
  `password_reset_expires_at`; updated stale docstrings on
  `AuthProvider`/`Session` that described them as "not used yet."
- `backend/app/schemas.py` -- added the auth schema block (see
  CHANGELOG.md); fixed a stale "Not yet wired to any router" comment on
  `ProjectCollaborationSummary` (it was wired, by session 6).
- `backend/app/main.py` -- registered `auth.router`/`sessions.router`
  first among the collaboration layer.
- `backend/app/routers/project_members.py`,
  `backend/app/routers/project_invitations.py`,
  `backend/app/routers/roles.py`,
  `backend/app/routers/permissions.py` -- added authorization
  dependencies (see CHANGELOG.md for the exact mapping per endpoint).
- `backend/requirements.txt` -- added `pyjwt`, `passlib[bcrypt]`,
  `bcrypt`.
- `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `CHANGELOG.md` -- updated to
  describe the implemented auth system (see each file's own diff for
  detail; ARCHITECTURE.md's old "Authentication Preparation" section
  is now "Identity & Security Architecture").

## Architecture Decisions
- **Refresh tokens are opaque, not JWTs.** A JWT refresh token would be
  self-validating (no DB hit needed) but that's exactly the problem: it
  can't be revoked before its own expiry without a blocklist. An opaque
  token that must be looked up by hash against `Session.refresh_token_hash`
  is trivially revocable (delete/flag the row) and trivially rotatable,
  at the cost of one indexed DB query per refresh -- refresh happens far
  less often than access-token use, so that cost is fine.
- **Access tokens are stateless JWTs, not opaque.** The opposite
  tradeoff on purpose: access tokens are used on almost every request,
  so avoiding a DB hit to validate the signature matters. Revocability
  is recovered by keying every access token to a Session id (`sid`
  claim) and having `get_current_user` check that Session's `revoked`/
  `expires_at` on every request anyway (needed regardless, to support
  session listing/revocation) -- so revocation propagates to already-
  issued access tokens without a separate blocklist table.
- **Password reset / email verification are real, working
  token-issuance-and-validation flows with no email delivery.** This
  matches the task brief's literal wording ("Password Reset
  Preparation" / "Email Verification Preparation") -- not stub
  endpoints, not commented-out code, but a mechanism a future mail
  integration can slot into by adding one `send_email(...)` call at
  the point the token is generated. The `debug_reset_token`/
  `debug_verification_token` response fields only populate when
  `AUTH_DEBUG_EXPOSE_TOKENS=true` is set, so this can't silently leak
  tokens in a real deployment by default.
- **`AUTH_SECRET_KEY` has a fallback dev value** so the app still boots
  without configuration (matching every other "reads from env, falls
  back to a working default" pattern already in this codebase for a
  single-user local app) -- but the fallback string is written to be
  obviously not a real secret (`"dev-insecure-secret-key-change-in-
  production"`) so it can't be mistaken for one, and any real deployment
  must set the env var per ENGINEERING_GUIDELINES.md "Security."
- **Login timing-safe comparison against unknown users**: even when
  `username_or_email` matches no `User`, `login()` still runs a full
  bcrypt verify against a fixed dummy hash before returning 401, so
  "no such user" and "wrong password" take statistically
  indistinguishable time -- otherwise measuring response latency alone
  could enumerate registered accounts.
- **`change_password`/`deactivate_account`/`password-reset/confirm`
  all revoke every Session for that user** (change-password revokes
  including the very session making the request). This is the standard
  "a password is no longer trustworthy, force re-auth everywhere"
  defense -- verified live that the access token used to *make* a
  password-change call stops working on its very next use.
- **`project_members.py`'s `/leave` endpoint** now requires the caller
  to either be the `user_id` being removed, or a project Admin/Owner
  acting on someone else's behalf -- previously (session 6) this took
  an unauthenticated `user_id` query param with no ownership check at
  all, since there was no `current_user` to compare against yet.
- **`project_invitations.py`'s `create_invitation` now ignores the
  request body's `invited_by_user_id`** in favor of the authenticated
  caller's own id -- session 6 had accepted (and merely existence-
  validated) whatever id the client sent, since there was no
  authenticated caller to default to yet.
- **`roles.py`/`permissions.py` global (non-project-scoped) catalog
  mutations require only authentication, not any special "admin"
  role** -- this app has no platform-admin/superuser concept
  (deliberately, per "Do NOT introduce Workspace"), so any logged-in
  user can extend the shared permission/role catalog, while
  project-specific custom roles are locked to that project's own
  Admin/Owner.

## Known Issues / Things To Watch
- No email is ever sent for password reset or email verification --
  this is intentional scope (see "Architecture Decisions" above), not
  an oversight, but it means neither flow is usable end-to-end from a
  real user's perspective yet. A future session wiring up actual email
  delivery just needs to call a mailer at the point
  `request_password_reset`/`request_email_verification` generate their
  token, using the same `user.email` already on hand.
- No OAuth/SSO/MFA, matching the task brief's explicit exclusion list.
  `AuthProvider.google`/`github`/`other` remain unused enum values.
- No admin/support tooling to reverse a `deactivate_account` soft
  delete -- the column supports it (`status` can be set back to
  `active`), but there's no endpoint that does so yet, since no
  privileged-operator concept exists in this app yet either.
- `AUTH_SECRET_KEY` is not set by default -- fine for this local
  single-user app, but must be set via environment variable before any
  real/shared/cloud deployment, or every previously-issued JWT becomes
  forgeable the moment the fallback value is guessed (it's public, in
  this very file).
- Rate limiting on `/login`/`/register`/`/password-reset/request`
  (brute-force / enumeration protection beyond the timing-safe compare
  and generic response message already in place) does not exist --
  reasonable for a local single-user app, a real gap before any
  internet-facing deployment.

## Testing Completed
- `python -m py_compile` on every new/modified backend file: clean.
- **Live `TestClient` boot**: `/openapi.json` loads (139 route paths /
  221 operations, up from session 6's count with the new auth/sessions
  routes added), zero 500s across every no-path-param `GET` endpoint,
  `/api/dashboard`/`/api/tasks`/`/api/projects` (pre-existing routers)
  all still respond normally -- no regressions.
- **Live auth flow**: register (+ duplicate-username 409,
  duplicate-email 409, weak-password 422), login (+ wrong-password 401,
  nonexistent-user 401), `/me` (+ no-token 401), `/status`
  (authenticated + anonymous), refresh (+ reused-old-token-after-
  rotation correctly 401), change-password (+ session correctly
  invalidated immediately after, including the session that made the
  call).
- **Live sessions flow**: register + a second `login` (simulating a
  second device) both create distinct Session rows; `list` shows both
  with correct `is_current`; `revoke-others` revokes the non-calling
  session (verified its access token 401s afterward) while leaving the
  calling one valid; `logout-all` then revokes everything (verified the
  calling session's own access token also 401s on its next use).
- **Live authorization matrix**: 3 registered users (owner/member/
  outsider) + 1 real project with `owner_id` set. Owner: create
  invitation succeeds, add member succeeds, transfer-ownership
  succeeds. Member (assigned the seeded "Member" role, which has no
  `manage_members`/`invite_members` permission): add-member 403,
  create-invitation 403, transfer-ownership 403; list-members (has
  `view_members`) succeeds. Outsider (not a project member at all):
  list-members 403, add-member 403. Anonymous (no token): add-member
  401. Token-scoped invitation accept: fully unauthenticated, still
  succeeds, creates the invitee's `User` + `ProjectMember` exactly as
  session 6 built it.
- **Not completed this session**: no pytest test *files* were written
  (all verification above was ad-hoc `TestClient` scripts run and
  discarded, not committed test suites) -- flagging this explicitly per
  ENGINEERING_GUIDELINES.md's own honesty expectations, since
  "verified live" and "has a regression suite" are different claims.

## Remaining Work (per task brief, next sessions)
Backend Identity & Security is now complete per this session's brief.
Explicitly not started (per this session's own "DO NOT IMPLEMENT" list
and session 5/6's longer-range roadmap):

Frontend authentication (login/register pages, protected routes, an
auth context/store wired to `/api/auth/*`), member management UI,
project collaboration UI, settings pages, OAuth/SSO/MFA, cloud sync,
realtime collaboration, actual email delivery for password reset /
email verification, rate limiting, and a committed automated test
suite (this session's testing was live but ad-hoc, not a pytest
suite left behind in the repo).

---

---

## Session 7 -- Backend Stabilization & Security Audit

### Completed Review
- Full backend audit: `py_compile` + `pyflakes` on every backend file, live `TestClient` boot, RBAC review of every router, dead-code/unused-import sweep.
- Confirmed app boots clean and OpenAPI still reports 139 paths / 221 operations (no routes lost) after all changes.

### Issues Found
1. **RBAC gap (major):** every Project Workspace / AI Workspace content router (`todos`, `milestones`, `phases`, `bugs`, `features`, `documents`, `project_resources`, `conversations`, `ai_handoffs`, `knowledge_articles`, `project_zips`, `timeline`, plus the project-scoped endpoints in `activity` and `analytics`) had zero auth checks, despite the `Permission` catalog already defining the exact keys needed for them. Several `list` endpoints also treated `project_id` as an optional filter, so omitting it returned every project's rows.
2. **Root cause (critical):** `routers/projects.py`'s `create_project` never set `Project.owner_id`, so no project ever had a recognized owner -- the entire RBAC system built in session 6 had nothing to check ownership against. `list_projects`/`get_project`/`update_project`/`delete_project`/`get_workspace_summary` were also all fully open (any project, to anyone).
3. **Security bug:** `owner_id` was a client-settable field on `ProjectCreate` and `ProjectUpdate` (inherited from the shared `ProjectBase`/`ProjectOut` schema). Any caller with `manage_project` could have silently reassigned project ownership via a plain `PATCH`, bypassing `project_members.transfer_ownership`'s dedicated flow.
4. **Response bug:** `serialize_project` built a hand-written dict that omitted `owner_id`, `visibility`, `collaboration_enabled`, `project_type` -- present on the model and schema, but every API response silently showed schema defaults for them instead of the real DB values.
5. **Global Search / `projects.py` `/search` leak:** returned matches from every project in the system regardless of the caller's membership.
6. Four unused imports (confirmed via `pyflakes`, not guessed): `security.py`, `routers/ai_analytics.py`, `routers/auth.py`, `routers/user_preferences.py`.

### Issues Fixed
All of the above. See CHANGELOG.md's "Backend Stabilization & Security Audit" entry for the full breakdown of exactly what changed in each file.

### Files Modified
`auth_dependencies.py`, `project_helpers.py`, `routers/projects.py`, `routers/todos.py`, `routers/milestones.py`, `routers/phases.py`, `routers/bugs.py`, `routers/features.py`, `routers/documents.py`, `routers/project_resources.py`, `routers/conversations.py`, `routers/ai_handoffs.py`, `routers/knowledge_articles.py`, `routers/project_zips.py`, `routers/timeline.py`, `routers/activity.py`, `routers/analytics.py`, `routers/search.py`, `security.py`, `routers/ai_analytics.py`, `routers/auth.py`, `routers/user_preferences.py`.

### Implementation Notes
- New `auth_dependencies.require_project_access(db, user, project_id, permission_key=None)`: an inline counterpart to the existing `require_membership`/`require_permission` `Depends` factories, for routers whose `project_id` isn't a path parameter (i.e. every Project Workspace content router -- none of them nest under `/api/projects/{project_id}/...`). Same owner-or-permission logic, called directly inside the handler once `project_id` is known by whatever means that handler already uses (query param for lists, the fetched row's field for get/update/delete, the request body for create).
- New `project_helpers.get_accessible_project_ids(db, user_id)`: owned + active-membership project ids, used by `search.py` and `projects.py`'s own search/list/summary endpoints.
- `conversations.py`, `ai_handoffs.py`, `knowledge_articles.py` have a *nullable* `project_id` by design (personal, unscoped AI Workspace items are allowed) -- the new checks only apply when `project_id` is actually set on the row/payload, so personal AI Workspace usage is untouched.
- Deliberately did **not** touch the personal/single-user routers (`tasks`, `subjects`, `notes`, `assignments`, `resources`, `study_sessions`, `timetable`, `prompt_templates`, `token_trackers`, `ai_accounts`, `dashboard`, `ai_analytics`'s global summary) -- these have no `project_id`/`user_id` at all and are personal data by the app's existing single-user design, not a gap.
- `search.py`'s `ai_analytics.py`-style global aggregate endpoints (`/overview` in `analytics.py`, the global summary in `ai_analytics.py`) were also left open -- they roll up across every project by design (like `dashboard.py`) and have no single project to gate against; flagging this as a known, accepted scope boundary rather than silently deciding it either way.

### Regression Testing Performed
Live `TestClient` runs against a clean SQLite DB (no committed pytest suite added this session, consistent with session 6's own noted gap):
- 2 registered users (owner + outsider) + 1 project. 30 targeted checks across every newly-wired router: owner create/read/write succeeds (201/200), non-member gets 403, anonymous gets 401, personal/unscoped routes (`tasks`, `dashboard`, unscoped conversations) remain open exactly as before.
- Confirmed a forged `owner_id` in the create/update payload is ignored (actual owner is always the authenticated caller / never changes via `PATCH`).
- Confirmed `serialize_project` now returns real `owner_id`/`visibility`/`collaboration_enabled`/`project_type` values.
- Confirmed pre-existing session 6 routers (`roles`, `project_members`, `project_invitations`, `permissions`, `auth` sessions) still function correctly end-to-end.

### Known Issues / Residual Scope (unchanged from session 6, plus one addition)
- No committed pytest test suite (all verification above is ad-hoc `TestClient` scripts, not left in the repo) -- same gap session 6 flagged, still true.
- Global Search and the workspace summary now scope every *project-tied* result type to the caller's accessible projects, but personal/global entity types (Task, Subject, Note, etc.) remain unscoped by design, matching the rest of the app.
- OAuth/SSO/MFA, cloud sync, realtime collaboration, real email delivery, and rate limiting are all still not implemented -- unchanged from session 6's "Remaining Work", not addressed this session (out of scope per this session's own brief).

---

This file represents the current engineering state of the project and should always reflect reality.

If anything changes during development, update this file before ending the session.

---

## Session 8 -- Identity & Security: Frontend Identity Layer (Conversation 5)

### Context
Backend Identity & Security (session 3, hardened in session 7) was
already complete: `/api/auth/*` (register, login, logout, refresh,
revoke, `/me` + sub-resource PATCHes, deactivate, change-password,
password-reset request/confirm, email-verification request/confirm)
and `/api/auth/sessions/*` (list, current, revoke, revoke-others,
logout-all). This session builds the frontend that talks to it. Per
the task brief: frontend Identity layer only -- no Member Management,
Invitations UI, Roles UI, Permissions UI, or Project Settings (those
are Conversation 6), no backend/database changes.

### Completed Work
- Read every required doc (PROJECT_CONTEXT.md, ARCHITECTURE.md,
  DATABASE_SCHEMA.md, ENGINEERING_GUIDELINES.md, SYNC_ARCHITECTURE.md,
  AI_HANDOFF.md, CHANGELOG.md) and the actual backend
  (`schemas.py`'s Identity & Security section, `routers/auth.py`,
  `routers/sessions.py`, `security.py`'s constants/password policy,
  `auth_dependencies.py`'s session-revocation checks) before writing
  any frontend code, per the task brief's "BEFORE WRITING CODE".
- Auth token engine: `lib/authClient.ts` (new) + `lib/api.ts`
  (extended). Access token in memory only; refresh token in
  `localStorage`/`sessionStorage` depending on Remember Me.
  `request()`/`requestForm()` now attach `Authorization: Bearer` and
  silently refresh-and-retry once on a 401 (single-flight, so
  concurrent 401s share one rotation). Added every `/api/auth/*` and
  `/api/auth/sessions/*` call to `api.*`.
- `context/AuthContext.tsx` (new): `AuthProvider`/`useAuth()`. Restores
  session on mount, proactively rotates the access token ~2 minutes
  before its 30-minute expiry, exposes `login`/`register`/`logout`/
  `updateUser`/`refresh`.
- `components/auth/ProtectedRoute.tsx` (new): gates the app; loading
  shell during restore, redirect-with-return-path otherwise.
  `RedirectIfAuthenticated` for the reverse case on the auth pages.
- Full page set: Login (Remember Me), Register (live password-strength
  UI), ForgotPassword, ResetPassword (token from query string),
  VerifyEmail (dual-mode: confirm-by-token, or status/resend for a
  signed-in user), Profile (profile fields, email change requiring
  current password, password change, session list + revoke/revoke-
  others/logout-all, deactivate account).
- Shared components: `AuthShell`, `PasswordInput`, `PasswordStrengthMeter`
  (mirrors `security.py`'s `_PASSWORD_RULES` exactly), `FormAlert`,
  `AuthErrorState` (401/403/expired/invalid-token/server-unavailable),
  `SessionRow`.
- `hooks/useSessions.ts` (new): React Query hooks for the sessions list
  and its three mutations, following the existing `useTasks.ts`
  invalidate-on-success pattern.
- `App.tsx` (extended): public Identity routes outside `AppLayout`,
  the existing route tree now wrapped in one `ProtectedRoute`, new
  `/profile` route. All still route-level code-split via `lazy()`.
- `components/layout/Sidebar.tsx` / `TopBar.tsx` (extended): account
  footer with avatar/name/profile-link/sign-out in the sidebar; a
  profile avatar link in the top bar for mobile (where the sidebar is
  hidden and the bottom `MobileNav` was left untouched rather than
  adding an 8th icon).
- `types/auth.ts` (new): `User`, `Session`, and every auth request/
  response shape, kept separate from the large `types/index.ts` per
  ENGINEERING_GUIDELINES.md's modularity rule.

### Created Files
```
frontend/src/types/auth.ts
frontend/src/lib/authClient.ts
frontend/src/context/AuthContext.tsx
frontend/src/hooks/useSessions.ts
frontend/src/components/auth/ProtectedRoute.tsx
frontend/src/components/auth/AuthShell.tsx
frontend/src/components/auth/PasswordInput.tsx
frontend/src/components/auth/PasswordStrengthMeter.tsx
frontend/src/components/auth/FormAlert.tsx
frontend/src/components/auth/AuthErrorState.tsx
frontend/src/components/auth/SessionRow.tsx
frontend/src/pages/auth/Login.tsx
frontend/src/pages/auth/Register.tsx
frontend/src/pages/auth/ForgotPassword.tsx
frontend/src/pages/auth/ResetPassword.tsx
frontend/src/pages/auth/VerifyEmail.tsx
frontend/src/pages/Profile.tsx
```

### Modified Files
```
frontend/src/lib/api.ts               (Authorization header + 401 refresh-retry + auth API surface)
frontend/src/App.tsx                  (AuthProvider, public auth routes, ProtectedRoute wrap, /profile route)
frontend/src/components/layout/Sidebar.tsx  (account footer)
frontend/src/components/layout/TopBar.tsx   (mobile profile avatar link)
CHANGELOG.md
AI_HANDOFF.md
```

### Architecture Decisions
- **Access token in memory, refresh token in Storage.** The short-lived
  (30 min) access token is never persisted, so it can't be read by
  storage inspection; only the long-lived (30 day) refresh token is,
  and which Storage it goes in is decided once, at login/register time,
  by the Remember Me checkbox.
- **`lib/authClient.ts` exists to avoid a circular import.**
  `lib/api.ts`'s 401 interceptor needs to trigger a refresh and know
  the current token; `context/AuthContext.tsx` needs to react to a
  refresh that failed (session truly over) or one that happened in the
  background (401-triggered, not the proactive timer). Neither can
  import the other directly (api.ts is used by contexts and hooks;
  AuthContext would need to import api.ts's request internals), so
  both import this third, dependency-free module instead.
- **Two refresh code paths, same backend call.** `AuthContext.refresh()`
  (proactive, scheduled ~2 min before expiry) and `api.ts`'s
  `refreshAccessToken()` (reactive, on a 401) both call
  `POST /api/auth/refresh` directly rather than sharing one function,
  because the proactive path needs the full `TokenResponse` to update
  `user` and reschedule its own timer, while the reactive path only
  needs "did this work, yes/no" to decide whether to retry the
  original request. Both write through the same `authClient.ts`
  storage functions, so they can't disagree about what's persisted.
- **`schemas.UserOut` fields drive the Profile form, not a separate
  "editable fields" allowlist** -- `ProfileUpdateRequest` already
  restricts what `PATCH /api/auth/me` accepts, so the frontend doesn't
  duplicate that validation; it just doesn't render fields the backend
  won't accept (e.g. no `status`/`auth_provider` editing UI).
- **Theme select was deliberately left out of Profile**, even though
  `ProfileUpdateRequest.theme` exists on the backend -- the existing
  Settings.tsx already states, honestly, that only one dark theme is
  implemented; adding a working-looking theme picker on Profile would
  contradict that. A note in its place says so instead.

### Known Issues / Things To Watch
- ~~**`schemas.UserOut` never exposes `email_verified`**~~ **Fixed in
  session 9** (see "Session 9" section below) -- `UserOut` now
  includes the field and the frontend renders a real verified/
  unverified state.
- No email is actually sent for password reset / email verification
  (unchanged from the backend's own documented scope) -- the dev-only
  `debug_reset_token`/`debug_verification_token` fields (populated only
  when the backend has `AUTH_DEBUG_EXPOSE_TOKENS=true`) are surfaced in
  `ForgotPassword.tsx`/`VerifyEmail.tsx` as a clickable dev link, purely
  so the flow is testable without a mail server. Remove that UI (or
  gate it behind an env check) before any real deployment where that
  env var might accidentally be set.
- `useLogoutAllDevices` (in `hooks/useSessions.ts`) calls the backend's
  `logout-all` (which revokes every session including the caller's own)
  and then also calls `AuthContext.logout()` (which calls
  `POST /api/auth/logout`, itself already invalid at that point). This
  is intentionally tolerated -- `AuthContext.logout()`'s own try/catch
  swallows the resulting 401 and still runs `clearSession()` in its
  `finally` -- rather than special-cased, to keep one client-side
  "sign out completely" code path.
- No automated frontend test suite (unit or e2e) was added this
  session -- verification was `tsc --noEmit`, a production build, and
  live backend `curl` smoke tests (see below), not a committed test
  suite. Flagging explicitly, matching this project's existing
  "verified live is not the same claim as has a regression suite"
  convention (see session 6/7's own Known Issues).
- Manual browser click-through of each flow (actual login/register/
  logout/refresh/profile-update/password-reset/email-verification/
  protected-route-redirect/session-revoke behavior in a real browser,
  plus mobile/tablet responsive layout) was **not** performed in this
  session -- no browser is available in this tool environment. The
  backend contract was verified live; the UI itself was not
  click-tested. Recommend a manual pass before shipping.

### Testing Completed
- `npx tsc --noEmit -p tsconfig.app.json` -- zero errors.
- `npm run build` -- production build succeeds; every new auth page
  confirmed as its own code-split chunk in the output (`Login-*.js`,
  `Register-*.js`, `ForgotPassword-*.js`, `ResetPassword-*.js`,
  `VerifyEmail-*.js`, `Profile-*.js`, plus the shared `AuthShell-*.js`/
  `PasswordInput-*.js`/`PasswordStrengthMeter-*.js`/`FormAlert-*.js`/
  `AuthErrorState-*.js` chunks).
- Live backend smoke test: ran the actual FastAPI app
  (`AUTH_DEBUG_EXPOSE_TOKENS=true uvicorn app.main:app`) and `curl`'d
  register, login, `GET /me` with a valid token (200, matches
  `types/auth.ts`'s `User` exactly) and with no token (401, confirms
  `lib/api.ts`'s interceptor has something real to react to),
  `GET /api/auth/sessions` (`is_current` correctly true only for the
  session behind the token used), and `POST /api/auth/password-reset/
  request` (debug token returned in dev mode, matching
  `PasswordResetRequestOut`). No response shape drift found between
  the live backend and the frontend's TypeScript types.
- Not run: real browser session (see "Known Issues" above).

### Remaining Work (per task brief, next session)
Conversation 6: Project Collaboration frontend (Member Management,
Invitations, Roles, Permissions UI, Project Settings), built on top of
this session's `useAuth()`/`ProtectedRoute()`/`api.*` auth surface.
The `email_verified` backend fix mentioned below was completed in
session 9 (see that section).

---

# Session 9 -- Identity Integration Fix Pass

Task brief: a small integration-fix pass between the session 8
frontend Identity layer and the session 3/7 backend Identity APIs.
Fix the one verified issue (`schemas.UserOut` missing
`email_verified`), then audit the rest of the contract. Explicitly
not Conversation 6, not a redesign, not new features.

### Completed Work
- Read PROJECT_CONTEXT.md, ARCHITECTURE.md, DATABASE_SCHEMA.md,
  ENGINEERING_GUIDELINES.md, SYNC_ARCHITECTURE.md, AI_HANDOFF.md, and
  CHANGELOG.md, then inspected the actual backend/frontend code before
  making changes, per the task brief.
- **Fixed the verified issue:** added `email_verified: bool = False`
  to `schemas.UserOut` in `backend/app/schemas.py`. Since
  `TokenResponse.user`, `AuthStatusOut.user`, and every `/me`/`/me/*`
  endpoint already return `UserOut`, this alone fixes `/register`,
  `/login`, `/refresh`, `/me`, `/status`, all `/me/*` PATCHes, and
  `/email-verification/confirm` -- no per-endpoint changes needed.
- Updated `frontend/src/types/auth.ts`'s `User` to include
  `email_verified: boolean`.
- Updated `frontend/src/pages/auth/VerifyEmail.tsx`: `StatusView` now
  branches on `user.email_verified` to show a real verified state
  (hiding the resend UI) instead of always offering to send a link;
  `ConfirmView` now calls `updateUser()` with the confirm endpoint's
  returned user so a freshly-verified user's local state updates
  without a reload.
- Updated `frontend/src/pages/Profile.tsx`: the Email card now shows a
  Verified/Unverified `Badge` and hides the "Verify email" link once
  already verified.
- Audited the Identity frontend/backend contract: every `lib/api.ts`
  Identity call against `routers/auth.py`/`routers/sessions.py`'s
  actual paths; `types/auth.ts`'s request/response interfaces against
  the corresponding `schemas.py` classes; `UserStatus`/
  `AuthProviderType` against `models.UserStatus`/`models.AuthProvider`;
  `PasswordStrengthMeter.tsx` against `security.py`'s
  `_PASSWORD_RULES`; `AuthContext.tsx`/`ProtectedRoute.tsx`'s
  login/register/refresh/logout wiring against their backend calls.
  No further mismatches found.

### Modified Files
```
backend/app/schemas.py                      (UserOut gained email_verified)
frontend/src/types/auth.ts                  (User gained email_verified)
frontend/src/pages/auth/VerifyEmail.tsx     (state-dependent verified UI)
frontend/src/pages/Profile.tsx              (Verified/Unverified badge)
CHANGELOG.md
AI_HANDOFF.md
```

### Known Issues / Things To Watch
- **Live validation was not performed** -- this sandbox has no network/
  package access, so `pip install`/`npm install` failed and neither a
  live `uvicorn` boot + OpenAPI load, nor `npx tsc --noEmit`/
  `npm run build`, could be run. Verification here was
  `python3 -m py_compile` on the touched/related backend files plus a
  manual, line-by-line trace of every changed type's call sites.
  Recommend running the live checks (and a real browser click-through
  of the verify-email and profile flows) before shipping.
- All other Known Issues from session 8 (no email actually sent;
  `useLogoutAllDevices`'s intentional double-logout tolerance; no
  automated frontend test suite) are unchanged and still apply --
  out of scope for this fix pass.

### Testing Completed
- `python3 -m py_compile app/schemas.py app/models.py
  app/routers/auth.py app/routers/sessions.py` -- no syntax errors.
- Manual cross-reference of every `email_verified` usage across
  `types/auth.ts`, `VerifyEmail.tsx`, `Profile.tsx` -- consistent, no
  stale references left.
- Manual audit of the full Identity API surface (paths, request/
  response shapes, enums) between frontend and backend -- see
  "Completed Work" above; no issues beyond the one fixed.

### Remaining Work (next session)
Conversation 6: Project Collaboration frontend (Member Management,
Invitations, Roles, Permissions UI, Project Settings), unchanged from
session 8's handoff. Recommend a live `uvicorn`/`tsc`/`npm run build`
pass (see "Known Issues" above) whenever network/package access is
available, before shipping this fix pass.

---

# Session 10 -- Project Collaboration Frontend (Conversation 6)

Task brief: build the complete Project Collaboration frontend (Member
Management, Invitations, Roles, Permissions, Project Settings) against
the existing, production-ready backend. No backend/database redesign.
Explicitly not Hackathon Hub, Git Sync, or auth redesign.

### Completed Work
- Read PROJECT_CONTEXT.md, ARCHITECTURE.md, DATABASE_SCHEMA.md,
  ENGINEERING_GUIDELINES.md, SYNC_ARCHITECTURE.md, AI_HANDOFF.md, and
  CHANGELOG.md, then inspected every relevant backend router/schema
  (`project_members.py`, `project_invitations.py`, `roles.py`,
  `permissions.py`, `projects.py`, `users.py`, and the matching
  `schemas.py`/`models.py` sections, including the seeded permission
  keys and system roles in `main.py::_seed_collaboration_if_empty`)
  before writing any frontend code, per the task brief.
- Installed `@radix-ui/react-dropdown-menu`, `-switch`, `-avatar`,
  `-alert-dialog`, `-tooltip` (npm registry is allow-listed in this
  sandbox's network config) -- same Radix family already used for
  every other `ui/` primitive.
- **Types**: new `frontend/src/types/collaboration.ts`; extended
  `types/index.ts`'s `Project`/`ProjectInput` with `owner_id`,
  `visibility`, `collaboration_enabled`, `project_type`.
- **API layer**: extended `lib/api.ts` with `getUsers`/`getUser` and
  the full Permissions/Roles/Project-Members/Project-Invitations call
  surface -- every call's path, query params, and body verified
  line-by-line against its router (see CHANGELOG.md "Verification").
- **Hooks**: `useUsers.ts`, `usePermissions.ts`, `useRoles.ts`,
  `useProjectMembers.ts` (incl. `useCurrentMembership` -- resolves the
  signed-in user's own role/permissions client-side for hiding UI
  only, never for enforcement), `useProjectInvitations.ts`.
- **UI primitives**: `dropdown-menu.tsx`, `switch.tsx`, `avatar.tsx`,
  `alert-dialog.tsx`, `tooltip.tsx`, `checkbox.tsx`. `App.tsx` now
  wraps the router in `TooltipProvider`.
- **`components/collaboration/`**: `RoleBadge`, `ConfirmDialog`,
  `MemberRow`/`MemberList`/`MemberProfileDialog`/`InviteMemberDialog`/
  `TransferOwnershipDialog`, `InvitationRow`/`InvitationList`/
  `InvitationDetailsDialog`, `RoleCard`/`RoleList`/`RoleFormDialog`/
  `RoleDetailsDialog`, `PermissionViewer`/`PermissionMatrix`/
  `PermissionsPanel`, `ProjectSettingsGeneral`/
  `ProjectSettingsDangerZone`/`ProjectSettings`.
- **`pages/ProjectDetail.tsx`**: header gained Owner, member count,
  current-user role badge, Visibility, Project Type, Collaboration
  on/off, pending-invitation count, and a Quick Invite button; new
  "Team" tab renders `ProjectSettings` (General/Members/Invitations/
  Roles/Permissions/Danger Zone).
- `lib/collaborationMeta.ts` -- badge metadata + `initialsOf`/
  `titleCase` helpers, mirroring `lib/projectMeta.ts`'s shape.

### Created Files
```
frontend/src/types/collaboration.ts
frontend/src/lib/collaborationMeta.ts
frontend/src/hooks/useUsers.ts
frontend/src/hooks/usePermissions.ts
frontend/src/hooks/useRoles.ts
frontend/src/hooks/useProjectMembers.ts
frontend/src/hooks/useProjectInvitations.ts
frontend/src/components/ui/dropdown-menu.tsx
frontend/src/components/ui/switch.tsx
frontend/src/components/ui/avatar.tsx
frontend/src/components/ui/alert-dialog.tsx
frontend/src/components/ui/tooltip.tsx
frontend/src/components/ui/checkbox.tsx
frontend/src/components/collaboration/RoleBadge.tsx
frontend/src/components/collaboration/ConfirmDialog.tsx
frontend/src/components/collaboration/MemberRow.tsx
frontend/src/components/collaboration/MemberList.tsx
frontend/src/components/collaboration/MemberProfileDialog.tsx
frontend/src/components/collaboration/InviteMemberDialog.tsx
frontend/src/components/collaboration/TransferOwnershipDialog.tsx
frontend/src/components/collaboration/InvitationRow.tsx
frontend/src/components/collaboration/InvitationList.tsx
frontend/src/components/collaboration/InvitationDetailsDialog.tsx
frontend/src/components/collaboration/RoleCard.tsx
frontend/src/components/collaboration/RoleList.tsx
frontend/src/components/collaboration/RoleFormDialog.tsx
frontend/src/components/collaboration/RoleDetailsDialog.tsx
frontend/src/components/collaboration/PermissionViewer.tsx
frontend/src/components/collaboration/PermissionMatrix.tsx
frontend/src/components/collaboration/PermissionsPanel.tsx
frontend/src/components/collaboration/ProjectSettingsGeneral.tsx
frontend/src/components/collaboration/ProjectSettingsDangerZone.tsx
frontend/src/components/collaboration/ProjectSettings.tsx
```

### Modified Files
```
frontend/src/types/index.ts          (Project/ProjectInput collaboration fields)
frontend/src/lib/api.ts              (users + collaboration API surface)
frontend/src/App.tsx                 (TooltipProvider wrap)
frontend/src/pages/ProjectDetail.tsx (header + Team tab)
frontend/package.json / package-lock.json (5 new Radix deps)
CHANGELOG.md
AI_HANDOFF.md
```

### Architecture Decisions
- Member Management lives inside the "Team" tab's `ProjectSettings`
  component rather than as a second, separate implementation --
  `ProjectSettings`'s "Members" sub-tab *is* the Member Management
  interface the brief asked for, satisfying both requirements from one
  component tree.
- User identity is resolved client-side (`useUsers({ limit: 200 })` +
  `Map` lookup) since `ProjectMemberOut`/`ProjectInvitationOut` only
  carry `user_id`s -- no backend change was needed or made.
- All destructive/authorization-sensitive actions call the backend
  directly; `useCurrentMembership` only decides what to *render*.

### Known Issues / Things To Watch
- **No live browser click-through was performed** -- no running
  backend/frontend dev server in this sandbox. `npx tsc --noEmit` and
  `npm run build` both pass clean, and every new API call was
  cross-checked path-by-path against its router, but a manual pass
  through invite -> accept -> role change -> transfer ownership ->
  remove -> leave (and the Danger Zone delete-project flow) in a real
  browser is recommended before shipping.
- "Resend invitation" is intentionally UI-only (disabled menu item),
  matching the task brief ("prepare UI only").
- No route/page exists yet for an invitee to actually land on
  `/invitations/{token}` and accept/reject without already being an
  active project member with dashboard access -- the token-scoped
  accept/reject API calls exist in `lib/api.ts` but aren't wired to
  any page. Out of scope for this session (email sending itself is
  also out of scope, per the backend's own docstring), but worth
  flagging for whoever eventually adds an invite email.
- Session 8/9's Known Issues (no email sending; `useLogoutAllDevices`'s
  intentional double-logout tolerance; no automated frontend test
  suite) are unchanged and still apply.

### Testing Completed
- `npx tsc --noEmit -p tsconfig.app.json` -- clean, zero errors.
- `npm run build` -- succeeds (pre-existing >500kB chunk-size warning
  only; not a new regression, same warning present before this
  session's changes).
- Manually cross-checked every new `lib/api.ts` call's path, query
  params, and body against `project_members.py`, `project_invitations.py`,
  `roles.py`, `permissions.py`, `users.py`.
- Verified the permission keys/role names used in frontend UI logic
  (`manage_members`, `invite_members`, `manage_roles`, and the
  Owner/Admin/Member/Viewer role names) against
  `main.py::_seed_collaboration_if_empty`'s actual seed data.

### Remaining Work (next session -- Conversation 7)
Per the task brief, Conversation 7 is scoped to:
- Dashboard integration (e.g. a "pending invitations" and/or "your
  projects by role" widget on the main Dashboard)
- Final UI polish pass
- End-to-end QA (ideally with a live server -- see "Known Issues")
- Performance review
- Documentation review
- Release packaging

No Project Collaboration frontend work is outstanding beyond that --
Members, Invitations, Roles, Permissions, and Project Settings are all
built, wired to the live backend, and typecheck/build clean.

---

# Conversation 7 -- Release Audit & Polish

Per the task brief, this session was **audit-only**: no new features,
no architecture/database changes. Goal was to genuinely review the
project (not invent issues) and prepare a Version 1.0 Release
Candidate.

### Sandbox Constraint (read this first)

This session's sandbox had **no outbound network access** and no
`node_modules`/`venv` were included in the uploaded archive, so
`npm install`, `pip install`, `npm run build`, `npx tsc --noEmit`, and
booting the backend were **not possible**. Everything below is a
*static* review (reading source, grepping for known-bad patterns,
cross-checking docs against code) rather than a live-run verification.
The last session that could actually run `tsc`/`npm run build`
(Conversation 6, per its own Testing Completed section) reported both
clean. **Before tagging a real `v1.0.0`, run `npm install && npm run
build && npx tsc --noEmit` in `frontend/`, `pip install -r
requirements.txt` and boot `uvicorn app.main:app` in `backend/`, and do
one manual click-through of: register -> login -> Dashboard -> Study
Hub -> Project Workspace (incl. Team tab / invite / role change) -> AI
Workspace -> Settings -> logout.**

### Review Areas Completed

**Documentation review** -- Issues found: `README.md` had drifted
significantly out of sync with the shipped app (still described it as
having "no auth/accounts", listed only 3 of ~30 backend routers, and
didn't mention Project Collaboration at all). `PROJECT_CONTEXT.md` and
`ARCHITECTURE.md` were confirmed (via grep) to already be in sync from
earlier sessions -- only the GitHub-facing `README.md` needed work.
Issues fixed: rewrote the Features list, Project Structure tree,
"Running it locally" steps, added an environment-variables table, and
corrected "Known limitations." Files modified: `README.md`,
`CHANGELOG.md` (new entry), this file. Verification: manual re-read of
the edited sections against actual router/component filenames on disk.

**Security review** -- Issues found: (1) `CORSMiddleware` combined
`allow_origins=["*"]` with `allow_credentials=True`, which is
unnecessary (the app never sends credentialed/cookie-based requests --
auth is a Bearer token in the `Authorization` header) and is a
recognized CORS misconfiguration pattern. (2) No other issues: password
hashing (bcrypt via passlib), JWT signing key sourced from
`AUTH_SECRET_KEY` env var with an obviously-fake documented fallback,
refresh tokens stored only as SHA-256 hashes, no hardcoded secrets
found anywhere via grep, no `.env` files committed. Issues fixed: set
`allow_credentials=False`, documented why in a code comment; verified
via grep that no frontend `fetch` call sets `credentials: "include"`
anywhere, so this is a safe, behavior-preserving fix. Files modified:
`backend/app/main.py`. Verification: grep across `frontend/src` for
`credentials:` returned no matches.

**Code quality / release hygiene** -- Issues found: (1) No
`.gitignore` existed anywhere in the repository -- the SQLite DB,
`node_modules`, `__pycache__`, and runtime user uploads all had no
exclusion rule. (2) `frontend/vite.config.js` and
`frontend/vite.config.d.ts` were stale *compiled* output of
`vite.config.ts` (emitted because `tsconfig.node.json` includes
`vite.config.ts` with `composite: true`), committed alongside the real
source file -- confirmed by diffing (identical content, different
formatting) and by tracing `tsconfig.node.json`'s `include`.
`tsconfig.app.tsbuildinfo` / `tsconfig.node.tsbuildinfo` build caches
were also present. (3) `backend/uploads/` contained a 2-byte leftover
test-upload artifact from manual testing. Issues fixed: added a root
`.gitignore`; deleted the three stale compiled/cache files and added
patterns to prevent recurrence; deleted the stray test upload and
added `.gitkeep` so the (now-ignored) directory still exists on a
fresh clone. Files modified/removed: `.gitignore` (new),
`frontend/vite.config.js` (deleted), `frontend/vite.config.d.ts`
(deleted), `frontend/tsconfig.app.tsbuildinfo` (deleted),
`frontend/tsconfig.node.tsbuildinfo` (deleted),
`backend/uploads/2ad80ccb...zip` (deleted) ->
`backend/uploads/.gitkeep` (new). Verification: `diff` confirmed the
deleted `.js`/`.d.ts` were functionally identical to their `.ts`
source; re-listed `frontend/src` recursively for any other `.ts(x)` /
`.js` twin pairs -- none found.

**Static code smell scan** -- Issues found: none. Grepped
`frontend/src` for `console.log`/`console.debug` (0 matches outside
`console.error`/`console.warn`), `debugger` statements (0 matches),
and hardcoded secret-shaped strings in `backend/app` (0 matches beyond
the intentionally-obvious dev fallback in `security.py`, which is
already documented and env-overridable).

### Review Areas NOT Completed (need a live environment)

These require `npm install`/`pip install` and a running dev server,
neither of which this sandbox could provide:

- Live `npm run build` / `npx tsc --noEmit` re-verification (last
  confirmed clean in Conversation 6; no frontend files that affect
  typechecking were touched this session, only `vite.config.js`/
  `.d.ts` which were dead compiled output, not source).
- Backend boot / `/docs` OpenAPI load check (no source files that
  affect backend startup were touched except the CORS
  `allow_credentials` flag, which cannot break startup).
- ESLint run (`npm run lint`) -- not attempted, same network
  constraint.
- Full manual QA click-through (Auth, Study Hub, Project Workspace,
  Project Collaboration, Dashboard, Navigation, CRUD, RBAC, Search,
  Notifications) -- see the Sandbox Constraint note above for the
  recommended pass before tagging `v1.0.0`.
- Bundle-size / performance profiling -- Conversation 6 already noted
  one pre-existing >500kB chunk warning from `npm run build`; not
  re-investigated this session since it predates this session's
  changes and splitting it would be a build-config change beyond
  "audit and polish" scope without being able to verify the rebuild
  still passes.

### Known Issues / Things To Watch (carried forward + new)

- (Carried forward, Conversation 6) No live browser click-through has
  been performed since Conversation 6 or 7 -- still recommended before
  shipping.
- (Carried forward) No invitation-email sending; no `/invitations/{token}`
  landing page for an invitee who isn't already a project member.
- (Carried forward) No automated frontend or backend test suite.
- (New, informational only) The pre-existing >500kB `npm run build`
  chunk-size warning (first noted in Conversation 6) is unchanged and
  was not addressed -- fixing it would mean introducing manual chunk
  splitting in `vite.config.ts`, which is a build-config change that
  should be verified with a real `npm run build` afterward; deferred
  since this sandbox can't run that verification.

### Release Package

A release archive was produced from the current working tree,
excluding `node_modules`, `dist`, `venv`/`.venv`, `__pycache__`,
`*.db`, and the (now-empty, gitkept) `backend/uploads/` runtime
directory's actual contents. See the chat response for the download
link.

# Session 11 -- Invitation System Completion & Notification Center (Conversation 8)

## Completed Work

**Invitation System (no SMTP):**
- Backend: creating an invitation now writes a real `Notification` to
  an existing-account invitee (email match), instead of relying on
  email delivery that was never implemented. Accept notifies the
  inviter and confirms to the new member; Reject notifies the
  inviter; Cancel notifies the invitee if they have an account.
- New `POST /api/projects/{project_id}/invitations/{invitation_id}/resend`
  endpoint: issues a fresh token, reopens pending/expired/revoked
  invitations, restarts the expiry window (reusing the original
  window length, 7-day floor if degenerate), re-notifies an
  existing-account invitee. Replaces the frontend's former "Resend
  (coming soon)" disabled menu item.
- New `GET /api/invitations/{token}` response
  (`schemas.InvitationPreviewOut`) now also returns `project_name`/
  `project_icon`/`project_color`/`invited_by_name`/`role_name` --
  needed because the invite landing page has to show this to a
  visitor who, by definition, doesn't have `view_project` access yet,
  so the existing membership-gated `GET /api/projects/{id}` can't be
  used.
- New `/invite/{token}` frontend page (`pages/InvitationLanding.tsx`):
  public route (outside both `ProtectedRoute` and
  `RedirectIfAuthenticated`, like `verify-email`). Handles pending
  (with Accept/Reject), accepted, rejected, expired, revoked, and
  invalid-token states. Signed-in visitors accept/reject directly;
  signed-out visitors get a display-name field (creates a new account
  via the existing token-accept flow) or a "sign in first" link that
  reuses `Login.tsx`'s existing `location.state.from` redirect
  pattern.
- Owner-facing UI: `InvitationRow.tsx` and `InvitationDetailsDialog.tsx`
  no longer display the raw invitation token (was previously shown
  directly in `InvitationDetailsDialog`). Both now offer "Copy invite
  link" (the full `/invite/{token}` URL) and a real "Resend
  invitation" action wired to the new endpoint, available for
  pending/expired/revoked invitations.

**Notification Center (new top-level module):**
- Backend: `models.Notification` (13-category enum, user-scoped,
  optional `project_id`/`invitation_id`/`action_url` deep links),
  `notification_helpers.create_notification()`, and
  `routers/notifications.py` (list w/ read-state/category/search
  filters, unread counts, mark read/unread, mark-all-read, delete).
  Purely additive -- no existing table touched; `Base.metadata.create_all`
  will create the new table on next boot, no migration step needed.
- Frontend: `pages/Notifications.tsx` (tabs for all/unread/read,
  category dropdown, search, mark-all-read), `NotificationRow.tsx`
  (inline Accept/Reject for `project_invitation` notifications, using
  the same token endpoints the landing page uses), `useNotificationCenter.ts`
  (React Query hooks -- deliberately NOT named `useNotifications` to
  avoid colliding with the pre-existing toast/browser-permission
  context of the same name in `NotificationContext.tsx`),
  `notificationMeta.ts` (per-category icon/label/color).
- Sidebar, MobileNav, and TopBar all got a Notifications entry/icon
  with a live unread-count badge, polling `/api/notifications/counts`
  every 30s via React Query's `refetchInterval`.
- `NotificationsWidget.tsx` added to the Dashboard (next to
  `AIWorkspaceWidget`, same self-fetching pattern -- queries directly
  rather than extending `DashboardOut`, consistent with how
  `AIWorkspaceWidget`'s own docstring explains that choice) --
  shows unread count, pending-invitation count, and the 4 most recent
  unread notifications.

## Created Files

- `backend/app/notification_helpers.py`
- `backend/app/routers/notifications.py`
- `frontend/src/types/notifications.ts`
- `frontend/src/lib/notificationMeta.ts`
- `frontend/src/hooks/useNotificationCenter.ts`
- `frontend/src/components/notifications/NotificationRow.tsx`
- `frontend/src/pages/Notifications.tsx`
- `frontend/src/components/dashboard/NotificationsWidget.tsx`
- `frontend/src/pages/InvitationLanding.tsx`

## Modified Files

- `backend/app/models.py` (added `NotificationCategory`, `Notification`,
  `User.notifications`)
- `backend/app/schemas.py` (added `NotificationOut`/`NotificationCreate`/
  `NotificationCounts`/`InvitationPreviewOut`)
- `backend/app/routers/project_invitations.py` (notification wiring on
  create/accept/reject/cancel; new `resend` endpoint; enriched
  token-GET response)
- `backend/app/main.py` (registered `notifications.router`)
- `frontend/src/lib/api.ts` (added `resendProjectInvitation` +
  full Notifications call surface; `getInvitationByToken` now typed
  as `InvitationPreview`)
- `frontend/src/types/collaboration.ts` (added `InvitationPreview`)
- `frontend/src/hooks/useProjectInvitations.ts` (added
  `useResendProjectInvitation`)
- `frontend/src/pages/Dashboard.tsx` (mounted `NotificationsWidget`)
- `frontend/src/components/layout/Sidebar.tsx`,
  `MobileNav.tsx`, `TopBar.tsx` (Notifications nav item/icon + unread
  badge)
- `frontend/src/App.tsx` (added `/invite/:token` public route and
  `/notifications` protected route)
- `frontend/src/components/collaboration/InvitationRow.tsx`,
  `InvitationDetailsDialog.tsx`, `InvitationList.tsx` (hid raw token,
  added Copy Invite Link + real Resend)

## Testing

**No live environment was available in this sandbox** (no network
egress -- `npm install` failed with `403 Forbidden` against
registry.npmjs.org, confirmed once; `pip install` would fail the same
way). Everything below is static verification only; a real boot/build
pass (see "Next Task" #5 above) is still required before shipping.

Backend:
- `python3 -m py_compile` on every touched/new backend file, and on
  the full `app/*.py app/routers/*.py` tree -- clean.
- `ast.parse()` sanity pass on the touched files -- clean.
- Manually cross-checked: `models.Project` has `name`/`icon`/`color`;
  `models.Role` has `name`; the `invite_members` permission key
  (used by the new `resend` endpoint's `require_permission` guard)
  matches every other invitation-management endpoint in the same
  router and the seed data in `main.py`.
- Confirmed `Base.metadata.create_all(bind=engine)` in `main.py` means
  the new `notifications` table needs no explicit migration.

Frontend:
- Every new/modified `.ts`/`.tsx` file (18 files) run through
  `ts.transpileModule()` using the sandbox's global `typescript`
  package (v6.0.3) in `--jsx react-jsx` mode -- this is a **syntax-only**
  check (no type resolution, since project dependencies like
  `react-router-dom`/`@tanstack/react-query`/`lucide-react` aren't
  installed in this sandbox); all 18 passed with zero diagnostics.
- Every `@/...` import path in the new/modified files resolved
  against the actual filesystem (`.ts`/`.tsx`/`index` variants) --
  all resolved, none missing.
- Manually cross-checked new imports against their target files'
  actual exports (`Tabs`/`TabsList`/`TabsTrigger`, `Badge`, `Card`/
  `CardHeader`/`CardTitle`, `Input`, `Button` size/variant props) --
  all consistent.
- **NOT verified**: real `tsc -b` type-checking (would catch prop-type
  mismatches, incorrect hook return-type usage, etc. that syntax-only
  checking cannot), `vite build`, ESLint, or any actual rendering/
  browser click-through.

## Known Issues (new this session)

See "Next Task" above -- summarized: anonymous invitation acceptance
creates a passwordless account; accept/reject-by-token doesn't verify
the signed-in session's email against the invitation's; MobileNav is
now at 8 items and hasn't been verified on a real small screen; Parts
5-8 of the task brief (mobile pass, further UX polish, placeholder
sweep, PROJECT_CONTEXT.md/ARCHITECTURE.md sync) are not done.


## Session 11 (continued) -- Parts 5-8: Mobile Optimization, UX Polish, Placeholder Sweep

### Completed Work

**Notification Center integration -- verified and hardened:**
- Confirmed (didn't need to fix) that TanStack Query's default
  prefix-matching means invalidating `["notifications"]` already
  refreshes `["notifications", "counts"]` and every filtered list
  query too -- the badges were already wired correctly.
- Found and fixed a real gap: `InvitationLanding.tsx`'s accept/reject
  and `NotificationRow.tsx`'s inline accept/reject only invalidated
  the notifications cache, not the accepting user's own project
  members/invitations cache. Both now also invalidate
  `PROJECT_MEMBERS_KEY`/`PROJECT_INVITATIONS_KEY` for the relevant
  `project_id`, so if the same browser session later opens that
  project's Team tab, the membership list is fresh rather than stale
  until the next full refetch.

**Invitation flow -- completed the loop:**
- `InviteMemberDialog.tsx` no longer closes immediately after sending
  an invitation. It now shows an inline success screen with the full
  invite link and a Copy button, since there's no email delivery --
  the previous version's own description text admitted the owner had
  to "copy the link from the Invitations tab once it's created" after
  closing the dialog, which was real, avoidable friction given the
  whole point of this task brief is a no-SMTP flow. Copy Invite
  Link and Resend (both already implemented earlier this session)
  re-verified as present and wired to the real endpoints in
  `InvitationRow.tsx` and `InvitationDetailsDialog.tsx`.
- Placeholder sweep: grepped the entire `frontend/src` tree for
  "Coming Soon", `// TODO`/`TODO:`, "Not Implemented", and
  standalone "Placeholder"/"Future feature" text (careful to exclude
  false positives like the `TaskStatus`/`AssignmentStatus` enum value
  `"todo"` and `placeholder=` input props, which are legitimate).
  Zero remaining matches outside the allowed categories (SMTP, Git
  Sync, Cloud Collaboration, Realtime Collaboration, Project
  Templates) -- none of which currently render as UI placeholders
  anyway, so there was nothing left to complete or remove.

**Mobile optimization pass -- real issues found and fixed, nothing
invented or redesigned:**
- `MemberList.tsx`: the status/role filter `<Select>`s + Invite
  button were a fixed-width, non-wrapping `flex gap-2` row that could
  overflow under ~380px. Now `flex flex-wrap`, each Select
  `w-[calc(50%-4px)] sm:w-[130px]`, Invite button `w-full sm:w-auto`.
- `pages/Notifications.tsx`: same fix for its search input + category
  `<select>` row (`flex flex-wrap`, search `flex-1 min-w-[140px]`,
  consistent `h-9` on both controls -- the native `<select>` had no
  explicit height before, which looked visually inconsistent with the
  `Input` next to it).
- `ProjectSettingsGeneral.tsx`: the Visibility/Project-type fields
  were a hard `grid-cols-2` with no mobile breakpoint -- two Selects
  plus their description text side by side would cramp badly under
  ~380px. Changed to `grid-cols-1 sm:grid-cols-2`, matching the
  pattern already used everywhere else in this file/app.
- `RoleFormDialog.tsx`: identical issue, identical fix, for the role
  name/description input pair.
- `ProjectSettingsDangerZone.tsx`: the Archive and Delete cards used
  `flex items-center justify-between` with a paragraph of
  explanatory text next to a button -- on a narrow phone this crams a
  multi-line paragraph against a vertically-centered button in the
  single most consequence-heavy part of the UI (project deletion).
  Both cards now `flex-col sm:flex-row`, with the action button
  `w-full sm:w-auto` so it reads as a clear, full-width tap target on
  mobile instead of a small pinned-right button.
- `RoleList.tsx`: header row (description text + "New role" button)
  aligned to the same `flex-col gap-2 sm:flex-row sm:items-center
  sm:justify-between` pattern `MemberList.tsx`/`InvitationList.tsx`
  already use, for consistency and to stop the button crowding the
  text on narrow screens.
- Re-confirmed (no change needed) that `components/ui/dialog.tsx`'s
  base sizing (`w-[calc(100%-2rem)] max-w-lg`, `max-h-[88vh]
  overflow-y-auto`) and `MemberRow.tsx`'s existing responsive
  hide/show breakpoints (role badge and last-active timestamp
  `hidden md:flex`, status badge `hidden sm:inline-flex`, name/email
  `truncate`) were already solid from earlier sessions -- left
  untouched rather than "fixing" things that weren't broken.
- Deliberately did NOT touch `AIWorkspaceWidget.tsx`'s `grid-cols-4`
  mini-stat grid -- pre-existing, shipped, outside this task brief's
  file list, and a 4-up grid of small square stat tiles is a
  legitimate compact-mobile pattern already used consistently (the
  new `NotificationsWidget.tsx` copies the same `grid-cols-2` idea for
  its 2 stats).

**UX polish:**
- Added a staggered fade/slide-in entrance animation
  (`framer-motion`, capped at 8 rows' worth of stagger delay so a
  long list doesn't take visibly long to finish animating in) to the
  Notifications page list.
- Added a subtle `animate-in zoom-in-95 fade-in` entrance animation
  (via the already-installed `tailwindcss-animate` plugin -- verified
  those exact utility classes are already in use in
  `components/ui/dialog.tsx`, not introducing an unverified class) to
  all three unread-count badges (TopBar bell, Sidebar nav item,
  MobileNav nav item) so a new unread notification announces itself
  visually instead of just silently appearing.
- Loading/empty/error/success states for the Notification Center and
  Invitation Landing page (built in the first half of this session)
  re-verified as present; toast feedback for copy/accept/reject/
  resend re-verified as wired through `useNotifications()`'s
  `toast()`.

### Modified Files (this continuation)

- `frontend/src/pages/InvitationLanding.tsx` (added project-cache
  invalidation on accept/reject)
- `frontend/src/components/notifications/NotificationRow.tsx` (same)
- `frontend/src/components/collaboration/InviteMemberDialog.tsx`
  (rewritten: inline invite-link success screen, responsive grid)
- `frontend/src/components/collaboration/MemberList.tsx` (responsive
  filter row)
- `frontend/src/pages/Notifications.tsx` (responsive filter row,
  staggered list animation)
- `frontend/src/components/collaboration/ProjectSettingsGeneral.tsx`
  (responsive grid)
- `frontend/src/components/collaboration/ProjectSettingsDangerZone.tsx`
  (Archive/Delete cards stack on mobile)
- `frontend/src/components/collaboration/RoleFormDialog.tsx`
  (responsive grid)
- `frontend/src/components/collaboration/RoleList.tsx` (responsive
  header row)
- `frontend/src/components/layout/TopBar.tsx`,
  `Sidebar.tsx`, `MobileNav.tsx` (badge entrance animation)

No files were created in this continuation (all new files were
created in the first half of Session 11, listed above).

### Testing Completed

Same sandbox constraint as the first half of this session -- no
network (`npm install` still returns `403 Forbidden` against
registry.npmjs.org; not re-attempted since nothing changed about the
sandbox). Static verification only:
- Every file modified in this continuation (12 files) run through
  `ts.transpileModule()` (syntax-only, same method as before) -- all
  clean.
- Import-resolution re-run across the full set of 27 files touched
  by Session 11 end-to-end (both halves) -- all `@/...` imports
  resolve to real files.
- Manually cross-checked new imports (`ProjectInvitation` from
  `types/collaboration`, `toast` from `NotificationContext`,
  `PROJECT_MEMBERS_KEY`/`PROJECT_INVITATIONS_KEY` from their
  respective hook files) against actual exports.
- Backend re-`py_compile`'d (no backend files changed this
  continuation) -- still clean.
- **NOT verified**: real `tsc -b`, `vite build`, ESLint, or any
  actual rendering/browser click-through, incl. at real mobile
  viewport widths -- everything above is reasoned from the Tailwind
  classes applied, not from seeing it render. See "Next Task" above
  for the exact live-verification steps this needs before shipping.

### Architecture Decisions

- No database changes this continuation (none were needed for Parts
  5-8).
- Continued the established pattern of invalidating by the *parent*
  query key (`PROJECT_MEMBERS_KEY`/`PROJECT_INVITATIONS_KEY` +
  `project_id`) rather than every possible child variant, matching
  how `useProjectInvitations.ts`'s own `useInvalidateInvitations`
  already did it.
- Chose CSS-utility animation (`tailwindcss-animate`'s `animate-in`
  classes, already a project dependency) over `framer-motion` for the
  three small badges, reserving `framer-motion` (already used
  throughout the app for page-level transitions) for the
  list-level stagger in Notifications -- avoids adding
  `framer-motion` overhead to three tiny, frequently-rendered badge
  elements for a purely cosmetic effect.
