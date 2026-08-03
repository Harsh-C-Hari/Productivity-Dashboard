"""
SQLAlchemy ORM models for the Productivity Dashboard.

Core tables:
- tasks: the core work item tracked by the app
- timetable_slots: the recurring weekly schedule
- activity_log: an append-only trail of what happened, for the
  "Recent Activity" dashboard widget

Study Hub tables (subject-scoped academic workspace):
- subjects: courses/classes the user is organizing work around
- topics: modules/units within a subject
- assignments: academic work items, analogous to Task but subject-scoped
- notes: lightweight rich text notes, scoped to a subject/topic
- resources: a per-subject library of uploaded files and external links
- study_sessions: logged study time (Pomodoro-style or manual), used for
  streaks and the hours-by-subject analytics on the Study Hub dashboard

Project Workspace tables (project-scoped work management, backend
foundation only -- see AI_HANDOFF.md for router/frontend status):
- projects: top-level container for a body of work (a repo, an app, etc.)
- project_phases: ordered roadmap stages within a project
- features: planned/in-progress work items, optionally grouped by phase
- project_todos: fine-grained task items, reuses TaskStatus and the
  existing Smart Urgency Engine field shape (deadline/effort/progress)
- bugs: defect tracking, optionally tied to a phase/feature
- milestones: dated checkpoints, optionally tied to a phase
- project_resources: file/link references, mirrors the Study Hub
  `Resource` shape so the existing upload helper can be reused as-is
- project_documents: markdown documentation pages
- timeline_events: an append-only, reusable event trail per project
  (the project-scoped analogue of ActivityLog)

AI Workspace tables (multi-assistant AI project-management workspace,
backend foundation only -- see AI_HANDOFF.md for router/frontend status):
- ai_accounts: a configured AI assistant (Claude, GPT, Gemini, ...) the
  user works with; never stores the actual API key, only the name of
  the environment variable that holds it (see Security in
  PROJECT_CONTEXT.md)
- conversations: a chat/session with an AI account, optionally scoped
  to a project
- prompt_templates: reusable prompt text, not tied to any one project
  or account
- project_zips: a point-in-time zip snapshot of a project handed off
  to (or received from) an AI account/conversation
- ai_handoffs: structured session handoff notes (completed work,
  created/modified files, remaining work, next objective), the
  database-backed analogue of this repo's own AI_HANDOFF.md
- token_trackers: an append-only log of token usage per account/
  conversation, for future cost/usage analytics
- knowledge_articles: durable reference notes an AI account (or the
  user) has written, optionally scoped to a project, mirrors
  ProjectDocument's shape
"""
import enum
import uuid
from datetime import timezone

from sqlalchemy import (
    Column, String, Text, DateTime, Float, Integer, Boolean, ForeignKey,
    Enum as SAEnum, UniqueConstraint,
)
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import relationship
from .database import Base
from .timeutils import utc_now


def gen_id() -> str:
    return uuid.uuid4().hex[:12]


