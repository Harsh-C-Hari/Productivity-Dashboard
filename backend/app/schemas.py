"""
Pydantic schemas: the API's public contract. Kept separate from the ORM
models so internal DB structure can evolve without breaking the API shape.
"""
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

from pydantic import field_validator

from .models import (
    TaskStatus,
    TaskCategory,
    DayOfWeek,
    AssignmentStatus,
    ResourceType,
    StudySessionType,
    ProjectStatus,
    PhaseStatus,
    FeatureStatus,
    Priority,
    BugSeverity,
    BugStatus,
    AIProvider,
    AIAccountStatus,
    ConversationStatus,
    KnowledgeSource,
    ProjectVisibility,
    ProjectType,
    UserStatus,
    AuthProvider,
    MemberStatus,
    InvitationStatus,
    NotificationCategory,
)


# ---------- Tasks ----------

class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    category: TaskCategory = TaskCategory.other
    deadline: Optional[datetime] = None
    estimated_effort_hours: float = Field(default=1.0, ge=0)
    status: TaskStatus = TaskStatus.todo
    progress: int = Field(default=0, ge=0, le=100)


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[TaskCategory] = None
    deadline: Optional[datetime] = None
    estimated_effort_hours: Optional[float] = Field(default=None, ge=0)
    status: Optional[TaskStatus] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    # Allows explicitly clearing the deadline from the client
    clear_deadline: Optional[bool] = False


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    attachments: str = ""
    urgency: str = "low"  # computed field, injected at serialization time


# ---------- Timetable ----------

class TimetableSlotBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    location: str = ""
    day_of_week: DayOfWeek
    start_time: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    end_time: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    color: str = "purple"


class TimetableSlotCreate(TimetableSlotBase):
    pass


class TimetableSlotUpdate(BaseModel):
    title: Optional[str] = None
    location: Optional[str] = None
    day_of_week: Optional[DayOfWeek] = None
    start_time: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    end_time: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    color: Optional[str] = None


