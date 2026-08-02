import type { AIProvider, AIAccountStatus, ConversationStatus, KnowledgeSource } from "@/types";

interface StatusMeta {
  label: string;
  color: string; // badge bg/border classes
  text: string;
  dot: string;
}

export const AI_PROVIDER_META: Record<AIProvider, StatusMeta> = {
  claude: { label: "Claude", color: "bg-primary/15 border-primary/40", text: "text-primary", dot: "bg-primary" },
  gpt: { label: "GPT", color: "bg-urgency-low/15 border-urgency-low/40", text: "text-urgency-low", dot: "bg-urgency-low" },
  gemini: { label: "Gemini", color: "bg-secondary/15 border-secondary/40", text: "text-secondary", dot: "bg-secondary" },
  other: { label: "Other", color: "bg-white/10 border-white/20", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export const AI_ACCOUNT_STATUS_META: Record<AIAccountStatus, StatusMeta> = {
  active: { label: "Active", color: "bg-urgency-low/15 border-urgency-low/40", text: "text-urgency-low", dot: "bg-urgency-low" },
  idle: { label: "Idle", color: "bg-urgency-medium/15 border-urgency-medium/40", text: "text-urgency-medium", dot: "bg-urgency-medium" },
  archived: { label: "Archived", color: "bg-white/10 border-white/20", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export const CONVERSATION_STATUS_META: Record<ConversationStatus, StatusMeta> = {
  active: { label: "Active", color: "bg-urgency-low/15 border-urgency-low/40", text: "text-urgency-low", dot: "bg-urgency-low" },
  completed: { label: "Completed", color: "bg-primary/15 border-primary/40", text: "text-primary", dot: "bg-primary" },
  archived: { label: "Archived", color: "bg-white/10 border-white/20", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export const KNOWLEDGE_SOURCE_META: Record<KnowledgeSource, StatusMeta> = {
  manual: { label: "Manual", color: "bg-secondary/15 border-secondary/40", text: "text-secondary", dot: "bg-secondary" },
  ai_generated: { label: "AI-generated", color: "bg-primary/15 border-primary/40", text: "text-primary", dot: "bg-primary" },
};

export const AI_PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = (
  Object.keys(AI_PROVIDER_META) as AIProvider[]
).map((value) => ({ value, label: AI_PROVIDER_META[value].label }));

export const AI_ACCOUNT_STATUS_OPTIONS: { value: AIAccountStatus; label: string }[] = (
  Object.keys(AI_ACCOUNT_STATUS_META) as AIAccountStatus[]
).map((value) => ({ value, label: AI_ACCOUNT_STATUS_META[value].label }));

export const CONVERSATION_STATUS_OPTIONS: { value: ConversationStatus; label: string }[] = (
  Object.keys(CONVERSATION_STATUS_META) as ConversationStatus[]
).map((value) => ({ value, label: CONVERSATION_STATUS_META[value].label }));

// Client-side-only "favorite"/"pinned" convention: the backend has no
// boolean column for either (see AI_HANDOFF.md Known Issues), so both
// PromptTemplate and KnowledgeArticle reuse the `category` text field
// with these reserved values, matching the routers' own
// FAVORITE_CATEGORY/PINNED_CATEGORY constants exactly.
export const FAVORITE_CATEGORY = "favorite";
export const PINNED_CATEGORY = "pinned";

// Client-side "default AI account" preference (localStorage). The
// backend has no `is_default` column (see AI_HANDOFF.md Known Issues:
// "no natural single-column home... recommend a client-side preference
// rather than guessing at a schema change"), so this is intentionally
// NOT synced to the database -- it's a per-device UI convenience only.
const DEFAULT_ACCOUNT_KEY = "ai-workspace:default-account-id";

export function getDefaultAccountId(): string | null {
  try {
    return localStorage.getItem(DEFAULT_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function setDefaultAccountId(id: string | null): void {
  try {
    if (id) localStorage.setItem(DEFAULT_ACCOUNT_KEY, id);
    else localStorage.removeItem(DEFAULT_ACCOUNT_KEY);
  } catch {
    // localStorage unavailable (private browsing, etc) -- silently no-op,
    // this is a convenience preference only, never load-bearing.
  }
}

// Client-side "token refresh reminder" per AI account. `TokenTracker`
// has no `refresh_time`/`status`/`notify_*` columns (see
// token_trackers.py's module docstring and AI_HANDOFF.md Known
// Issues), so there is nothing to read a countdown from on the
// backend. This is a *local reminder the user sets themselves*
// ("my Claude usage resets at 9pm") -- not a value derived from any
// server-side rate-limit state, and it's never presented as one.
// Stored as a single map so it's one read/write instead of N.
const TOKEN_REMINDER_KEY = "ai-workspace:token-refresh-reminders";

type ReminderMap = Record<string, string>; // accountId -> ISO timestamp

function loadReminderMap(): ReminderMap {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_REMINDER_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveReminderMap(map: ReminderMap): void {
  try {
    localStorage.setItem(TOKEN_REMINDER_KEY, JSON.stringify(map));
  } catch {
    // Private browsing / storage disabled -- reminder just won't persist.
  }
}

export function getTokenRefreshReminder(accountId: string): string | null {
  return loadReminderMap()[accountId] ?? null;
}

export function getAllTokenRefreshReminders(): ReminderMap {
  return loadReminderMap();
}

export function setTokenRefreshReminder(accountId: string, isoTimestamp: string | null): void {
  const map = loadReminderMap();
  if (isoTimestamp) map[accountId] = isoTimestamp;
  else delete map[accountId];
  saveReminderMap(map);
}
