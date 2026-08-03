import { QueryClient } from "@tanstack/react-query";

// Pulled out of App.tsx into its own module (rather than defined inline
// in the component) so `AuthContext.tsx` can import it too, without a
// circular dependency (App.tsx renders AuthProvider, so AuthProvider
// can't import the client back out of App.tsx). AuthContext calls
// `queryClient.clear()` on logout -- see its `clearSession` -- so no
// other user's cached data (dashboard widgets, project data, Study Hub,
// AI Workspace, notifications, everything React Query has cached)
// survives into the next login on a shared device.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
