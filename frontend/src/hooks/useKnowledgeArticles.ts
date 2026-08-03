import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { KnowledgeArticleInput, KnowledgeSource } from "@/types";
import { useNotifications } from "@/context/NotificationContext";

export const KNOWLEDGE_ARTICLES_KEY = ["knowledge-articles"] as const;

export function useKnowledgeArticles(params?: {
  projectId?: string;
  category?: string;
  pinnedOnly?: boolean;
  favoritesOnly?: boolean;
  source?: KnowledgeSource;
  tag?: string;
  q?: string;
  sortBy?: "title" | "created_at" | "updated_at";
  sortDir?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: [...KNOWLEDGE_ARTICLES_KEY, params ?? {}],
    queryFn: () => api.getKnowledgeArticles(params),
    meta: { projectId: params?.projectId },
  });
}

export function useKnowledgeArticle(id: string | undefined) {
  return useQuery({
    queryKey: [...KNOWLEDGE_ARTICLES_KEY, id],
    queryFn: () => api.getKnowledgeArticle(id as string),
    enabled: !!id,
  });
}

export function useKnowledgeCategories() {
  return useQuery({
    queryKey: [...KNOWLEDGE_ARTICLES_KEY, "categories"],
    queryFn: api.getKnowledgeCategories,
  });
}

function useInvalidateKnowledgeArticles() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KNOWLEDGE_ARTICLES_KEY });
    qc.invalidateQueries({ queryKey: ["ai-workspace-summary"] });
  };
}

export function useCreateKnowledgeArticle() {
  const invalidate = useInvalidateKnowledgeArticles();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: KnowledgeArticleInput) => api.createKnowledgeArticle(payload),
    onSuccess: (article) => {
      invalidate();
      toast(`Added "${article.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't create article", "error"),
  });
}

export function useUpdateKnowledgeArticle() {
  const invalidate = useInvalidateKnowledgeArticles();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<KnowledgeArticleInput> & { clear_project?: boolean };
    }) => api.updateKnowledgeArticle(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update article", "error"),
  });
}

export function useDeleteKnowledgeArticle() {
  const invalidate = useInvalidateKnowledgeArticles();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteKnowledgeArticle(id),
    onSuccess: () => {
      invalidate();
      toast("Article deleted", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't delete article", "error"),
  });
}
