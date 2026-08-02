export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskCategory =
  | "study"
  | "assignment"
  | "project"
  | "exam"
  | "reading"
  | "personal"
  | "other";

export type Urgency = "critical" | "high" | "medium" | "low" | "none";

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  deadline: string | null; // ISO string
  estimated_effort_hours: number;
  status: TaskStatus;
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  attachments: string;
  urgency: Urgency;
}

export interface TaskInput {
  title: string;
  description?: string;
  category?: TaskCategory;
  deadline?: string | null;
  estimated_effort_hours?: number;
  status?: TaskStatus;
  progress?: number;
}

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface TimetableSlot {
  id: string;
  title: string;
  location: string;
  day_of_week: DayOfWeek;
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  color: string;
  created_at: string;
}

export interface TimetableSlotInput {
  title: string;
  location?: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  color?: string;
}

export interface QuickStats {
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  due_today: number;
  completion_rate: number;
  hours_planned_this_week: number;
}

export interface ActivityEntry {
  id: string;
  message: string;
  icon: string;
  created_at: string;
}

// ======================================================================
// Study Hub
// ======================================================================

export interface Subject {
  id: string;
  name: string;
  code: string;
  instructor: string;
  color: string;
  created_at: string;
}

export interface SubjectInput {
  name: string;
  code?: string;
  instructor?: string;
  color?: string;
}

export interface Topic {
  id: string;
  subject_id: string;
  title: string;
  order_index: number;
  created_at: string;
}

export interface TopicInput {
  subject_id: string;
  title: string;
  order_index?: number;
}

export interface SubjectProgress {
  subject: Subject;
  total_assignments: number;
  completed_assignments: number;
  overdue_assignments: number;
  completion_rate: number;
  hours_studied_this_week: number;
  topic_count: number;
  resource_count: number;
  note_count: number;
}

export type AssignmentStatus = "todo" | "in_progress" | "done";

export interface AttachmentMeta {
  filename: string;
  original_name: string;
  url: string;
  size_bytes: number;
  content_type: string;
}

export interface Assignment {
  id: string;
  subject_id: string;
  topic_id: string | null;
  title: string;
  description: string;
  deadline: string | null;
  estimated_effort_hours: number;
  status: AssignmentStatus;
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  attachments: AttachmentMeta[];
  urgency: Urgency;
  subject_name: string | null;
  subject_color: string | null;
}

export interface AssignmentInput {
  subject_id: string;
  topic_id?: string | null;
  title: string;
  description?: string;
  deadline?: string | null;
  estimated_effort_hours?: number;
  status?: AssignmentStatus;
  progress?: number;
}

export interface Note {
  id: string;
  subject_id: string;
  topic_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  attachments: AttachmentMeta[];
  subject_name: string | null;
  subject_color: string | null;
}

export interface NoteInput {
  subject_id: string;
  topic_id?: string | null;
  title: string;
  content?: string;
}

export type ResourceType = "pdf" | "ppt" | "docx" | "image" | "zip" | "link" | "other";

export interface Resource {
  id: string;
  subject_id: string;
  topic_id: string | null;
  title: string;
  resource_type: ResourceType;
  file_name: string | null;
  original_name: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  external_url: string | null;
  created_at: string;
  subject_name: string | null;
  subject_color: string | null;
}

export interface ResourceLinkInput {
  subject_id: string;
  topic_id?: string | null;
  title: string;
  external_url: string;
}

export type StudySessionType = "pomodoro" | "deep_work" | "manual";

export interface StudySession {
  id: string;
  subject_id: string | null;
  assignment_id: string | null;
  session_type: StudySessionType;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  notes: string;
  created_at: string;
  subject_name: string | null;
  subject_color: string | null;
}

export interface StudySessionStartInput {
  subject_id?: string | null;
  assignment_id?: string | null;
  session_type?: StudySessionType;
  notes?: string;
}

export interface DailyStudyMinutes {
  date: string;
  minutes: number;
}

export interface SubjectHours {
  subject_id: string;
  subject_name: string;
  subject_color: string;
  hours: number;
}

export interface StudyAnalytics {
  current_streak_days: number;
  longest_streak_days: number;
  total_hours_all_time: number;
  total_hours_this_week: number;
  sessions_this_week: number;
  daily_minutes_last_14_days: DailyStudyMinutes[];
  hours_by_subject: SubjectHours[];
}

