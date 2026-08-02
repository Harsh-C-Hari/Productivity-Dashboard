# SYNC_ARCHITECTURE.md

# Git Synchronization Architecture

Version: Planned

Status: Design Approved

Database: SQLite

Synchronization: Git + GitHub (Private Repository)

---

# Purpose

This document describes the synchronization architecture for the Personal Productivity System.

The application is designed as an Offline-First system.

SQLite remains the primary runtime database.

GitHub acts only as a synchronization layer.

No hosted backend database is required.

No cloud database is required.

No always-running server is required.

---

# Goals

✔ Offline First

✔ Fast Local Performance

✔ Cross Device Sync

✔ Complete Version History

✔ No Monthly Hosting

✔ No Cloud Database

✔ Private Repository

✔ Human Readable Storage

✔ Automatic Conflict Detection

---

# High-Level Architecture

```
Laptop

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

Phone
```

Both devices always remain usable even without internet.

---

# Synchronization Philosophy

SQLite is NOT synchronized.

Only exported structured files are synchronized.

The database is rebuilt from exported data whenever synchronization occurs.

SQLite remains an implementation detail.

Git tracks the exported project data.

---

# Repository Structure

```
sync-data/

tasks/

subjects/

topics/

assignments/

notes/

resources/

projects/

settings/

metadata/

uploads/

README.md
```

Each entity should be stored as an individual file whenever practical.

Example

```
tasks/

3f21.json

a921.json

bb91.json
```

instead of

```
tasks.json
```

This minimizes merge conflicts.

---

# Export Engine

Responsibilities

Read SQLite

↓

Convert records

↓

Write structured files

↓

Track deletions

↓

Update metadata

---

# Import Engine

Responsibilities

Read exported files

↓

Compare versions

↓

Update SQLite

↓

Delete removed items

↓

Refresh indexes

---

# Sync Engine

The Sync Engine coordinates synchronization.

Responsibilities

Export

Git Commit

Git Push

Git Pull

Import

Conflict Resolution

Status Reporting

---

# Git Service

Responsibilities

Clone repository

Authenticate

Commit

Push

Pull

Fetch

Resolve merge state

Display sync status

---

# Change Detector

Detect

Created

Modified

Deleted

Moved

Renamed

Only changed files should be committed.

---

# Repository Layout

```
sync-data/

tasks/

task-id.json

subjects/

subject-id.json

notes/

note-id.md

resources/

resource-id.json

projects/

project-id/

project.json

roadmap.json

milestones/

bugs/

features/

attachments/

settings/

settings.json

metadata/

devices.json

sync.json
```

---

# Upload Synchronization

Uploads are stored separately.

```
uploads/

image.png

lecture.pdf

diagram.png
```

Database stores only relative paths.

Git synchronizes uploads alongside metadata.

---

# Metadata

Every synchronized entity should contain

```
id

version

created_at

updated_at

device_id

deleted

sync_state
```

---

# Device Registration

Every device receives a unique identifier.

Example

```
Laptop

HP-OMEN-001

Phone

Galaxy-A54
```

Device IDs assist with conflict resolution.

---

# Sync States

```
LOCAL

MODIFIED

SYNCED

CONFLICT

DELETED
```

---

# Manual Sync

Workflow

```
Sync Button

↓

Export

↓

Commit

↓

Push

↓

Pull

↓

Import

↓

Dashboard Refresh
```

---

# Automatic Sync (Future)

Optional

Trigger

Startup

Shutdown

Timed Interval

Network Available

---

# Conflict Detection

Conflict occurs when

Two devices modify the same record before synchronization.

---

# Conflict Resolution

Preferred strategy

Last Modified Wins

Future

Manual Merge UI

Future

Field-level merging

---

# Deletion Strategy

Soft Delete

```
deleted = true
```

Permanent deletion occurs only after successful synchronization.

---

# Repository Authentication

Authentication uses

GitHub Personal Access Token

Stored securely.

Never committed.

Never hardcoded.

---

# Repository Type

Private Repository only.

No public synchronization.

---

# Encryption

Future enhancement

Encrypt exported files before pushing.

Optional.

---

# Git Ignore

Never synchronize

```
study.db

node_modules/

venv/

dist/

build/

.pyc

__pycache__/
```

---

# Failure Recovery

If synchronization fails

Rollback SQLite changes.

Preserve export.

Retry later.

Never corrupt user data.

---

# Version History

Git automatically provides

History

Restore

Diff

Audit

Rollback

---

# Future Features

Sync Status

Recent Commits

Last Sync Time

Pending Changes

Conflict Viewer

History Browser

Repository Health

---

# Dashboard Integration

Dashboard widget

Displays

Repository Status

Current Branch

Last Sync

Pending Changes

Conflicts

Sync Progress

---

# Security

Never expose

PAT

Repository URL

Credentials

Store securely.

---

# Long-Term Vision

```
                Device A

                    │

             SQLite Database

                    │

             Export Engine

                    │

                  Git

                    │

         Private GitHub Repository

                    │

                  Git

                    │

             Import Engine

                    │

             SQLite Database

                    │

                Device B
```

The synchronization layer should remain completely independent from the runtime database.

SQLite continues to provide fast local performance.

GitHub provides synchronization, history, and backup.

No cloud database is required.