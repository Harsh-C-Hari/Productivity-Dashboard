"""
FastAPI application entrypoint.

Run with:  uvicorn app.main:app --reload --port 8000
"""
import os
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy import text

from dotenv import load_dotenv

# Load backend/.env explicitly, by path relative to this file, *before*
# importing any local module below -- several of them (database.py,
# security.py, uploads.py, email_utils.py) read os.environ at import
# time, so .env has to be in os.environ before those imports run.
#
# We resolve the path from this file's own location (not relying on
# python-dotenv's cwd-based auto-discovery) so `uvicorn app.main:app`
# picks up backend/.env no matter which directory you launch it from.
# On Vercel there's no .env file at all -- load_dotenv() just no-ops
# and the real env vars set in Project Settings are used as-is.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import models
from .database import engine, SessionLocal, run_startup_migrations
from .timeutils import utc_now
from .uploads import UPLOAD_DIR, ensure_upload_dir, supabase_storage_configured
from .routers import (
    tasks,
    timetable,
    dashboard,
    subjects,
    assignments,
    notes,
    resources,
    study_sessions,
    study_hub,
    projects,
    phases,
    features,
    todos,
    bugs,
    milestones,
    documents,
    project_resources,
    timeline,
    analytics,
    search,
    ai_accounts,
    conversations,
    prompt_templates,
    project_zips,
    ai_handoffs,
    token_trackers,
    knowledge_articles,
    ai_analytics,
    users,
    permissions,
    roles,
    project_members,
    project_invitations,
    user_preferences,
    notification_preferences,
    notifications,
    activity,
    auth,
    sessions,
    push,
)

# `RUN_STARTUP_TASKS` (default "true") gates `create_all` + the
# ownership-column migration + the three `_seed_if_empty` sample-data
# seeders below. Each is idempotent/safe to re-run, but on serverless
# every cold start pays for the extra round-trips to the database (see
# database.py's `run_startup_migrations` docstring) -- once a
# deployment's schema is known current, set this to "false" so cold
# starts don't do that work (and don't open a connection just to run a
# handful of `SELECT count(*)` checks) on every invocation.
_RUN_STARTUP_TASKS = os.environ.get("RUN_STARTUP_TASKS", "true").lower() != "false"

if _RUN_STARTUP_TASKS:
    models.Base.metadata.create_all(bind=engine)
    run_startup_migrations()  # adds the data-isolation fix's user_id columns to pre-existing databases

# Local-disk mode only: Vercel's filesystem is read-only outside /tmp,
# so this must never run when Supabase Storage is configured (see
# uploads.py) -- `ensure_upload_dir` already no-ops in that case, but
# skip it here too rather than relying on that alone.
if not supabase_storage_configured():
    ensure_upload_dir()

app = FastAPI(title="Productivity Dashboard API", version="1.0.0")

# `ALLOWED_ORIGINS` -- comma-separated list of allowed frontend origins,
# e.g. "https://your-app.vercel.app,https://your-app-git-preview.vercel.app".
# Defaults to "*" (wide open) so the app still works out of the box for
# local/personal use; set this explicitly once real users are on it.
# allow_credentials is intentionally False either way: auth tokens are
# sent via the `Authorization` header (see frontend/src/lib/api.ts), not
# cookies, so no cross-site credentialed requests are ever made -- and
# allow_credentials=True combined with a wildcard origin is a real CORS
# misconfiguration (browsers reject it; some servers silently reflect
# the request origin instead, which is worse than either setting alone).
_allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "").strip()
_allowed_origins = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves uploaded assignment/note attachments and resource-library files
# in local-disk mode only -- in Supabase Storage mode, `save_upload`
# already returns a direct Supabase public URL, so there's nothing for
# this app to serve itself (and UPLOAD_DIR may not even exist on
# Vercel's read-only filesystem).
if not supabase_storage_configured():
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(tasks.router)
app.include_router(timetable.router)
app.include_router(subjects.router)
app.include_router(subjects.topics_router)
app.include_router(assignments.router)
app.include_router(notes.router)
app.include_router(resources.router)
app.include_router(study_sessions.router)
app.include_router(study_hub.router)

# Project Workspace. `projects.router` is registered before the other
# Project Workspace routers because `projects.search_projects` imports
# their `serialize_*` helpers lazily (inside the function body) to
# avoid a circular import, but that only works once those modules are
# themselves importable -- plain registration order here doesn't
# actually matter for that reason, only for route-matching order within
# a single router (handled inside each router module itself).
app.include_router(projects.router)
app.include_router(phases.router)
app.include_router(features.router)
app.include_router(todos.router)
app.include_router(bugs.router)
app.include_router(milestones.router)
app.include_router(documents.router)
app.include_router(project_resources.router)
app.include_router(timeline.router)
app.include_router(analytics.router)

