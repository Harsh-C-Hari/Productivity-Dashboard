import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { TopBar } from "./TopBar";
import { Toaster } from "@/components/ui/toaster";
import { QuickCapture } from "@/components/tasks/QuickCapture";
import { useNotificationScheduler } from "@/hooks/useNotificationScheduler";
import { useTokenRefreshScheduler } from "@/hooks/useTokenRefreshScheduler";

export function AppLayout() {
  useNotificationScheduler();
  useTokenRefreshScheduler();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-5 pb-28 md:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileNav />
      <QuickCapture />
      <Toaster />
    </div>
  );
}