export interface StudyHubSummary {
  subjects_progress: SubjectProgress[];
  upcoming_assignments: Assignment[];
  overdue_assignments: Assignment[];
  today_study_sessions: StudySession[];
  analytics: StudyAnalytics;
}

export interface StudyHubSearchResult {
  subjects: Subject[];
  assignments: Assignment[];
  notes: Note[];
  resources: Resource[];
}

export interface GlobalSearchItem {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  path: string;
}

export interface GlobalSearchResult {
  query: string;
  results: GlobalSearchItem[];
}

export interface DashboardData {
  today_tasks: Task[];
  overdue_tasks: Task[];
  upcoming_deadlines: Task[];
  stats: QuickStats;
  recent_activity: ActivityEntry[];
  upcoming_assignments: Assignment[];
  overdue_assignments: Assignment[];
  today_study_sessions: StudySession[];
  subjects_progress: SubjectProgress[];
  // Project Workspace integration
  projects_progress: ProjectSummary[];
  upcoming_milestones: Milestone[];
  overdue_project_todos: ProjectTodo[];
  recent_project_timeline: TimelineEvent[];
}

// ======================================================================
// Project Workspace
// ======================================================================

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "archived";
export type PhaseStatus = "pending" | "in_progress" | "completed" | "blocked";
export type FeatureStatus = "backlog" | "planned" | "in_progress" | "testing" | "done";
export type Priority = "low" | "medium" | "high" | "critical";
export type BugSeverity = "low" | "medium" | "high" | "critical";
export type BugStatus = "open" | "in_progress" | "resolved" | "wont_fix" | "duplicate";

// Re-exported here so callers of `Project`/`ProjectInput` don't need a
// second import for the collaboration-readiness fields -- the actual
// definitions live in types/collaboration.ts alongside the rest of the
// Project Collaboration surface (Role/Permission/ProjectMember/etc.).
export type { ProjectVisibility, ProjectType } from "./collaboration";
import type { ProjectVisibility, ProjectType } from "./collaboration";

export interface Project {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: ProjectStatus;
  repository_url: string;
  local_repository: string;
  progress: number;
  archived: boolean;
  tags: string[];
  // ---- Collaboration-readiness (see ARCHITECTURE.md "Membership Model") ----
  owner_id: string | null;
  visibility: ProjectVisibility;
  collaboration_enabled: boolean;
  project_type: ProjectType;
  created_at: string;
  updated_at: string;
}

export interface ProjectInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  status?: ProjectStatus;
  repository_url?: string;
  local_repository?: string;
  progress?: number;
  archived?: boolean;
  tags?: string[];
  visibility?: ProjectVisibility;
  collaboration_enabled?: boolean;
  project_type?: ProjectType;
}

export interface ProjectSummary {
  project: Project;
  phase_count: number;
  feature_count: number;
  todo_count: number;
  completed_todo_count: number;
  bug_count: number;
  open_bug_count: number;
  milestone_count: number;
  completed_milestone_count: number;
  resource_count: number;
  document_count: number;
  overall_progress: number;
}

