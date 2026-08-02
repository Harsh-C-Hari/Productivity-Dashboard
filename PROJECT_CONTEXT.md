# PROJECT_CONTEXT.md

# Personal Productivity System

Version: MVP + Study Hub
Status: Active Development

---

# Vision

This application is a personal productivity operating system, evolving
into a collaborative Developer & Student Operating System. It began as
single-user; Projects are now collaboration-ready at the database
level (see "Project Collaboration" below), with Project remaining the
one central, collaborative container -- no separate Workspace/Team
model.

It combines:

- Study Management
- Project Management
- Resource Management
- Notes
- Timetable
- AI Workspace
- Smart Task Planning
- Git-based Synchronization

The goal is to replace multiple applications (Notion, Trello, Todo apps, project planners, note managers, etc.) with one unified offline-first application.

The application must remain clean, modular, scalable and maintainable.

---

# Core Principles

Always follow these principles.

1.

Never rewrite existing working functionality.

Always extend.

2.

Preserve backward compatibility.

3.

Reuse existing code whenever possible.

4.

Avoid duplicate logic.

5.

Every module should integrate into the Dashboard.

6.

Everything must support desktop and mobile.

7.

UI consistency is mandatory.

8.

Production-quality code only.

Never create placeholder implementations.

---

# Current Technology Stack

Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn-style components
- Framer Motion
- React Query
- React Router
- Lucide Icons
- Recharts

Backend

- FastAPI
- SQLAlchemy
- SQLite
- Pydantic

Other

- Browser Notification API
- Progressive Web App
- Glassmorphism UI

---

# Folder Structure

frontend/

backend/

uploads/

assets/

docs/

database/

scripts/

shared/

The current folder structure should be preserved.

---

# Current Modules

Implemented

✅ Dashboard

✅ Task Manager

✅ Smart Urgency Engine

✅ Notifications

✅ Weekly Timetable

✅ Study Hub

✅ PWA

Pending

⬜ Project Workspace

⬜ Project Collaboration (database foundation + backend API complete; auth/frontend pending)

⬜ Git Sync Engine

⬜ Claude Workspace

⬜ Resource Center Improvements

⬜ Calendar

⬜ Search Everywhere

⬜ Archive

⬜ Backup Manager

---

# Dashboard

The dashboard is the application's home page.

Every module should expose dashboard widgets.

Current widgets include

- Today's Tasks

- Upcoming Deadlines

- Overdue Tasks

- Recent Activity

Study Hub also contributes widgets.

Future modules must integrate similarly.

Never create isolated pages that are disconnected from the dashboard.

---

# Existing Features

Task Manager

Supports

- CRUD

- Smart urgency

- Progress

- Completion

- Notifications

Timetable

Supports

- Weekly schedule

- Editing

Study Hub

Supports

Subjects

Topics

Assignments

Notes

Resources

Study Sessions

Analytics

Pomodoro Timer

Search

Dashboard Integration

File Uploads

---

# Smart Urgency Engine

Already implemented.

Never duplicate urgency logic.

Every module requiring priority calculations must reuse the existing urgency engine.

Examples

Tasks

Assignments

Future Project Todos

Future Bugs

Milestones

All should reuse the same engine.

---

# UI Design System

Theme

Gaming-inspired Professional

Dark Theme

Glassmorphism

Purple

Blue

Cyan accents

Rounded cards

Soft shadows

Blurred panels

Smooth animations

Responsive layouts

Use existing design tokens.

Never introduce another design language.

---

# Component Rules

Always reuse existing components.

Use existing

Cards

Buttons

Dialogs

Forms

Progress

Badges

Inputs

Tabs

Never create duplicate UI primitives.

---

# Routing Rules

Follow existing routing.

Extend routing.

Never replace existing routes.

---

# API Rules

Follow existing REST conventions.

One router per domain.

Use FastAPI dependency injection.

Return consistent response formats.

Reuse existing helpers.

Avoid duplicate endpoints.

---

# Database Rules

SQLite remains the primary local database.

Do not replace SQLite.

Extend models.

Do not redesign working schema without necessity.

Use SQLAlchemy.

Relationships should remain clean.

---

# File Upload Rules

Uploads already exist.

Future modules should reuse the upload helpers.

Never create another upload implementation.

---

# Notifications

Two distinct systems exist -- both intentional, not a violation of
the "don't create another notification implementation" rule below,
which predates the second one:

