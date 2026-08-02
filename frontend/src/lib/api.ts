import type {
  Task,
  TaskInput,
  TimetableSlot,
  TimetableSlotInput,
  DashboardData,
  Subject,
  SubjectInput,
  Topic,
  TopicInput,
  Assignment,
  AssignmentInput,
  Note,
  NoteInput,
  Resource,
  ResourceLinkInput,
  StudySession,
  StudySessionStartInput,
  StudyHubSummary,
  StudyHubSearchResult,
  GlobalSearchResult,
  Project,
  ProjectInput,
  ProjectSummary,
  ProjectPhase,
  ProjectPhaseInput,
  ProjectPhaseSummary,
  Feature,
  FeatureInput,
  ProjectTodo,
  ProjectTodoInput,
  Bug,
  BugInput,
  Milestone,
  MilestoneInput,
  ProjectResource,
  ProjectResourceLinkInput,
  ProjectDocument,
  ProjectDocumentInput,
  TimelineEvent,
  TimelineEventInput,
  ProjectWorkspaceSummary,
  ProjectWorkspaceSearchResult,
  ProjectAnalytics,
  WorkspaceAnalytics,
  ProjectStatus,
  PhaseStatus,
  FeatureStatus,
  Priority,
  BugSeverity,
  BugStatus,
  AIAccount,
  AIAccountInput,
  AIAccountSummary,
  AIProvider,
  AIAccountStatus,
  Conversation,
  ConversationInput,
  ConversationSummary,
  ConversationStatus,
  PromptTemplate,
  PromptTemplateInput,
  ProjectZip,
  AIHandoff,
  AIHandoffInput,
  TokenTracker,
  TokenTrackerInput,
  TokenTrackerAccountTotal,
  TokenUsageSummary,
  KnowledgeArticle,
  KnowledgeArticleInput,
  KnowledgeSource,
  AIWorkspaceSummary,
  ConversationsPerProject,
  ConversationsPerProvider,
  PromptCategoryCount,
  ZipUploadCountBreakdown,
  KnowledgeArticleBreakdown,
  ProviderUsage,
  ConversationStatusCount,
  TokenLimitsReached,
} from "@/types";
import type {
  User,
  RegisterRequest,
  LoginRequest,
  TokenResponse,
  ChangePasswordRequest,
  PasswordResetRequestOut,
  EmailVerificationRequestOut,
  AuthStatusOut,
  ProfileUpdateRequest,
  EmailUpdateRequest,
  DeactivateAccountRequest,
  Session,
} from "@/types/auth";
import type {
  Permission,
  PermissionInput,
  Role,
  RoleInput,
  ProjectMember,
  ProjectMemberInput,
  ProjectMemberUpdateInput,
  ProjectInvitation,
  ProjectInvitationInput,
  InvitationPreview,
  ProjectCollaborationSummary,
  MemberStatus,
  InvitationStatus,
} from "@/types/collaboration";
import type { Notification, NotificationCategory, NotificationCounts } from "@/types/notifications";
import {
  getAccessToken,
  setAccessToken,
  loadPersistedRefreshToken,
  updateStoredRefreshToken,
  clearPersistedSession,
  emitAuthExpired,
  emitUserRefreshed,
} from "@/lib/authClient";

// In dev, Vite proxies /api -> http://127.0.0.1:8000 (see vite.config.ts).
// In production, serve the frontend build behind the same origin as the
// API, or set VITE_API_BASE_URL to point elsewhere.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// Endpoints that either don't take an access token or ARE the token
// refresh call itself -- attempting a refresh-and-retry on a 401 from
// any of these would either be pointless or recurse into itself.
const AUTH_EXEMPT_PATHS = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/refresh"]);

// Single-flight refresh: if five queries all 401 at once (e.g. right
// after the access token expires), they should share one /refresh call
// and one rotated refresh token, not race five separate rotations
// against each other (the backend invalidates the old refresh token
// the instant one rotation succeeds -- see routers/auth.py's
// `refresh_token` docstring).
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = loadPersistedRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) throw new Error("refresh failed");
      const data = (await res.json()) as TokenResponse;
      setAccessToken(data.access_token);
      updateStoredRefreshToken(data.refresh_token);
      emitUserRefreshed(data.user);
      return true;
    } catch {
      setAccessToken(null);
      clearPersistedSession();
      return false;
    }
  })();
  const result = await refreshInFlight;
  refreshInFlight = null;
  return result;
}

