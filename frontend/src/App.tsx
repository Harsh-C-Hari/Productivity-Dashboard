import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { NotificationProvider } from "@/context/NotificationContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute, RedirectIfAuthenticated } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";

// Route-level code-splitting: each page is its own chunk, loaded on
// first navigation instead of all being bundled into the single large
// startup chunk `vite build` used to warn about (see CHANGELOG.md).
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const Timetable = lazy(() => import("@/pages/Timetable"));
const StudyHub = lazy(() => import("@/pages/StudyHub"));
const SubjectDetail = lazy(() => import("@/pages/SubjectDetail"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const AIWorkspace = lazy(() => import("@/pages/AIWorkspace"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));
const VerifyEmail = lazy(() => import("@/pages/auth/VerifyEmail"));
const InvitationLanding = lazy(() => import("@/pages/InvitationLanding"));

function RouteFallback() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading page…</span>
      <div className="glass-card h-24 animate-pulse bg-white/[0.02]" />
      <div className="glass-card h-96 animate-pulse bg-white/[0.02]" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <TooltipProvider delayDuration={200}>
            <BrowserRouter>
              <Routes>
                {/* Public Identity routes -- no AppLayout chrome (sidebar/topbar), no auth required. */}
                <Route
                  path="login"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <RedirectIfAuthenticated>
                        <Login />
                      </RedirectIfAuthenticated>
                    </Suspense>
                  }
                />
                <Route
                  path="register"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <RedirectIfAuthenticated>
                        <Register />
                      </RedirectIfAuthenticated>
                    </Suspense>
                  }
                />
                <Route
                  path="forgot-password"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <RedirectIfAuthenticated>
                        <ForgotPassword />
                      </RedirectIfAuthenticated>
                    </Suspense>
                  }
                />
                <Route
                  path="reset-password"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <ResetPassword />
                    </Suspense>
                  }
                />
                {/* Not RedirectIfAuthenticated-gated -- verify-email must work for
                    both signed-in visitors (status/resend) and the token-confirm
                    link, which can be opened whether or not the tab is signed in. */}
                <Route
                  path="verify-email"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <VerifyEmail />
                    </Suspense>
                  }
                />

                {/* Public invitation landing page -- reached via a copied invite
                    link or a Notification's action_url. Works whether or not the
                    visitor is signed in (see pages/InvitationLanding.tsx), so it's
                    outside both ProtectedRoute and RedirectIfAuthenticated. */}
                <Route
                  path="invite/:token"
                  element={
                    <Suspense fallback={<RouteFallback />}>
                      <InvitationLanding />
                    </Suspense>
                  }
                />

                {/* Protected app shell -- everything below requires a session. */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route
                    index
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <Dashboard />
                      </Suspense>
                    }
                  />
                  <Route
                    path="tasks"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <Tasks />
                      </Suspense>
                    }
                  />
                  <Route
                    path="timetable"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <Timetable />
                      </Suspense>
                    }
                  />
                  <Route
                    path="study-hub"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <StudyHub />
                      </Suspense>
                    }
                  />
                  <Route
                    path="study-hub/:subjectId"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <SubjectDetail />
                      </Suspense>
                    }
                  />
                  <Route
                    path="projects"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <Projects />
                      </Suspense>
                    }
                  />
                  <Route
                    path="projects/:projectId"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <ProjectDetail />
                      </Suspense>
                    }
                  />
                  <Route
                    path="ai-workspace/*"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <AIWorkspace />
                      </Suspense>
                    }
                  />
                  <Route
                    path="notifications"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <Notifications />
                      </Suspense>
                    }
                  />
                  <Route
                    path="profile"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <Profile />
                      </Suspense>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <Suspense fallback={<RouteFallback />}>
                        <Settings />
                      </Suspense>
                    }
                  />
                </Route>
              </Routes>
            </BrowserRouter>
            </TooltipProvider>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