1. **Toast / browser-permission context** (`context/NotificationContext.tsx`,
   `lib/notifications.ts`, `hooks/useNotificationScheduler.ts`) --
   ephemeral in-app toasts and optional OS-level push notifications.
   No persistence; nothing here is stored server-side.
2. **Notification Center** (`backend/app/models.py`'s `Notification`
   table, `routers/notifications.py`, `frontend/src/pages/Notifications.tsx`)
   -- a persisted, per-user inbox (Conversation 8 / AI_HANDOFF.md
   "Session 11"). Added because the Invitation System needed a real
   place to put in-app invitations, accept/reject actions, and a
   history a user can revisit -- a toast can't do that, it's gone
   once dismissed.

Future modules needing to notify a user of something durable (a task
reminder, a project update, a role change) should publish through the
Notification Center's `create_notification()` helper
(`backend/app/notification_helpers.py`), not build a third system.
Ephemeral, in-the-moment feedback (a toast confirming "link copied")
still belongs in the toast context, not the Notification Center.

---

# Search

Current

Study Hub Search

Future Goal

Global Search

One search box searching

Tasks

Assignments

Notes

Projects

Resources

Files

Claude Workspace

Documentation

---

# Project Workspace (Planned)

Will include

Projects

Roadmap

Current Phase

Milestones

Todo Board

Features

Bug Tracker

Progress

Documentation

Attachments

Timeline

Analytics

Dashboard Widgets

---

# Project Collaboration

Status: Database foundation, collaboration API, and backend Identity &
Security layer all complete (models + schemas + CRUD routers for
Project Members, Project Invitations, Roles, Permissions, Users, User
Preferences, Notification Preferences, a filterable Activity Log API,
reusable RBAC helper functions, and now a full authentication API --
registration, login/logout, JWT access + refresh tokens, session
management, current-user profile, password change/reset, email
verification prep -- plus authorization middleware enforcing that RBAC
on the collaboration routers). No frontend yet -- see AI_HANDOFF.md and
ARCHITECTURE.md "Project Collaboration Architecture" / "Identity &
Security Architecture".

Projects are the application's one collaborative container. There is
no separate Workspace or Team model -- a User joins a Project directly.

New tables

Users -- now includes email_verified/email_verification_token,
password_reset_token, all set by routers/auth.py

Roles (Owner / Admin / Member / Viewer defaults, extensible)

Permissions (reusable catalog)

Project Members (User <-> Project join, with role + status)

Project Invitations (email + assigned role + token, pending -> accepted/rejected/expired/revoked)

Sessions -- now actively issued/rotated/revoked by routers/auth.py + routers/sessions.py

User Preferences

Notification Preferences (per-user opt-in/opt-out on the existing notification system)

Extended (not replaced)

Project -- added owner, visibility, collaboration_enabled, project_type

Activity Log -- added optional user/project/entity references, so it can serve as the audit trail for collaboration events too (including auth events: login, logout, registration, password change, permission denied)

Future modules that build on this (Hackathon, College Project,
Startup, Research, Open Source, Freelance, Git Sync) all attach to
Project via `project_type`/`ProjectMember`, not a new top-level
container.

New API surface

`/api/auth/*` -- register, login, logout, refresh, revoke, me
(get/update/avatar/display-name/email/deactivate), change-password,
password-reset/request+confirm, email-verification/request+confirm, status

`/api/auth/sessions/*` -- list, current, revoke one, revoke-others, logout-all

`/api/projects/{project_id}/members` -- list/get/add/update/remove,
`/summary`, `/transfer-ownership`, `/leave` (membership required to
read; `manage_members` permission to add/update/remove; Owner-only to
transfer ownership)

`/api/projects/{project_id}/invitations` -- create/list/cancel/expire
(membership required to list; `invite_members` permission to create/cancel/expire)

`/api/invitations/{token}` -- get/accept/reject (token-based, for the
invitee -- deliberately left unauthenticated; the token is the credential)