class UTCDateTime(TypeDecorator):
    """DateTime column that is naive (UTC) at rest -- SQLite has no
    real timezone support -- but always timezone-*aware* (UTC) once it
    reaches Python/Pydantic. See timeutils.py for the full story on
    why this is the fix for the app-wide relative-timestamp offset.

    This is the ONE place that change is made: every model column
    below uses this type instead of plain `DateTime`, so every
    Pydantic schema and every API response automatically gets a
    correctly UTC-labeled timestamp, with no per-router or per-page
    changes required.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # Everything in this column is UTC by construction (see
        # process_bind_param and every `default=utc_now` below), so
        # it's safe to always label rows coming back out as UTC.
        return value.replace(tzinfo=timezone.utc)


class TaskStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class TaskCategory(str, enum.Enum):
    study = "study"
    assignment = "assignment"
    project = "project"
    exam = "exam"
    reading = "reading"
    personal = "personal"
    other = "other"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=gen_id)
    # Personal-data ownership (data-isolation fix). Nullable only so
    # legacy pre-migration rows (created before this column existed)
    # don't break the schema -- see main.py's `_run_startup_migrations`.
    # A NULL owner is never returned to any user (see
    # ownership_helpers.filter_owned): it's treated as orphaned, not
    # globally visible.
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    category = Column(SAEnum(TaskCategory), default=TaskCategory.other, nullable=False)
    deadline = Column(UTCDateTime, nullable=True)
    estimated_effort_hours = Column(Float, default=1.0)  # hours of work estimated
    status = Column(SAEnum(TaskStatus), default=TaskStatus.todo, nullable=False)
    progress = Column(Integer, default=0)  # 0-100
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)
    completed_at = Column(UTCDateTime, nullable=True)
    # Placeholder for future file-attachment support. Stored as a
    # comma-separated list of filenames for the MVP.
    attachments = Column(Text, default="")


class DayOfWeek(str, enum.Enum):
    mon = "mon"
    tue = "tue"
    wed = "wed"
    thu = "thu"
    fri = "fri"
    sat = "sat"
    sun = "sun"


class TimetableSlot(Base):
    __tablename__ = "timetable_slots"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    location = Column(String(200), default="")
    day_of_week = Column(SAEnum(DayOfWeek), nullable=False)
    start_time = Column(String(5), nullable=False)  # "HH:MM" 24h
    end_time = Column(String(5), nullable=False)  # "HH:MM" 24h
    color = Column(String(20), default="purple")  # theme accent tag
    created_at = Column(UTCDateTime, default=utc_now)


class ActivityLog(Base):
    """App-wide "Recent Activity" trail. Extended (not replaced) for
    collaboration: `user_id`/`project_id`/`entity_type`/`entity_id`/
    `action` are new, all nullable, all defaulted to NULL/"" -- every
    pre-existing call site (`log_activity(db, message, icon)` and
    `routers/tasks.py`'s local copy) keeps compiling and keeps writing
    valid rows unchanged. See DATABASE_SCHEMA.md "Activity Log" for why
    this table was extended instead of a second one being added
    alongside it."""
    __tablename__ = "activity_log"

    id = Column(String, primary_key=True, default=gen_id)
    message = Column(String(300), nullable=False)
    icon = Column(String(30), default="activity")
    created_at = Column(UTCDateTime, default=utc_now, index=True)

    # ---- Collaboration/audit extension (additive) ----
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(50), nullable=True, index=True)  # e.g. "created", "updated", "invited", "role_changed"
    entity_type = Column(String(50), nullable=True, index=True)  # e.g. "project", "todo", "member", "invitation"
    entity_id = Column(String, nullable=True)

    user = relationship("User", back_populates="activity_log_entries")
    project = relationship("Project", back_populates="activity_log_entries")


# ======================================================================
# Study Hub
# ======================================================================

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String, primary_key=True, default=gen_id)
    # Owning user. Topic/Assignment/Note/Resource are all subject-scoped
    # (they carry subject_id, not their own user_id) and inherit
    # ownership by joining back to this column -- same "child inherits
    # from parent" pattern the task brief requires for Project content,
    # applied to Study Hub content via Subject instead of Project.
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(40), default="")  # e.g. "CS 301"
    instructor = Column(String(120), default="")
    color = Column(String(20), default="purple")  # theme accent tag, matches timetable colors
    created_at = Column(UTCDateTime, default=utc_now)


class Topic(Base):
    """A module/unit within a subject, used to group assignments, notes,
    and resources more finely than the subject alone."""
    __tablename__ = "topics"

    id = Column(String, primary_key=True, default=gen_id)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    order_index = Column(Integer, default=0)
    created_at = Column(UTCDateTime, default=utc_now)


class AssignmentStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class Assignment(Base):
    """Academic work item, subject-scoped. Deliberately mirrors Task's
    shape (title/description/deadline/effort/status/progress/attachments)
    so it can reuse the same Smart Urgency engine, while being organized
    by subject/topic instead of a flat category."""
    __tablename__ = "assignments"

    id = Column(String, primary_key=True, default=gen_id)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String, ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    deadline = Column(UTCDateTime, nullable=True)
    estimated_effort_hours = Column(Float, default=1.0)
    status = Column(SAEnum(AssignmentStatus), default=AssignmentStatus.todo, nullable=False)
    progress = Column(Integer, default=0)  # 0-100
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)
    completed_at = Column(UTCDateTime, nullable=True)
    # JSON-encoded list of {filename, original_name, url, size_bytes, content_type}
    attachments = Column(Text, default="[]")


class Note(Base):
    """A lightweight rich-text note, scoped to a subject and optionally a
    topic. Content is stored as a small markdown-lite string rendered
    client-side (see frontend/src/lib/markdown.ts)."""
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=gen_id)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String, ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")
    attachments = Column(Text, default="[]")  # same shape as Assignment.attachments
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)


class ResourceType(str, enum.Enum):
    pdf = "pdf"
    ppt = "ppt"
    docx = "docx"
    image = "image"
    zip = "zip"
    link = "link"
    other = "other"


class Resource(Base):
    """One entry in a subject's resource library: either an uploaded file
    or an external link. File-backed resources have file_name/file_path/
    file_size_bytes populated; link resources have external_url populated."""
    __tablename__ = "resources"

    id = Column(String, primary_key=True, default=gen_id)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String, ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), nullable=False)
    resource_type = Column(SAEnum(ResourceType), default=ResourceType.other, nullable=False)
    file_name = Column(String(255), nullable=True)  # stored (disk) filename
    original_name = Column(String(255), nullable=True)  # filename as uploaded
    file_path = Column(String(500), nullable=True)  # public URL path, e.g. /uploads/xyz.pdf
    file_size_bytes = Column(Integer, nullable=True)
    external_url = Column(String(1000), nullable=True)
    created_at = Column(UTCDateTime, default=utc_now)


class StudySessionType(str, enum.Enum):
    pomodoro = "pomodoro"
    deep_work = "deep_work"
    manual = "manual"


class StudySession(Base):
    """A logged block of study time, optionally tied to a subject and/or
    assignment. `ended_at` is null while a session is actively running."""
    __tablename__ = "study_sessions"

    id = Column(String, primary_key=True, default=gen_id)
    # subject_id/assignment_id are both nullable (a session can be
    # logged with no subject attached), so ownership can't always be
    # derived by joining through Subject -- StudySession needs its own
    # user_id, unlike Topic/Assignment/Note/Resource.
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    subject_id = Column(String, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    assignment_id = Column(String, ForeignKey("assignments.id", ondelete="SET NULL"), nullable=True)
    session_type = Column(SAEnum(StudySessionType), default=StudySessionType.pomodoro, nullable=False)
    started_at = Column(UTCDateTime, default=utc_now)
    ended_at = Column(UTCDateTime, nullable=True)
    duration_minutes = Column(Integer, default=0)  # finalized once the session ends
    notes = Column(Text, default="")
    created_at = Column(UTCDateTime, default=utc_now)


# ======================================================================
# Project Workspace
#
# Backend foundation only (models + schemas). No routers or frontend
# yet -- see AI_HANDOFF.md. Mirrors the Study Hub's conventions:
#   - string uuid PKs via gen_id()
#   - "*_id" FK columns, snake_case columns, PascalCase models
#   - JSON-encoded text columns for small variable-length lists
#     (tags, attachments) rather than new association tables
#   - ResourceType/TaskStatus are reused rather than re-declared, per
#     the "never duplicate logic" rule in ENGINEERING_GUIDELINES.md
#
# Unlike the Study Hub tables (which only set ondelete= on the FK and
# handle cascades manually in router code), these models pair ondelete=
# with an explicit SQLAlchemy relationship(cascade="all, delete-orphan").
# This is an intentional, additive extension of the existing pattern: it
# gives the Project Workspace real ORM-level cascade behavior (a project
# owns its phases/features/todos/etc.) without touching any existing
# table. Note this is deliberately ORM-level cascade (SQLAlchemy issues
# the child DELETEs itself), not DB-level passive_deletes: this app's
# database.py never enables `PRAGMA foreign_keys=ON`, so SQLite would
# silently ignore ondelete=CASCADE/SET NULL and leave orphaned rows if
# cascades relied on the database alone. The ondelete= values are kept
# on the FK columns anyway, both as documentation and so cascades would
# still work correctly if FK enforcement is ever turned on later.
# ======================================================================

class ProjectStatus(str, enum.Enum):
    planning = "planning"
    active = "active"
    on_hold = "on_hold"
    completed = "completed"
    archived = "archived"


# Collaboration-readiness enums (see "Collaboration & Identity" section
# near the bottom of this file). Defined here, ahead of Project, since
# Project's new columns reference them directly.
class ProjectVisibility(str, enum.Enum):
    private = "private"  # only members can see/access the project
    team = "team"  # visible to every member of the user's org/team (future)
    public = "public"  # future: shareable/discoverable outside the member list


class ProjectType(str, enum.Enum):
    """Open-ended on purpose -- PROJECT_CONTEXT.md lists Hackathon,
    College Project, Startup, Research, Open Source, and Freelance as
    named future modules, all of which attach to a Project rather than
    a new top-level container. New types are additive enum members,
    never a schema change."""
    personal = "personal"
    hackathon = "hackathon"
    college_project = "college_project"
    startup = "startup"
    research = "research"
    open_source = "open_source"
    freelance = "freelance"


class PhaseStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    blocked = "blocked"


class FeatureStatus(str, enum.Enum):
    backlog = "backlog"
    planned = "planned"
    in_progress = "in_progress"
    testing = "testing"
    done = "done"


class Priority(str, enum.Enum):
    """Shared priority scale for Features (and available for reuse by
    any future Project Workspace entity that needs one)."""
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class BugSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class BugStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    wont_fix = "wont_fix"
    duplicate = "duplicate"


class Project(Base):
    """Top-level container for a body of work: an app, a repo, a
    freelance engagement, etc. Everything else in the Project Workspace
    hangs off of a Project."""
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, default="")
    icon = Column(String(50), default="folder")  # lucide icon name
    color = Column(String(20), default="purple")  # theme accent tag, matches Subject/TimetableSlot
    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.planning, nullable=False, index=True)
    repository_url = Column(String(500), default="")  # e.g. https://github.com/user/repo
    local_repository = Column(String(500), default="")  # local filesystem path, future Git Sync Engine
    progress = Column(Integer, default=0)  # 0-100, rolled up from phases/features
    archived = Column(Boolean, default=False, nullable=False, index=True)
    tags = Column(Text, default="[]")  # JSON-encoded list[str], same convention as attachments columns
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)

    # ---- Collaboration-readiness (additive; see the "Collaboration &
    # Identity" section near the bottom of this file). All nullable/
    # defaulted so every pre-existing Project row stays valid untouched. ----
    owner_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    visibility = Column(SAEnum(ProjectVisibility), default=ProjectVisibility.private, nullable=False, index=True)
    collaboration_enabled = Column(Boolean, default=False, nullable=False, index=True)
    project_type = Column(SAEnum(ProjectType), default=ProjectType.personal, nullable=False, index=True)

    owner = relationship("User", back_populates="owned_projects", foreign_keys=[owner_id])
    members = relationship(
        "ProjectMember", back_populates="project",
        cascade="all, delete-orphan",
    )
    invitations = relationship(
        "ProjectInvitation", back_populates="project",
        cascade="all, delete-orphan",
    )
    # Associated, not owned (no cascade): a project's activity history is
    # allowed to un-scope rather than disappear when the project is
    # deleted, same SET NULL pattern as ai_conversations/ai_handoffs below.
    activity_log_entries = relationship("ActivityLog", back_populates="project")

    phases = relationship(
        "ProjectPhase", back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectPhase.order_index",
    )
    features = relationship(
        "Feature", back_populates="project",
        cascade="all, delete-orphan",
    )
    todos = relationship(
        "ProjectTodo", back_populates="project",
        cascade="all, delete-orphan",
    )
    bugs = relationship(
        "Bug", back_populates="project",
        cascade="all, delete-orphan",
    )
    milestones = relationship(
        "Milestone", back_populates="project",
        cascade="all, delete-orphan",
    )
    resources = relationship(
        "ProjectResource", back_populates="project",
        cascade="all, delete-orphan",
    )
    documents = relationship(
        "ProjectDocument", back_populates="project",
        cascade="all, delete-orphan",
    )
    timeline_events = relationship(
        "TimelineEvent", back_populates="project",
        cascade="all, delete-orphan",
        order_by="TimelineEvent.created_at.desc()",
    )

    # ---- AI Workspace relationships (additive; see the "AI Workspace"
    # section near the bottom of this file) ----
    # ProjectZip is owned by the project (a zip is a snapshot OF this
    # project), so it cascade-deletes like the collections above.
    ai_zips = relationship(
        "ProjectZip", back_populates="project",
        cascade="all, delete-orphan",
    )
    # Conversations/AIHandoffs/KnowledgeArticles are only *associated*
    # with a project, not owned by it (a conversation may span several
    # projects over its lifetime, and a handoff or knowledge article may
    # be general-purpose). Their FK uses ON DELETE SET NULL, so these
    # relationships deliberately have no cascade, mirroring how
    # ProjectPhase relates to Feature/ProjectTodo/Bug/Milestone above.
    ai_conversations = relationship("Conversation", back_populates="project")
    ai_handoffs = relationship("AIHandoff", back_populates="project")
    knowledge_articles = relationship("KnowledgeArticle", back_populates="project")


class ProjectPhase(Base):
    """An ordered roadmap stage within a project (e.g. "Phase 1: MVP").
    Deleting a phase never deletes the work items inside it -- features/
    todos/bugs/milestones are simply un-grouped (phase_id -> NULL)."""
    __tablename__ = "project_phases"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    order_index = Column(Integer, default=0, index=True)
    status = Column(SAEnum(PhaseStatus), default=PhaseStatus.pending, nullable=False, index=True)
    progress = Column(Integer, default=0)  # 0-100
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="phases")
    features = relationship("Feature", back_populates="phase")
    todos = relationship("ProjectTodo", back_populates="phase")
    bugs = relationship("Bug", back_populates="phase")
    milestones = relationship("Milestone", back_populates="phase")


class Feature(Base):
    """A planned or in-progress unit of work, optionally grouped under a
    phase. `estimated_effort_hours`/`progress` deliberately match the
    Task/Assignment shape so the Smart Urgency Engine can be reused by a
    future router without any new calculation logic."""
    __tablename__ = "features"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    phase_id = Column(String, ForeignKey("project_phases.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    status = Column(SAEnum(FeatureStatus), default=FeatureStatus.backlog, nullable=False, index=True)
    priority = Column(SAEnum(Priority), default=Priority.medium, nullable=False, index=True)
    estimated_effort_hours = Column(Float, default=1.0)
    progress = Column(Integer, default=0)  # 0-100
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="features")
    phase = relationship("ProjectPhase", back_populates="features")
    todos = relationship("ProjectTodo", back_populates="feature")
    bugs = relationship("Bug", back_populates="feature")


class ProjectTodo(Base):
    """Fine-grained task item scoped to a project (and optionally a
    phase/feature). Reuses `TaskStatus` and mirrors Task's urgency-
    relevant fields (deadline/estimated_effort_hours/progress) so
    `urgency.compute_urgency` works unchanged for Project Todos."""
    __tablename__ = "project_todos"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    phase_id = Column(String, ForeignKey("project_phases.id", ondelete="SET NULL"), nullable=True, index=True)
    feature_id = Column(String, ForeignKey("features.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    status = Column(SAEnum(TaskStatus), default=TaskStatus.todo, nullable=False, index=True)
    deadline = Column(UTCDateTime, nullable=True, index=True)  # feeds the Smart Urgency Engine
    estimated_effort_hours = Column(Float, default=1.0)  # feeds the Smart Urgency Engine
    progress = Column(Integer, default=0)  # 0-100
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)
    completed_at = Column(UTCDateTime, nullable=True)

    project = relationship("Project", back_populates="todos")
    phase = relationship("ProjectPhase", back_populates="todos")
    feature = relationship("Feature", back_populates="todos")


class Bug(Base):
    """Defect tracking, scoped to a project and optionally a phase/
    feature."""
    __tablename__ = "bugs"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    phase_id = Column(String, ForeignKey("project_phases.id", ondelete="SET NULL"), nullable=True, index=True)
    feature_id = Column(String, ForeignKey("features.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    severity = Column(SAEnum(BugSeverity), default=BugSeverity.medium, nullable=False, index=True)
    status = Column(SAEnum(BugStatus), default=BugStatus.open, nullable=False, index=True)
    resolution = Column(Text, default="")
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)
    resolved_at = Column(UTCDateTime, nullable=True)

    project = relationship("Project", back_populates="bugs")
    phase = relationship("ProjectPhase", back_populates="bugs")
    feature = relationship("Feature", back_populates="bugs")


class Milestone(Base):
    """A dated checkpoint within a project, optionally tied to a phase."""
    __tablename__ = "milestones"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    phase_id = Column(String, ForeignKey("project_phases.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    target_date = Column(UTCDateTime, nullable=True, index=True)
    completed = Column(Boolean, default=False, nullable=False, index=True)
    completed_at = Column(UTCDateTime, nullable=True)
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="milestones")
    phase = relationship("ProjectPhase", back_populates="milestones")


class ProjectResource(Base):
    """File/link reference library for a project. Deliberately the same
    shape as the Study Hub's `Resource` model so `uploads.py` (save_upload
    / delete_upload / infer_resource_type) can be reused unchanged by a
    future router -- no second upload implementation."""
    __tablename__ = "project_resources"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    resource_type = Column(SAEnum(ResourceType), default=ResourceType.other, nullable=False, index=True)
    file_name = Column(String(255), nullable=True)  # stored (disk) filename
    original_name = Column(String(255), nullable=True)  # filename as uploaded
    file_path = Column(String(500), nullable=True)  # public URL path, e.g. /uploads/xyz.pdf
    file_size_bytes = Column(Integer, nullable=True)
    external_url = Column(String(1000), nullable=True)
    created_at = Column(UTCDateTime, default=utc_now)

    project = relationship("Project", back_populates="resources")


class ProjectDocument(Base):
    """A markdown documentation page belonging to a project (README-
    style docs, design notes, etc). `content` is rendered client-side
    the same way Study Hub Notes are (see frontend/src/lib/markdown.ts)."""
    __tablename__ = "project_documents"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")  # markdown
    order_index = Column(Integer, default=0, index=True)
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="documents")


class TimelineEvent(Base):
    """Append-only event trail for a project -- the project-scoped
    analogue of `ActivityLog`. Deliberately generic (`event_type` is a
    free-form string, `related_entity_type`/`related_entity_id` are
    optional pointers) so any future entity (phase completed, bug
    resolved, milestone reached, document published, ...) can log a
    timeline entry without a schema change."""
    __tablename__ = "timeline_events"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)  # e.g. "phase_completed", "bug_resolved"
    title = Column(String(300), nullable=False)
    description = Column(Text, default="")
    icon = Column(String(30), default="activity")
    related_entity_type = Column(String(50), nullable=True)  # e.g. "feature", "bug", "milestone", "todo"
    related_entity_id = Column(String, nullable=True)
    created_at = Column(UTCDateTime, default=utc_now, index=True)

    project = relationship("Project", back_populates="timeline_events")


# ======================================================================
# AI Workspace
#
# Backend foundation only (models + schemas). No routers or frontend
# yet -- see AI_HANDOFF.md. Generalizes the "Claude Workspace" concept
# from PROJECT_CONTEXT.md into a multi-provider AI Workspace (Claude,
# GPT, Gemini, ...), following the same conventions as Project
# Workspace above:
#   - string uuid PKs via gen_id()
#   - "*_id" FK columns, snake_case columns, PascalCase models
#   - JSON-encoded text columns for small variable-length lists
#     (tags, variables, created_files, modified_files), same convention
#     as Project.tags / Assignment.attachments
#   - ondelete= on the FK paired with an explicit SQLAlchemy
#     relationship(cascade=...) only where the child is truly OWNED by
#     the parent (ProjectZip -> Project); everything else uses
#     ON DELETE SET NULL with no cascade, since an AI account,
#     conversation, handoff, or knowledge article can reasonably
#     outlive -- or span more than -- a single project
#
# Security (see PROJECT_CONTEXT.md "Security"): AIAccount never stores
# an actual API key. `api_key_env_var` stores only the *name* of the
# environment variable the real key lives in (e.g. "ANTHROPIC_API_KEY"),
# mirroring the "Future GitHub authentication should use Personal
# Access Tokens stored securely [in environment variables]" rule
# already established for Git Sync in SYNC_ARCHITECTURE.md.
# ======================================================================

class AIProvider(str, enum.Enum):
    claude = "claude"
    gpt = "gpt"
    gemini = "gemini"
    other = "other"


class AIAccountStatus(str, enum.Enum):
    active = "active"
    idle = "idle"
    archived = "archived"


class ConversationStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    archived = "archived"


class KnowledgeSource(str, enum.Enum):
    manual = "manual"
    ai_generated = "ai_generated"


class AIAccount(Base):
    """A configured AI assistant the user works with (e.g. "Claude --
    Backend", "GPT-4 -- Research"). Analogous role to Subject in the
    Study Hub: the top-level entity most other AI Workspace tables hang
    off of. `current_task` mirrors the "Current Task" field described
    for the planned Claude Workspace in PROJECT_CONTEXT.md."""
    __tablename__ = "ai_accounts"

    id = Column(String, primary_key=True, default=gen_id)
    # Owning user. Conversation/ProjectZip/AIHandoff/TokenTracker are all
    # ai_account-scoped and inherit ownership via ai_account_id, the AI
    # Workspace analogue of Subject.user_id above.
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    provider = Column(SAEnum(AIProvider), default=AIProvider.other, nullable=False, index=True)
    model = Column(String(100), default="")  # e.g. "claude-sonnet-4-6"
    description = Column(Text, default="")
    icon = Column(String(50), default="bot")  # lucide icon name, matches Project.icon convention
    color = Column(String(20), default="purple")  # theme accent tag, matches Project/Subject
    status = Column(SAEnum(AIAccountStatus), default=AIAccountStatus.active, nullable=False, index=True)
    # Name of the environment variable holding the real key -- never the
    # key itself. See module-level "Security" note above.
    api_key_env_var = Column(String(100), default="")
    current_task = Column(Text, default="")
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)

    conversations = relationship(
        "Conversation", back_populates="ai_account",
        cascade="all, delete-orphan",
    )
    zips = relationship("ProjectZip", back_populates="ai_account")
    handoffs = relationship("AIHandoff", back_populates="ai_account")
    token_trackers = relationship(
        "TokenTracker", back_populates="ai_account",
        cascade="all, delete-orphan",
    )


class Conversation(Base):
    """A chat/session with an AIAccount, optionally scoped to a
    Project. Deleting the AIAccount deletes its conversations (a
    conversation cannot exist without the account that had it);
    deleting the Project only un-scopes the conversation (project_id ->
    NULL), since the same conversation may reference more than one
    project over its lifetime."""
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=gen_id)
    ai_account_id = Column(String, ForeignKey("ai_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(300), nullable=False)
    summary = Column(Text, default="")
    status = Column(SAEnum(ConversationStatus), default=ConversationStatus.active, nullable=False, index=True)
    message_count = Column(Integer, default=0)
    started_at = Column(UTCDateTime, default=utc_now, index=True)
    last_message_at = Column(UTCDateTime, nullable=True)
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)

    ai_account = relationship("AIAccount", back_populates="conversations")
    project = relationship("Project", back_populates="ai_conversations")
    zips = relationship("ProjectZip", back_populates="conversation")
    handoffs = relationship("AIHandoff", back_populates="conversation")
    token_trackers = relationship("TokenTracker", back_populates="conversation")


class PromptTemplate(Base):
    """Reusable prompt text, independent of any single project or
    account -- the AI Workspace analogue of a shared library entry.
    Not scoped by project_id/ai_account_id on purpose: a good prompt
    template is meant to be reused across both."""
    __tablename__ = "prompt_templates"

    id = Column(String, primary_key=True, default=gen_id)
    # No natural parent to inherit ownership from (deliberately not
    # scoped to a project/account, per the class docstring), so this
    # needs its own user_id, like Task/TimetableSlot/Subject/StudySession.
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, default="")
    content = Column(Text, nullable=False, default="")
    category = Column(String(60), default="general", index=True)  # e.g. "coding", "docs", "brainstorm"
    # JSON-encoded list[str] of placeholder names used in `content`
    # (e.g. ["project_name", "language"]), same convention as
    # Project.tags.
    variables = Column(Text, default="[]")
    usage_count = Column(Integer, default=0)
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)


class ProjectZip(Base):
    """A point-in-time zip snapshot of a project, handed off to (or
    received back from) an AI account/conversation -- literally what
    this session's own task started from (`productivity-dashboard.zip`).
    File storage mirrors ProjectResource/Resource exactly so the
    existing `uploads.py` helper (save_upload/delete_upload) can be
    reused unchanged. Owned by the project: deleting the project
    deletes its zip snapshots."""
    __tablename__ = "project_zips"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    ai_account_id = Column(String, ForeignKey("ai_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True, index=True)
    version_label = Column(String(100), default="")  # e.g. "v1", "session-3"
    file_name = Column(String(255), nullable=True)  # stored (disk) filename
    original_name = Column(String(255), nullable=True)  # filename as uploaded
    file_path = Column(String(500), nullable=True)  # public URL path, e.g. /uploads/xyz.zip
    file_size_bytes = Column(Integer, nullable=True)
    notes = Column(Text, default="")  # what changed in this snapshot
    created_at = Column(UTCDateTime, default=utc_now, index=True)

    project = relationship("Project", back_populates="ai_zips")
    ai_account = relationship("AIAccount", back_populates="zips")
    conversation = relationship("Conversation", back_populates="zips")


class AIHandoff(Base):
    """Structured session handoff notes -- the database-backed analogue
    of this repository's own AI_HANDOFF.md, one row per handoff instead
    of one continuously-overwritten file. All FKs are optional/SET NULL:
    a handoff is commonly tied to a project/account/conversation, but
    (like this repo's AI_HANDOFF.md 'Token Limit Rule') should still be
    writable even when one of those isn't cleanly known."""
    __tablename__ = "ai_handoffs"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    ai_account_id = Column(String, ForeignKey("ai_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True, index=True)
    completed_work = Column(Text, default="")
    # JSON-encoded list[str], same convention as Project.tags
    created_files = Column(Text, default="[]")
    modified_files = Column(Text, default="[]")
    remaining_work = Column(Text, default="")
    known_issues = Column(Text, default="")
    next_objective = Column(Text, default="")
    created_at = Column(UTCDateTime, default=utc_now, index=True)

    project = relationship("Project", back_populates="ai_handoffs")
    ai_account = relationship("AIAccount", back_populates="handoffs")
    conversation = relationship("Conversation", back_populates="handoffs")


class TokenTracker(Base):
    """Append-only log of token usage, one row per recorded usage event
    (e.g. one API call or one session) -- the AI Workspace analogue of
    TimelineEvent/ActivityLog. Owned by the account (deleting the
    account deletes its usage history); the conversation link is
    optional/SET NULL since usage may be recorded outside any single
    conversation (e.g. a batch job)."""
    __tablename__ = "token_trackers"

    id = Column(String, primary_key=True, default=gen_id)
    ai_account_id = Column(String, ForeignKey("ai_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True, index=True)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    estimated_cost_usd = Column(Float, default=0.0)
    model = Column(String(100), default="")
    recorded_at = Column(UTCDateTime, default=utc_now, index=True)

    ai_account = relationship("AIAccount", back_populates="token_trackers")
    conversation = relationship("Conversation", back_populates="token_trackers")


class KnowledgeArticle(Base):
    """A durable reference note (written by the user or an AI account),
    optionally scoped to a project. Deliberately the same shape as
    ProjectDocument (title/content/markdown) so it can be rendered
    client-side the same way, but lives in the AI Workspace since its
    purpose is durable *context* an AI account can be pointed at,
    rather than project documentation per se."""
    __tablename__ = "knowledge_articles"

    id = Column(String, primary_key=True, default=gen_id)
    # Author/owner. When project_id is set, access is via project
    # membership (Project Content rule); when project_id is NULL this is
    # a personal knowledge article and user_id is what scopes it.
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    content = Column(Text, default="")  # markdown
    category = Column(String(60), default="general", index=True)
    tags = Column(Text, default="[]")  # JSON-encoded list[str], same convention as Project.tags
    source = Column(SAEnum(KnowledgeSource), default=KnowledgeSource.manual, nullable=False, index=True)
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="knowledge_articles")


# ======================================================================
# Collaboration & Identity
#
# Collaboration-ready database foundation only -- models + schemas, no
# routers, no auth endpoints, no frontend. See AI_HANDOFF.md and
# ARCHITECTURE.md ("Project Collaboration Architecture") for scope and
# rationale. Follows the exact conventions established above:
#   - string uuid PKs via gen_id()
#   - "*_id" FK columns, snake_case columns, PascalCase models
#   - JSON-encoded text columns for small variable-length lists/dicts
#     (permission_keys, permission_overrides, dashboard_layout,
#     ai_preferences, reminder_preferences), same convention as
#     Project.tags / AIHandoff.created_files
#   - ondelete= on the FK paired with an explicit SQLAlchemy
#     relationship(cascade=...) only where the child is truly OWNED by
#     its parent (User -> ProjectMember/Session/UserPreference/
#     NotificationPreference, Project -> ProjectMember/ProjectInvitation);
#     everything else (Project.owner_id, Role/Permission references,
#     ActivityLog.user_id, UserPreference.default_project_id) uses
#     ON DELETE SET NULL with no cascade
#
# Projects remain the application's one collaborative container --
# there is no separate "Workspace" or "Team" model here. A User joins
# Projects directly (via ProjectMember); Roles/Permissions are reusable
# catalog entities referenced by ProjectMember and ProjectInvitation,
# not a second parallel hierarchy.
#
# Architectural note: the task brief for this session described "Role"
# and "Permission" as separate models with a "reusable permission
# system." Rather than add an unlisted RolePermission join table, a
# Role's permissions are stored as `permission_keys`, a JSON-encoded
# list[str] of Permission.key values -- identical in shape and intent
# to how Project.tags/AIHandoff.created_files already store small
# variable-length lists in this codebase. Permission itself stays a
# real table (a browsable/seedable catalog), so this is additive to,
# not a replacement for, the requested model list.
# ======================================================================

class UserStatus(str, enum.Enum):
    active = "active"
    invited = "invited"  # created ahead of the user's first login, e.g. via a ProjectInvitation
    suspended = "suspended"
    deactivated = "deactivated"


class AuthProvider(str, enum.Enum):
    """Which identity provider authenticates this User. `local` is the
    only provider with an implemented auth API (see routers/auth.py) --
    `google`/`github`/`other` remain reserved for future OAuth/SSO
    providers per the task brief's explicit "DO NOT IMPLEMENT" list."""
    local = "local"
    google = "google"
    github = "github"
    other = "other"


class MemberStatus(str, enum.Enum):
    active = "active"
    invited = "invited"  # membership row exists, invitation not yet accepted
    suspended = "suspended"
    removed = "removed"


class InvitationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    expired = "expired"
    revoked = "revoked"


class User(Base):
    """A person who can own or collaborate on Projects. Designed to be
    the foundation for future cloud/multi-device collaboration and
    authentication (see AuthProvider/`password_hash` below), but usable
    standalone today: nothing elsewhere in the app requires a User row
    to exist yet, so introducing this table has zero impact on the
    single-user MVP until it's actually wired up."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    username = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(150), default="")
    email = Column(String(255), unique=True, nullable=False, index=True)
    avatar_url = Column(Text, default="")
    timezone = Column(String(60), default="UTC")
    locale = Column(String(10), default="en")
    theme = Column(String(20), default="dark")  # matches the app's default dark/glassmorphism theme
    status = Column(SAEnum(UserStatus), default=UserStatus.active, nullable=False, index=True)
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)
    last_seen_at = Column(UTCDateTime, nullable=True)

    # ---- Authentication metadata ----
    auth_provider = Column(SAEnum(AuthProvider), default=AuthProvider.local, nullable=False, index=True)
    external_auth_id = Column(String(255), nullable=True, index=True)  # provider-side user id, e.g. Google sub
    password_hash = Column(Text, nullable=True)  # never a plaintext password; nullable for non-local auth_provider users

    # ---- Email verification / password reset (preparation only) ----
    # Additive columns, same "future-ready, nullable until wired up"
    # convention as password_hash/external_auth_id above. This session
    # issues and validates these tokens (see routers/auth.py) but never
    # sends an email -- delivery is out of scope, matching the task
    # brief's "Email Verification Preparation" / "Password Reset
    # Preparation" wording (prepare the mechanism, not the email).
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_token = Column(String(64), nullable=True, unique=True, index=True)
    email_verification_expires_at = Column(UTCDateTime, nullable=True)
    password_reset_token = Column(String(64), nullable=True, unique=True, index=True)
    password_reset_expires_at = Column(UTCDateTime, nullable=True)

    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    project_memberships = relationship(
        "ProjectMember", back_populates="user",
        cascade="all, delete-orphan",
    )
    sessions = relationship(
        "Session", back_populates="user",
        cascade="all, delete-orphan",
    )
    preferences = relationship(
        "UserPreference", back_populates="user",
        uselist=False, cascade="all, delete-orphan",
    )
    notification_preferences = relationship(
        "NotificationPreference", back_populates="user",
        uselist=False, cascade="all, delete-orphan",
    )
    sent_invitations = relationship(
        "ProjectInvitation", back_populates="invited_by",
        foreign_keys="ProjectInvitation.invited_by_user_id",
    )
    activity_log_entries = relationship("ActivityLog", back_populates="user")
    notifications = relationship(
        "Notification", back_populates="user",
        cascade="all, delete-orphan",
    )


class Permission(Base):
    """Reusable permission catalog, referenced by key (e.g.
    "manage_project") from Role.permission_keys and
    ProjectMember.permission_overrides. A flat catalog table rather than
    an enum so new permissions (future Git Sync, Hackathon, ...) are a
    seeded row, not a code change."""
    __tablename__ = "permissions"

    id = Column(String, primary_key=True, default=gen_id)
    key = Column(String(60), unique=True, nullable=False, index=True)  # e.g. "manage_members"
    name = Column(String(120), nullable=False)
    description = Column(Text, default="")
    category = Column(String(50), default="general", index=True)  # e.g. "project", "members", "tasks", "ai_workspace"
    created_at = Column(UTCDateTime, default=utc_now)


class Role(Base):
    """A named, reusable bundle of permission keys. Ships with four
    system-seeded roles (Owner, Admin, Member, Viewer; see
    ARCHITECTURE.md) but is extensible: `project_id` is nullable so a
    NULL-project role is a global role available to every project
    (the four defaults), while a future project-specific custom role
    can be added later by setting `project_id` -- additive, no schema
    change needed then either."""
    __tablename__ = "roles"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String(50), nullable=False, index=True)
    description = Column(Text, default="")
    is_system = Column(Boolean, default=False, nullable=False, index=True)  # protects the 4 defaults from deletion
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    # JSON-encoded list[str] of Permission.key values -- see module note above.
    permission_keys = Column(Text, default="[]")
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)

    project = relationship("Project")


class ProjectMember(Base):
    """A User's membership in a Project -- the join table that makes
    Projects collaborative. One row per (project, user) pair."""
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_member_project_user"),
    )

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(String, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(SAEnum(MemberStatus), default=MemberStatus.active, nullable=False, index=True)
    invitation_accepted = Column(Boolean, default=True, nullable=False)
    # JSON-encoded list[str] of Permission.key values granted/denied on
    # top of the role -- future-ready, unused until a permission-check
    # service exists.
    permission_overrides = Column(Text, default="[]")
    joined_at = Column(UTCDateTime, default=utc_now)
    last_active_at = Column(UTCDateTime, nullable=True)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")
    role = relationship("Role")


class ProjectInvitation(Base):
    """A pending (or resolved) invitation for an email address to join
    a Project with a given Role. `token` is the future email-link
    identifier -- opaque, unique, never the row's own `id` so it can be
    rotated independently."""
    __tablename__ = "project_invitations"

    id = Column(String, primary_key=True, default=gen_id)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    role_id = Column(String, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True, index=True)
    invited_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    status = Column(SAEnum(InvitationStatus), default=InvitationStatus.pending, nullable=False, index=True)
    expires_at = Column(UTCDateTime, nullable=False, index=True)
    accepted_at = Column(UTCDateTime, nullable=True)
    rejected_at = Column(UTCDateTime, nullable=True)
    created_at = Column(UTCDateTime, default=utc_now)

    project = relationship("Project", back_populates="invitations")
    role = relationship("Role")
    invited_by = relationship("User", back_populates="sent_invitations", foreign_keys=[invited_by_user_id])


class Session(Base):
    """An active login session for a User (e.g. one browser tab / one
    device), issued and managed by routers/auth.py + routers/sessions.py.
    One row per refresh-token lifetime -- `refresh_token_hash` stores a
    SHA-256 hash of the opaque refresh token handed to the client (never
    the raw token itself); access tokens are stateless JWTs that
    reference a session by id (`sid` claim) so revoking/expiring a
    Session immediately invalidates every access token tied to it on
    next validation, without needing an access-token blocklist."""
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    device = Column(String(150), default="")
    platform = Column(String(60), default="")  # e.g. "macOS", "iOS", "Windows"
    browser = Column(String(60), default="")  # e.g. "Chrome 126"
    ip_address = Column(String(45), nullable=True)  # nullable; long enough for IPv6
    created_at = Column(UTCDateTime, default=utc_now, index=True)
    last_active_at = Column(UTCDateTime, nullable=True)
    expires_at = Column(UTCDateTime, nullable=False, index=True)
    revoked = Column(Boolean, default=False, nullable=False, index=True)
    # Future refresh-token metadata -- stores a hash, never the raw token.
    refresh_token_hash = Column(Text, nullable=True)

    user = relationship("User", back_populates="sessions")


class UserPreference(Base):
    """Per-user app preferences, one row per User. Split from
    NotificationPreference (below) so a future "reset notifications
    only" action doesn't touch unrelated UI-state preferences."""
    __tablename__ = "user_preferences"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    theme = Column(String(20), default="dark")
    language = Column(String(10), default="en")
    timezone = Column(String(60), default="UTC")
    sidebar_state = Column(String(20), default="expanded")  # e.g. "expanded" / "collapsed"
    # JSON-encoded dict, same "small variable-length JSON in a Text
    # column" convention as the list[str] fields elsewhere (Project.tags),
    # just dict-shaped instead of list-shaped.
    dashboard_layout = Column(Text, default="{}")
    default_project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    ai_preferences = Column(Text, default="{}")
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="preferences")
    default_project = relationship("Project")


class NotificationPreference(Base):
    """Per-user notification channel preferences, one row per User.
    Reuses the app's existing notification system (Browser Notification
    API, per PROJECT_CONTEXT.md "Notifications") -- this table stores
    the user's opt-in/opt-out choices, it does not add a second
    notification pipeline."""
    __tablename__ = "notification_preferences"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    browser_notifications = Column(Boolean, default=True, nullable=False)
    email_notifications = Column(Boolean, default=False, nullable=False)
    task_notifications = Column(Boolean, default=True, nullable=False)
    project_notifications = Column(Boolean, default=True, nullable=False)
    ai_notifications = Column(Boolean, default=True, nullable=False)
    # JSON-encoded dict for future channels/reminder timing, same
    # convention as UserPreference.dashboard_layout above.
    reminder_preferences = Column(Text, default="{}")
    created_at = Column(UTCDateTime, default=utc_now)
    updated_at = Column(UTCDateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="notification_preferences")


class NotificationCategory(str, enum.Enum):
    """Matches AI_HANDOFF.md / the Notification Center task brief's
    category list exactly. Kept as a plain string enum (like every
    other status/category enum in this file) rather than a second
    catalog table, since -- unlike Permission/Role -- this list isn't
    meant to be user-extensible."""
    project_invitation = "project_invitation"
    invitation_accepted = "invitation_accepted"
    invitation_rejected = "invitation_rejected"
    invitation_cancelled = "invitation_cancelled"
    task_reminder = "task_reminder"
    task_overdue = "task_overdue"
    study_reminder = "study_reminder"
    ai_workspace = "ai_workspace"
    project_update = "project_update"
    member_joined = "member_joined"
    member_left = "member_left"
    project_access_revoked = "project_access_revoked"
    role_changed = "role_changed"
    system = "system"


class Notification(Base):
    """A single in-app notification for a User. This is the persisted,
    per-user notification the Notification Center reads/writes -- a
    different thing from `NotificationPreference` above, which only
    stores channel opt-in/opt-out settings. Additive table, same
    "extend, don't redesign" convention as every other collaboration
    table (see AI_HANDOFF.md session 5)."""
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(SAEnum(NotificationCategory), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, default="")
    # Optional deep links back to the entity this notification is about.
    # Nullable + SET NULL (not owned) since a notification should
    # survive the referenced project/invitation being deleted later --
    # it's a historical record, not a live pointer.
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    invitation_id = Column(String, ForeignKey("project_invitations.id", ondelete="SET NULL"), nullable=True, index=True)
    action_url = Column(String(500), default="")  # client-side route to deep-link to, e.g. /invite/{token}
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(UTCDateTime, default=utc_now, index=True)
    read_at = Column(UTCDateTime, nullable=True)

    user = relationship("User", back_populates="notifications")
    project = relationship("Project")
    invitation = relationship("ProjectInvitation")
