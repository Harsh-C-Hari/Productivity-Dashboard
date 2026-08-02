# ENGINEERING_GUIDELINES.md

# Engineering Guidelines

Project: Personal Productivity System

Version: 1.0

Status: Active Development

---

# Purpose

This document defines the engineering standards for the Personal Productivity System.

Every contributor (human or AI) must follow these guidelines.

These rules exist to ensure the project remains:

- Consistent
- Maintainable
- Scalable
- Modular
- Production Quality

---

# Core Principles

## Rule 1

Never rewrite working code.

Always extend.

---

## Rule 2

Reuse before creating.

If a helper already exists,

reuse it.

---

## Rule 3

Never duplicate logic.

Shared logic belongs in shared utilities.

---

## Rule 4

Every feature must integrate with the Dashboard.

No isolated modules.

---

## Rule 5

Always preserve backward compatibility.

---

## Rule 6

Every feature should be modular.

---

# Code Quality

Code should be

Readable

Predictable

Consistent

Well Named

Simple

Avoid unnecessary abstraction.

Prefer readable code over clever code.

---

# Naming Conventions

## Files

snake_case

Example

```
project_workspace.py

study_sessions.py
```

---

## React Components

PascalCase

```
ProjectCard.tsx

DashboardWidget.tsx
```

---

## Hooks

```
useProjects.ts

useAssignments.ts
```

Always start with

use

---

## Utilities

camelCase

```
calculateProgress()

formatDate()
```

---

## Models

PascalCase

```
Project

Task

Assignment
```

---

## Database Columns

snake_case

```
created_at

updated_at

project_id
```

---

# Folder Structure

Backend

```
routers/

models.py

schemas.py

database.py

services/

utils/
```

Frontend

```
components/

pages/

hooks/

services/

contexts/

types/

utils/
```

Never create duplicate folders.

---

# Backend Rules

Every domain should have

Model

Schema

Router

Business Logic

Validation

Activity Logging

Dashboard Integration

---

# Router Rules

One router

One responsibility.

Good

```
projects.py

tasks.py

subjects.py
```

Bad

```
everything.py
```

---

# API Standards

Use REST.

Examples

```
GET

POST

PUT

DELETE
```

Always return consistent JSON.

Never mix response formats.

---

# Business Logic

Business logic belongs

Backend

OR

React Query hooks.

Never inside pages.

---

# Validation

Validate

Backend

Always.

Frontend validation improves UX.

Backend validation ensures correctness.

---

# Error Handling

Backend

Raise proper HTTP exceptions.

Frontend

Display meaningful messages.

Never silently fail.

---

# Logging

Significant actions should be logged.

Examples

Project Created

Task Completed

Assignment Added

Study Session Finished

Future Timeline consumes these logs.

---

# Database Guidelines

SQLite is authoritative.

Never bypass SQLAlchemy.

Relationships should be explicit.

Avoid unnecessary joins.

Keep queries efficient.

---

# Migration Rules

Whenever schema changes

Update

Models

Schemas

DATABASE_SCHEMA.md

CHANGELOG.md

Test CRUD

Verify build

---

# React Guidelines

Pages

Thin

Hooks

Business Logic

Components

Presentation

Utilities

Pure functions

---

# React Query

Always use React Query.

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

# State Management

Local state

Component

Server state

React Query

Global UI state

React Context

Do not introduce Redux unless truly necessary.

---

# Components

Reusable first.

Avoid copy-paste.

If similar code appears twice,

consider abstraction.

---

# Styling

Tailwind only.

Reuse existing utility classes.

Maintain

Glassmorphism

Dark Theme

Rounded corners

Smooth animations

Professional appearance

---

# Forms

Use controlled components.

Validate input.

Prevent invalid submissions.

Provide user feedback.

---

# File Uploads

Reuse upload helpers.

Do not implement multiple upload systems.

Store only relative paths in database.

---

# Dashboard Rules

Every major module contributes widgets.

Dashboard is always the central overview.

---

# Search Rules

Every future module should expose searchable entities.

Future Global Search will aggregate them.

---

# Performance

Lazy load heavy pages.

Avoid unnecessary renders.

Cache queries.

Paginate if needed.

Optimize charts.

Avoid repeated API calls.

---

# Security

Never hardcode

Passwords

Tokens

Secrets

Keys

Use environment variables.

Validate uploads.

Sanitize input.

---

# Git Sync (Future)

GitHub is synchronization only.

SQLite remains runtime database.

Never commit

study.db

Export structured data instead.

---

# Documentation Rules

Every architectural change updates

README.md

PROJECT_CONTEXT.md

ARCHITECTURE.md

DATABASE_SCHEMA.md

CHANGELOG.md

AI_HANDOFF.md

if applicable.

---

# Testing Checklist

Every completed feature should pass

✔ Backend starts

✔ Frontend builds

✔ CRUD works

✔ Dashboard updates

✔ Mobile layout

✔ Desktop layout

✔ No console errors

✔ No TypeScript errors

✔ No API errors

✔ No broken imports

---

# Pull Request Checklist

Before considering work complete

- Remove debug code

- Remove unused imports

- Remove console logs

- Verify formatting

- Verify responsiveness

- Update documentation

- Update AI_HANDOFF.md

- Verify production build

---

# AI Development Rules

Before writing code

Read

PROJECT_CONTEXT.md

ARCHITECTURE.md

DATABASE_SCHEMA.md

ENGINEERING_GUIDELINES.md

AI_HANDOFF.md

Inspect current implementation.

Understand architecture.

Extend.

Never rewrite.

---

# Token Limit Rule

If conversation ends

Always output

Completed work

Created files

Modified files

Remaining work

Known issues

Architecture decisions

Next task

Nothing completed should remain undocumented.

---

# Definition of Done

A feature is complete only when

Backend implemented

Frontend implemented

CRUD verified

Dashboard integrated

Responsive

Production build passes

Documentation updated

AI_HANDOFF.md updated

Only then is the feature considered complete.

---

# Long-Term Goal

The project should evolve into a complete Offline-First Personal Productivity Operating System.

Every engineering decision should move the project toward

Modularity

Scalability

Maintainability

Consistency

Offline reliability

Git-based synchronization

without sacrificing simplicity.