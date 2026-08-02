# DATABASE_SCHEMA.md

# Personal Productivity System Database Schema

Version: MVP + Study Hub

Database: SQLite

ORM: SQLAlchemy

Status: Active Development

---

# Purpose

This document defines the complete database structure used by the Personal Productivity System.

It serves as the single source of truth for:

- Database tables
- Relationships
- Constraints
- Foreign keys
- Indexes
- Future schema
- Migration planning

Every database modification must update this document.

---

# Database Philosophy

The application is Offline-First.

SQLite is the primary runtime database.

GitHub synchronization (future) will synchronize exported structured files, NOT the SQLite database itself.

SQLite remains the authoritative local database.

---

# Database Overview

```
SQLite

├── Tasks
├── Subjects
├── Topics
├── Assignments
├── Notes
├── Resources
├── Study Sessions
├── Timetable
├── Activity Logs
├── Projects
├── Project Phases
├── Features
├── Project Todos
├── Bugs
├── Milestones
├── Project Resources
├── Project Documents
├── Timeline Events
├── AI Accounts
├── Conversations
├── Prompt Templates
├── Project Zips
├── AI Handoffs
├── Token Trackers
├── Knowledge Articles
├── Users
├── Permissions
├── Roles
├── Project Members
├── Project Invitations
├── Sessions
├── User Preferences
├── Notification Preferences
└── Settings (Future)
```

Note: Project Workspace tables (Projects through Timeline Events) have
full SQLAlchemy models, Pydantic schemas, and API routers (10 routers
in `backend/app/routers/`, plus dashboard integration). No frontend
yet -- see AI_HANDOFF.md.

Note: AI Workspace tables (AI Accounts through Knowledge Articles) have
SQLAlchemy models and Pydantic schemas only (no routers, no frontend,
no dashboard integration yet) -- see the "AI Workspace Tables" section
below and AI_HANDOFF.md for current status.

Note: Collaboration & Identity tables (Users through Notification
Preferences) have SQLAlchemy models and Pydantic schemas only (no
routers, no auth endpoints, no frontend) -- see the "Collaboration &
Identity Tables" section below and AI_HANDOFF.md for current status.

---

# Entity Relationship Diagram (Current)

```
Subject
   │
   ├──────────────┐
   │              │
Topic         Assignment
   │              │
   │              │
   ├──────────┐   │
   │          │   │
 Notes   Resources │
                  │
             Study Session

Dashboard aggregates all entities.
```

```
Project
   │
   ├── Phases ──────────┬── Features ──┬── Todos
   │                     │              └── Bugs
   │                     ├── Todos
   │                     ├── Bugs
   │                     └── Milestones
   │
   ├── Resources
   ├── Documents
   └── Timeline Events

Features, Todos, Bugs, and Milestones may each optionally belong to a
Phase; Todos and Bugs may additionally belong to a Feature.
```

---

# TABLE: Tasks

Purpose

Stores personal tasks.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | Integer | Yes | Primary Key |
| title | String | Yes | |
| description | Text | No | |
| priority | Integer | Yes | |
| status | String | Yes | |
| completed | Boolean | Yes | |
| due_date | DateTime | No | |
| urgency_score | Float | Calculated | |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

Relationships

None currently.

Future

Projects

Milestones

---

# TABLE: Subjects

Purpose

Study subjects.

Example

Mathematics

Operating Systems

Networking

Fields

| Field | Type |
|--------|------|
| id | Integer |
| name | String |
| description | Text |
| color | String |
| created_at | DateTime |

Relationships

One Subject

↓

Many Topics

↓

Many Assignments

↓

Many Notes

↓

Many Resources

↓

Many Study Sessions

---

# TABLE: Topics

Purpose

Subject modules.

Example

Module 1

Graphs

Pointers

Fields

| Field | Type |
|--------|------|
| id | Integer |
| subject_id | FK |
| name | String |
| description | Text |
| completed | Boolean |

Foreign Keys

subject_id

↓

Subjects.id

---

# TABLE: Assignments

Purpose

Study assignments.

Fields

| Field | Type |
|--------|------|
| id | Integer |
| subject_id | FK |
| topic_id | FK |
| title | String |
| description | Text |
| due_date | DateTime |
| completed | Boolean |
| urgency_score | Float |
| attachment | String |
| created_at | DateTime |

Relationships

Many Assignments

↓

One Subject

Optional

↓

One Topic

Urgency

Uses existing Smart Urgency Engine.

Never duplicate urgency calculations.

---

# TABLE: Notes

Purpose

Markdown study notes.

Fields

| Field | Type |
|--------|------|
| id | Integer |
| subject_id | FK |
| topic_id | FK |
| title | String |
| content | Text |
| attachment | String |
| created_at | DateTime |
| updated_at | DateTime |

Supports

Markdown

Attachments

Search

---

# TABLE: Resources

Purpose

Learning materials.

Supports

PDF

ZIP

Images

Videos

External Links

Fields

| Field | Type |
|--------|------|
| id | Integer |
| subject_id | FK |
| topic_id | FK |
| title | String |
| type | String |
| url | String |
| file_path | String |
| created_at | DateTime |

---

# TABLE: Study Sessions

Purpose

Pomodoro history.

Fields

| Field | Type |
|--------|------|
| id | Integer |
| subject_id | FK |
| topic_id | FK |
| duration | Integer |
| completed | Boolean |
| started_at | DateTime |
| completed_at | DateTime |

Analytics

Hours

Streaks

Progress

Dashboard

---