# AI Workspace. `ai_accounts.router` first since conversations/zips/
# handoffs/token_trackers all reference an AIAccount; `ai_analytics`
# last since it lazily imports serializers from `ai_handoffs`/
# `conversations` (see that module's docstring, same reason
# `projects.py` lazily imports sibling serializers).
app.include_router(ai_accounts.router)
app.include_router(conversations.router)
app.include_router(prompt_templates.router)
app.include_router(project_zips.router)
app.include_router(ai_handoffs.router)
app.include_router(token_trackers.router)
app.include_router(knowledge_articles.router)
app.include_router(ai_analytics.router)

# Identity & Security. `auth.router` (register/login/logout/refresh/
# revoke/me/password/email flows) and `sessions.router` (list/revoke
# login sessions) are registered first among the collaboration layer
# since `auth_dependencies.py`'s authorization dependencies -- used by
# the collaboration routers below -- resolve the current User from the
# tokens these two routers issue.
app.include_router(auth.router)
app.include_router(sessions.router)

# Collaboration layer (Project Members / Invitations / Roles / Permissions
# / User & Notification Preferences / Activity Log). `users.router` is
# registered first since project_members/project_invitations/preferences
# all reference a `user_id`; `roles`/`permissions` next since members and
# invitations reference `role_id`; `project_members` before
# `project_invitations` since accepting an invitation creates/updates a
# ProjectMember (imported lazily inside that router, same lazy-import
# pattern `projects.py`/`ai_analytics.py` already use for their sibling
# serializers). `activity` is read-only over the existing ActivityLog
# table and has no ordering dependency on the others.
app.include_router(users.router)
app.include_router(permissions.router)
app.include_router(roles.router)
app.include_router(project_members.router)
app.include_router(project_invitations.router)
app.include_router(project_invitations.token_router)
app.include_router(user_preferences.router)
app.include_router(notification_preferences.router)
app.include_router(notifications.router)
app.include_router(activity.router)

# Web Push (background delivery for the installed PWA): per-device
# subscription storage plus the shared-secret dispatch endpoint an
# external pinger (uptime bot / GitHub Actions) calls every few minutes.
# `/api/push` collides with nothing, so ordering is irrelevant here.
app.include_router(push.router)

app.include_router(search.router)  # registered after AI Workspace since global search now spans it too
app.include_router(dashboard.router)  # registered last since it depends on study_hub + project_workspace helpers


@app.api_route("/api/health", methods=["GET", "HEAD"])
def health_check():
    """Liveness check that also touches the database -- not just the
    Vercel function. A static response only keeps the serverless
    function warm; it does nothing to stop Supabase's free-tier
    project from auto-pausing after inactivity, and doesn't keep a
    real Postgres connection warm through the pooler either. This is
    the one endpoint safe to point an external uptime monitor at (no
    auth, no side effects) to cover both."""
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    finally:
        db.close()


