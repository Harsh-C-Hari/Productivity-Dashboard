# ARCHITECTURE.md

# Personal Productivity System Architecture

Version: MVP + Study Hub

Status: Active Development

---

# Purpose

This document describes the technical architecture of the Personal Productivity System.

It serves as the primary engineering reference for both developers and AI assistants.

This document explains:

- System architecture
- Backend architecture
- Frontend architecture
- Data flow
- Folder organization
- Design philosophy
- Current modules
- Future architecture
- Development principles

This document should always reflect the current implementation.

---

# High-Level Architecture

The application follows an Offline-First architecture.

```
                ┌─────────────────────────────┐
                │         Frontend            │
                │ React + TypeScript + Vite   │
                └──────────────┬──────────────┘
                               │
                     REST API (HTTP)
                               │
                ┌──────────────▼──────────────┐
                │        FastAPI Backend      │
                └──────────────┬──────────────┘
                               │
                SQLAlchemy ORM
                               │
                ┌──────────────▼──────────────┐
                │          SQLite             │
                └──────────────┬──────────────┘
                               │
                         Upload Storage
```

Future synchronization layer

```
SQLite

↓

Export Engine

↓

Structured Files

↓

Git

↓

Private GitHub Repository

↓

Git Pull

↓

Import Engine

↓

SQLite
```

---

# Design Philosophy

The project follows several architectural principles.

## Modular

Every feature exists as an independent module.

Example

Task Manager

Study Hub

Project Workspace

Claude Workspace

Calendar

Each module owns:

- Database models
- API routes
- React Query hooks
- Pages
- Components

Modules communicate only through public interfaces.

---

## Extend Instead of Rewrite

Existing code should never be replaced unless necessary.

Instead:

Reuse

Extend

Integrate

This keeps the codebase stable.

---

## Offline First

The application must always function without internet.

Network connectivity is only required for synchronization.

The database is always local.

---

## Local Performance

SQLite is the primary database.

Reasons:

Fast

Reliable

Simple

Portable

No external dependencies

---

## Responsive

Every screen must support

Desktop

Tablet

Mobile

PWA

---

# Current Technology Stack

## Frontend

React

TypeScript

Vite

Tailwind CSS

React Router

React Query

Framer Motion

Lucide Icons

Recharts

Browser Notifications

PWA

---

## Backend

FastAPI

SQLAlchemy

Pydantic

SQLite

python-multipart

---

# Directory Structure

```
project-root/

backend/
    routers/
    models.py
    schemas.py
    database.py
    main.py

frontend/
    src/
        components/
        hooks/
        pages/
        services/
        contexts/
        types/
        utils/

uploads/

docs/

assets/

README.md

PROJECT_CONTEXT.md

ARCHITECTURE.md

DATABASE_SCHEMA.md
```

---

# Backend Architecture

Backend uses FastAPI.

Each domain has its own router.

Example

```
routers/

tasks.py

study_hub.py

subjects.py

notes.py

resources.py

sessions.py

dashboard.py
```

Each router owns:

CRUD

Validation

Serialization

Business logic

Activity logging

---

# Data Layer

SQLAlchemy ORM

↓

SQLite

↓

Pydantic

↓

FastAPI Response

↓

Frontend

The frontend never accesses SQLite directly.

---

# API Layer

REST architecture.

Pattern

```
GET

POST

PUT

DELETE
```

Example

```
/api/tasks

/api/subjects

/api/projects

/api/dashboard
```

Every domain follows the same structure.

---

# Frontend Architecture

The frontend is divided into

Pages

Components

Hooks

Services

Utilities

Types

Contexts

Pages are intentionally thin.

Business logic belongs inside hooks.

---

# React Query

React Query is the only data fetching layer.

Never fetch directly inside components.

Flow

```
Component

↓

Hook

↓

API Service

↓

Backend
```

---

# Component Hierarchy

```
Page

↓

Feature Components

↓

Shared Components

↓

UI Components
```

Reusable UI components should always be preferred.

---

