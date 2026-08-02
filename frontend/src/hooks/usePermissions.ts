import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const PERMISSIONS_KEY = ["permissions"] as const;

export function usePermissions(params?: { category?: string; q?: string }) {
  return useQuery({
    queryKey: [...PERMISSIONS_KEY, params ?? {}],
    queryFn: () => api.getPermissions(params),
    staleTime: 60_000,
  });
}
