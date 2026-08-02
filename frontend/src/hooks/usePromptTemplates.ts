import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PromptTemplateInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";

export const PROMPT_TEMPLATES_KEY = ["prompt-templates"] as const;

export function usePromptTemplates(params?: {
  category?: string;
  favoritesOnly?: boolean;
  q?: string;
  sortBy?: "title" | "usage_count" | "created_at" | "updated_at";
  sortDir?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: [...PROMPT_TEMPLATES_KEY, params ?? {}],
    queryFn: () => api.getPromptTemplates(params),
  });
}

export function useRecentPromptTemplates(limit?: number) {
  return useQuery({
    queryKey: [...PROMPT_TEMPLATES_KEY, "recent", limit],
    queryFn: () => api.getRecentPromptTemplates(limit),
  });
}

export function usePromptTemplateCategories() {
  return useQuery({
    queryKey: [...PROMPT_TEMPLATES_KEY, "categories"],
    queryFn: api.getPromptTemplateCategories,
  });
}

function useInvalidatePromptTemplates() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: PROMPT_TEMPLATES_KEY });
    qc.invalidateQueries({ queryKey: ["ai-workspace-summary"] });
  };
}

export function useCreatePromptTemplate() {
  const invalidate = useInvalidatePromptTemplates();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: PromptTemplateInput) => api.createPromptTemplate(payload),
    onSuccess: (prompt) => {
      invalidate();
      toast(`Added prompt "${prompt.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create prompt", "error"),
  });
}

export function useUpdatePromptTemplate() {
  const invalidate = useInvalidatePromptTemplates();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PromptTemplateInput> }) =>
      api.updatePromptTemplate(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update prompt", "error"),
  });
}

export function useDuplicatePromptTemplate() {
  const invalidate = useInvalidatePromptTemplates();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.duplicatePromptTemplate(id),
    onSuccess: (prompt) => {
      invalidate();
      toast(`Duplicated as "${prompt.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't duplicate prompt", "error"),
  });
}

export function useUsePromptTemplate() {
  const invalidate = useInvalidatePromptTemplates();
  return useMutation({
    mutationFn: (id: string) => api.usePromptTemplate(id),
    onSuccess: () => invalidate(),
  });
}

export function useDeletePromptTemplate() {
  const invalidate = useInvalidatePromptTemplates();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deletePromptTemplate(id),
    onSuccess: () => {
      invalidate();
      toast("Prompt deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete prompt", "error"),
  });
}
