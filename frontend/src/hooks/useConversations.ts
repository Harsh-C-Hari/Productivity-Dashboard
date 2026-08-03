import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ConversationInput, ConversationStatus } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { AI_ACCOUNT_SUMMARIES_KEY } from "./useAIAccounts";

export const CONVERSATIONS_KEY = ["conversations"] as const;

export function useConversations(params?: {
  aiAccountId?: string;
  projectId?: string;
  status?: ConversationStatus;
  q?: string;
  sortBy?: "title" | "started_at" | "last_message_at" | "created_at" | "updated_at";
  sortDir?: "asc" | "desc";
  limit?: number;
}) {
  return useQuery({
    queryKey: [...CONVERSATIONS_KEY, params ?? {}],
    queryFn: () => api.getConversations(params),
    meta: { projectId: params?.projectId },
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: [...CONVERSATIONS_KEY, id],
    queryFn: () => api.getConversation(id as string),
    enabled: !!id,
  });
}

export function useConversationSummary(id: string | undefined) {
  return useQuery({
    queryKey: [...CONVERSATIONS_KEY, id, "summary"],
    queryFn: () => api.getConversationSummary(id as string),
    enabled: !!id,
  });
}

function useInvalidateConversations() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    qc.invalidateQueries({ queryKey: AI_ACCOUNT_SUMMARIES_KEY });
    qc.invalidateQueries({ queryKey: ["ai-workspace-summary"] });
  };
}

export function useCreateConversation() {
  const invalidate = useInvalidateConversations();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: ConversationInput) => api.createConversation(payload),
    onSuccess: (conversation) => {
      invalidate();
      toast(`Started "${conversation.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't start conversation", "error"),
  });
}

export function useUpdateConversation() {
  const invalidate = useInvalidateConversations();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<ConversationInput> & { clear_project?: boolean };
    }) => api.updateConversation(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update conversation", "error"),
  });
}

export function useDeleteConversation() {
  const invalidate = useInvalidateConversations();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: () => {
      invalidate();
      toast("Conversation deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete conversation", "error"),
  });
}