export interface ProjectPhase {
  id: string;
  project_id: string;
  title: string;
  description: string;
  order_index: number;
  status: PhaseStatus;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectPhaseInput {
  project_id: string;
  title: string;
  description?: string;
  order_index?: number;
  status?: PhaseStatus;
  progress?: number;
}

export interface ProjectPhaseSummary {
  phase: ProjectPhase;
  feature_count: number;
  todo_count: number;
  bug_count: number;
  milestone_count: number;
  completion_rate: number;
}

export interface Feature {
  id: string;
  project_id: string;
  phase_id: string | null;
  title: string;
  description: string;
  status: FeatureStatus;
  priority: Priority;
  estimated_effort_hours: number;
  progress: number;
  created_at: string;
  updated_at: string;
  urgency: Urgency;
  phase_title: string | null;
}

export interface FeatureInput {
  project_id: string;
  phase_id?: string | null;
  title: string;
  description?: string;
  status?: FeatureStatus;
  priority?: Priority;
  estimated_effort_hours?: number;
  progress?: number;
}

export interface ProjectTodo {
  id: string;
  project_id: string;
  phase_id: string | null;
  feature_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  deadline: string | null;
  estimated_effort_hours: number;
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  urgency: Urgency;
  feature_title: string | null;
  phase_title: string | null;
}

export interface ProjectTodoInput {
  project_id: string;
  phase_id?: string | null;
  feature_id?: string | null;
  title: string;
  description?: string;
  status?: TaskStatus;
  deadline?: string | null;
  estimated_effort_hours?: number;
  progress?: number;
}

export interface Bug {
  id: string;
  project_id: string;
  phase_id: string | null;
  feature_id: string | null;
  title: string;
  description: string;
  severity: BugSeverity;
  status: BugStatus;
  resolution: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  feature_title: string | null;
  phase_title: string | null;
}

export interface BugInput {
  project_id: string;
  phase_id?: string | null;
  feature_id?: string | null;
  title: string;
  description?: string;
  severity?: BugSeverity;
  status?: BugStatus;
  resolution?: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  phase_id: string | null;
  title: string;
  description: string;
  target_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  phase_title: string | null;
}

export interface MilestoneInput {
  project_id: string;
  phase_id?: string | null;
  title: string;
  description?: string;
  target_date?: string | null;
  completed?: boolean;
}

export interface ProjectResource {
  id: string;
  project_id: string;
  title: string;
  resource_type: ResourceType;
  file_name: string | null;
  original_name: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  external_url: string | null;
  created_at: string;
}

export interface ProjectResourceLinkInput {
  project_id: string;
  title: string;
  external_url: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  title: string;
  content: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectDocumentInput {
  project_id: string;
  title: string;
  content?: string;
  order_index?: number;
}

export interface TimelineEvent {
  id: string;
  project_id: string;
  event_type: string;
  title: string;
  description: string;
  icon: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
}

export interface TimelineEventInput {
  project_id: string;
  event_type: string;
  title: string;
  description?: string;
  icon?: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
}

export interface ProjectWorkspaceSummary {
  projects_progress: ProjectSummary[];
  upcoming_milestones: Milestone[];
  overdue_todos: ProjectTodo[];
  recent_timeline: TimelineEvent[];
}

export interface ProjectWorkspaceSearchResult {
  projects: Project[];
  todos: ProjectTodo[];
  features: Feature[];
  bugs: Bug[];
  documents: ProjectDocument[];
  resources: ProjectResource[];
}

export interface FeatureStatusCount {
  status: FeatureStatus;
  count: number;
}

export interface BugSeverityCount {
  severity: BugSeverity;
  count: number;
}

export interface BugStatusCount {
  status: BugStatus;
  count: number;
}

export interface VelocityPoint {
  week_start: string;
  todos_completed: number;
  bugs_resolved: number;
  milestones_reached: number;
}

export interface ProjectAnalytics {
  project_id: string;
  project_name: string;
  overall_progress: number;
  phase_count: number;
  completed_phase_count: number;
  total_todos: number;
  completed_todos: number;
  todo_completion_rate: number;
  overdue_todos: number;
  total_bugs: number;
  open_bugs: number;
  resolved_bugs: number;
  bugs_by_severity: BugSeverityCount[];
  bugs_by_status: BugStatusCount[];
  total_milestones: number;
  completed_milestones: number;
  milestone_completion_rate: number;
  upcoming_milestones: number;
  overdue_milestones: number;
  total_features: number;
  features_by_status: FeatureStatusCount[];
  velocity: VelocityPoint[];
}

export interface WorkspaceAnalytics {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  project_analytics: ProjectAnalytics[];
  combined_velocity: VelocityPoint[];
}

// ======================================================================
// AI Workspace
// Mirrors backend/app/schemas.py's AI Workspace section exactly (7
// tables: AIAccount, Conversation, PromptTemplate, ProjectZip,
// AIHandoff, TokenTracker, KnowledgeArticle). See AI_HANDOFF.md for the
// scope gaps noted below (favorites/pinned reuse `category`, token
// tracker is a usage log not a countdown-settings object, etc).
// ======================================================================

export type AIProvider = "claude" | "gpt" | "gemini" | "other";
export type AIAccountStatus = "active" | "idle" | "archived";
export type ConversationStatus = "active" | "completed" | "archived";
export type KnowledgeSource = "manual" | "ai_generated";

export interface AIAccount {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  description: string;
  icon: string;
  color: string;
  status: AIAccountStatus;
  api_key_env_var: string;
  current_task: string;
  created_at: string;
  updated_at: string;
}

export interface AIAccountInput {
  name: string;
  provider?: AIProvider;
  model?: string;
  description?: string;
  icon?: string;
  color?: string;
  status?: AIAccountStatus;
  api_key_env_var?: string;
  current_task?: string;
}

export interface AIAccountSummary {
  account: AIAccount;
  conversation_count: number;
  active_conversation_count: number;
  zip_count: number;
  handoff_count: number;
  total_tokens_used: number;
  last_active_at: string | null;
}

export interface Conversation {
  id: string;
  ai_account_id: string;
  project_id: string | null;
  title: string;
  summary: string;
  status: ConversationStatus;
  message_count: number;
  started_at: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationInput {
  ai_account_id: string;
  project_id?: string | null;
  title: string;
  summary?: string;
  status?: ConversationStatus;
  message_count?: number;
  started_at?: string | null;
  last_message_at?: string | null;
}

export interface ConversationSummary {
  conversation: Conversation;
  zip_count: number;
  handoff_count: number;
  total_tokens_used: number;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  variables: string[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface PromptTemplateInput {
  title: string;
  description?: string;
  content: string;
  category?: string;
  variables?: string[];
  usage_count?: number;
}

export interface ProjectZip {
  id: string;
  project_id: string;
  ai_account_id: string | null;
  conversation_id: string | null;
  version_label: string;
  file_name: string | null;
  original_name: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  notes: string;
  created_at: string;
}

export interface AIHandoff {
  id: string;
  project_id: string | null;
  ai_account_id: string | null;
  conversation_id: string | null;
  completed_work: string;
  created_files: string[];
  modified_files: string[];
  remaining_work: string;
  known_issues: string;
  next_objective: string;
  created_at: string;
}

export interface AIHandoffInput {
  project_id?: string | null;
  ai_account_id?: string | null;
  conversation_id?: string | null;
  completed_work?: string;
  created_files?: string[];
  modified_files?: string[];
  remaining_work?: string;
  known_issues?: string;
  next_objective?: string;
}

export interface TokenTracker {
  id: string;
  ai_account_id: string;
  conversation_id: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  model: string;
  recorded_at: string;
}

export interface TokenTrackerInput {
  ai_account_id: string;
  conversation_id?: string | null;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
  model?: string;
}

export interface TokenTrackerAccountTotal {
  ai_account_id: string;
  total_tokens: number;
  total_estimated_cost_usd: number;
}

export interface TokenUsageSummary {
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_estimated_cost_usd: number;
  by_account: TokenTrackerAccountTotal[];
}

export interface KnowledgeArticle {
  id: string;
  project_id: string | null;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source: KnowledgeSource;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeArticleInput {
  project_id?: string | null;
  title: string;
  content?: string;
  category?: string;
  tags?: string[];
  source?: KnowledgeSource;
}

export interface AIWorkspaceSummary {
  total_accounts: number;
  active_accounts: number;
  total_conversations: number;
  active_conversations: number;
  total_prompt_templates: number;
  total_zips: number;
  total_handoffs: number;
  total_knowledge_articles: number;
  token_usage: TokenUsageSummary;
  recent_handoffs: AIHandoff[];
  recent_conversations: Conversation[];
}

export interface AIWorkspaceSearchResult {
  ai_accounts: AIAccount[];
  conversations: Conversation[];
  prompt_templates: PromptTemplate[];
  knowledge_articles: KnowledgeArticle[];
  project_zips: ProjectZip[];
  ai_handoffs: AIHandoff[];
}

export interface ConversationsPerProject {
  project_id: string;
  project_name: string;
  conversation_count: number;
}

export interface ConversationsPerProvider {
  provider: string;
  conversation_count: number;
}

export interface PromptCategoryCount {
  category: string;
  count: number;
}

export interface ZipUploadCountBreakdown {
  total: number;
  by_project: { project_id: string; project_name: string; zip_count: number }[];
}

export interface KnowledgeArticleBreakdown {
  total: number;
  by_category: { category: string; count: number }[];
  by_source: { source: string; count: number }[];
}

export interface ProviderUsage {
  provider: string;
  total_tokens: number;
  total_estimated_cost_usd: number;
}

export interface ConversationStatusCount {
  status: string;
  count: number;
}

export interface TokenLimitsReached {
  count: number;
  events: { message: string; created_at: string }[];
}