def _seed_if_empty():
    """Populate a handful of realistic starter records on first run only,
    so the app is immediately usable instead of showing an empty state."""
    db = SessionLocal()
    try:
        if db.query(models.Task).count() > 0:
            return

        now = utc_now()

        sample_tasks = [
            models.Task(
                title="Finish React Query migration",
                description="Replace remaining useEffect data fetching with React Query hooks in the dashboard module.",
                category=models.TaskCategory.project,
                deadline=now + timedelta(hours=6),
                estimated_effort_hours=3,
                status=models.TaskStatus.in_progress,
                progress=60,
            ),
            models.Task(
                title="Algorithms problem set 4",
                description="Dynamic programming problems 1-6, show work for recurrence relations.",
                category=models.TaskCategory.assignment,
                deadline=now + timedelta(days=1, hours=2),
                estimated_effort_hours=4,
                status=models.TaskStatus.todo,
                progress=10,
            ),
            models.Task(
                title="Read Chapter 7 - Operating Systems",
                description="Focus on scheduling algorithms and deadlock avoidance.",
                category=models.TaskCategory.reading,
                deadline=now + timedelta(days=2),
                estimated_effort_hours=2,
                status=models.TaskStatus.todo,
                progress=0,
            ),
            models.Task(
                title="Database systems midterm",
                description="Covers normalization, indexing, and transaction isolation levels.",
                category=models.TaskCategory.exam,
                deadline=now + timedelta(days=5),
                estimated_effort_hours=8,
                status=models.TaskStatus.todo,
                progress=20,
            ),
            models.Task(
                title="Submit internship application",
                description="Tailor resume bullet points and finish cover letter draft.",
                category=models.TaskCategory.personal,
                deadline=now - timedelta(hours=5),
                estimated_effort_hours=1.5,
                status=models.TaskStatus.todo,
                progress=40,
            ),
            models.Task(
                title="Refactor auth module",
                description="Extract token refresh logic into a reusable hook.",
                category=models.TaskCategory.project,
                deadline=now + timedelta(days=10),
                estimated_effort_hours=3,
                status=models.TaskStatus.todo,
                progress=0,
            ),
            models.Task(
                title="Group project standup notes",
                description="Summarize sprint progress for the capstone team.",
                category=models.TaskCategory.project,
                deadline=now - timedelta(days=1),
                estimated_effort_hours=0.5,
                status=models.TaskStatus.done,
                progress=100,
            ),
        ]
        db.add_all(sample_tasks)

        sample_slots = [
            models.TimetableSlot(title="Data Structures Lecture", location="Hall B12", day_of_week=models.DayOfWeek.mon, start_time="09:00", end_time="10:30", color="purple"),
            models.TimetableSlot(title="Study Block: OS", location="Library 3F", day_of_week=models.DayOfWeek.mon, start_time="14:00", end_time="16:00", color="blue"),
            models.TimetableSlot(title="Database Systems", location="Room 214", day_of_week=models.DayOfWeek.tue, start_time="11:00", end_time="12:30", color="cyan"),
            models.TimetableSlot(title="Capstone Team Sync", location="Zoom", day_of_week=models.DayOfWeek.tue, start_time="17:00", end_time="18:00", color="pink"),
            models.TimetableSlot(title="Algorithms Lecture", location="Hall A2", day_of_week=models.DayOfWeek.wed, start_time="09:00", end_time="10:30", color="purple"),
            models.TimetableSlot(title="Gym", location="Rec Center", day_of_week=models.DayOfWeek.wed, start_time="18:00", end_time="19:00", color="green"),
            models.TimetableSlot(title="Database Systems", location="Room 214", day_of_week=models.DayOfWeek.thu, start_time="11:00", end_time="12:30", color="cyan"),
            models.TimetableSlot(title="Project Work Block", location="Makerspace", day_of_week=models.DayOfWeek.thu, start_time="15:00", end_time="17:30", color="blue"),
            models.TimetableSlot(title="Algorithms Lecture", location="Hall A2", day_of_week=models.DayOfWeek.fri, start_time="09:00", end_time="10:30", color="purple"),
            models.TimetableSlot(title="Career Fair Prep", location="Student Union", day_of_week=models.DayOfWeek.fri, start_time="13:00", end_time="14:00", color="orange"),
        ]
        db.add_all(sample_slots)

        db.add(models.ActivityLog(message="Welcome to your Productivity Dashboard!", icon="sparkles"))
        db.commit()
    finally:
        db.close()


