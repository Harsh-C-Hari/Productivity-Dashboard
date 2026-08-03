import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AIHandoffInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";

export const AI_HANDOFFS_KEY = ["ai-handoffs"] as const;

export function useAIHandoffs(params?: {
  projectId?: string;
  aiAccountId?: string;
  conversationId?: string;
  q?: string;
}) {
  return useQuery({
    queryKey: [...AI_HANDOFFS_KEY, params ?? {}],
    queryFn: () => api.getAIHandoffs(params),
    meta: { projectId: params?.projectId },
  });
}

export function useAIHandoff(id: string | undefined) {
  return useQuery({
    queryKey: [...AI_HANDOFFS_KEY, id],
    queryFn: () => api.getAIHandoff(id as string),
    enabled: !!id,
  });
}

export function useLatestAIHandoff(params?: { projectId?: string; aiAccountId?: string; conversationId?: string }) {
  const enabled = !!(params?.projectId || params?.aiAccountId || params?.conversationId);
  return useQuery({
    queryKey: [...AI_HANDOFFS_KEY, "latest", params ?? {}],
    queryFn: () => api.getLatestAIHandoff(params),
    enabled,
    retry: false,
    meta: { projectId: params?.projectId },
  });
}

function useInvalidateAIHandoffs() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: AI_HANDOFFS_KEY });
    qc.invalidateQueries({ queryKey: ["ai-workspace-summary"] });
  };
}

export function useCreateAIHandoff() {
  const invalidate = useInvalidateAIHandoffs();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: AIHandoffInput) => api.createAIHandoff(payload),
    onSuccess: () => {
      invalidate();
      toast("Handoff notes saved", "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't save handoff", "error"),
  });
}

export function useUpdateAIHandoff() {
  const invalidate = useInvalidateAIHandoffs();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AIHandoffInput> }) =>
      api.updateAIHandoff(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update handoff", "error"),
  });
}

export function useDeleteAIHandoff() {
  const invalidate = useInvalidateAIHandoffs();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteAIHandoff(id),
    onSuccess: () => {
      invalidate();
      toast("Handoff deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete handoff", "error"),
  });
}
