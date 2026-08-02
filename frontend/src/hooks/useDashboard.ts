import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DASHBOARD_KEY } from "./useTasks";

export function useDashboard() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: api.getDashboard,
    // Deadlines are time-relative, so keep this reasonably fresh even
    // if the user leaves the tab open for a while.
    refetchInterval: 60_000,
  });
}
