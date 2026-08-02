import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const GLOBAL_SEARCH_KEY = ["global-search"] as const;

/** Spans Tasks, Study Hub, and Project Workspace via `/api/search`.
 * Only enabled once the query is non-trivial, and results are cached
 * per-query for the session so re-opening the palette with the same
 * text doesn't refire the request. */
export function useGlobalSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...GLOBAL_SEARCH_KEY, trimmed],
    queryFn: () => api.globalSearch(trimmed),
    enabled: trimmed.length > 1,
    staleTime: 30_000,
  });
}