def _seed_study_hub_if_empty():
    """Populates Study Hub sample data (subjects, topics, assignments,
    notes, link resources, study sessions) on first run only, mirroring
    `_seed_if_empty` above."""
    db = SessionLocal()
    try:
        if db.query(models.Subject).count() > 0:
            return

        now = utc_now()

        dsa = models.Subject(name="Data Structures & Algorithms", code="CS 301", instructor="Dr. Chen", color="purple")
        db_sys = models.Subject(name="Database Systems", code="CS 340", instructor="Dr. Patel", color="cyan")
        os_sys = models.Subject(name="Operating Systems", code="CS 350", instructor="Dr. Okafor", color="blue")
        db.add_all([dsa, db_sys, os_sys])
        db.flush()  # assigns IDs without committing, so FKs below can reference them

        topic_dp = models.Topic(subject_id=dsa.id, title="Dynamic Programming", order_index=0)
        topic_graphs = models.Topic(subject_id=dsa.id, title="Graph Algorithms", order_index=1)
        topic_norm = models.Topic(subject_id=db_sys.id, title="Normalization & Indexing", order_index=0)
        topic_txn = models.Topic(subject_id=db_sys.id, title="Transactions", order_index=1)
        topic_sched = models.Topic(subject_id=os_sys.id, title="Scheduling", order_index=0)
        topic_deadlock = models.Topic(subject_id=os_sys.id, title="Deadlocks & Memory", order_index=1)
        db.add_all([topic_dp, topic_graphs, topic_norm, topic_txn, topic_sched, topic_deadlock])
        db.flush()

        sample_assignments = [
            models.Assignment(
                subject_id=dsa.id,
                topic_id=topic_dp.id,
                title="Problem Set 4: Dynamic Programming",
                description="Recurrence relations and memoization, problems 1-6.",
                deadline=now + timedelta(days=1),
                estimated_effort_hours=4,
                status=models.AssignmentStatus.in_progress,
                progress=10,
            ),
            models.Assignment(
                subject_id=dsa.id,
                topic_id=topic_graphs.id,
                title="Graph traversal lab report",
                description="Write up BFS/DFS results and complexity analysis from the lab.",
                deadline=now + timedelta(days=4),
                estimated_effort_hours=3,
                status=models.AssignmentStatus.todo,
                progress=0,
            ),
            models.Assignment(
                subject_id=dsa.id,
                title="Midterm review",
                description="Review session summary and practice problems.",
                deadline=now - timedelta(days=2),
                estimated_effort_hours=3,
                status=models.AssignmentStatus.done,
                progress=100,
                completed_at=now - timedelta(days=2, hours=-1),
            ),
            models.Assignment(
                subject_id=db_sys.id,
                topic_id=topic_norm.id,
                title="ER diagram assignment",
                description="Model the university enrollment schema through BCNF.",
                deadline=now + timedelta(days=2),
                estimated_effort_hours=2,
                status=models.AssignmentStatus.in_progress,
                progress=50,
            ),
            models.Assignment(
                subject_id=db_sys.id,
                topic_id=topic_txn.id,
                title="Transaction isolation quiz prep",
                description="Review isolation levels and phantom read scenarios.",
                deadline=now - timedelta(hours=3),
                estimated_effort_hours=1,
                status=models.AssignmentStatus.todo,
                progress=20,
            ),
            models.Assignment(
                subject_id=os_sys.id,
                topic_id=topic_sched.id,
                title="CPU scheduling simulator",
                description="Implement and compare FCFS, SJF, and round robin.",
                deadline=now + timedelta(days=6),
                estimated_effort_hours=5,
                status=models.AssignmentStatus.todo,
                progress=0,
            ),
            models.Assignment(
                subject_id=os_sys.id,
                topic_id=topic_deadlock.id,
                title="Deadlock avoidance essay",
                description="Compare banker's algorithm against deadlock detection/recovery.",
                deadline=now + timedelta(hours=12),
                estimated_effort_hours=2,
                status=models.AssignmentStatus.in_progress,
                progress=70,
            ),
        ]
        db.add_all(sample_assignments)

        sample_notes = [
            models.Note(
                subject_id=dsa.id,
                topic_id=topic_dp.id,
                title="DP recurrence cheat sheet",
                content=(
                    "# Dynamic Programming Recurrences\n\n"
                    "- **Knapsack**: dp[i][w] = max(dp[i-1][w], dp[i-1][w-wt[i]] + val[i])\n"
                    "- **LCS**: dp[i][j] = dp[i-1][j-1] + 1 if match, else max(dp[i-1][j], dp[i][j-1])\n\n"
                    "Reminder: always define the base case *before* writing the transition."
                ),
            ),
            models.Note(
                subject_id=db_sys.id,
                topic_id=topic_norm.id,
                title="Normal forms, quick recap",
                content=(
                    "# Normal Forms\n\n"
                    "1. **1NF** - atomic columns, no repeating groups\n"
                    "2. **2NF** - 1NF + no partial dependency on a composite key\n"
                    "3. **3NF** - 2NF + no transitive dependency\n"
                    "4. **BCNF** - every determinant is a candidate key\n"
                ),
            ),
            models.Note(
                subject_id=os_sys.id,
                topic_id=topic_sched.id,
                title="Scheduling algorithms comparison",
                content=(
                    "# Scheduling Algorithms\n\n"
                    "*FCFS* is simple but has poor average wait time under high variance.\n"
                    "*SJF* minimizes average wait time but can starve long jobs.\n"
                    "*Round Robin* is fair but throughput depends heavily on quantum size."
                ),
            ),
        ]
        db.add_all(sample_notes)

        sample_resources = [
            models.Resource(
                subject_id=dsa.id,
                topic_id=topic_dp.id,
                title="MIT OCW: Dynamic Programming Lecture",
                resource_type=models.ResourceType.link,
                external_url="https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/",
            ),
            models.Resource(
                subject_id=db_sys.id,
                title="Course syllabus",
                resource_type=models.ResourceType.link,
                external_url="https://example.edu/cs340/syllabus",
            ),
            models.Resource(
                subject_id=os_sys.id,
                topic_id=topic_deadlock.id,
                title="Banker's Algorithm reference",
                resource_type=models.ResourceType.link,
                external_url="https://en.wikipedia.org/wiki/Banker%27s_algorithm",
            ),
        ]
        db.add_all(sample_resources)

        # Study sessions across the last several days, with one gap, so the
        # streak/analytics widgets have something realistic to show.
        def completed_session(subject, days_ago, hour, minutes):
            start = (now - timedelta(days=days_ago)).replace(hour=hour, minute=0, second=0, microsecond=0)
            return models.StudySession(
                subject_id=subject.id,
                session_type=models.StudySessionType.pomodoro,
                started_at=start,
                ended_at=start + timedelta(minutes=minutes),
                duration_minutes=minutes,
            )

        sample_sessions = [
            completed_session(dsa, 0, 9, 50),
            completed_session(db_sys, 1, 19, 25),
            completed_session(dsa, 2, 14, 45),
            # day 3 intentionally skipped
            completed_session(os_sys, 4, 20, 30),
            completed_session(dsa, 5, 10, 60),
        ]
        db.add_all(sample_sessions)

        db.add(models.ActivityLog(message="Study Hub is ready — 3 subjects added", icon="graduation-cap"))
        db.commit()
    finally:
        db.close()