`/api/roles`, `/api/permissions` -- catalog CRUD + lookup/validation
(mutations require authentication; project-scoped role mutations
additionally require that project's Admin/Owner)

`/api/users` -- plain identity CRUD (not an auth API)

`/api/users/{user_id}/preferences`, `/api/users/{user_id}/notification-preferences`

`/api/activity` (+ `/projects/{id}`, `/users/{id}`) -- filterable Activity Log reads

**Update (Conversation 6-8):** the above "No frontend yet" is now
stale -- the Project Collaboration frontend (Members, Invitations,
Roles, Permissions UI, Project Settings) shipped in Conversation 6,
and Conversation 8 completed the Invitation System end-to-end without
SMTP (in-app notifications, `/invite/{token}` landing page, a real
`POST /api/projects/{project_id}/invitations/{invitation_id}/resend`
endpoint) and added a persisted Notification Center as a new
top-level module (`Notification` table, `/api/notifications/*`,
`frontend/src/pages/Notifications.tsx`) -- see the "Notifications"
section above and AI_HANDOFF.md "Session 11" for the full breakdown.
This paragraph is left in place rather than rewriting the section
above it, to keep the historical record of what Conversation 6's own
starting state looked like intact.

---

# Claude Workspace (Planned)

Manage multiple AI assistants.

Each Claude account stores

Current Task

History

Completed Work

Pending Work

Descriptions

Attachments

Notes

This acts as an AI project management system.

---

# Git Sync Engine (Planned)

The application is Offline First.

SQLite remains local.

GitHub is used ONLY as synchronization.

Architecture

SQLite

↓

Export

↓

Structured JSON/Markdown files

↓

Git

↓

Private GitHub Repository

↓

Git Pull

↓

Import

↓

SQLite

GitHub is NOT the database.

GitHub is the synchronization layer.

---

# Git Sync Rules

Never push SQLite.

Never commit

study.db

Instead export structured files.

Example

data/

tasks/

projects/

notes/

assignments/

settings/

Each object should have its own file whenever practical.

Benefits

Smaller diffs

Cleaner history

Easy conflict resolution

---

# Future Sync Engine

Components

Sync Engine

Export Engine

Import Engine

Conflict Resolver

Git Service

Change Detector

Sync Status

The application should support

Push

Pull

Conflict Detection

Manual Sync

Future Auto Sync

---

# Performance Rules

Avoid unnecessary renders.

Lazy load heavy pages.

Reuse queries.

Reuse components.

Avoid duplicate requests.

---

# Security

Never expose secrets.

Never hardcode tokens.

Never expose GitHub credentials.

Sensitive values belong in environment variables.

---

# Documentation Rules

Every new module must update

README.md

CHANGELOG.md

PROJECT_CONTEXT.md

if architecture changes.

---

# Coding Standards

Write readable code.

Use TypeScript.

Comment complex logic.

Avoid unnecessary abstractions.

Prefer composition.

Reuse existing hooks.

Keep functions small.

Avoid duplication.

---

# Development Workflow

Before changing anything

1.

Read existing implementation.

2.

Understand architecture.

3.

Reuse existing systems.

4.

Extend only.

5.

Test.

6.

Build.

7.

Verify.

8.

Update documentation.

---

# AI Development Rules

Every AI conversation must

Inspect the latest uploaded project.

Read PROJECT_CONTEXT.md.

Understand existing architecture.

Continue development.

Never restart implementation.

Never replace working code.

When token limit approaches

Output

Completed Work

Modified Files

Created Files

Remaining Work

Architectural Decisions

Next Steps

Handoff Summary

No completed work should remain hidden.

---

# Long-Term Roadmap

Phase 1

Core Productivity Dashboard

✅ Complete

Phase 2

Study Hub

✅ Complete

Phase 3

Project Workspace

⬜ In Progress

Phase 3.5

Project Collaboration (Auth, RBAC, Invitations, Cloud Sync)

⬜ Database foundation + backend API complete; Authentication APIs / Frontend planned next

Phase 4

Git Sync Engine

⬜ Planned

Phase 5

Claude Workspace

⬜ Planned

Phase 6

Global Search

⬜ Planned

Phase 7

Calendar

⬜ Planned

Phase 8

Resource Improvements

⬜ Planned

Phase 9

Analytics Expansion

⬜ Planned

Phase 10

Release Candidate

⬜ Planned

---

# Final Goal

The final application should become a complete Personal Productivity Operating System.

It should allow a single user to manage:

- Studies
- Projects
- Roadmaps
- Notes
- Resources
- AI Workflows
- Timetable
- Tasks
- Deadlines
- Documentation
- Files

using one unified offline-first application synchronized across multiple devices through GitHub while maintaining local SQLite performance.

This document is the authoritative source of truth for every future AI conversation.