class TimetableSlotOut(TimetableSlotBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime


# ---------- Activity ----------

class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    message: str
    icon: str
    created_at: datetime
    # ---- Collaboration/audit extension (additive, all optional) ----
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    action: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None


# ---------- Study Hub: Subjects & Topics ----------

class SubjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: str = ""
    instructor: str = ""
    color: str = "purple"


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    code: Optional[str] = None
    instructor: Optional[str] = None
    color: Optional[str] = None


class SubjectOut(SubjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime


class TopicBase(BaseModel):
    subject_id: str
    title: str = Field(..., min_length=1, max_length=200)
    order_index: int = 0


class TopicCreate(TopicBase):
    pass


class TopicUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    order_index: Optional[int] = None


class TopicOut(TopicBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime


# Per-subject progress summary, used on the Study Hub dashboard and
# subject cards. Computed on the fly, not stored.
class SubjectProgress(BaseModel):
    subject: SubjectOut
    total_assignments: int
    completed_assignments: int
    overdue_assignments: int
    completion_rate: float  # 0-100
    hours_studied_this_week: float
    topic_count: int
    resource_count: int
    note_count: int


# ---------- Study Hub: Assignments ----------

class AttachmentMeta(BaseModel):
    filename: str
    original_name: str
    url: str
    size_bytes: int
    content_type: str = "application/octet-stream"


class AssignmentBase(BaseModel):
    subject_id: str
    topic_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    deadline: Optional[datetime] = None
    estimated_effort_hours: float = Field(default=1.0, ge=0)
    status: AssignmentStatus = AssignmentStatus.todo
    progress: int = Field(default=0, ge=0, le=100)


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentUpdate(BaseModel):
    subject_id: Optional[str] = None
    topic_id: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    estimated_effort_hours: Optional[float] = Field(default=None, ge=0)
    status: Optional[AssignmentStatus] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    clear_deadline: Optional[bool] = False
    clear_topic: Optional[bool] = False


class AssignmentOut(AssignmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    attachments: List[AttachmentMeta] = []
    urgency: str = "low"  # computed field, injected at serialization time
    subject_name: Optional[str] = None  # convenience denormalization for widgets
    subject_color: Optional[str] = None


# ---------- Study Hub: Notes ----------

class NoteBase(BaseModel):
    subject_id: str
    topic_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    content: str = ""


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    subject_id: Optional[str] = None
    topic_id: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = None
    clear_topic: Optional[bool] = False


class NoteOut(NoteBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentMeta] = []
    subject_name: Optional[str] = None
    subject_color: Optional[str] = None


# ---------- Study Hub: Resources ----------

class ResourceLinkCreate(BaseModel):
    subject_id: str
    topic_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    external_url: str = Field(..., min_length=1, max_length=1000)


class ResourceUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    topic_id: Optional[str] = None
    external_url: Optional[str] = None
    clear_topic: Optional[bool] = False


class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    subject_id: str
    topic_id: Optional[str] = None
    title: str
    resource_type: ResourceType
    file_name: Optional[str] = None
    original_name: Optional[str] = None
    file_path: Optional[str] = None
    file_size_bytes: Optional[int] = None
    external_url: Optional[str] = None
    created_at: datetime
    subject_name: Optional[str] = None
    subject_color: Optional[str] = None


# ---------- Study Hub: Study Sessions ----------

class StudySessionCreate(BaseModel):
    subject_id: Optional[str] = None
    assignment_id: Optional[str] = None
    session_type: StudySessionType = StudySessionType.pomodoro
    notes: str = ""


class StudySessionUpdate(BaseModel):
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None
    # Convenience flag: server sets ended_at=now and computes duration_minutes
    complete_now: Optional[bool] = False


class StudySessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    subject_id: Optional[str] = None
    assignment_id: Optional[str] = None
    session_type: StudySessionType
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: int
    notes: str
    created_at: datetime
    subject_name: Optional[str] = None
    subject_color: Optional[str] = None


# ---------- Study Hub: Analytics & Search ----------

class DailyStudyMinutes(BaseModel):
    date: str  # ISO date, e.g. "2026-07-21"
    minutes: int


class SubjectHours(BaseModel):
    subject_id: str
    subject_name: str
    subject_color: str
    hours: float


class StudyAnalytics(BaseModel):
    current_streak_days: int
    longest_streak_days: int
    total_hours_all_time: float
    total_hours_this_week: float
    sessions_this_week: int
    daily_minutes_last_14_days: List[DailyStudyMinutes]
    hours_by_subject: List[SubjectHours]


class StudyHubSummary(BaseModel):
    subjects_progress: List[SubjectProgress]
    upcoming_assignments: List[AssignmentOut]
    overdue_assignments: List[AssignmentOut]
    today_study_sessions: List[StudySessionOut]
    analytics: StudyAnalytics


class StudyHubSearchResult(BaseModel):
    subjects: List[SubjectOut]
    assignments: List[AssignmentOut]
    notes: List[NoteOut]
    resources: List[ResourceOut]


# ======================================================================
# Project Workspace
#
# Backend foundation only (see models.py). Follows the same Base/Create/
# Update/Out shape as the rest of this file. List-valued Text columns
# (Project.tags) are exposed as native lists here, the same convention
# already used for Assignment/Note attachments -- the JSON encode/decode
# is a router-layer concern, not a schema-layer one.
# ======================================================================

# ---------- Project Workspace: Projects ----------

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    icon: str = Field(default="folder", max_length=50)
    color: str = Field(default="purple", max_length=20)
    status: ProjectStatus = ProjectStatus.planning
    repository_url: str = Field(default="", max_length=500)
    local_repository: str = Field(default="", max_length=500)
    progress: int = Field(default=0, ge=0, le=100)
    archived: bool = False
    tags: List[str] = []
    # ---- Collaboration-readiness (additive, all optional/defaulted --
    # see models.py "Collaboration & Identity") ----
    owner_id: Optional[str] = None
    visibility: ProjectVisibility = ProjectVisibility.private
    collaboration_enabled: bool = False
    project_type: ProjectType = ProjectType.personal


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    icon: Optional[str] = Field(default=None, max_length=50)
    color: Optional[str] = Field(default=None, max_length=20)
    status: Optional[ProjectStatus] = None
    repository_url: Optional[str] = Field(default=None, max_length=500)
    local_repository: Optional[str] = Field(default=None, max_length=500)
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    archived: Optional[bool] = None
    tags: Optional[List[str]] = None
    owner_id: Optional[str] = None
    visibility: Optional[ProjectVisibility] = None
    collaboration_enabled: Optional[bool] = None
    project_type: Optional[ProjectType] = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


# Per-project rollup, used on the Project Workspace dashboard and project
# cards. Computed on the fly from child tables, not stored -- mirrors
# SubjectProgress's role for the Study Hub.
class ProjectSummary(BaseModel):
    project: ProjectOut
    phase_count: int
    feature_count: int
    todo_count: int
    completed_todo_count: int
    bug_count: int
    open_bug_count: int
    milestone_count: int
    completed_milestone_count: int
    resource_count: int
    document_count: int
    overall_progress: float  # 0-100


# ---------- Project Workspace: Phases ----------

class ProjectPhaseBase(BaseModel):
    project_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    order_index: int = 0
    status: PhaseStatus = PhaseStatus.pending
    progress: int = Field(default=0, ge=0, le=100)


class ProjectPhaseCreate(ProjectPhaseBase):
    pass


class ProjectPhaseUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    order_index: Optional[int] = None
    status: Optional[PhaseStatus] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)


class ProjectPhaseOut(ProjectPhaseBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


class ProjectPhaseSummary(BaseModel):
    phase: ProjectPhaseOut
    feature_count: int
    todo_count: int
    bug_count: int
    milestone_count: int
    completion_rate: float  # 0-100


# ---------- Project Workspace: Features ----------

class FeatureBase(BaseModel):
    project_id: str
    phase_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    status: FeatureStatus = FeatureStatus.backlog
    priority: Priority = Priority.medium
    estimated_effort_hours: float = Field(default=1.0, ge=0)
    progress: int = Field(default=0, ge=0, le=100)


class FeatureCreate(FeatureBase):
    pass


class FeatureUpdate(BaseModel):
    phase_id: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[FeatureStatus] = None
    priority: Optional[Priority] = None
    estimated_effort_hours: Optional[float] = Field(default=None, ge=0)
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    clear_phase: Optional[bool] = False


class FeatureOut(FeatureBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime
    urgency: str = "low"  # computed field, injected at serialization time by a future router
    phase_title: Optional[str] = None  # convenience denormalization for widgets


# ---------- Project Workspace: Todos ----------

class ProjectTodoBase(BaseModel):
    project_id: str
    phase_id: Optional[str] = None
    feature_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    status: TaskStatus = TaskStatus.todo
    deadline: Optional[datetime] = None
    estimated_effort_hours: float = Field(default=1.0, ge=0)
    progress: int = Field(default=0, ge=0, le=100)


class ProjectTodoCreate(ProjectTodoBase):
    pass


class ProjectTodoUpdate(BaseModel):
    phase_id: Optional[str] = None
    feature_id: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    deadline: Optional[datetime] = None
    estimated_effort_hours: Optional[float] = Field(default=None, ge=0)
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    clear_deadline: Optional[bool] = False
    clear_phase: Optional[bool] = False
    clear_feature: Optional[bool] = False


class ProjectTodoOut(ProjectTodoBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    urgency: str = "low"  # computed field, injected at serialization time by a future router
    feature_title: Optional[str] = None
    phase_title: Optional[str] = None


# ---------- Project Workspace: Bugs ----------

class BugBase(BaseModel):
    project_id: str
    phase_id: Optional[str] = None
    feature_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    severity: BugSeverity = BugSeverity.medium
    status: BugStatus = BugStatus.open
    resolution: str = ""


class BugCreate(BugBase):
    pass


class BugUpdate(BaseModel):
    phase_id: Optional[str] = None
    feature_id: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    severity: Optional[BugSeverity] = None
    status: Optional[BugStatus] = None
    resolution: Optional[str] = None
    clear_phase: Optional[bool] = False
    clear_feature: Optional[bool] = False


class BugOut(BugBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    feature_title: Optional[str] = None
    phase_title: Optional[str] = None


# ---------- Project Workspace: Milestones ----------

class MilestoneBase(BaseModel):
    project_id: str
    phase_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    target_date: Optional[datetime] = None
    completed: bool = False


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    phase_id: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    target_date: Optional[datetime] = None
    completed: Optional[bool] = None
    clear_target_date: Optional[bool] = False
    clear_phase: Optional[bool] = False
    # Convenience flag: server sets completed=True and completed_at=now
    complete_now: Optional[bool] = False


class MilestoneOut(MilestoneBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    phase_title: Optional[str] = None


# ---------- Project Workspace: Resources ----------
# Mirrors the Study Hub Resource*/*Create/*Update/*Out shape so the
# existing uploads.py helper can serve both without modification.

class ProjectResourceLinkCreate(BaseModel):
    project_id: str
    title: str = Field(..., min_length=1, max_length=200)
    external_url: str = Field(..., min_length=1, max_length=1000)


class ProjectResourceUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    external_url: Optional[str] = None


class ProjectResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    title: str
    resource_type: ResourceType
    file_name: Optional[str] = None
    original_name: Optional[str] = None
    file_path: Optional[str] = None
    file_size_bytes: Optional[int] = None
    external_url: Optional[str] = None
    created_at: datetime


# ---------- Project Workspace: Documents ----------

class ProjectDocumentBase(BaseModel):
    project_id: str
    title: str = Field(..., min_length=1, max_length=200)
    content: str = ""  # markdown
    order_index: int = 0


class ProjectDocumentCreate(ProjectDocumentBase):
    pass


class ProjectDocumentUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = None
    order_index: Optional[int] = None


class ProjectDocumentOut(ProjectDocumentBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


# ---------- Project Workspace: Timeline ----------

class TimelineEventBase(BaseModel):
    project_id: str
    event_type: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=300)
    description: str = ""
    icon: str = Field(default="activity", max_length=30)
    related_entity_type: Optional[str] = Field(default=None, max_length=50)
    related_entity_id: Optional[str] = None


class TimelineEventCreate(TimelineEventBase):
    pass


class TimelineEventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    description: Optional[str] = None
    icon: Optional[str] = Field(default=None, max_length=30)


class TimelineEventOut(TimelineEventBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime


# ---------- Project Workspace: Aggregate Summary ----------
# Top-level rollup for the (future) Project Workspace landing page,
# analogous to StudyHubSummary. Not yet wired to any router.

class ProjectWorkspaceSummary(BaseModel):
    projects_progress: List[ProjectSummary]
    upcoming_milestones: List[MilestoneOut]
    overdue_todos: List[ProjectTodoOut]
    recent_timeline: List[TimelineEventOut]


# ---------- Project Workspace: Search ----------
# Cross-entity search result, same role as StudyHubSearchResult but
# spanning the Project Workspace's searchable entities (Projects, Todos,
# Features, Bugs, Documentation, Resources), per PROJECT_CONTEXT.md's
# "every future module should expose searchable entities" rule.

class ProjectWorkspaceSearchResult(BaseModel):
    projects: List[ProjectOut] = []
    todos: List[ProjectTodoOut] = []
    features: List[FeatureOut] = []
    bugs: List[BugOut] = []
    documents: List[ProjectDocumentOut] = []
    resources: List[ProjectResourceOut] = []


# ---------- Project Workspace: Analytics ----------
# Backs `routers/analytics.py`. Computed on the fly from child tables,
# never stored, same philosophy as StudyAnalytics.

class FeatureStatusCount(BaseModel):
    status: FeatureStatus
    count: int


class BugSeverityCount(BaseModel):
    severity: BugSeverity
    count: int


class BugStatusCount(BaseModel):
    status: BugStatus
    count: int


class VelocityPoint(BaseModel):
    week_start: str  # ISO date, e.g. "2026-07-21" (Monday of that week)
    todos_completed: int
    bugs_resolved: int
    milestones_reached: int


class ProjectAnalytics(BaseModel):
    project_id: str
    project_name: str
    # Project Progress
    overall_progress: float  # 0-100, rolled up from phases/features/todos
    phase_count: int
    completed_phase_count: int
    # Todo Completion
    total_todos: int
    completed_todos: int
    todo_completion_rate: float  # 0-100
    overdue_todos: int
    # Bug Counts
    total_bugs: int
    open_bugs: int
    resolved_bugs: int
    bugs_by_severity: List[BugSeverityCount]
    bugs_by_status: List[BugStatusCount]
    # Milestone Progress
    total_milestones: int
    completed_milestones: int
    milestone_completion_rate: float  # 0-100
    upcoming_milestones: int
    overdue_milestones: int
    # Feature Status
    total_features: int
    features_by_status: List[FeatureStatusCount]
    # Velocity: last 8 weeks of completions
    velocity: List[VelocityPoint]


class WorkspaceAnalytics(BaseModel):
    """Cross-project rollup, used for a workspace-wide analytics view."""
    total_projects: int
    active_projects: int
    completed_projects: int
    project_analytics: List[ProjectAnalytics]
    combined_velocity: List[VelocityPoint]


# ---------- Dashboard ----------

class QuickStats(BaseModel):
    total_tasks: int
    completed_tasks: int
    overdue_tasks: int
    due_today: int
    completion_rate: float  # 0-100
    hours_planned_this_week: float


class DashboardOut(BaseModel):
    today_tasks: List[TaskOut]
    overdue_tasks: List[TaskOut]
    upcoming_deadlines: List[TaskOut]
    stats: QuickStats
    recent_activity: List[ActivityOut]
    # Study Hub integration: kept optional-with-defaults so this remains a
    # backwards-compatible addition to the existing dashboard payload.
    upcoming_assignments: List[AssignmentOut] = []
    overdue_assignments: List[AssignmentOut] = []
    today_study_sessions: List[StudySessionOut] = []
    subjects_progress: List[SubjectProgress] = []
    # Project Workspace integration: kept optional-with-defaults for the
    # same backwards-compatibility reason the Study Hub fields above are.
    projects_progress: List[ProjectSummary] = []
    upcoming_milestones: List[MilestoneOut] = []
    overdue_project_todos: List[ProjectTodoOut] = []
    recent_project_timeline: List[TimelineEventOut] = []


# ---------- Global Search ----------
# Spans Tasks, Study Hub, and Project Workspace. Each existing module
# already exposes its own scoped search (study_hub.search_study_hub,
# projects.search_projects); this reuses those same queries and just
# flattens the results into one ranked, navigable list for a global
# command-palette-style UI. It does not replace the scoped searches.


class GlobalSearchItem(BaseModel):
    type: str
    id: str
    title: str
    subtitle: Optional[str] = None
    path: str


class GlobalSearchResult(BaseModel):
    query: str
    results: List[GlobalSearchItem]


# ======================================================================
# AI Workspace
#
# Backend foundation only -- see models.py's "AI Workspace" section for
# the table design and models.AIAccount et al. for the full rationale.
# Follows the exact schema convention already used for Project
# Workspace above: Base (shared fields + Field(...) validation) / Create
# / Update (all-optional) / Out (the API response shape) / a per-entity
# Summary where the entity has meaningful children to roll up.
#
# Validation schemas: this codebase doesn't have a live Git Sync Import
# Engine yet (see SYNC_ARCHITECTURE.md, "Planned"), but every synced
# entity will eventually need its exported JSON validated *before* it's
# written back into SQLite on import. Rather than invent that machinery
# now (out of scope for this task), each AI Workspace entity gets a
# `*Validation` schema that captures that future contract today: the
# full persisted shape (including `id`) plus stricter checks than
# Create/Update need at authoring time. They are defined but not yet
# imported by any router, exactly like `ProjectWorkspaceSummary` was
# "defined but not yet wired to a router" in the previous session.
# ======================================================================

def _clean_str_list(value: Optional[List[str]]) -> List[str]:
    """Shared normalizer for JSON-encoded-list fields (tags, variables,
    created_files, modified_files): trims whitespace and drops empty
    entries. Used by both Base fields (Create/Update-time validation)
    and Validation schemas (import-time validation)."""
    if value is None:
        return []
    return [item.strip() for item in value if item and item.strip()]


def _looks_like_a_real_secret(value: str) -> bool:
    """Heuristic guard for AIAccount.api_key_env_var: this field must
    hold the *name* of an environment variable (e.g. "ANTHROPIC_API_KEY"),
    never an actual key. Flags values that look like a pasted-in secret
    rather than a variable name, per PROJECT_CONTEXT.md's "Never expose
    secrets" / "Never hardcode tokens" rules."""
    if not value:
        return False
    if len(value) > 100:
        return True
    # Real keys are long, often mixed-case/lowercase, and rarely valid
    # shouting-snake-case identifiers the way env var names are.
    return not bool(__import__("re").fullmatch(r"[A-Z][A-Z0-9_]*", value))


# ---------- AI Workspace: AI Accounts ----------

class AIAccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    provider: AIProvider = AIProvider.other
    model: str = Field(default="", max_length=100)
    description: str = ""
    icon: str = Field(default="bot", max_length=50)
    color: str = Field(default="purple", max_length=20)
    status: AIAccountStatus = AIAccountStatus.active
    api_key_env_var: str = Field(default="", max_length=100)
    current_task: str = ""

    @field_validator("api_key_env_var")
    @classmethod
    def validate_api_key_env_var(cls, v: str) -> str:
        if _looks_like_a_real_secret(v):
            raise ValueError(
                "api_key_env_var must be the NAME of an environment "
                "variable (e.g. 'ANTHROPIC_API_KEY'), never the key "
                "itself -- see PROJECT_CONTEXT.md Security rules"
            )
        return v


class AIAccountCreate(AIAccountBase):
    pass


class AIAccountUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    provider: Optional[AIProvider] = None
    model: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = Field(default=None, max_length=50)
    color: Optional[str] = Field(default=None, max_length=20)
    status: Optional[AIAccountStatus] = None
    api_key_env_var: Optional[str] = Field(default=None, max_length=100)
    current_task: Optional[str] = None

    @field_validator("api_key_env_var")
    @classmethod
    def validate_api_key_env_var(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and _looks_like_a_real_secret(v):
            raise ValueError(
                "api_key_env_var must be the NAME of an environment "
                "variable, never the key itself"
            )
        return v


class AIAccountOut(AIAccountBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


# Per-account rollup, same role as ProjectSummary/SubjectProgress.
class AIAccountSummary(BaseModel):
    account: AIAccountOut
    conversation_count: int
    active_conversation_count: int
    zip_count: int
    handoff_count: int
    total_tokens_used: int
    last_active_at: Optional[datetime] = None


class AIAccountValidation(BaseModel):
    """Full persisted shape for future Git Sync import validation."""
    id: str
    name: str = Field(..., min_length=1, max_length=200)
    provider: AIProvider
    status: AIAccountStatus
    api_key_env_var: str = Field(default="", max_length=100)
    created_at: datetime
    updated_at: datetime

    @field_validator("api_key_env_var")
    @classmethod
    def validate_api_key_env_var(cls, v: str) -> str:
        if _looks_like_a_real_secret(v):
            raise ValueError("api_key_env_var must not contain an actual secret")
        return v


# ---------- AI Workspace: Conversations ----------

class ConversationBase(BaseModel):
    ai_account_id: str
    project_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=300)
    summary: str = ""
    status: ConversationStatus = ConversationStatus.active
    message_count: int = Field(default=0, ge=0)
    started_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None


class ConversationCreate(ConversationBase):
    pass


class ConversationUpdate(BaseModel):
    project_id: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    summary: Optional[str] = None
    status: Optional[ConversationStatus] = None
    message_count: Optional[int] = Field(default=None, ge=0)
    last_message_at: Optional[datetime] = None
    # Allows explicitly un-scoping the conversation from its project,
    # matching the existing clear_* convenience-flag convention
    # (TaskUpdate.clear_deadline, AssignmentUpdate.clear_topic, ...)
    clear_project: Optional[bool] = False


class ConversationOut(ConversationBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    started_at: datetime
    created_at: datetime
    updated_at: datetime


class ConversationSummary(BaseModel):
    conversation: ConversationOut
    zip_count: int
    handoff_count: int
    total_tokens_used: int


class ConversationValidation(BaseModel):
    id: str
    ai_account_id: str
    project_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=300)
    status: ConversationStatus
    started_at: datetime
    created_at: datetime
    updated_at: datetime


# ---------- AI Workspace: Prompt Templates ----------

class PromptTemplateBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    content: str = Field(..., min_length=1)
    category: str = Field(default="general", max_length=60)
    variables: List[str] = []
    usage_count: int = Field(default=0, ge=0)

    @field_validator("variables")
    @classmethod
    def normalize_variables(cls, v: List[str]) -> List[str]:
        return _clean_str_list(v)


class PromptTemplateCreate(PromptTemplateBase):
    pass


class PromptTemplateUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    content: Optional[str] = Field(default=None, min_length=1)
    category: Optional[str] = Field(default=None, max_length=60)
    variables: Optional[List[str]] = None
    usage_count: Optional[int] = Field(default=None, ge=0)

    @field_validator("variables")
    @classmethod
    def normalize_variables(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return None if v is None else _clean_str_list(v)


class PromptTemplateOut(PromptTemplateBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


class PromptTemplateValidation(BaseModel):
    id: str
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    variables: List[str] = []
    created_at: datetime
    updated_at: datetime

    @field_validator("variables")
    @classmethod
    def normalize_variables(cls, v: List[str]) -> List[str]:
        return _clean_str_list(v)


# ---------- AI Workspace: Project Zips ----------
# Mirrors ProjectResourceOut's split (link-style Create for external
# references vs. an upload endpoint handled outside Pydantic) -- a
# ProjectZip is always file-backed, so there is no *LinkCreate variant.

class ProjectZipBase(BaseModel):
    project_id: str
    ai_account_id: Optional[str] = None
    conversation_id: Optional[str] = None
    version_label: str = Field(default="", max_length=100)
    notes: str = ""


class ProjectZipCreate(ProjectZipBase):
    """Metadata accompanying an upload; file fields are populated by the
    (future) router from the saved UploadFile, same pattern as
    ProjectResource's upload endpoint."""
    pass


class ProjectZipUpdate(BaseModel):
    ai_account_id: Optional[str] = None
    conversation_id: Optional[str] = None
    version_label: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = None
    clear_ai_account: Optional[bool] = False
    clear_conversation: Optional[bool] = False


class ProjectZipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    ai_account_id: Optional[str] = None
    conversation_id: Optional[str] = None
    version_label: str = ""
    file_name: Optional[str] = None
    original_name: Optional[str] = None
    file_path: Optional[str] = None
    file_size_bytes: Optional[int] = None
    notes: str = ""
    created_at: datetime


class ProjectZipValidation(BaseModel):
    id: str
    project_id: str
    file_path: Optional[str] = None
    file_size_bytes: Optional[int] = Field(default=None, ge=0)
    created_at: datetime


# ---------- AI Workspace: AI Handoffs ----------

class AIHandoffBase(BaseModel):
    project_id: Optional[str] = None
    ai_account_id: Optional[str] = None
    conversation_id: Optional[str] = None
    completed_work: str = ""
    created_files: List[str] = []
    modified_files: List[str] = []
    remaining_work: str = ""
    known_issues: str = ""
    next_objective: str = ""

    @field_validator("created_files", "modified_files")
    @classmethod
    def normalize_file_lists(cls, v: List[str]) -> List[str]:
        return _clean_str_list(v)


class AIHandoffCreate(AIHandoffBase):
    pass


class AIHandoffUpdate(BaseModel):
    completed_work: Optional[str] = None
    created_files: Optional[List[str]] = None
    modified_files: Optional[List[str]] = None
    remaining_work: Optional[str] = None
    known_issues: Optional[str] = None
    next_objective: Optional[str] = None

    @field_validator("created_files", "modified_files")
    @classmethod
    def normalize_file_lists(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return None if v is None else _clean_str_list(v)


class AIHandoffOut(AIHandoffBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime


class AIHandoffValidation(BaseModel):
    id: str
    completed_work: str = ""
    remaining_work: str = ""
    created_at: datetime


# ---------- AI Workspace: Token Trackers ----------

class TokenTrackerBase(BaseModel):
    ai_account_id: str
    conversation_id: Optional[str] = None
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    estimated_cost_usd: float = Field(default=0.0, ge=0)
    model: str = Field(default="", max_length=100)


class TokenTrackerCreate(TokenTrackerBase):
    pass


class TokenTrackerUpdate(BaseModel):
    """Token usage rows are append-only in normal operation; this exists
    only to correct a mis-recorded entry (e.g. a fixed cost estimate),
    matching the "every domain gets Create/Update/Out" convention."""
    input_tokens: Optional[int] = Field(default=None, ge=0)
    output_tokens: Optional[int] = Field(default=None, ge=0)
    total_tokens: Optional[int] = Field(default=None, ge=0)
    estimated_cost_usd: Optional[float] = Field(default=None, ge=0)
    model: Optional[str] = Field(default=None, max_length=100)


class TokenTrackerOut(TokenTrackerBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    recorded_at: datetime


class TokenTrackerAccountTotal(BaseModel):
    ai_account_id: str
    total_tokens: int
    total_estimated_cost_usd: float


class TokenUsageSummary(BaseModel):
    """Aggregate rollup, same role as StudyAnalytics but for token
    spend; not tied to a single account/conversation."""
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_estimated_cost_usd: float
    by_account: List[TokenTrackerAccountTotal] = []


class TokenTrackerValidation(BaseModel):
    id: str
    ai_account_id: str
    total_tokens: int = Field(..., ge=0)
    estimated_cost_usd: float = Field(..., ge=0)
    recorded_at: datetime


# ---------- AI Workspace: Knowledge Articles ----------

class KnowledgeArticleBase(BaseModel):
    project_id: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    content: str = ""  # markdown
    category: str = Field(default="general", max_length=60)
    tags: List[str] = []
    source: KnowledgeSource = KnowledgeSource.manual

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, v: List[str]) -> List[str]:
        return _clean_str_list(v)


class KnowledgeArticleCreate(KnowledgeArticleBase):
    pass


class KnowledgeArticleUpdate(BaseModel):
    project_id: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    content: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=60)
    tags: Optional[List[str]] = None
    source: Optional[KnowledgeSource] = None
    clear_project: Optional[bool] = False

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return None if v is None else _clean_str_list(v)


class KnowledgeArticleOut(KnowledgeArticleBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


class KnowledgeArticleValidation(BaseModel):
    id: str
    title: str = Field(..., min_length=1, max_length=200)
    source: KnowledgeSource
    created_at: datetime
    updated_at: datetime


# ---------- AI Workspace: Aggregate Summary ----------
# Top-level rollup for the (future) AI Workspace landing page, same
# role as ProjectWorkspaceSummary/StudyHubSummary. Not yet wired to any
# router.

class AIWorkspaceSummary(BaseModel):
    total_accounts: int
    active_accounts: int
    total_conversations: int
    active_conversations: int
    total_prompt_templates: int
    total_zips: int
    total_handoffs: int
    total_knowledge_articles: int
    token_usage: TokenUsageSummary
    recent_handoffs: List[AIHandoffOut] = []
    recent_conversations: List[ConversationOut] = []


# ======================================================================
# Collaboration & Identity
#
# Schemas for the collaboration-ready database foundation (see
# models.py "Collaboration & Identity" and AI_HANDOFF.md). Backend
# foundation only -- these are not yet imported by any router, exactly
# like the AI Workspace schemas above were "defined but not yet wired"
# in a previous session.
# ======================================================================

def _looks_like_a_real_password(value: str) -> bool:
    """Guard mirroring `_looks_like_a_real_secret` above: `password_hash`
    must hold a hash, never a plaintext password. This is a best-effort
    heuristic (short, or missing a hash-shaped separator) -- the real
    guarantee will come from the future auth service always calling a
    hashing function before this field is ever set, per PROJECT_CONTEXT.md
    Security rules."""
    if not value:
        return False
    return len(value) < 20


# ---------- Users ----------

class UserBase(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    display_name: str = Field(default="", max_length=150)
    email: str = Field(..., min_length=3, max_length=255)
    avatar_url: str = Field(default="", max_length=2_000_000)
    timezone: str = Field(default="UTC", max_length=60)
    locale: str = Field(default="en", max_length=10)
    theme: str = Field(default="dark", max_length=20)
    status: UserStatus = UserStatus.active
    auth_provider: AuthProvider = AuthProvider.local
    external_auth_id: Optional[str] = Field(default=None, max_length=255)


class UserCreate(UserBase):
    # Accepted only so a future auth service can pass an already-hashed
    # value through Create; never a plaintext password.
    password_hash: Optional[str] = None

    @field_validator("password_hash")
    @classmethod
    def validate_password_hash(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and _looks_like_a_real_password(v):
            raise ValueError("password_hash must be a hash, never a plaintext password")
        return v


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=1, max_length=50)
    display_name: Optional[str] = Field(default=None, max_length=150)
    email: Optional[str] = Field(default=None, min_length=3, max_length=255)
    avatar_url: Optional[str] = Field(default=None, max_length=2_000_000)
    timezone: Optional[str] = Field(default=None, max_length=60)
    locale: Optional[str] = Field(default=None, max_length=10)
    theme: Optional[str] = Field(default=None, max_length=20)
    status: Optional[UserStatus] = None
    auth_provider: Optional[AuthProvider] = None
    external_auth_id: Optional[str] = Field(default=None, max_length=255)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email_verified: bool = False
    created_at: datetime
    updated_at: datetime
    last_seen_at: Optional[datetime] = None
    # Deliberately excludes password_hash -- never returned by the API.


# Per-user rollup, same role as ProjectSummary/AIAccountSummary.
class UserSummary(BaseModel):
    user: UserOut
    project_count: int
    owned_project_count: int
    active_session_count: int
    pending_invitation_count: int


class UserValidation(BaseModel):
    """Full persisted shape for future Git Sync import validation.
    Deliberately excludes password_hash (never exported/imported by
    Git Sync, which is a plain-file JSON/Markdown mechanism -- see
    SYNC_ARCHITECTURE.md; credentials never belong in a synced file)."""
    id: str
    username: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., min_length=3, max_length=255)
    status: UserStatus
    auth_provider: AuthProvider
    created_at: datetime
    updated_at: datetime


# ---------- Permissions ----------

class PermissionBase(BaseModel):
    key: str = Field(..., min_length=1, max_length=60)
    name: str = Field(..., min_length=1, max_length=120)
    description: str = ""
    category: str = Field(default="general", max_length=50)


class PermissionCreate(PermissionBase):
    pass


class PermissionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=50)


class PermissionOut(PermissionBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime


# ---------- Roles ----------

class RoleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str = ""
    is_system: bool = False
    project_id: Optional[str] = None
    permission_keys: List[str] = []

    @field_validator("permission_keys")
    @classmethod
    def clean_permission_keys(cls, v: List[str]) -> List[str]:
        return _clean_str_list(v)


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    description: Optional[str] = None
    project_id: Optional[str] = None
    permission_keys: Optional[List[str]] = None

    @field_validator("permission_keys")
    @classmethod
    def clean_permission_keys(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return None if v is None else _clean_str_list(v)


class RoleOut(RoleBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


# ---------- Project Members ----------

class ProjectMemberBase(BaseModel):
    project_id: str
    user_id: str
    role_id: Optional[str] = None
    status: MemberStatus = MemberStatus.active
    invitation_accepted: bool = True
    permission_overrides: List[str] = []

    @field_validator("permission_overrides")
    @classmethod
    def clean_permission_overrides(cls, v: List[str]) -> List[str]:
        return _clean_str_list(v)


class ProjectMemberCreate(ProjectMemberBase):
    pass


class ProjectMemberUpdate(BaseModel):
    role_id: Optional[str] = None
    status: Optional[MemberStatus] = None
    invitation_accepted: Optional[bool] = None
    permission_overrides: Optional[List[str]] = None
    last_active_at: Optional[datetime] = None

    @field_validator("permission_overrides")
    @classmethod
    def clean_permission_overrides(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return None if v is None else _clean_str_list(v)


class ProjectMemberOut(ProjectMemberBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    joined_at: datetime
    last_active_at: Optional[datetime] = None


# ---------- Project Invitations ----------

class ProjectInvitationBase(BaseModel):
    project_id: str
    # `email` is the raw identifier the caller typed; whether it's
    # matched against `User.email` or `User.username` is driven by
    # `identifier_type` below. min_length=1 (not the old min_length=3)
    # since a valid username can be as short as 1 character elsewhere
    # in this app -- per-type length/shape rules are enforced by the
    # `identifier_type`-aware validator instead.
    email: str = Field(..., min_length=1, max_length=255)
    identifier_type: Literal["email", "username"] = "email"
    role_id: Optional[str] = None
    invited_by_user_id: Optional[str] = None
    expires_at: datetime

    @field_validator("email")
    @classmethod
    def _strip_identifier(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def _validate_identifier_shape(self) -> "ProjectInvitationBase":
        """Enforces per-type shape so the dropdown selection actually
        constrains what's accepted, instead of silently accepting
        either shape regardless of what the caller picked:
        - identifier_type="email": must look like an email (contains
          "@") and be at least 3 characters.
        - identifier_type="username": any non-empty string, matching
          `UserOut.username`'s own min_length=1 elsewhere in this file.
        """
        identifier = self.email
        if self.identifier_type == "email":
            if len(identifier) < 3 or "@" not in identifier:
                raise ValueError('"email" must be a valid email address when identifier_type is "email"')
        else:
            if len(identifier) < 1:
                raise ValueError('"email" must be a non-empty username when identifier_type is "username"')
        return self


class ProjectInvitationCreate(ProjectInvitationBase):
    """`email` here is actually an "email or username" identifier,
    disambiguated by `identifier_type`: the router resolves it against
    `User.email` (identifier_type="email") OR `User.username`
    (identifier_type="username") only -- not both -- and rejects the
    request (404) if that specific field has no matching account. The
    stored `ProjectInvitation.email` is always the resolved user's
    real email, never the raw identifier the caller typed."""
    pass


class ProjectInvitationUpdate(BaseModel):
    role_id: Optional[str] = None
    status: Optional[InvitationStatus] = None
    expires_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None


class ProjectInvitationOut(ProjectInvitationBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    token: str
    status: InvitationStatus
    accepted_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    created_at: datetime
    # Deliberately excludes nothing sensitive -- `token` is already
    # meant to be emailed to the invitee, unlike password_hash/api keys.


# ---------- Sessions ----------

class SessionBase(BaseModel):
    user_id: str
    device: str = Field(default="", max_length=150)
    platform: str = Field(default="", max_length=60)
    browser: str = Field(default="", max_length=60)
    ip_address: Optional[str] = Field(default=None, max_length=45)
    expires_at: datetime


class SessionCreate(SessionBase):
    pass


class SessionUpdate(BaseModel):
    last_active_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    revoked: Optional[bool] = None


class SessionOut(SessionBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    last_active_at: Optional[datetime] = None
    revoked: bool
    # Deliberately excludes refresh_token_hash -- never returned by the API.


# ---------- User Preferences ----------

class UserPreferenceBase(BaseModel):
    theme: str = Field(default="dark", max_length=20)
    language: str = Field(default="en", max_length=10)
    timezone: str = Field(default="UTC", max_length=60)
    sidebar_state: str = Field(default="expanded", max_length=20)
    dashboard_layout: dict = {}
    default_project_id: Optional[str] = None
    ai_preferences: dict = {}


class UserPreferenceCreate(UserPreferenceBase):
    user_id: str


class UserPreferenceUpdate(BaseModel):
    theme: Optional[str] = Field(default=None, max_length=20)
    language: Optional[str] = Field(default=None, max_length=10)
    timezone: Optional[str] = Field(default=None, max_length=60)
    sidebar_state: Optional[str] = Field(default=None, max_length=20)
    dashboard_layout: Optional[dict] = None
    default_project_id: Optional[str] = None
    ai_preferences: Optional[dict] = None


class UserPreferenceOut(UserPreferenceBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime


# ---------- Notification Preferences ----------

class NotificationPreferenceBase(BaseModel):
    browser_notifications: bool = True
    email_notifications: bool = False
    task_notifications: bool = True
    project_notifications: bool = True
    ai_notifications: bool = True
    reminder_preferences: dict = {}


class NotificationPreferenceCreate(NotificationPreferenceBase):
    user_id: str


class NotificationPreferenceUpdate(BaseModel):
    browser_notifications: Optional[bool] = None
    email_notifications: Optional[bool] = None
    task_notifications: Optional[bool] = None
    project_notifications: Optional[bool] = None
    ai_notifications: Optional[bool] = None
    reminder_preferences: Optional[dict] = None


class NotificationPreferenceOut(NotificationPreferenceBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime


# ---------- Collaboration: Aggregate Summary ----------
# Per-project rollup of its collaboration state, same role as
# ProjectSummary but for membership rather than work items. Wired up by
# `routers/project_members.py`'s `GET /summary`.

class ProjectCollaborationSummary(BaseModel):
    project_id: str
    member_count: int
    active_member_count: int
    pending_invitation_count: int
    owner: Optional[UserOut] = None


# ======================================================================
# Identity & Security (Authentication / Authorization)
#
# Request/response shapes for routers/auth.py and routers/sessions.py.
# These are the first schemas in this file that carry a raw plaintext
# password -- `RegisterRequest.password`/`LoginRequest.password`/
# `ChangePasswordRequest.new_password`/`PasswordResetConfirm.new_password`
# are deliberately typed as plain `str`, never logged, and never echoed
# back in any response model; they exist only to be handed to
# `security.hash_password`/`security.verify_password` inside the router
# and discarded immediately after.
# ======================================================================

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)
    display_name: str = Field(default="", max_length=150)


class LoginRequest(BaseModel):
    # Accepts either a username or an email in one field, mirroring how
    # most consumer apps let you log in with either -- the router tries
    # email first (contains "@"), then username.
    username_or_email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)
    device: str = Field(default="", max_length=150)
    platform: str = Field(default="", max_length=60)
    browser: str = Field(default="", max_length=60)


class GoogleAuthRequest(BaseModel):
    """Sent by the frontend's Google Identity Services button.
    `id_token` is the raw JWT credential Google issues to the browser --
    it is verified server-side (signature, audience, issuer, expiry)
    in routers/auth.py before any User row is trusted or created. Same
    device/platform/browser fields as LoginRequest, for the same
    multi-device Session bookkeeping."""
    id_token: str = Field(..., min_length=1)
    device: str = Field(default="", max_length=150)
    platform: str = Field(default="", max_length=60)
    browser: str = Field(default="", max_length=60)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token lifetime, in seconds
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


class RevokeRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=1, max_length=128)


class PasswordResetRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)


class PasswordResetRequestOut(BaseModel):
    # Deliberately generic regardless of whether the email matched a
    # User -- see routers/auth.py's `request_password_reset` docstring
    # for why (account-enumeration prevention).
    message: str = "If that email is registered, a password reset link has been prepared."
    # Only ever populated when the request is made without a mail
    # sender configured, so local/dev usage isn't blocked on an email
    # provider that doesn't exist yet (task brief: preparation only, no
    # email sending). Never populate this in a real deployment.
    debug_reset_token: Optional[str] = None


class PasswordResetConfirm(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=1, max_length=128)


class EmailVerificationRequestOut(BaseModel):
    message: str = "A verification link has been prepared for your email address."
    debug_verification_token: Optional[str] = None  # see PasswordResetRequestOut note


class EmailVerificationConfirm(BaseModel):
    token: str = Field(..., min_length=1)


class AuthStatusOut(BaseModel):
    authenticated: bool
    user: Optional[UserOut] = None


class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=150)
    avatar_url: Optional[str] = Field(default=None, max_length=2_000_000)
    timezone: Optional[str] = Field(default=None, max_length=60)
    locale: Optional[str] = Field(default=None, max_length=10)
    theme: Optional[str] = Field(default=None, max_length=20)


class AvatarUpdateRequest(BaseModel):
    avatar_url: str = Field(..., max_length=2_000_000)


class DisplayNameUpdateRequest(BaseModel):
    display_name: str = Field(..., max_length=150)


class EmailUpdateRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    current_password: str = Field(..., min_length=1, max_length=128)


class DeactivateAccountRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)


# ---------- Sessions (auth-facing) ----------
# `SessionOut` above already covers the persisted shape; this adds the
# one auth-specific flag (`is_current`) the sessions router computes
# per-request by comparing each Session's id against the requesting
# token's `sid` claim -- not a column, so it doesn't belong on SessionOut.

class SessionWithCurrentOut(SessionOut):
    is_current: bool = False


# ---------- Notifications ----------
# See `models.Notification` -- persisted per-user notifications for the
# Notification Center, distinct from `NotificationPreference` (channel
# settings) above.

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    category: NotificationCategory
    title: str
    message: str = ""
    project_id: Optional[str] = None
    invitation_id: Optional[str] = None
    action_url: str = ""
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None


class NotificationCreate(BaseModel):
    user_id: str
    category: NotificationCategory
    title: str = Field(..., min_length=1, max_length=200)
    message: str = ""
    project_id: Optional[str] = None
    invitation_id: Optional[str] = None
    action_url: str = ""


class NotificationCounts(BaseModel):
    unread: int
    total: int
    pending_invitations: int = 0


class InvitationPreviewOut(ProjectInvitationOut):
    """Public, token-scoped view of an invitation (see
    `routers/project_invitations.py`'s `GET /api/invitations/{token}`).
    Adds read-only display fields the invite page needs (project name/
    icon/color, the inviting user's display name, the assigned role's
    name) so an unauthenticated/not-yet-a-member invitee can see who
    invited them and to what, without requiring `view_project` access
    they don't have yet -- the alternative would be calling the
    membership-gated `GET /api/projects/{project_id}` endpoint, which a
    brand-new invitee can never pass."""
    project_name: str = ""
    project_icon: str = ""
    project_color: str = ""
    invited_by_name: Optional[str] = None
    role_name: Optional[str] = None
