import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const AI_WORKSPACE_SUMMARY_KEY = ["ai-workspace-summary"] as const;

/** Top-level AI Workspace rollup -- powers both the AI Workspace
 * Dashboard tab and the standalone main-Dashboard widget. Deliberately
 * NOT wired through `/api/dashboard`/`DashboardOut` (see AI_HANDOFF.md
 * "Next Task" #3 -- dashboard integration was explicitly left for a
 * future backend session), so this queries `/api/ai-analytics/summary`
 * directly instead of waiting on a backend schema change. */
export function useAIWorkspaceSummary() {
  return useQuery({
    queryKey: AI_WORKSPACE_SUMMARY_KEY,
    queryFn: api.getAIWorkspaceSummary,
  });
}

export function useConversationsPerProject() {
  return useQuery({
    queryKey: ["ai-analytics", "conversations-per-project"],
    queryFn: api.getConversationsPerProject,
  });
}

export function useConversationsPerProvider() {
  return useQuery({
    queryKey: ["ai-analytics", "conversations-per-provider"],
    queryFn: api.getConversationsPerProvider,
  });
}

export function usePromptCategoryBreakdown() {
  return useQuery({
    queryKey: ["ai-analytics", "prompt-categories"],
    queryFn: api.getPromptCategoryBreakdown,
  });
}

export function useZipUploadBreakdown() {
  return useQuery({
    queryKey: ["ai-analytics", "zip-upload-count"],
    queryFn: api.getZipUploadBreakdown,
  });
}

export function useKnowledgeArticleBreakdown() {
  return useQuery({
    queryKey: ["ai-analytics", "knowledge-articles"],
    queryFn: api.getKnowledgeArticleBreakdown,
  });
}

export function useProviderUsage() {
  return useQuery({
    queryKey: ["ai-analytics", "provider-usage"],
    queryFn: api.getProviderUsage,
  });
}

export function useConversationStatusBreakdown() {
  return useQuery({
    queryKey: ["ai-analytics", "conversation-status"],
    queryFn: api.getConversationStatusBreakdown,
  });
}

export function useTokenLimitsReached() {
  return useQuery({
    queryKey: ["ai-analytics", "token-limits-reached"],
    queryFn: api.getTokenLimitsReached,
  });
}