# Dashboard Architecture

The dashboard is the application's home.

Every module contributes dashboard widgets.

Current widgets

Tasks

Deadlines

Study Progress

Assignments

Upcoming Sessions

Future widgets

Projects

Milestones

Recent Commits

AI Workspace

Calendar

Sync Status

---

# Current Modules

## Dashboard

Purpose

Application overview.

Responsibilities

Summary

Navigation

Recent activity

Statistics

---

## Task Manager

Responsibilities

Task CRUD

Smart urgency

Progress

Notifications

Completion

---

## Timetable

Responsibilities

Weekly schedule

Editing

Visualization

---

## Study Hub

Responsibilities

Subjects

Topics

Assignments

Notes

Resources

Study Sessions

Analytics

Search

Attachments

Dashboard Integration

---

# Planned Modules

## Project Workspace

Responsibilities

Projects

Roadmaps

Phases

Milestones

Todo Board

Features

Bug Tracker

Documentation

Analytics

Timeline

---

## Claude Workspace

Responsibilities

AI conversations

Context

Current task

Pending work

Completed work

History

---

## Git Sync Engine

Responsibilities

Export

Import

Push

Pull

Conflict resolution

Sync status

Version history

---

# Project Collaboration Architecture

Status: Database foundation and backend API complete (models +
schemas -- see DATABASE_SCHEMA.md "Collaboration & Identity Tables" --
plus CRUD routers for Project Members, Project Invitations, Roles,
Permissions, Users, User Preferences, Notification Preferences, an
Activity Log read API, and reusable RBAC helper functions in
`project_helpers.py`). No authentication/JWT/login endpoints, no
authorization middleware, no frontend yet. This section documents the
shape so the next session (Authentication APIs + authorization
middleware, then Frontend, per AI_HANDOFF.md "Next Planned Modules")
builds on it rather than re-deriving it.

## Why Projects Remain the Primary Collaborative Container

PROJECT_CONTEXT.md's "Architectural Rule" is unchanged by this work:
every feature belongs to exactly one Project, and every module
(Tasks, Timeline, Documentation, AI Workspace, Git Sync, future
Hackathon/College Project/Startup/Research/Open Source/Freelance
features) inherits its permissions from its parent Project. This
session did not introduce a "Workspace" or "Team" model above Project
-- a User joins a Project directly (via ProjectMember). Adding a
second container would mean every existing Project Workspace and AI
Workspace table would need a second scoping FK; keeping Project as the
one collaborative container means none of them do.

## Ownership Model

Every Project optionally has one `owner_id` (a User). Ownership is
separate from membership: the owner is also expected to hold a
ProjectMember row with the system "Owner" role, but the FK itself is
nullable and `ON DELETE SET NULL` so deleting a User never deletes
their Projects -- ownership is un-scoped, not cascaded, matching how
Project Workspace already treats "associated but not owned" relations
(e.g. Conversation.project_id).

## Membership Model

`ProjectMember` is the join table between User and Project: one row
per (project, user) pair (enforced by a unique constraint), carrying a
`status` (active/invited/suspended/removed), whether the invitation
that created it has been accepted, an optional `role_id`, and a
future-ready `permission_overrides` list for per-member exceptions on
top of the role. Deleting a Project or a User cascades its
ProjectMember rows (a membership cannot outlive either side of the
pair it joins).

## Role-Based Access Control (RBAC)

`Role` is a named, reusable bundle of permission keys
(`permission_keys`, a JSON-encoded list[str], same convention as
`Project.tags`). Four system roles ship as data, not code: Owner,
Admin, Member, Viewer (`is_system=True`, protecting them from
deletion). `Role.project_id` is nullable: NULL means a global role
available to every project (the four defaults); a future project can
define its own custom role by setting `project_id`, without any schema
change.

`Permission` is a flat, seedable catalog table (key/name/description/
category) rather than an enum, so new permissions -- e.g. a future
Git Sync or Hackathon-specific permission -- are a seeded row, not a
code change. Deliberately no `RolePermission` join table: a Role's
permissions are the JSON list, exactly like `AIHandoff.created_files`
already stores a list without a child table.

