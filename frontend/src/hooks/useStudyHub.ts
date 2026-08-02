import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const STUDY_HUB_SUMMARY_KEY = ["study-hub", "summary"] as const;

export function useStudyHubSummary() {
  return useQuery({
    queryKey: STUDY_HUB_SUMMARY_KEY,
    queryFn: api.getStudyHubSummary,
    refetchInterval: 60_000,
  });
}

export function useStudyHubSearch(query: string) {
  return useQuery({
    queryKey: ["study-hub", "search", query],
    queryFn: () => api.searchStudyHub(query),
    enabled: query.trim().length > 1,
  });
}
