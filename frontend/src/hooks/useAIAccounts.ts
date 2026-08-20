import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AIAccount, AIAccountInput, AIAccountSummary, AIProvider, AIAccountStatus } from "@/types";
import { useNotifications } from "@/context/NotificationContext";

export const AI_ACCOUNTS_KEY = ["ai-accounts"] as const;
export const AI_ACCOUNT_SUMMARIES_KEY = ["ai-account-summaries"] as const;

export function useAIAccounts(params?: {
  provider?: AIProvider;
  status?: AIAccountStatus;
  q?: string;
  sortBy?: "name" | "created_at" | "updated_at";
  sortDir?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: [...AI_ACCOUNTS_KEY, params ?? {}],
    queryFn: () => api.getAIAccounts(params),
  });
}

export function useAIAccount(id: string | undefined) {
  return useQuery({
    queryKey: [...AI_ACCOUNTS_KEY, id],
    queryFn: () => api.getAIAccount(id as string),
    enabled: !!id,
  });
}

export function useAIAccountSummaries() {
  return useQuery({
    queryKey: AI_ACCOUNT_SUMMARIES_KEY,
    queryFn: api.getAIAccountSummaries,
  });
}

export function useAIAccountSummary(id: string | undefined) {
  return useQuery({
    queryKey: [...AI_ACCOUNT_SUMMARIES_KEY, id],
    queryFn: () => api.getAIAccountSummary(id as string),
    enabled: !!id,
  });
}

function useInvalidateAIAccounts() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: AI_ACCOUNTS_KEY });
    qc.invalidateQueries({ queryKey: AI_ACCOUNT_SUMMARIES_KEY });
    qc.invalidateQueries({ queryKey: ["ai-workspace-summary"] });
  };
}

export function useCreateAIAccount() {
  const invalidate = useInvalidateAIAccounts();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: AIAccountInput) => api.createAIAccount(payload),
    onSuccess: (account) => {
      invalidate();
      toast(`Added "${account.name}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create AI account", "error"),
  });
}

export function useUpdateAIAccount() {
  const invalidate = useInvalidateAIAccounts();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AIAccountInput> }) =>
      api.updateAIAccount(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update AI account", "error"),
  });
}

export function useTouchAIAccount() {
  const invalidate = useInvalidateAIAccounts();
  return useMutation({
    mutationFn: (id: string) => api.touchAIAccount(id),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteAIAccount() {
  const invalidate = useInvalidateAIAccounts();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteAIAccount(id),
    onSuccess: () => {
      invalidate();
      toast("AI account deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete AI account", "error"),
  });
}
