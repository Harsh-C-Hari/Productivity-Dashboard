import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TokenTrackerInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { AI_ACCOUNT_SUMMARIES_KEY } from "./useAIAccounts";

export const TOKEN_TRACKERS_KEY = ["token-trackers"] as const;

export function useTokenTrackers(params?: { aiAccountId?: string; conversationId?: string; limit?: number }) {
  return useQuery({
    queryKey: [...TOKEN_TRACKERS_KEY, params ?? {}],
    queryFn: () => api.getTokenTrackers(params),
  });
}

export function useTokenUsageSummary() {
  return useQuery({
    queryKey: [...TOKEN_TRACKERS_KEY, "summary"],
    queryFn: api.getTokenUsageSummary,
  });
}

export function useAccountTokenTotal(accountId: string | undefined) {
  return useQuery({
    queryKey: [...TOKEN_TRACKERS_KEY, "account-total", accountId],
    queryFn: () => api.getAccountTokenTotal(accountId as string),
    enabled: !!accountId,
  });
}

function useInvalidateTokenTrackers() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: TOKEN_TRACKERS_KEY });
    qc.invalidateQueries({ queryKey: AI_ACCOUNT_SUMMARIES_KEY });
    qc.invalidateQueries({ queryKey: ["ai-workspace-summary"] });
  };
}

export function useRecordTokenUsage() {
  const invalidate = useInvalidateTokenTrackers();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: TokenTrackerInput) => api.recordTokenUsage(payload),
    onSuccess: () => {
      invalidate();
      toast("Token usage recorded", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't record usage", "error"),
  });
}

export function useDeleteTokenTracker() {
  const invalidate = useInvalidateTokenTrackers();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteTokenTracker(id),
    onSuccess: () => {
      invalidate();
      toast("Usage entry deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete entry", "error"),
  });
}

export function useMarkAccountTokenLimited() {
  const invalidate = useInvalidateTokenTrackers();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (accountId: string) => api.markAccountTokenLimited(accountId),
    onSuccess: () => {
      invalidate();
      toast("Marked as limited", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't update account", "error"),
  });
}

export function useMarkAccountTokenRefreshed() {
  const invalidate = useInvalidateTokenTrackers();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (accountId: string) => api.markAccountTokenRefreshed(accountId),
    onSuccess: () => {
      invalidate();
      toast("Marked as refreshed", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't update account", "error"),
  });
}