async function request<T>(path: string, options: RequestInit = {}, _retried = false): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !_retried && !AUTH_EXEMPT_PATHS.has(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, options, true);
    emitAuthExpired();
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // response had no JSON body
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Separate from `request`: FormData must NOT get a manual Content-Type
// header, since fetch needs to set its own multipart boundary.
async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", body: formData, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // response had no JSON body
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Tasks
  getTasks: () => request<Task[]>("/api/tasks"),
  getTask: (id: string) => request<Task>(`/api/tasks/${id}`),
  createTask: (payload: TaskInput) =>
    request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (id: string, payload: Partial<TaskInput> & { clear_deadline?: boolean }) =>
    request<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTask: (id: string) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),

  // Timetable
  getTimetable: () => request<TimetableSlot[]>("/api/timetable"),
  createSlot: (payload: TimetableSlotInput) =>
    request<TimetableSlot>("/api/timetable", { method: "POST", body: JSON.stringify(payload) }),
  updateSlot: (id: string, payload: Partial<TimetableSlotInput>) =>
    request<TimetableSlot>(`/api/timetable/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSlot: (id: string) => request<void>(`/api/timetable/${id}`, { method: "DELETE" }),

  // Dashboard
  getDashboard: () => request<DashboardData>("/api/dashboard"),

  // Study Hub: Subjects
  getSubjects: () => request<Subject[]>("/api/subjects"),
  getSubject: (id: string) => request<Subject>(`/api/subjects/${id}`),
  createSubject: (payload: SubjectInput) =>
    request<Subject>("/api/subjects", { method: "POST", body: JSON.stringify(payload) }),
  updateSubject: (id: string, payload: Partial<SubjectInput>) =>
    request<Subject>(`/api/subjects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSubject: (id: string) => request<void>(`/api/subjects/${id}`, { method: "DELETE" }),

  // Study Hub: Topics
  getTopics: (subjectId?: string) =>
    request<Topic[]>(`/api/topics${subjectId ? `?subject_id=${subjectId}` : ""}`),
  createTopic: (payload: TopicInput) =>
    request<Topic>("/api/topics", { method: "POST", body: JSON.stringify(payload) }),
  updateTopic: (id: string, payload: Partial<TopicInput>) =>
    request<Topic>(`/api/topics/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTopic: (id: string) => request<void>(`/api/topics/${id}`, { method: "DELETE" }),

  // Study Hub: Assignments
  getAssignments: (params?: { subjectId?: string; topicId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.subjectId) q.set("subject_id", params.subjectId);
    if (params?.topicId) q.set("topic_id", params.topicId);
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return request<Assignment[]>(`/api/assignments${qs ? `?${qs}` : ""}`);
  },
  getAssignment: (id: string) => request<Assignment>(`/api/assignments/${id}`),
  createAssignment: (payload: AssignmentInput) =>
    request<Assignment>("/api/assignments", { method: "POST", body: JSON.stringify(payload) }),
  updateAssignment: (
    id: string,
    payload: Partial<AssignmentInput> & { clear_deadline?: boolean; clear_topic?: boolean }
  ) => request<Assignment>(`/api/assignments/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAssignment: (id: string) => request<void>(`/api/assignments/${id}`, { method: "DELETE" }),
  uploadAssignmentAttachment: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return requestForm<Assignment>(`/api/assignments/${id}/attachments`, form);
  },
  deleteAssignmentAttachment: (id: string, filename: string) =>
    request<Assignment>(`/api/assignments/${id}/attachments/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    }),

  // Study Hub: Notes
  getNotes: (params?: { subjectId?: string; topicId?: string; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.subjectId) q.set("subject_id", params.subjectId);
    if (params?.topicId) q.set("topic_id", params.topicId);
    if (params?.q) q.set("q", params.q);
    const qs = q.toString();
    return request<Note[]>(`/api/notes${qs ? `?${qs}` : ""}`);
  },
  getNote: (id: string) => request<Note>(`/api/notes/${id}`),
  createNote: (payload: NoteInput) =>
    request<Note>("/api/notes", { method: "POST", body: JSON.stringify(payload) }),
  updateNote: (id: string, payload: Partial<NoteInput> & { clear_topic?: boolean }) =>
    request<Note>(`/api/notes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteNote: (id: string) => request<void>(`/api/notes/${id}`, { method: "DELETE" }),
  uploadNoteAttachment: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return requestForm<Note>(`/api/notes/${id}/attachments`, form);
  },
  deleteNoteAttachment: (id: string, filename: string) =>
    request<Note>(`/api/notes/${id}/attachments/${encodeURIComponent(filename)}`, { method: "DELETE" }),

  // Study Hub: Resources
  getResources: (params?: { subjectId?: string; topicId?: string; resourceType?: string }) => {
    const q = new URLSearchParams();
    if (params?.subjectId) q.set("subject_id", params.subjectId);
    if (params?.topicId) q.set("topic_id", params.topicId);
    if (params?.resourceType) q.set("resource_type", params.resourceType);
    const qs = q.toString();
    return request<Resource[]>(`/api/resources${qs ? `?${qs}` : ""}`);
  },
  createResourceLink: (payload: ResourceLinkInput) =>
    request<Resource>("/api/resources", { method: "POST", body: JSON.stringify(payload) }),
  uploadResourceFile: (params: { subjectId: string; title: string; topicId?: string | null; file: File }) => {
    const form = new FormData();
    form.append("subject_id", params.subjectId);
    form.append("title", params.title);
    if (params.topicId) form.append("topic_id", params.topicId);
    form.append("file", params.file);
    return requestForm<Resource>("/api/resources/upload", form);
  },
  updateResource: (id: string, payload: { title?: string; topic_id?: string; external_url?: string; clear_topic?: boolean }) =>
    request<Resource>(`/api/resources/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteResource: (id: string) => request<void>(`/api/resources/${id}`, { method: "DELETE" }),

  // Study Hub: Study Sessions
  getStudySessions: (params?: { subjectId?: string; assignmentId?: string; activeOnly?: boolean; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.subjectId) q.set("subject_id", params.subjectId);
    if (params?.assignmentId) q.set("assignment_id", params.assignmentId);
    if (params?.activeOnly) q.set("active_only", "true");
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<StudySession[]>(`/api/study-sessions${qs ? `?${qs}` : ""}`);
  },
  startStudySession: (payload: StudySessionStartInput) =>
    request<StudySession>("/api/study-sessions", { method: "POST", body: JSON.stringify(payload) }),
  updateStudySession: (
    id: string,
    payload: { ended_at?: string; duration_minutes?: number; notes?: string; complete_now?: boolean }
  ) => request<StudySession>(`/api/study-sessions/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteStudySession: (id: string) => request<void>(`/api/study-sessions/${id}`, { method: "DELETE" }),

  // Study Hub: aggregate summary + search
  getStudyHubSummary: () => request<StudyHubSummary>("/api/study-hub/summary"),
  searchStudyHub: (q: string) => request<StudyHubSearchResult>(`/api/study-hub/search?q=${encodeURIComponent(q)}`),

  // Global Search: spans Tasks, Study Hub, and Project Workspace in one call
  globalSearch: (q: string) => request<GlobalSearchResult>(`/api/search?q=${encodeURIComponent(q)}`),

  // ==================================================================
  // Project Workspace: Projects
  // ==================================================================
  getProjects: (params?: {
    status?: ProjectStatus;
    archived?: boolean;
    q?: string;
    tag?: string;
    sortBy?: "name" | "created_at" | "updated_at" | "progress";
    sortOrder?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.archived !== undefined) q.set("archived", String(params.archived));
    if (params?.q) q.set("q", params.q);
    if (params?.tag) q.set("tag", params.tag);
    if (params?.sortBy) q.set("sort_by", params.sortBy);
    if (params?.sortOrder) q.set("sort_order", params.sortOrder);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<Project[]>(`/api/projects${qs ? `?${qs}` : ""}`);
  },
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  getProjectSummary: (id: string) => request<ProjectSummary>(`/api/projects/${id}/summary`),
  getWorkspaceSummary: (includeArchived?: boolean) =>
    request<ProjectWorkspaceSummary>(
      `/api/projects/summary${includeArchived ? "?include_archived=true" : ""}`
    ),
  searchProjectWorkspace: (query: string, projectId?: string) => {
    const q = new URLSearchParams({ q: query });
    if (projectId) q.set("project_id", projectId);
    return request<ProjectWorkspaceSearchResult>(`/api/projects/search?${q.toString()}`);
  },
  createProject: (payload: ProjectInput) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(payload) }),
  updateProject: (id: string, payload: Partial<ProjectInput>) =>
    request<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),

  // ==================================================================
  // Project Workspace: Phases (Roadmap)
  // ==================================================================
  getPhases: (params?: { projectId?: string; status?: PhaseStatus }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return request<ProjectPhase[]>(`/api/phases${qs ? `?${qs}` : ""}`);
  },
  getPhase: (id: string) => request<ProjectPhase>(`/api/phases/${id}`),
  getPhaseSummary: (id: string) => request<ProjectPhaseSummary>(`/api/phases/${id}/summary`),
  createPhase: (payload: ProjectPhaseInput) =>
    request<ProjectPhase>("/api/phases", { method: "POST", body: JSON.stringify(payload) }),
  updatePhase: (id: string, payload: Partial<ProjectPhaseInput>) =>
    request<ProjectPhase>(`/api/phases/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  reorderPhases: (items: { id: string; order_index: number }[]) =>
    request<ProjectPhase[]>("/api/phases/reorder", { method: "POST", body: JSON.stringify(items) }),
  deletePhase: (id: string) => request<void>(`/api/phases/${id}`, { method: "DELETE" }),

  // ==================================================================
  // Project Workspace: Features
  // ==================================================================
  getFeatures: (params?: {
    projectId?: string;
    phaseId?: string;
    status?: FeatureStatus;
    priority?: Priority;
    q?: string;
    sortBy?: "created_at" | "updated_at" | "priority" | "progress" | "title";
    sortOrder?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.phaseId) q.set("phase_id", params.phaseId);
    if (params?.status) q.set("status", params.status);
    if (params?.priority) q.set("priority", params.priority);
    if (params?.q) q.set("q", params.q);
    if (params?.sortBy) q.set("sort_by", params.sortBy);
    if (params?.sortOrder) q.set("sort_order", params.sortOrder);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<Feature[]>(`/api/features${qs ? `?${qs}` : ""}`);
  },
  getFeature: (id: string) => request<Feature>(`/api/features/${id}`),
  createFeature: (payload: FeatureInput) =>
    request<Feature>("/api/features", { method: "POST", body: JSON.stringify(payload) }),
  updateFeature: (id: string, payload: Partial<FeatureInput> & { clear_phase?: boolean }) =>
    request<Feature>(`/api/features/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteFeature: (id: string) => request<void>(`/api/features/${id}`, { method: "DELETE" }),

  // ==================================================================
  // Project Workspace: Todos
  // ==================================================================
  getProjectTodos: (params?: {
    projectId?: string;
    phaseId?: string;
    featureId?: string;
    status?: string;
    q?: string;
    overdueOnly?: boolean;
    sortBy?: "deadline" | "created_at" | "updated_at" | "progress" | "title";
    sortOrder?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.phaseId) q.set("phase_id", params.phaseId);
    if (params?.featureId) q.set("feature_id", params.featureId);
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    if (params?.overdueOnly) q.set("overdue_only", "true");
    if (params?.sortBy) q.set("sort_by", params.sortBy);
    if (params?.sortOrder) q.set("sort_order", params.sortOrder);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<ProjectTodo[]>(`/api/todos${qs ? `?${qs}` : ""}`);
  },
  getProjectTodo: (id: string) => request<ProjectTodo>(`/api/todos/${id}`),
  createProjectTodo: (payload: ProjectTodoInput) =>
    request<ProjectTodo>("/api/todos", { method: "POST", body: JSON.stringify(payload) }),
  updateProjectTodo: (
    id: string,
    payload: Partial<ProjectTodoInput> & {
      clear_deadline?: boolean;
      clear_phase?: boolean;
      clear_feature?: boolean;
    }
  ) => request<ProjectTodo>(`/api/todos/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProjectTodo: (id: string) => request<void>(`/api/todos/${id}`, { method: "DELETE" }),

  // ==================================================================
  // Project Workspace: Bugs
  // ==================================================================
  getBugs: (params?: {
    projectId?: string;
    phaseId?: string;
    featureId?: string;
    severity?: BugSeverity;
    status?: BugStatus;
    q?: string;
    sortBy?: "created_at" | "updated_at" | "severity" | "title";
    sortOrder?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.phaseId) q.set("phase_id", params.phaseId);
    if (params?.featureId) q.set("feature_id", params.featureId);
    if (params?.severity) q.set("severity", params.severity);
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    if (params?.sortBy) q.set("sort_by", params.sortBy);
    if (params?.sortOrder) q.set("sort_order", params.sortOrder);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<Bug[]>(`/api/bugs${qs ? `?${qs}` : ""}`);
  },
  getBug: (id: string) => request<Bug>(`/api/bugs/${id}`),
  createBug: (payload: BugInput) =>
    request<Bug>("/api/bugs", { method: "POST", body: JSON.stringify(payload) }),
  updateBug: (id: string, payload: Partial<BugInput> & { clear_phase?: boolean; clear_feature?: boolean }) =>
    request<Bug>(`/api/bugs/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteBug: (id: string) => request<void>(`/api/bugs/${id}`, { method: "DELETE" }),

  // ==================================================================
  // Project Workspace: Milestones
  // ==================================================================
  getMilestones: (params?: {
    projectId?: string;
    phaseId?: string;
    completed?: boolean;
    q?: string;
    sortBy?: "target_date" | "created_at" | "title";
    sortOrder?: "asc" | "desc";
  }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.phaseId) q.set("phase_id", params.phaseId);
    if (params?.completed !== undefined) q.set("completed", String(params.completed));
    if (params?.q) q.set("q", params.q);
    if (params?.sortBy) q.set("sort_by", params.sortBy);
    if (params?.sortOrder) q.set("sort_order", params.sortOrder);
    const qs = q.toString();
    return request<Milestone[]>(`/api/milestones${qs ? `?${qs}` : ""}`);
  },
  getMilestone: (id: string) => request<Milestone>(`/api/milestones/${id}`),
  createMilestone: (payload: MilestoneInput) =>
    request<Milestone>("/api/milestones", { method: "POST", body: JSON.stringify(payload) }),
  updateMilestone: (
    id: string,
    payload: Partial<MilestoneInput> & {
      clear_target_date?: boolean;
      clear_phase?: boolean;
      complete_now?: boolean;
    }
  ) => request<Milestone>(`/api/milestones/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteMilestone: (id: string) => request<void>(`/api/milestones/${id}`, { method: "DELETE" }),

  // ==================================================================
  // Project Workspace: Documentation
  // ==================================================================
  getProjectDocuments: (params?: { projectId?: string; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.q) q.set("q", params.q);
    const qs = q.toString();
    return request<ProjectDocument[]>(`/api/documents${qs ? `?${qs}` : ""}`);
  },
  getProjectDocument: (id: string) => request<ProjectDocument>(`/api/documents/${id}`),
  createProjectDocument: (payload: ProjectDocumentInput) =>
    request<ProjectDocument>("/api/documents", { method: "POST", body: JSON.stringify(payload) }),
  updateProjectDocument: (id: string, payload: Partial<ProjectDocumentInput>) =>
    request<ProjectDocument>(`/api/documents/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProjectDocument: (id: string) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),

  // ==================================================================
  // Project Workspace: Resources
  // (named project-resources on the backend -- see AI_HANDOFF.md: the
  // Study Hub already owns /api/resources, so this reuses the same
  // upload helpers under a different route prefix, not a new upload
  // implementation)
  // ==================================================================
  getProjectResources: (params?: { projectId?: string; resourceType?: string; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.resourceType) q.set("resource_type", params.resourceType);
    if (params?.q) q.set("q", params.q);
    const qs = q.toString();
    return request<ProjectResource[]>(`/api/project-resources${qs ? `?${qs}` : ""}`);
  },
  createProjectResourceLink: (payload: ProjectResourceLinkInput) =>
    request<ProjectResource>("/api/project-resources", { method: "POST", body: JSON.stringify(payload) }),
  uploadProjectResourceFile: (params: { projectId: string; title: string; file: File }) => {
    const form = new FormData();
    form.append("project_id", params.projectId);
    form.append("title", params.title);
    form.append("file", params.file);
    return requestForm<ProjectResource>("/api/project-resources/upload", form);
  },
  updateProjectResource: (id: string, payload: { title?: string; external_url?: string }) =>
    request<ProjectResource>(`/api/project-resources/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProjectResource: (id: string) => request<void>(`/api/project-resources/${id}`, { method: "DELETE" }),

  // ==================================================================
  // Project Workspace: Timeline
  // ==================================================================
  getTimelineEvents: (params?: {
    projectId?: string;
    eventType?: string;
    relatedEntityType?: string;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.eventType) q.set("event_type", params.eventType);
    if (params?.relatedEntityType) q.set("related_entity_type", params.relatedEntityType);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<TimelineEvent[]>(`/api/timeline${qs ? `?${qs}` : ""}`);
  },
  getTimelineEvent: (id: string) => request<TimelineEvent>(`/api/timeline/${id}`),
  createTimelineEvent: (payload: TimelineEventInput) =>
    request<TimelineEvent>("/api/timeline", { method: "POST", body: JSON.stringify(payload) }),
  deleteTimelineEvent: (id: string) => request<void>(`/api/timeline/${id}`, { method: "DELETE" }),

  // ==================================================================
  // Project Workspace: Analytics
  // ==================================================================
  getProjectAnalytics: (projectId: string) =>
    request<ProjectAnalytics>(`/api/analytics/projects/${projectId}`),
  getWorkspaceAnalytics: (includeArchived?: boolean) =>
    request<WorkspaceAnalytics>(
      `/api/analytics/overview${includeArchived ? "?include_archived=true" : ""}`
    ),

  // ==================================================================
  // AI Workspace: AI Accounts
  // ==================================================================
  getAIAccounts: (params?: {
    provider?: AIProvider;
    status?: AIAccountStatus;
    q?: string;
    sortBy?: "name" | "created_at" | "updated_at";
    sortDir?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.provider) q.set("provider", params.provider);
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    if (params?.sortBy) q.set("sort_by", params.sortBy);
    if (params?.sortDir) q.set("sort_dir", params.sortDir);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<AIAccount[]>(`/api/ai-accounts${qs ? `?${qs}` : ""}`);
  },
  getAIAccount: (id: string) => request<AIAccount>(`/api/ai-accounts/${id}`),
  getAIAccountSummaries: () => request<AIAccountSummary[]>("/api/ai-accounts/summary"),
  getAIAccountSummary: (id: string) => request<AIAccountSummary>(`/api/ai-accounts/${id}/summary`),
  createAIAccount: (payload: AIAccountInput) =>
    request<AIAccount>("/api/ai-accounts", { method: "POST", body: JSON.stringify(payload) }),
  updateAIAccount: (id: string, payload: Partial<AIAccountInput>) =>
    request<AIAccount>(`/api/ai-accounts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  touchAIAccount: (id: string) => request<AIAccount>(`/api/ai-accounts/${id}/touch`, { method: "POST" }),
  deleteAIAccount: (id: string) => request<void>(`/api/ai-accounts/${id}`, { method: "DELETE" }),

  // ==================================================================
  // AI Workspace: Conversations
  // ==================================================================
  getConversations: (params?: {
    aiAccountId?: string;
    projectId?: string;
    status?: ConversationStatus;
    q?: string;
    sortBy?: "title" | "started_at" | "last_message_at" | "created_at" | "updated_at";
    sortDir?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.aiAccountId) q.set("ai_account_id", params.aiAccountId);
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    if (params?.sortBy) q.set("sort_by", params.sortBy);
    if (params?.sortDir) q.set("sort_dir", params.sortDir);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<Conversation[]>(`/api/conversations${qs ? `?${qs}` : ""}`);
  },
  getConversation: (id: string) => request<Conversation>(`/api/conversations/${id}`),
  getConversationSummary: (id: string) => request<ConversationSummary>(`/api/conversations/${id}/summary`),
  createConversation: (payload: ConversationInput) =>
    request<Conversation>("/api/conversations", { method: "POST", body: JSON.stringify(payload) }),
  updateConversation: (id: string, payload: Partial<ConversationInput> & { clear_project?: boolean }) =>
    request<Conversation>(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteConversation: (id: string) => request<void>(`/api/conversations/${id}`, { method: "DELETE" }),

  // ==================================================================
  // AI Workspace: Prompt Templates
  // ==================================================================
  getPromptTemplates: (params?: {
    category?: string;
    favoritesOnly?: boolean;
    q?: string;
    sortBy?: "title" | "usage_count" | "created_at" | "updated_at";
    sortDir?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    if (params?.favoritesOnly) q.set("favorites_only", "true");
    if (params?.q) q.set("q", params.q);
    if (params?.sortBy) q.set("sort_by", params.sortBy);
    if (params?.sortDir) q.set("sort_dir", params.sortDir);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<PromptTemplate[]>(`/api/prompt-templates${qs ? `?${qs}` : ""}`);
  },
  getRecentPromptTemplates: (limit?: number) =>
    request<PromptTemplate[]>(`/api/prompt-templates/recent${limit ? `?limit=${limit}` : ""}`),
  getPromptTemplateCategories: () => request<string[]>("/api/prompt-templates/categories"),
  getPromptTemplate: (id: string) => request<PromptTemplate>(`/api/prompt-templates/${id}`),
  createPromptTemplate: (payload: PromptTemplateInput) =>
    request<PromptTemplate>("/api/prompt-templates", { method: "POST", body: JSON.stringify(payload) }),
  duplicatePromptTemplate: (id: string) =>
    request<PromptTemplate>(`/api/prompt-templates/${id}/duplicate`, { method: "POST" }),
  usePromptTemplate: (id: string) =>
    request<PromptTemplate>(`/api/prompt-templates/${id}/use`, { method: "POST" }),
  updatePromptTemplate: (id: string, payload: Partial<PromptTemplateInput>) =>
    request<PromptTemplate>(`/api/prompt-templates/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deletePromptTemplate: (id: string) => request<void>(`/api/prompt-templates/${id}`, { method: "DELETE" }),

  // ==================================================================
  // AI Workspace: Project Zips (ZIP Manager)
  // Reuses the same upload/replace pattern as Project Resources.
  // ==================================================================
  getProjectZips: (params?: { projectId?: string; aiAccountId?: string; conversationId?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.aiAccountId) q.set("ai_account_id", params.aiAccountId);
    if (params?.conversationId) q.set("conversation_id", params.conversationId);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<ProjectZip[]>(`/api/project-zips${qs ? `?${qs}` : ""}`);
  },
  getCurrentProjectZip: (projectId: string) =>
    request<ProjectZip>(`/api/project-zips/current?project_id=${projectId}`),
  getProjectZip: (id: string) => request<ProjectZip>(`/api/project-zips/${id}`),
  uploadProjectZip: (params: {
    projectId: string;
    aiAccountId?: string;
    conversationId?: string;
    versionLabel?: string;
    notes?: string;
    file: File;
  }) => {
    const form = new FormData();
    form.append("project_id", params.projectId);
    if (params.aiAccountId) form.append("ai_account_id", params.aiAccountId);
    if (params.conversationId) form.append("conversation_id", params.conversationId);
    form.append("version_label", params.versionLabel ?? "");
    form.append("notes", params.notes ?? "");
    form.append("file", params.file);
    return requestForm<ProjectZip>("/api/project-zips/upload", form);
  },
  replaceProjectZip: (id: string, params: { file: File; versionLabel?: string; notes?: string }) => {
    const form = new FormData();
    form.append("file", params.file);
    if (params.versionLabel !== undefined) form.append("version_label", params.versionLabel);
    if (params.notes !== undefined) form.append("notes", params.notes);
    return requestForm<ProjectZip>(`/api/project-zips/${id}/replace`, form);
  },
  updateProjectZip: (
    id: string,
    payload: {
      ai_account_id?: string | null;
      conversation_id?: string | null;
      version_label?: string;
      notes?: string;
      clear_ai_account?: boolean;
      clear_conversation?: boolean;
    }
  ) => request<ProjectZip>(`/api/project-zips/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProjectZip: (id: string) => request<void>(`/api/project-zips/${id}`, { method: "DELETE" }),

  // ==================================================================
  // AI Workspace: AI Handoffs
  // ==================================================================
  getAIHandoffs: (params?: {
    projectId?: string;
    aiAccountId?: string;
    conversationId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.aiAccountId) q.set("ai_account_id", params.aiAccountId);
    if (params?.conversationId) q.set("conversation_id", params.conversationId);
    if (params?.q) q.set("q", params.q);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<AIHandoff[]>(`/api/ai-handoffs${qs ? `?${qs}` : ""}`);
  },
  getLatestAIHandoff: (params?: { projectId?: string; aiAccountId?: string; conversationId?: string }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.aiAccountId) q.set("ai_account_id", params.aiAccountId);
    if (params?.conversationId) q.set("conversation_id", params.conversationId);
    const qs = q.toString();
    return request<AIHandoff>(`/api/ai-handoffs/latest${qs ? `?${qs}` : ""}`);
  },
  getAIHandoff: (id: string) => request<AIHandoff>(`/api/ai-handoffs/${id}`),
  createAIHandoff: (payload: AIHandoffInput) =>
    request<AIHandoff>("/api/ai-handoffs", { method: "POST", body: JSON.stringify(payload) }),
  updateAIHandoff: (id: string, payload: Partial<AIHandoffInput>) =>
    request<AIHandoff>(`/api/ai-handoffs/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAIHandoff: (id: string) => request<void>(`/api/ai-handoffs/${id}`, { method: "DELETE" }),

  // ==================================================================
  // AI Workspace: Token Trackers
  // Append-only usage log (see AI_HANDOFF.md Known Issues -- this is
  // NOT a countdown/settings object; there is no persisted refresh
  // time or notify state on the backend).
  // ==================================================================
  getTokenTrackers: (params?: { aiAccountId?: string; conversationId?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.aiAccountId) q.set("ai_account_id", params.aiAccountId);
    if (params?.conversationId) q.set("conversation_id", params.conversationId);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<TokenTracker[]>(`/api/token-trackers${qs ? `?${qs}` : ""}`);
  },
  getTokenUsageSummary: () => request<TokenUsageSummary>("/api/token-trackers/summary"),
  getAccountTokenTotal: (accountId: string) =>
    request<TokenTrackerAccountTotal>(`/api/token-trackers/accounts/${accountId}/total`),
  getTokenTracker: (id: string) => request<TokenTracker>(`/api/token-trackers/${id}`),
  recordTokenUsage: (payload: TokenTrackerInput) =>
    request<TokenTracker>("/api/token-trackers", { method: "POST", body: JSON.stringify(payload) }),
  updateTokenTracker: (id: string, payload: Partial<TokenTrackerInput>) =>
    request<TokenTracker>(`/api/token-trackers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTokenTracker: (id: string) => request<void>(`/api/token-trackers/${id}`, { method: "DELETE" }),
  markAccountTokenLimited: (accountId: string) =>
    request<void>(`/api/token-trackers/accounts/${accountId}/mark-limited`, { method: "POST" }),
  markAccountTokenRefreshed: (accountId: string) =>
    request<void>(`/api/token-trackers/accounts/${accountId}/mark-refreshed`, { method: "POST" }),

  // ==================================================================
  // AI Workspace: Knowledge Articles (Knowledge Base)
  // ==================================================================
  getKnowledgeArticles: (params?: {
    projectId?: string;
    category?: string;
    pinnedOnly?: boolean;
    favoritesOnly?: boolean;
    source?: KnowledgeSource;
    tag?: string;
    q?: string;
    sortBy?: "title" | "created_at" | "updated_at";
    sortDir?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("project_id", params.projectId);
    if (params?.category) q.set("category", params.category);
    if (params?.pinnedOnly) q.set("pinned_only", "true");
    if (params?.favoritesOnly) q.set("favorites_only", "true");
    if (params?.source) q.set("source", params.source);
    if (params?.tag) q.set("tag", params.tag);
    if (params?.q) q.set("q", params.q);
    if (params?.sortBy) q.set("sort_by", params.sortBy);
    if (params?.sortDir) q.set("sort_dir", params.sortDir);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<KnowledgeArticle[]>(`/api/knowledge-articles${qs ? `?${qs}` : ""}`);
  },
  getKnowledgeCategories: () => request<string[]>("/api/knowledge-articles/categories"),
  getKnowledgeArticle: (id: string) => request<KnowledgeArticle>(`/api/knowledge-articles/${id}`),
  createKnowledgeArticle: (payload: KnowledgeArticleInput) =>
    request<KnowledgeArticle>("/api/knowledge-articles", { method: "POST", body: JSON.stringify(payload) }),
  updateKnowledgeArticle: (id: string, payload: Partial<KnowledgeArticleInput> & { clear_project?: boolean }) =>
    request<KnowledgeArticle>(`/api/knowledge-articles/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteKnowledgeArticle: (id: string) => request<void>(`/api/knowledge-articles/${id}`, { method: "DELETE" }),

  // ==================================================================
  // AI Workspace: Analytics
  // ==================================================================
  getAIWorkspaceSummary: () => request<AIWorkspaceSummary>("/api/ai-analytics/summary"),
  getConversationsPerProject: () => request<ConversationsPerProject[]>("/api/ai-analytics/conversations-per-project"),
  getConversationsPerProvider: () => request<ConversationsPerProvider[]>("/api/ai-analytics/conversations-per-provider"),
  getPromptCategoryBreakdown: () => request<PromptCategoryCount[]>("/api/ai-analytics/prompt-categories"),
  getZipUploadBreakdown: () => request<ZipUploadCountBreakdown>("/api/ai-analytics/zip-upload-count"),
  getKnowledgeArticleBreakdown: () => request<KnowledgeArticleBreakdown>("/api/ai-analytics/knowledge-articles"),
  getProviderUsage: () => request<ProviderUsage[]>("/api/ai-analytics/provider-usage"),
  getConversationStatusBreakdown: () => request<ConversationStatusCount[]>("/api/ai-analytics/conversation-status"),
  getTokenLimitsReached: () => request<TokenLimitsReached>("/api/ai-analytics/token-limits-reached"),

  // ==================================================================
  // Identity & Security (routers/auth.py, routers/sessions.py)
  // ==================================================================
  register: (payload: RegisterRequest) =>
    request<TokenResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: LoginRequest) =>
    request<TokenResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  revokeToken: (refresh_token: string) =>
    request<void>("/api/auth/revoke", { method: "POST", body: JSON.stringify({ refresh_token }) }),
  getMe: () => request<User>("/api/auth/me"),
  getAuthStatus: () => request<AuthStatusOut>("/api/auth/status"),
  updateProfile: (payload: ProfileUpdateRequest) =>
    request<User>("/api/auth/me", { method: "PATCH", body: JSON.stringify(payload) }),
  updateAvatar: (avatar_url: string) =>
    request<User>("/api/auth/me/avatar", { method: "PATCH", body: JSON.stringify({ avatar_url }) }),
  updateDisplayName: (display_name: string) =>
    request<User>("/api/auth/me/display-name", { method: "PATCH", body: JSON.stringify({ display_name }) }),
  updateEmail: (payload: EmailUpdateRequest) =>
    request<User>("/api/auth/me/email", { method: "PATCH", body: JSON.stringify(payload) }),
  deactivateAccount: (payload: DeactivateAccountRequest) =>
    request<void>("/api/auth/me/deactivate", { method: "POST", body: JSON.stringify(payload) }),
  changePassword: (payload: ChangePasswordRequest) =>
    request<void>("/api/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),
  requestPasswordReset: (email: string) =>
    request<PasswordResetRequestOut>("/api/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  confirmPasswordReset: (token: string, new_password: string) =>
    request<void>("/api/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    }),
  requestEmailVerification: () =>
    request<EmailVerificationRequestOut>("/api/auth/email-verification/request", { method: "POST" }),
  confirmEmailVerification: (token: string) =>
    request<User>("/api/auth/email-verification/confirm", { method: "POST", body: JSON.stringify({ token }) }),

  // Sessions
  getSessions: (includeRevoked = false) =>
    request<Session[]>(`/api/auth/sessions${includeRevoked ? "?include_revoked=true" : ""}`),
  getCurrentSession: () => request<Session>("/api/auth/sessions/current"),
  revokeSession: (id: string) => request<void>(`/api/auth/sessions/${id}`, { method: "DELETE" }),
  revokeOtherSessions: () => request<void>("/api/auth/sessions/revoke-others", { method: "POST" }),
  logoutAllDevices: () => request<void>("/api/auth/sessions/logout-all", { method: "POST" }),

  // ==================================================================
  // Users (routers/users.py) -- read-only lookups used by the Project
  // Collaboration UI to resolve a ProjectMember/ProjectInvitation's
  // user_id/invited_by_user_id into a displayable name/avatar.
  // ==================================================================
  getUsers: (params?: { q?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    search.set("limit", String(params?.limit ?? 200));
    return request<User[]>(`/api/users?${search.toString()}`);
  },
  getUser: (id: string) => request<User>(`/api/users/${id}`),

  // ==================================================================
  // Permissions (routers/permissions.py)
  // ==================================================================
  getPermissions: (params?: { category?: string; q?: string }) => {
    const search = new URLSearchParams();
    if (params?.category) search.set("category", params.category);
    if (params?.q) search.set("q", params.q);
    const qs = search.toString();
    return request<Permission[]>(`/api/permissions${qs ? `?${qs}` : ""}`);
  },
  getPermission: (id: string) => request<Permission>(`/api/permissions/${id}`),
  getPermissionByKey: (key: string) => request<Permission>(`/api/permissions/lookup/${encodeURIComponent(key)}`),

  // ==================================================================
  // Roles (routers/roles.py)
  // ==================================================================
  getRoles: (params?: { projectId?: string; includeGlobal?: boolean }) => {
    const search = new URLSearchParams();
    if (params?.projectId) search.set("project_id", params.projectId);
    if (params?.includeGlobal === false) search.set("include_global", "false");
    const qs = search.toString();
    return request<Role[]>(`/api/roles${qs ? `?${qs}` : ""}`);
  },
  getRole: (id: string) => request<Role>(`/api/roles/${id}`),
  createRole: (payload: RoleInput) =>
    request<Role>("/api/roles", { method: "POST", body: JSON.stringify(payload) }),
  updateRole: (id: string, payload: Partial<RoleInput>) =>
    request<Role>(`/api/roles/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteRole: (id: string) => request<void>(`/api/roles/${id}`, { method: "DELETE" }),
  addRolePermissions: (id: string, keys: string[]) =>
    request<Role>(`/api/roles/${id}/permissions?${keys.map((k) => `keys=${encodeURIComponent(k)}`).join("&")}`, {
      method: "POST",
    }),
  removeRolePermissions: (id: string, keys: string[]) =>
    request<Role>(`/api/roles/${id}/permissions?${keys.map((k) => `keys=${encodeURIComponent(k)}`).join("&")}`, {
      method: "DELETE",
    }),

  // ==================================================================
  // Project Members (routers/project_members.py)
  // ==================================================================
  getProjectMembers: (projectId: string, params?: { status?: MemberStatus; roleId?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.roleId) search.set("role_id", params.roleId);
    const qs = search.toString();
    return request<ProjectMember[]>(`/api/projects/${projectId}/members${qs ? `?${qs}` : ""}`);
  },
  getProjectCollaborationSummary: (projectId: string) =>
    request<ProjectCollaborationSummary>(`/api/projects/${projectId}/members/summary`),
  getProjectMember: (projectId: string, memberId: string) =>
    request<ProjectMember>(`/api/projects/${projectId}/members/${memberId}`),
  addProjectMember: (projectId: string, payload: ProjectMemberInput) =>
    request<ProjectMember>(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProjectMember: (projectId: string, memberId: string, payload: ProjectMemberUpdateInput) =>
    request<ProjectMember>(`/api/projects/${projectId}/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  removeProjectMember: (projectId: string, memberId: string) =>
    request<void>(`/api/projects/${projectId}/members/${memberId}`, { method: "DELETE" }),
  transferProjectOwnership: (projectId: string, newOwnerUserId: string) =>
    request<ProjectMember>(
      `/api/projects/${projectId}/members/transfer-ownership?new_owner_user_id=${encodeURIComponent(newOwnerUserId)}`,
      { method: "POST" }
    ),
  leaveProject: (projectId: string, userId: string) =>
    request<void>(`/api/projects/${projectId}/members/leave?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
    }),

  // ==================================================================
  // Project Invitations (routers/project_invitations.py)
  // ==================================================================
  getProjectInvitations: (projectId: string, status?: InvitationStatus) =>
    request<ProjectInvitation[]>(
      `/api/projects/${projectId}/invitations${status ? `?status=${status}` : ""}`
    ),
  createProjectInvitation: (projectId: string, payload: Omit<ProjectInvitationInput, "project_id">) =>
    request<ProjectInvitation>(`/api/projects/${projectId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ ...payload, project_id: projectId }),
    }),
  cancelProjectInvitation: (projectId: string, invitationId: string) =>
    request<ProjectInvitation>(`/api/projects/${projectId}/invitations/${invitationId}/cancel`, {
      method: "POST",
    }),
  expireProjectInvitation: (projectId: string, invitationId: string) =>
    request<ProjectInvitation>(`/api/projects/${projectId}/invitations/${invitationId}/expire`, {
      method: "POST",
    }),
  getInvitationByToken: (token: string) => request<InvitationPreview>(`/api/invitations/${token}`),
  acceptInvitation: (token: string, displayName?: string) =>
    request<ProjectMember>(
      `/api/invitations/${token}/accept${displayName ? `?display_name=${encodeURIComponent(displayName)}` : ""}`,
      { method: "POST" }
    ),
  rejectInvitation: (token: string) =>
    request<ProjectInvitation>(`/api/invitations/${token}/reject`, { method: "POST" }),
  resendProjectInvitation: (projectId: string, invitationId: string) =>
    request<ProjectInvitation>(`/api/projects/${projectId}/invitations/${invitationId}/resend`, {
      method: "POST",
    }),

  // ==================================================================
  // Notifications (routers/notifications.py)
  // ==================================================================
  getNotifications: (params?: { is_read?: boolean; category?: NotificationCategory; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.is_read !== undefined) query.set("is_read", String(params.is_read));
    if (params?.category) query.set("category", params.category);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return request<Notification[]>(`/api/notifications${qs ? `?${qs}` : ""}`);
  },
  getNotificationCounts: () => request<NotificationCounts>("/api/notifications/counts"),
  markNotificationRead: (id: string) =>
    request<Notification>(`/api/notifications/${id}/read`, { method: "POST" }),
  markNotificationUnread: (id: string) =>
    request<Notification>(`/api/notifications/${id}/unread`, { method: "POST" }),
  markAllNotificationsRead: () =>
    request<NotificationCounts>("/api/notifications/mark-all-read", { method: "POST" }),
  deleteNotification: (id: string) =>
    request<void>(`/api/notifications/${id}`, { method: "DELETE" }),
};