## Permission Flow

The resolution logic exists as plain helper functions in
`project_helpers.py` (`is_owner`, `has_role`,
`get_effective_permission_keys`, `has_permission`, `is_admin`,
`can_invite`, `can_manage_members`, `can_manage_project`), and is now
wired to incoming requests by `auth_dependencies.py`'s dependency
factories (`require_membership`, `require_role`, `require_permission`,
`require_owner`, `require_admin`) -- see "Identity & Security
Architecture" below for the full flow:

```
Request (Authorization: Bearer <access token>)
  │
  ▼
auth_dependencies.get_current_user(...)          <- decodes JWT, loads Session + User
  │
  ▼
project_helpers.get_membership(db, project_id, user_id)  <- unchanged
  │
  ▼
project_helpers.get_effective_permission_keys(...)        <- unchanged
  │
  ▼
Check the required permission key against that union      <- project_helpers.has_permission(...)
  │
  ▼
403 (+ log_activity_event "permission_denied") on failure, else proceed
```

The project owner is treated as implicitly holding every permission
(see `get_effective_permission_keys`), so ownership alone is always
sufficient without a matching `ProjectMember`/`Role` row.

## Invitation Flow

`ProjectInvitation` stores an email, a Project, an assigned Role, an
opaque `token` (separate from the row's own id, so it can be rotated),
a `status` (pending/accepted/rejected/expired/revoked), and an
`expires_at`. The flow is now implemented end-to-end, including
delivery -- via in-app `Notification`s, not email:
`POST /api/projects/{project_id}/invitations` creates a `pending` row
with a `secrets.token_urlsafe(32)` token (validating there's no
duplicate pending invitation or existing active member for that email
first), and -- if the invited email already belongs to a `User`
account -- writes them a `Notification` (category
`project_invitation`, `action_url=/invite/{token}`) so they see it in
the Notification Center without needing the link;
`POST /api/invitations/{token}/accept` finds-or-creates the invitee's
`User` row by email and creates/reactivates their `ProjectMember`,
setting `status=accepted`/`accepted_at`, and notifies the inviter
(`invitation_accepted`) plus the new member (`member_joined`);
`POST /api/invitations/{token}/reject` sets `status=rejected`/
`rejected_at` and notifies the inviter (`invitation_rejected`);
`POST /api/projects/{project_id}/invitations/{invitation_id}/cancel`
notifies the invitee if they have an account (`invitation_cancelled`);
a pending invitation past its `expires_at` is lazily flipped to
`expired` on any read (`GET`/`accept`/`reject`), with an explicit
`POST .../expire` endpoint also available. New in Conversation 8:
`POST .../resend` issues a fresh token, reopens a pending/expired/
revoked invitation, restarts the expiry window, and re-notifies an
existing-account invitee -- this is the "Resend" action, since there's
still no SMTP to resend an email through. `GET /api/invitations/{token}`
(the token-scoped, deliberately unauthenticated preview endpoint) now
also returns resolved `project_name`/`project_icon`/`project_color`/
`invited_by_name`/`role_name` so the public `/invite/{token}` landing
page can render without needing the membership-gated
`GET /api/projects/{id}`. See "Notification Architecture" below for
how the `Notification` table this all writes to fits into the rest of
the notification system.

## Identity & Security Architecture

Login, JWT issuance, refresh, session management, and authorization
middleware are all implemented (`security.py`, `auth_dependencies.py`,
`routers/auth.py`, `routers/sessions.py`). No OAuth/SSO/MFA -- only
`AuthProvider.local` has a working auth API, per the task brief's
explicit "DO NOT IMPLEMENT" list.

### Password Storage

`User.password_hash` holds a bcrypt hash (via passlib's
`CryptContext`), never a plaintext password. Verification
(`security.verify_password`) is timing-safe by construction (bcrypt's
own comparison), and `routers/auth.py`'s login endpoint additionally
runs a dummy bcrypt verify even when no matching user exists, so a
nonexistent username/email doesn't respond measurably faster than a
wrong password -- otherwise the response-time difference itself would
leak which accounts exist. Password strength is enforced by
`security.validate_password_strength`, a list of `(predicate, message)`
rules (minimum/maximum length, at least one letter and one digit) so
future policy expansion is "append a rule," not "rewrite a function."

### JWT Flow

Two token types, deliberately different shapes:

- **Access tokens** are short-lived (default 30 minutes,
  `ACCESS_TOKEN_EXPIRE_MINUTES`), stateless JWTs (HS256, signed with
  `AUTH_SECRET_KEY`) carrying `sub` (user id) and `sid` (Session row
  id) claims. Stateless means validating one is just a signature +
  expiry check -- no DB hit for the *token* itself -- but
  `get_current_user` still loads the referenced `Session` row on every
  request specifically so a revoked/expired Session invalidates every
  access token tied to it immediately, without needing a separate
  access-token blocklist/deny-list table.
- **Refresh tokens** are opaque random strings
  (`secrets.token_urlsafe(48)`), never JWTs. Only their SHA-256 hash
  (`Session.refresh_token_hash`) is ever persisted -- a stolen database
  dump can't be replayed as a live refresh token, since the hash alone
  doesn't let an attacker reconstruct the original. Each
  `POST /api/auth/refresh` call rotates the token: the old one is
  overwritten and stops working the instant the new one is issued, so
  a leaked-then-replayed old refresh token fails visibly rather than
  silently succeeding alongside the legitimate client's.

### Session Management

One `Session` row per login (one per device, supporting the task
brief's "future multi-device support" -- logging in from a second
device creates a second Session rather than replacing the first).
`routers/sessions.py` exposes list/current/revoke-one/revoke-others/
logout-all, all scoped to `Session.user_id == current_user.id` so one
user can never see or revoke another user's sessions. Revoking a
Session (`revoked=True`) takes effect immediately: the next request
using an access token whose `sid` claim points at that Session fails
authentication at `auth_dependencies.get_current_user`, even though the
JWT itself hasn't expired yet.

### Authorization Middleware

See "Permission Flow" above for the full request-to-permission-check
path. `auth_dependencies.py`'s five dependency factories
(`require_membership`, `require_role`, `require_permission`,
`require_owner`, `require_admin`) all read a `project_id` path
parameter and delegate every actual check to the existing
`project_helpers.py` RBAC functions -- no permission logic is
duplicated. A denied check both raises a 403 and calls
`log_activity_event(..., action="permission_denied", ...)`, so blocked
attempts show up in the same Activity Log as successful actions.
Applied to the collaboration routers as follows:

- `project_members.py` -- list/get/summary require active membership;
  add/update/remove require the `manage_members` permission;
  transfer-ownership requires being the current Owner; leave requires
  the caller to be removing themselves (or, for an Admin/Owner, someone
  else on that member's behalf).
- `project_invitations.py` -- list requires membership; create/cancel/
  expire require the `invite_members` permission, and
  `invited_by_user_id` is always the authenticated caller (the request
  body's value, if any, is ignored) so invitations can't be attributed
  to someone else. The token-scoped routes
  (`GET/accept/reject /api/invitations/{token}`) are deliberately left
  unauthenticated: the invitee holds an opaque token, not a session,
  and may not have a `User` row (or be logged in) yet.
- `roles.py` / `permissions.py` -- catalog mutations require
  authentication; a project-scoped Role's mutations additionally
  require that project's Admin/Owner (`project_helpers.is_admin`).
  Global (catalog-level, `project_id=None`) mutations only require
  authentication, since this app has no separate "platform admin"
  concept -- consistent with the "Do NOT introduce Workspace"
  architectural rule.

**Session 7 addendum:** the four routers above are the only ones whose
routes nest a real `project_id` *path* parameter, so they're the only
ones the `require_*` dependency factories can attach to directly via
`Depends`. Every Project Workspace / AI Workspace *content* router
(`todos`, `milestones`, `phases`, `bugs`, `features`, `documents`,
`project_resources`, `conversations`, `ai_handoffs`,
`knowledge_articles`, `project_zips`, `timeline`, plus the
project-scoped endpoints in `activity`/`analytics`) is flat
(`/api/todos/{id}`, not `/api/projects/{project_id}/todos/{id}`), so
`project_id` there is a query param, a request-body field, or only
knowable after the target row is fetched. These went unwired in
Session 6 despite the `Permission` catalog already seeding exactly the
keys they needed (`view_tasks`/`manage_tasks`, `manage_documents`,
`view_ai_workspace`/`manage_ai_workspace`). Session 7 closed this gap
with `auth_dependencies.require_project_access(db, user, project_id,
permission_key=None)`: same owner-or-permission logic as
`require_permission`, called directly inside the handler instead of
via `Depends`, once the handler already has a `project_id` by whatever
means it uses. `conversations`/`ai_handoffs`/`knowledge_articles` have
a nullable `project_id` (personal, unscoped AI Workspace items are
allowed), so the check there only fires when `project_id` is actually
set. See CHANGELOG.md and AI_HANDOFF.md's Session 7 entry for the full
list of files touched, including the `projects.py` root-cause fix
(`create_project` never set `owner_id`) this work surfaced.

### Password Reset / Email Verification (preparation only)

`User.password_reset_token`/`password_reset_expires_at` and
`email_verification_token`/`email_verification_expires_at` (additive
columns, nullable, unique+indexed) let `routers/auth.py` issue,
validate, and consume single-use tokens end-to-end -- but no email is
ever sent. `POST /api/auth/password-reset/request` always returns the
same generic message regardless of whether the email matched a User,
so the endpoint can't be used to enumerate registered accounts; the raw
token is only ever included in the response when the operator has set
`AUTH_DEBUG_EXPOSE_TOKENS=true`, so local/dev testing isn't blocked on
a mail provider that doesn't exist yet, without that debug path ever
being reachable in a real deployment by default.

### What Changed From "Authentication Preparation"

The schema pieces this section used to describe as "ready for a future
migration" (`User.password_hash`/`auth_provider`/`external_auth_id`,
`Session`) needed no migration at all -- they're exactly what
`routers/auth.py` and `routers/sessions.py` use today. Only the
email-verification/password-reset token columns were newly added, and
additively (nullable, unique+indexed), matching every other
"future-ready column" already in this schema.

## Future Cloud Collaboration

`User`/`ProjectMember`/`Session` are the tables a future cloud sync
layer needs to know "who did what, from where." SYNC_ARCHITECTURE.md's
"Future Git Sync Metadata" (device_id/version/sync_state/deleted) still
applies uniformly across every table, collaboration tables included --
nothing here special-cases them.

## Future Hackathon Integration

PROJECT_CONTEXT.md and this file already list Hackathon as a planned
module. `Project.project_type` (enum, includes `hackathon`) and
`Project.collaboration_enabled` exist specifically so a future
Hackathon Hub is "a Project with `project_type=hackathon` and several
ProjectMembers," not a new top-level container -- consistent with the
"every feature belongs to exactly one Project" rule above.

---

# Data Flow

```
User Action

↓

React Component

↓

React Query Hook

↓

API Service

↓

FastAPI

↓

SQLAlchemy

↓

SQLite

↓

Response

↓

React Query Cache

↓

UI Update
```

---

# Upload Architecture

```
User

↓

Upload

↓

Backend

↓

uploads/

↓

Database Reference

↓

Frontend URL
```

Future Git Sync will synchronize uploaded files.

---

# Search Architecture

Current

Study Hub Search

Future

Global Search

Targets

Tasks

Projects

Assignments

Notes

Resources

Files

Claude Workspace

---

# Notification Architecture

Two layers, added in different sessions, serving different purposes:

**1. Ephemeral (original; unchanged this session)**

```
Backend Event

↓

Frontend Notification Context

↓

Browser Notification

↓

Dashboard Activity
```

In-app toast + optional OS-level push, via `NotificationContext.tsx`.
Nothing here persists -- once dismissed, it's gone. Good for
"copied to clipboard" / "saved" style feedback.

**2. Persisted (Notification Center, Conversation 8)**

```
Backend event (invitation created/accepted/rejected/cancelled today;
task/study reminders, member changes, etc. are the same pattern for
future modules)

↓

notification_helpers.create_notification() writes a Notification row
(user_id, category, title, message, optional project_id/
invitation_id/action_url, is_read)

↓

GET /api/notifications (+ /counts, mark read/unread, mark-all-read,
delete) -- scoped to the authenticated caller

↓

frontend/src/pages/Notifications.tsx (the inbox) + unread-count badges
on Sidebar/MobileNav/TopBar (polled every 30s via React Query, plus
invalidated immediately on same-session mutations)
```

A `Notification` survives until the user (or a future retention job --
not built) removes it, and is the mechanism the no-SMTP Invitation
System uses to actually reach an invitee -- see "Invitation Flow"
above. The two layers aren't mutually exclusive on a single user
action: accepting an invitation both writes persisted `Notification`
rows (for the inviter/new member) and can still trigger an ephemeral
toast client-side confirming the action succeeded.

Future

Push notifications (OS-level, beyond the existing permission-gated
browser Notification API)

Sync notifications

Real-time delivery of new `Notification` rows (currently poll/
invalidate-based, not push -- see "Future Cloud Collaboration" and
the explicitly-deferred "Realtime Collaboration" placeholder category)

---

# Smart Urgency Engine

Single shared implementation.

Consumers

Tasks

Assignments

Future

Project Todos

Bug Reports

Milestones

Never duplicate urgency calculations.

---

# Future Git Synchronization

Architecture

```
SQLite

↓

Export Engine

↓

JSON / Markdown

↓

Git Service

↓

Private Repository

↓

Pull

↓

Import Engine

↓

SQLite
```

SQLite remains the authoritative runtime database.

GitHub is synchronization only.

---

# Conflict Resolution

Future implementation.

Every record will contain

```
id

updated_at

version

device_id
```

Conflict strategy

Newest edit wins by default.

Future manual merge support.

---

# Logging

Future centralized logging.

Every module should publish events.

Example

Task Created

Assignment Completed

Project Updated

Bug Fixed

Session Started

Study Session Completed

Timeline consumes these events.

---

# Performance Principles

Avoid duplicate API requests.

Reuse cached queries.

Lazy-load heavy pages.

Reuse components.

Avoid unnecessary re-renders.

Optimize charts.

---

# Error Handling

Backend

HTTP Exceptions

Validation

Meaningful responses

Frontend

Toast notifications

Retry logic

Graceful fallback

---

# Security Principles

No secrets in source code.

Environment variables for tokens.

Validate uploads.

Sanitize user input.

Future GitHub authentication should use Personal Access Tokens stored securely.

---

# Testing Philosophy

Every new module should be tested by:

CRUD

Validation

Routing

Dashboard Integration

Responsive UI

Production Build

No feature is complete until both backend and frontend compile successfully.

---

# Documentation Rules

Every architectural change should update

ARCHITECTURE.md

PROJECT_CONTEXT.md

DATABASE_SCHEMA.md

README.md

CHANGELOG.md

---

# Long-Term Architecture Vision

```
                    Personal Productivity OS

                           Dashboard
                               │
      ┌──────────────┬───────────────┬───────────────┐
      │              │               │               │
 Task Manager    Study Hub    Project Workspace   Calendar
      │              │               │               │
      └──────────────┴───────────────┴───────────────┘
                               │
                      Claude Workspace
                               │
                         Git Sync Engine
                               │
                     Private GitHub Repository
```

The long-term goal is to create a unified offline-first productivity operating system where every module shares the same architecture, design language, and synchronization layer while remaining independently maintainable.