def _seed_collaboration_if_empty():
    """Seeds the `Permission` catalog and the four system `Role`s (Owner,
    Admin, Member, Viewer -- `is_system=True`, `project_id=None` so
    they're global/available to every project) on first run only,
    mirroring `_seed_if_empty`/`_seed_study_hub_if_empty` above. Neither
    table has any other writer that would create these rows, so
    `project_members`/`roles` endpoints would otherwise have nothing to
    assign until an operator manually POSTed them in.
    """
    import json as _json

    db = SessionLocal()
    try:
        if db.query(models.Permission).count() > 0:
            return

        permission_defs = [
            ("view_project", "View Project", "See project details, phases, features, and progress.", "project"),
            ("manage_project", "Manage Project", "Edit project settings, archive, or delete the project.", "project"),
            ("view_members", "View Members", "See the project's member list and roles.", "members"),
            ("invite_members", "Invite Members", "Send project invitations to new collaborators.", "members"),
            ("manage_members", "Manage Members", "Change member roles/status or remove members.", "members"),
            ("manage_roles", "Manage Roles", "Create, edit, or delete project roles and their permissions.", "members"),
            ("view_tasks", "View Tasks", "See todos, features, bugs, and milestones.", "tasks"),
            ("manage_tasks", "Manage Tasks", "Create, edit, or delete todos, features, bugs, and milestones.", "tasks"),
            ("manage_documents", "Manage Documents", "Create, edit, or delete project documentation and resources.", "project"),
            ("view_ai_workspace", "View AI Workspace", "See AI conversations, prompt templates, and handoffs.", "ai_workspace"),
            ("manage_ai_workspace", "Manage AI Workspace", "Create, edit, or delete AI accounts, conversations, and related records.", "ai_workspace"),
        ]
        permissions_by_key = {}
        for key, name, description, category in permission_defs:
            permission = models.Permission(key=key, name=name, description=description, category=category)
            db.add(permission)
            permissions_by_key[key] = permission
        db.flush()

        all_keys = list(permissions_by_key.keys())
        admin_keys = [k for k in all_keys if k != "manage_project"]
        member_keys = ["view_project", "view_members", "view_tasks", "manage_tasks", "manage_documents", "view_ai_workspace", "manage_ai_workspace"]
        viewer_keys = ["view_project", "view_members", "view_tasks", "view_ai_workspace"]

        system_roles = [
            ("Owner", "Full control over the project, including membership, roles, and deletion.", all_keys),
            ("Admin", "Can manage members, tasks, and content, but cannot delete the project or transfer ownership.", admin_keys),
            ("Member", "Can view the project and manage its day-to-day work items.", member_keys),
            ("Viewer", "Read-only access to the project.", viewer_keys),
        ]
        for name, description, keys in system_roles:
            db.add(models.Role(name=name, description=description, is_system=True, project_id=None, permission_keys=_json.dumps(keys)))

        db.commit()
    finally:
        db.close()


# Sample-data seeders -- each already checks "is this table empty?"
# before writing anything, so these are no-ops against a real,
# populated (e.g. migrated-to-Supabase) database. Still gated behind
# `_RUN_STARTUP_TASKS` (see above) purely to skip the extra
# count-query round-trips on every serverless cold start once a
# deployment is known to be past the "needs seeding" stage.
if _RUN_STARTUP_TASKS:
    _seed_if_empty()
    _seed_study_hub_if_empty()
    _seed_collaboration_if_empty()