# TABLE: Timetable

Purpose

Weekly schedule.

Fields

| Field | Type |
|--------|------|
| id | Integer |
| day | Integer |
| start_time | Time |
| end_time | Time |
| title | String |
| location | String |

---

# TABLE: Activity Log

Purpose

Tracks user activity.

Examples

Task Created

Assignment Completed

Subject Added

Study Session Started

Future

Project Events

Sync Events

Claude Workspace Events

Collaboration extension (new)

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| message | String(300) | Yes | |
| icon | String(30) | No | default "activity" |
| created_at | DateTime | Yes | Indexed |
| user_id | String | No | FK -> Users.id, ON DELETE SET NULL. Indexed. New |
| project_id | String | No | FK -> Projects.id, ON DELETE SET NULL. Indexed. New |
| action | String(50) | No | e.g. "created", "updated", "invited", "role_changed". Indexed. New |
| entity_type | String(50) | No | e.g. "project", "todo", "member", "invitation". Indexed. New |
| entity_id | String | No | New |

`user_id`/`project_id`/`action`/`entity_type`/`entity_id` were added
in the Collaboration & Identity session, all nullable and defaulted so
every existing `log_activity(db, message, icon)` call site (including
`routers/tasks.py`'s own local copy of the helper) keeps compiling and
keeps writing valid rows unchanged. This table was extended rather
than adding a second "collaboration activity log" alongside it --
Recent Activity, Notifications, Audit Trail, Timeline, and Project
History (the roles this table is meant to power, per its original
"Future" note above) are all one trail, not several.

---

# Current Relationships

```
Subject

├── Topics

├── Assignments

├── Notes

├── Resources

└── Study Sessions
```

Topic

↓

Assignments

↓

Notes

↓

Resources

↓

Study Sessions

---

# Index Recommendations

Current

Primary Keys

Project Workspace tables additionally index: Project name/status/
archived, Phase project_id/order_index/status, Feature project_id/
phase_id/status/priority, Project Todo project_id/phase_id/feature_id/
status/deadline, Bug project_id/phase_id/feature_id/severity/status,
Milestone project_id/phase_id/target_date/completed, Project Resource
project_id/resource_type, Project Document project_id, Timeline Event
project_id/event_type/created_at.

AI Workspace tables additionally index: AI Account name/provider/
status, Conversation ai_account_id/project_id/status/started_at,
Prompt Template title/category, Project Zip project_id/ai_account_id/
conversation_id/created_at, AI Handoff project_id/ai_account_id/
conversation_id/created_at, Token Tracker ai_account_id/
conversation_id/recorded_at, Knowledge Article project_id/title/
category/source.

Future (still not indexed)

Subject Name

Assignment Due Date

Task Due Date

Study Session Date

Resource Type (Study Hub)

---

# Cascade Rules

## Study Hub (existing)

Deleting Subject

↓

Delete

Topics

Assignments

Notes

Resources

Study Sessions

Uploaded Files

Handled manually in router code.

SQLite foreign-key cascades are not relied upon.

## Project Workspace (new)

Deleting a Project cascades, at the SQLAlchemy ORM level
(`relationship(cascade="all, delete-orphan")`), to:

Phases

Features

Todos

Bugs

Milestones

Resources

Documents

Timeline Events

Deleting a Phase does NOT delete Features/Todos/Bugs/Milestones under
it -- their `phase_id` is set to NULL (`ondelete="SET NULL"`,
mirrored by the relationship having no cascade).

Deleting a Feature does NOT delete Todos/Bugs under it -- their
`feature_id` is set to NULL, same pattern.

Like the Study Hub, this app's `database.py` never enables
`PRAGMA foreign_keys=ON`, so SQLite itself does not enforce these
`ondelete=` clauses. Project Workspace cascades work because
SQLAlchemy issues the child DELETE/UPDATE statements itself
(ORM-level cascade), not because the database enforces them. Verified
against a real SQLite engine before merging (see AI_HANDOFF.md).

## AI Workspace (new)

Deleting an AI Account cascades, at the SQLAlchemy ORM level, to:

Conversations

Token Trackers

Deleting a Conversation does NOT cascade further (it has no owned
children); Project Zips/AI Handoffs/Token Trackers referencing it have
`conversation_id` set to NULL instead.

Deleting a Project cascades to its Project Zips (owned, same as every
other Project Workspace child above), but only un-scopes (sets
`project_id`/`ai_account_id`/`conversation_id` to NULL on) its
Conversations, AI Handoffs, and Knowledge Articles -- these are treated
as *associated* with, not *owned* by, the project or account, since a
conversation or handoff may reasonably span more than one project.

Verified against a real (in-memory) SQLite engine before merging: both
the "delete cascades" case (AIAccount -> Conversation/TokenTracker,
Project -> ProjectZip) and the "delete orphans instead" case (AIAccount
or Project deletion leaving ProjectZip/AIHandoff/KnowledgeArticle rows
in place with their FK nulled) were exercised end-to-end.

## Collaboration & Identity (new)

Deleting a Project cascades, at the SQLAlchemy ORM level, to:

ProjectMembers

ProjectInvitations

Deleting a Project does NOT delete its ActivityLog entries or un-scope
its `owner_id` reference from the User side -- ActivityLog rows have
`project_id` set to NULL instead (same "associated, not owned" pattern
as Conversation/AIHandoff/KnowledgeArticle above).

Deleting a User cascades, at the SQLAlchemy ORM level, to:

ProjectMembers

Sessions

UserPreference

NotificationPreference

Deleting a User does NOT delete the Projects they own, the
ProjectInvitations they sent, or their ActivityLog entries -- these are
un-scoped instead (`owner_id`/`invited_by_user_id`/`user_id` -> NULL),
since a Project, an invitation record, or a historical activity entry
should outlive the User who created it.

Deleting a Role only un-scopes ProjectMember/ProjectInvitation rows
that reference it (`role_id` -> NULL); it never deletes the membership
or invitation itself.

Verified against a real (in-memory) SQLite engine before merging: User
deletion cascading to ProjectMember/Session/UserPreference/
NotificationPreference, Project deletion cascading to ProjectMember/
ProjectInvitation, and Project deletion un-scoping (not deleting)
ActivityLog rows were all exercised end-to-end.

---

# Upload Storage

Database stores only

Relative file path

Example

uploads/

↓

resources/

↓

lecture1.pdf

Actual files remain in uploads/.

---

# Dashboard Queries

Dashboard aggregates

Tasks

Assignments

Study Hours

Upcoming Deadlines

Recent Activity

Progress

Dashboard never owns data.

It queries each module.

---

# Project Workspace Tables

Status: Backend complete (models + schemas + routers + dashboard
integration). No frontend yet -- see AI_HANDOFF.md for current status.

All Project Workspace tables use the same conventions as the rest of
the database: string UUID primary keys via `gen_id()`, snake_case FK
columns (`entity_id`), and `created_at`/`updated_at` timestamps. Unlike
the Study Hub tables, these models pair `ondelete=` on the FK with an
explicit SQLAlchemy `relationship(cascade="all, delete-orphan")`, so
deleting a Project reliably cascades to everything below it at the ORM
level (SQLite does not enforce FK constraints in this app, so cascade
is handled by SQLAlchemy, not the database).

## TABLE: Projects

Purpose

Top-level container for a body of work (an app, a repo, an engagement).

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| name | String(200) | Yes | Indexed |
| description | Text | No | |
| icon | String(50) | No | Lucide icon name, default "folder" |
| color | String(20) | No | Theme accent tag, default "purple" |
| status | Enum | Yes | planning / active / on_hold / completed / archived. Indexed |
| repository_url | String(500) | No | |
| local_repository | String(500) | No | Local filesystem path (future Git Sync Engine) |
| progress | Integer | No | 0-100 |
| archived | Boolean | Yes | Indexed |
| tags | Text | No | JSON-encoded list[str], default "[]" |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |
| owner_id | String | No | FK -> Users.id, ON DELETE SET NULL. Indexed. Collaboration extension, see below |
| visibility | Enum | Yes | private / team / public, default private. Indexed. Collaboration extension |
| collaboration_enabled | Boolean | Yes | default False. Indexed. Collaboration extension |
| project_type | Enum | Yes | personal / hackathon / college_project / startup / research / open_source / freelance, default personal. Indexed. Collaboration extension |

Collaboration extension (new)

`owner_id`/`visibility`/`collaboration_enabled`/`project_type` were
added in the Collaboration & Identity session (see below). All are
defaulted so every pre-existing Project row remains valid unchanged
(`owner_id` NULL, `visibility=private`, `collaboration_enabled=False`,
`project_type=personal`).

Relationships

```
Project

├── Phases (cascade delete)

├── Features (cascade delete)

├── Todos (cascade delete)

├── Bugs (cascade delete)

├── Milestones (cascade delete)

├── Resources (cascade delete)

├── Documents (cascade delete)

└── Timeline Events (cascade delete)
```

Collaboration relationships (new, see "Collaboration & Identity Tables"
below for full detail)

```
Project

├── owner (associated, SET NULL on delete -- not owned)

├── ProjectMembers (owned, cascade delete)

├── ProjectInvitations (owned, cascade delete)

└── ActivityLog entries (associated, SET NULL on delete -- not owned)
```

---

## TABLE: Project Phases

Purpose

An ordered roadmap stage within a project (e.g. "Phase 1: MVP").

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | Yes | FK -> Projects.id, ON DELETE CASCADE. Indexed |
| title | String(200) | Yes | |
| description | Text | No | |
| order_index | Integer | No | Indexed |
| status | Enum | Yes | pending / in_progress / completed / blocked. Indexed |
| progress | Integer | No | 0-100 |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

Cascade

Deleting a Project deletes its Phases.

Deleting a Phase does NOT delete its Features/Todos/Bugs/Milestones --
their `phase_id` is set to NULL instead.

---

## TABLE: Features

Purpose

A planned or in-progress unit of work, optionally grouped under a phase.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | Yes | FK -> Projects.id, ON DELETE CASCADE. Indexed |
| phase_id | String | No | FK -> ProjectPhases.id, ON DELETE SET NULL. Indexed |
| title | String(200) | Yes | |
| description | Text | No | |
| status | Enum | Yes | backlog / planned / in_progress / testing / done. Indexed |
| priority | Enum | Yes | low / medium / high / critical. Indexed |
| estimated_effort_hours | Float | No | Feeds the Smart Urgency Engine |
| progress | Integer | No | 0-100 |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

Urgency

`estimated_effort_hours`/`progress` deliberately match Task/Assignment
so a future router can reuse `urgency.compute_urgency` unchanged.

---

## TABLE: Project Todos

Purpose

Fine-grained task item, scoped to a project and optionally a phase/
feature. The Project Workspace analogue of Task/Assignment.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | Yes | FK -> Projects.id, ON DELETE CASCADE. Indexed |
| phase_id | String | No | FK -> ProjectPhases.id, ON DELETE SET NULL. Indexed |
| feature_id | String | No | FK -> Features.id, ON DELETE SET NULL. Indexed |
| title | String(200) | Yes | |
| description | Text | No | |
| status | Enum | Yes | Reuses TaskStatus (todo / in_progress / done). Indexed |
| deadline | DateTime | No | Feeds the Smart Urgency Engine. Indexed |
| estimated_effort_hours | Float | No | Feeds the Smart Urgency Engine |
| progress | Integer | No | 0-100 |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |
| completed_at | DateTime | No | |

Urgency

Uses the existing Smart Urgency Engine (`urgency.compute_urgency`).
Never duplicate urgency calculations.

---

## TABLE: Bugs

Purpose

Defect tracking, scoped to a project and optionally a phase/feature.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | Yes | FK -> Projects.id, ON DELETE CASCADE. Indexed |
| phase_id | String | No | FK -> ProjectPhases.id, ON DELETE SET NULL. Indexed |
| feature_id | String | No | FK -> Features.id, ON DELETE SET NULL. Indexed |
| title | String(200) | Yes | |
| description | Text | No | |
| severity | Enum | Yes | low / medium / high / critical. Indexed |
| status | Enum | Yes | open / in_progress / resolved / wont_fix / duplicate. Indexed |
| resolution | Text | No | |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |
| resolved_at | DateTime | No | |

---

## TABLE: Milestones

Purpose

A dated checkpoint within a project, optionally tied to a phase.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | Yes | FK -> Projects.id, ON DELETE CASCADE. Indexed |
| phase_id | String | No | FK -> ProjectPhases.id, ON DELETE SET NULL. Indexed |
| title | String(200) | Yes | |
| description | Text | No | |
| target_date | DateTime | No | Indexed |
| completed | Boolean | Yes | Indexed |
| completed_at | DateTime | No | |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

---

## TABLE: Project Resources

Purpose

File/link reference library for a project. Deliberately the same shape
as the Study Hub's `Resource` table so the existing upload helper
(`uploads.py`) can be reused unchanged -- no second upload system.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | Yes | FK -> Projects.id, ON DELETE CASCADE. Indexed |
| title | String(200) | Yes | |
| resource_type | Enum | Yes | Reuses ResourceType (pdf/ppt/docx/image/zip/link/other). Indexed |
| file_name | String(255) | No | Stored (disk) filename |
| original_name | String(255) | No | Filename as uploaded |
| file_path | String(500) | No | Public URL path, e.g. /uploads/xyz.pdf |
| file_size_bytes | Integer | No | |
| external_url | String(1000) | No | |
| created_at | DateTime | Yes | |

File references only: the database stores relative paths, actual files
remain in `uploads/`, same as every other Resource table.

---

## TABLE: Project Documents

Purpose

Markdown documentation pages belonging to a project (README-style
docs, design notes, etc). Rendered client-side the same way Study Hub
Notes are.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | Yes | FK -> Projects.id, ON DELETE CASCADE. Indexed |
| title | String(200) | Yes | |
| content | Text | No | Markdown |
| order_index | Integer | No | Indexed |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

---

## TABLE: Timeline Events

Purpose

Append-only event trail for a project -- the project-scoped analogue
of Activity Log. Deliberately generic so any future entity can log an
event without a schema change.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | Yes | FK -> Projects.id, ON DELETE CASCADE. Indexed |
| event_type | String(50) | Yes | Free-form, e.g. "phase_completed", "bug_resolved". Indexed |
| title | String(300) | Yes | |
| description | Text | No | |
| icon | String(30) | No | Default "activity" |
| related_entity_type | String(50) | No | e.g. "feature", "bug", "milestone", "todo" |
| related_entity_id | String | No | |
| created_at | DateTime | Yes | Indexed |

---

# AI Workspace Tables

Status: Backend foundation only (models + schemas). No routers, no
frontend, no dashboard integration yet -- see AI_HANDOFF.md for current
status. Generalizes the "Claude Workspace" concept sketched above (and
in PROJECT_CONTEXT.md) into a multi-provider AI Workspace (Claude, GPT,
Gemini, ...).

All AI Workspace tables use the same conventions as Project Workspace:
string UUID primary keys via `gen_id()`, snake_case FK columns
(`entity_id`), and `created_at`/`updated_at` timestamps. Cascade is
handled the same way -- `ondelete=` on the FK paired with an explicit
SQLAlchemy `relationship(cascade="all, delete-orphan")` -- but is only
used where a child is truly *owned* by its parent. Everything else uses
`ON DELETE SET NULL` with no cascade, because an AI account,
conversation, handoff, or knowledge article can reasonably outlive, or
span more than, a single project (unlike Project Workspace children,
which don't make sense outside their project).

Security: `AIAccount.api_key_env_var` stores only the *name* of an
environment variable (e.g. `"ANTHROPIC_API_KEY"`), never an actual key.
Enforced both by the model's naming/intent and by a Pydantic validator
on the schema layer (`AIAccountBase`/`AIAccountUpdate`) that rejects
values that look like a pasted-in secret rather than a variable name.

## TABLE: AI Accounts

Purpose

A configured AI assistant the user works with (Claude, GPT, Gemini,
...). The top-level entity most other AI Workspace tables hang off of,
analogous to Subject in the Study Hub.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| name | String(200) | Yes | Indexed |
| provider | Enum | Yes | claude / gpt / gemini / other. Indexed |
| model | String(100) | No | e.g. "claude-sonnet-4-6" |
| description | Text | No | |
| icon | String(50) | No | Lucide icon name, default "bot" |
| color | String(20) | No | Theme accent tag, default "purple" |
| status | Enum | Yes | active / idle / archived. Indexed |
| api_key_env_var | String(100) | No | Name of the env var holding the real key -- never the key itself |
| current_task | Text | No | |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

Relationships

```
AIAccount

├── Conversations (cascade delete)

├── TokenTrackers (cascade delete)

├── ProjectZips (SET NULL on delete, not owned)

└── AIHandoffs (SET NULL on delete, not owned)
```

---

## TABLE: Conversations

Purpose

A chat/session with an AI account, optionally scoped to a project.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| ai_account_id | String | Yes | FK -> AIAccounts.id, ON DELETE CASCADE. Indexed |
| project_id | String | No | FK -> Projects.id, ON DELETE SET NULL. Indexed |
| title | String(300) | Yes | |
| summary | Text | No | |
| status | Enum | Yes | active / completed / archived. Indexed |
| message_count | Integer | No | |
| started_at | DateTime | Yes | Indexed |
| last_message_at | DateTime | No | |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

Cascade

Deleting the AIAccount deletes its Conversations. Deleting the Project
only un-scopes the Conversation (`project_id` -> NULL); a conversation
may span more than one project over its lifetime.

---

## TABLE: Prompt Templates

Purpose

Reusable prompt text, independent of any single project or account.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| title | String(200) | Yes | Indexed |
| description | Text | No | |
| content | Text | Yes | The prompt body |
| category | String(60) | No | e.g. "coding", "docs". Indexed |
| variables | Text | No | JSON-encoded list[str] of placeholder names, default "[]" |
| usage_count | Integer | No | |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

Relationships

None. Deliberately not scoped by `project_id`/`ai_account_id` -- a good
prompt template is meant to be reused across both.

---

## TABLE: Project Zips

Purpose

A point-in-time zip snapshot of a project, handed off to (or received
back from) an AI account/conversation. Deliberately the same
file-storage shape as ProjectResource/Resource so the existing
`uploads.py` helper can be reused unchanged.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | Yes | FK -> Projects.id, ON DELETE CASCADE. Indexed |
| ai_account_id | String | No | FK -> AIAccounts.id, ON DELETE SET NULL. Indexed |
| conversation_id | String | No | FK -> Conversations.id, ON DELETE SET NULL. Indexed |
| version_label | String(100) | No | e.g. "v1", "session-3" |
| file_name | String(255) | No | Stored (disk) filename |
| original_name | String(255) | No | Filename as uploaded |
| file_path | String(500) | No | Public URL path, e.g. /uploads/xyz.zip |
| file_size_bytes | Integer | No | |
| notes | Text | No | What changed in this snapshot |
| created_at | DateTime | Yes | Indexed |

Cascade

Owned by the Project: deleting a Project deletes its ProjectZips.
Deleting an AIAccount or Conversation only un-links the zip
(`ai_account_id`/`conversation_id` -> NULL); the snapshot itself is
kept, since it still belongs to the project.

---

## TABLE: AI Handoffs

Purpose

Structured session handoff notes -- the database-backed analogue of
this repository's own AI_HANDOFF.md, one row per handoff instead of one
continuously-overwritten file.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | No | FK -> Projects.id, ON DELETE SET NULL. Indexed |
| ai_account_id | String | No | FK -> AIAccounts.id, ON DELETE SET NULL. Indexed |
| conversation_id | String | No | FK -> Conversations.id, ON DELETE SET NULL. Indexed |
| completed_work | Text | No | |
| created_files | Text | No | JSON-encoded list[str], default "[]" |
| modified_files | Text | No | JSON-encoded list[str], default "[]" |
| remaining_work | Text | No | |
| known_issues | Text | No | |
| next_objective | Text | No | |
| created_at | DateTime | Yes | Indexed |

Cascade

All FKs are optional/SET NULL: a handoff is commonly tied to a
project/account/conversation, but -- like this repo's own
AI_HANDOFF.md "Token Limit Rule" -- should still be writable even when
one of those isn't cleanly known, and should never be deleted as a
side effect of deleting something else.

---

## TABLE: Token Trackers

Purpose

Append-only log of token usage, one row per recorded usage event -- the
AI Workspace analogue of TimelineEvent/ActivityLog.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| ai_account_id | String | Yes | FK -> AIAccounts.id, ON DELETE CASCADE. Indexed |
| conversation_id | String | No | FK -> Conversations.id, ON DELETE SET NULL. Indexed |
| input_tokens | Integer | No | |
| output_tokens | Integer | No | |
| total_tokens | Integer | No | |
| estimated_cost_usd | Float | No | |
| model | String(100) | No | |
| recorded_at | DateTime | Yes | Indexed |

Cascade

Owned by the AIAccount: deleting the account deletes its usage
history. The conversation link is optional/SET NULL since usage may be
recorded outside any single conversation (e.g. a batch job).

---

## TABLE: Knowledge Articles

Purpose

A durable reference note (written by the user or an AI account),
optionally scoped to a project. Deliberately the same shape as
ProjectDocument so it can be rendered client-side the same way, but
lives in the AI Workspace since its purpose is durable *context* an AI
account can be pointed at, rather than project documentation per se.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | No | FK -> Projects.id, ON DELETE SET NULL. Indexed |
| title | String(200) | Yes | Indexed |
| content | Text | No | Markdown |
| category | String(60) | No | Default "general". Indexed |
| tags | Text | No | JSON-encoded list[str], default "[]" |
| source | Enum | Yes | manual / ai_generated. Indexed |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

Cascade

Deleting a Project only un-scopes the article (`project_id` -> NULL);
knowledge articles are meant to outlive any single project.

---

## AI Workspace <-> Project Relationships

```
Project
   │
   ├── ProjectZips (owned, cascade delete)
   │
   ├── Conversations (associated, SET NULL on delete)
   │
   ├── AIHandoffs (associated, SET NULL on delete)
   │
   └── KnowledgeArticles (associated, SET NULL on delete)
```

```
AIAccount
   │
   ├── Conversations (owned, cascade delete)
   │      │
   │      ├── ProjectZips (associated, SET NULL on delete)
   │      ├── AIHandoffs (associated, SET NULL on delete)
   │      └── TokenTrackers (owned via account; conversation link is SET NULL)
   │
   ├── ProjectZips (associated, SET NULL on delete)
   ├── AIHandoffs (associated, SET NULL on delete)
   └── TokenTrackers (owned, cascade delete)
```

PromptTemplate has no relationship to either Project or AIAccount --
it is a standalone, fully reusable entity.

---

## AI Workspace Pydantic Schemas

Every AI Workspace model has `Create` / `Update` / `Out` (the API
response shape) schemas following the existing Base/Create/Update/Out
convention. In addition:

- **Summary** schemas exist both per-entity (`AIAccountSummary`,
  `ConversationSummary` -- rollups of an account's/conversation's
  children, same role as `ProjectSummary`) and as one workspace-wide
  aggregate (`AIWorkspaceSummary`, same role as
  `ProjectWorkspaceSummary`). Neither is wired to a router yet.
- **Validation** schemas (`AIAccountValidation`,
  `ConversationValidation`, `PromptTemplateValidation`,
  `ProjectZipValidation`, `AIHandoffValidation`,
  `TokenTrackerValidation`, `KnowledgeArticleValidation`) capture the
  full persisted shape (including `id`) plus stricter checks than
  Create/Update need at authoring time. They exist for the future Git
  Sync Import Engine described in SYNC_ARCHITECTURE.md, which will need
  to validate each entity's exported JSON before writing it back into
  SQLite on import -- not for any router that exists today.
- A shared `_clean_str_list` normalizer backs every JSON-encoded-list
  field (`tags`, `variables`, `created_files`, `modified_files`),
  trimming whitespace and dropping empty entries on both Create/Update
  and Validation schemas.
- `AIAccountBase`/`AIAccountUpdate`/`AIAccountValidation` all reject an
  `api_key_env_var` that looks like a real pasted-in secret rather
  than an environment variable name (see Security note above).

---

# Collaboration & Identity Tables

Status: Backend foundation only (models + schemas). No routers, no
auth endpoints, no frontend, no dashboard integration yet -- see
AI_HANDOFF.md for current status and ARCHITECTURE.md "Project
Collaboration Architecture" for the design rationale. Makes Projects
collaborative while keeping Project the application's one primary
collaborative container -- no separate Workspace/Team model.

All Collaboration & Identity tables use the same conventions as
Project Workspace and AI Workspace: string UUID primary keys via
`gen_id()`, snake_case FK columns (`entity_id`), `created_at`/
`updated_at` timestamps, and JSON-encoded Text columns for small
variable-length lists/dicts (`permission_keys`, `permission_overrides`,
`dashboard_layout`, `ai_preferences`, `reminder_preferences`), same
convention as `Project.tags`/`AIHandoff.created_files`. Cascade follows
the established pattern: `ondelete=` on the FK paired with an explicit
SQLAlchemy `relationship(cascade="all, delete-orphan")` only where the
child is truly *owned* by its parent; everything else is `ON DELETE
SET NULL` with no cascade.

Security: `User.password_hash` never stores a plaintext password (a
schema-layer validator on `UserCreate` rejects short/unhashed-looking
values, mirroring `AIAccount.api_key_env_var`'s secret-shape guard).
No endpoint sets this field yet -- it exists so the future auth service
doesn't need a migration.

## TABLE: Users

Purpose

A person who can own or collaborate on Projects. Standalone today --
nothing elsewhere in the app requires a User row to exist yet, so this
table has zero impact on the single-user MVP until it's wired up.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| username | String(50) | Yes | Unique. Indexed |
| display_name | String(150) | No | |
| email | String(255) | Yes | Unique. Indexed |
| avatar_url | String(500) | No | |
| timezone | String(60) | No | Default "UTC" |
| locale | String(10) | No | Default "en" |
| theme | String(20) | No | Default "dark" |
| status | Enum | Yes | active / invited / suspended / deactivated. Indexed |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |
| last_seen_at | DateTime | No | |
| auth_provider | Enum | Yes | local / google / github / other, default local. Indexed. Future auth metadata |
| external_auth_id | String(255) | No | Provider-side user id (e.g. Google `sub`). Indexed. Future auth metadata |
| password_hash | Text | No | Never a plaintext password. Future auth metadata |

Relationships

```
User

├── owned_projects (associated, SET NULL on delete -- not owned)

├── ProjectMembers (owned, cascade delete)

├── Sessions (owned, cascade delete)

├── UserPreference (owned, cascade delete, one-to-one)

├── NotificationPreference (owned, cascade delete, one-to-one)

├── sent_invitations (associated, SET NULL on delete -- not owned)

└── ActivityLog entries (associated, SET NULL on delete -- not owned)
```

---

## TABLE: Permissions

Purpose

Reusable, seedable catalog of permission keys (e.g. "manage_members",
"invite_members"), referenced by `Role.permission_keys` and
`ProjectMember.permission_overrides`. A table rather than an enum so a
new permission (future Git Sync, Hackathon, ...) is a seeded row, not a
code change.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| key | String(60) | Yes | Unique, e.g. "manage_project". Indexed |
| name | String(120) | Yes | |
| description | Text | No | |
| category | String(50) | No | e.g. "project", "members", "tasks", "ai_workspace". Default "general". Indexed |
| created_at | DateTime | Yes | |

Relationships

None (referenced by key, not FK, from `Role.permission_keys`/
`ProjectMember.permission_overrides` -- see "Architectural note" in
schemas.py and ARCHITECTURE.md).

---

## TABLE: Roles

Purpose

A named, reusable bundle of permission keys. Ships as four
system-seeded rows (Owner, Admin, Member, Viewer) but is extensible to
custom, project-specific roles without a schema change.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| name | String(50) | Yes | Indexed |
| description | Text | No | |
| is_system | Boolean | Yes | Default False. Protects the 4 defaults from deletion. Indexed |
| project_id | String | No | FK -> Projects.id, ON DELETE CASCADE. NULL = global role available to every project. Indexed |
| permission_keys | Text | No | JSON-encoded list[str] of Permission.key values, default "[]" |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

Cascade

A global role (`project_id` NULL) is unaffected by any project's
lifecycle. A future project-specific custom role is owned by its
project and is deleted with it.

---

## TABLE: Project Members

Purpose

Join table between User and Project -- the table that makes Projects
collaborative. One row per (project, user) pair.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | Yes | FK -> Projects.id, ON DELETE CASCADE. Indexed |
| user_id | String | Yes | FK -> Users.id, ON DELETE CASCADE. Indexed |
| role_id | String | No | FK -> Roles.id, ON DELETE SET NULL. Indexed |
| status | Enum | Yes | active / invited / suspended / removed, default active. Indexed |
| invitation_accepted | Boolean | Yes | Default True |
| permission_overrides | Text | No | JSON-encoded list[str] of Permission.key values, default "[]". Future-ready |
| joined_at | DateTime | Yes | |
| last_active_at | DateTime | No | |

Constraints

Unique on (`project_id`, `user_id`) -- a user has at most one
membership row per project.

Cascade

Deleting a Project or a User deletes its ProjectMember rows (a
membership cannot outlive either side of the pair it joins). Deleting
a Role only un-scopes the membership's role (`role_id` -> NULL).

---

## TABLE: Project Invitations

Purpose

A pending (or resolved) invitation for an email address to join a
Project with a given Role.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| project_id | String | Yes | FK -> Projects.id, ON DELETE CASCADE. Indexed |
| email | String(255) | Yes | Indexed |
| role_id | String | No | FK -> Roles.id, ON DELETE SET NULL. Indexed |
| invited_by_user_id | String | No | FK -> Users.id, ON DELETE SET NULL. Indexed |
| token | String(64) | Yes | Unique, opaque invite-link identifier (separate from `id`). Indexed |
| status | Enum | Yes | pending / accepted / rejected / expired / revoked, default pending. Indexed |
| expires_at | DateTime | Yes | Indexed |
| accepted_at | DateTime | No | |
| rejected_at | DateTime | No | |
| created_at | DateTime | Yes | |

Cascade

Deleting a Project deletes its ProjectInvitations. Deleting a Role or
the inviting User only un-scopes the invitation (`role_id`/
`invited_by_user_id` -> NULL) -- the invitation itself is still valid
to accept.

---

## TABLE: Sessions

Purpose

An active login session for a User (one device/browser). No auth API
issues these yet; exists so a future auth service has somewhere to
write without a schema change.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| user_id | String | Yes | FK -> Users.id, ON DELETE CASCADE. Indexed |
| device | String(150) | No | |
| platform | String(60) | No | e.g. "macOS", "iOS", "Windows" |
| browser | String(60) | No | e.g. "Chrome 126" |
| ip_address | String(45) | No | Nullable; long enough for IPv6 |
| created_at | DateTime | Yes | Indexed |
| last_active_at | DateTime | No | |
| expires_at | DateTime | Yes | Indexed |
| revoked | Boolean | Yes | Default False. Indexed |
| refresh_token_hash | Text | No | Future refresh-token metadata; stores a hash, never the raw token |

Cascade

Deleting a User deletes their Sessions.

---

## TABLE: User Preferences

Purpose

Per-user app preferences (theme, layout, default project), one row
per User. Split from Notification Preferences so a future "reset
notifications only" action doesn't touch unrelated UI-state.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| user_id | String | Yes | FK -> Users.id, ON DELETE CASCADE. Unique. Indexed |
| theme | String(20) | No | Default "dark" |
| language | String(10) | No | Default "en" |
| timezone | String(60) | No | Default "UTC" |
| sidebar_state | String(20) | No | e.g. "expanded"/"collapsed". Default "expanded" |
| dashboard_layout | Text | No | JSON-encoded dict, default "{}" |
| default_project_id | String | No | FK -> Projects.id, ON DELETE SET NULL. Indexed |
| ai_preferences | Text | No | JSON-encoded dict, default "{}" |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

Cascade

Deleting a User deletes their UserPreference row (one-to-one, owned).
Deleting the default project only un-scopes it (`default_project_id`
-> NULL).

---

## TABLE: Notification Preferences

Purpose

Per-user notification channel opt-in/opt-out, one row per User. Reuses
the app's existing Browser Notification API-based notification system
(PROJECT_CONTEXT.md "Notifications") -- this table stores preferences,
it does not add a second notification pipeline.

Fields

| Field | Type | Required | Notes |
|--------|------|----------|------|
| id | String | Yes | Primary Key |
| user_id | String | Yes | FK -> Users.id, ON DELETE CASCADE. Unique. Indexed |
| browser_notifications | Boolean | Yes | Default True |
| email_notifications | Boolean | Yes | Default False |
| task_notifications | Boolean | Yes | Default True |
| project_notifications | Boolean | Yes | Default True |
| ai_notifications | Boolean | Yes | Default True |
| reminder_preferences | Text | No | JSON-encoded dict for future channels/timing, default "{}" |
| created_at | DateTime | Yes | |
| updated_at | DateTime | Yes | |

Cascade

Deleting a User deletes their NotificationPreference row (one-to-one,
owned).

---

## Collaboration & Identity <-> Project Relationships

```
Project
   │
   ├── owner (User; associated, SET NULL on delete)
   │
   ├── ProjectMembers (owned, cascade delete)
   │
   ├── ProjectInvitations (owned, cascade delete)
   │
   └── ActivityLog entries (associated, SET NULL on delete)
```

```
User
   │
   ├── owned_projects (associated, SET NULL on delete)
   │
   ├── ProjectMembers (owned, cascade delete)
   │
   ├── Sessions (owned, cascade delete)
   │
   ├── UserPreference (owned, cascade delete, one-to-one)
   │
   ├── NotificationPreference (owned, cascade delete, one-to-one)
   │
   ├── sent_invitations (associated, SET NULL on delete)
   │
   └── ActivityLog entries (associated, SET NULL on delete)
```

Role and Permission have no owning FK relationship to User or
Project (beyond Role's optional `project_id` for a future custom
role) -- both are reusable catalog/definition entities referenced by
key/id from ProjectMember and ProjectInvitation.

---

## Collaboration & Identity Pydantic Schemas

Every Collaboration & Identity model has `Create`/`Update`/`Out`
schemas following the existing Base/Create/Update/Out convention, plus:

- `UserSummary` / `ProjectCollaborationSummary` -- rollup schemas, same
  role as `ProjectSummary`/`AIAccountSummary`. Neither is wired to a
  router yet.
- `UserValidation` -- full persisted shape for the future Git Sync
  Import Engine (SYNC_ARCHITECTURE.md), following the same pattern as
  `AIAccountValidation` et al. Deliberately excludes `password_hash`:
  credentials never belong in a Git-synced file.
- `UserOut`/`SessionOut` deliberately exclude `password_hash`/
  `refresh_token_hash` -- never returned by the API, same treatment as
  `AIAccount.api_key_env_var` never round-tripping the real key.
- The shared `_clean_str_list` normalizer (already used by `tags`/
  `variables`/`created_files`/`modified_files`) also backs
  `Role.permission_keys` and `ProjectMember.permission_overrides`.
- `dashboard_layout`/`ai_preferences`/`reminder_preferences` are
  JSON-encoded dicts in the database (Text column) but typed as
  `dict` on the Pydantic side, exactly how `tags`/`variables`/etc. are
  Text in the database but `List[str]` on the Pydantic side -- the
  json.dumps/json.loads conversion happens in router code, same as
  every other JSON-encoded column, when a router is eventually built.

---



Every synchronized table should eventually include

| Field | Purpose |
|--------|----------|
| device_id | Origin device |
| version | Version counter |
| updated_at | Last modification |
| sync_state | Local/Modified/Synced |
| deleted | Soft delete support |

These fields will enable conflict resolution.

---

# Future Settings Table

Stores

Theme

Notifications

Git Repository

PAT Token (encrypted)

Auto Sync

Sync Interval

PWA Preferences

---

# Naming Conventions

Tables

PascalCase

Models

PascalCase

Columns

snake_case

Primary Key

id

Foreign Keys

entity_id

Timestamps

created_at

updated_at

---

# Migration Rules

When modifying schema

1.

Update SQLAlchemy model

2.

Update Pydantic schema

3.

Update DATABASE_SCHEMA.md

4.

Update CHANGELOG.md

5.

Test CRUD

6.

Verify Dashboard

7.

Verify Build

---

# Long-Term Database Vision

```
SQLite

│

├── Productivity

│      ├── Tasks
│      ├── Timetable
│      └── Activity

│

├── Study

│      ├── Subjects
│      ├── Topics
│      ├── Assignments
│      ├── Notes
│      ├── Resources
│      └── Sessions

│

├── Projects

│      ├── Projects
│      ├── Phases
│      ├── Features
│      ├── Todos
│      ├── Bugs
│      ├── Milestones
│      └── Documentation

│

├── AI

│      ├── AI Accounts
│      ├── Conversations
│      ├── Prompt Templates
│      ├── Project Zips
│      ├── AI Handoffs
│      ├── Token Trackers
│      └── Knowledge Articles

│

├── Collaboration & Identity

│      ├── Users
│      ├── Permissions
│      ├── Roles
│      ├── Project Members
│      ├── Project Invitations
│      ├── Sessions
│      ├── User Preferences
│      └── Notification Preferences

│

└── System

       ├── Settings
       ├── Sync
       └── Logs
```

The database should remain modular, extensible, and optimized for an offline-first productivity platform with Git-based synchronization.