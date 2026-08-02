import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  BookOpen,
  Archive,
  ClipboardList,
  Library,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";
import { AIWorkspaceDashboardView } from "@/components/ai-workspace/AIWorkspaceDashboardView";
import { AIAccountsView } from "@/components/ai-workspace/AIAccountsView";
import { ConversationsView } from "@/components/ai-workspace/ConversationsView";
import { PromptLibraryView } from "@/components/ai-workspace/PromptLibraryView";
import { ZipManagerView } from "@/components/ai-workspace/ZipManagerView";
import { AIHandoffsView } from "@/components/ai-workspace/AIHandoffsView";
import { KnowledgeBaseView } from "@/components/ai-workspace/KnowledgeBaseView";
import { AIAnalyticsView } from "@/components/ai-workspace/AIAnalyticsView";
import { AIWorkspaceSettingsView } from "@/components/ai-workspace/AIWorkspaceSettingsView";
import { useHorizontalWheelScroll } from "@/hooks/useHorizontalWheelScroll";

const TABS = [
  { to: "/ai-workspace", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/ai-workspace/accounts", label: "AI Accounts", icon: Bot },
  { to: "/ai-workspace/conversations", label: "Conversations", icon: MessageSquare },
  { to: "/ai-workspace/prompts", label: "Prompt Library", icon: BookOpen },
  { to: "/ai-workspace/zips", label: "ZIP Manager", icon: Archive },
  { to: "/ai-workspace/handoffs", label: "AI Handoffs", icon: ClipboardList },
  { to: "/ai-workspace/knowledge", label: "Knowledge Base", icon: Library },
  { to: "/ai-workspace/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/ai-workspace/settings", label: "Settings", icon: SettingsIcon },
];

export default function AIWorkspace() {
  const location = useLocation();
  const tabScrollRef = useHorizontalWheelScroll<HTMLDivElement>();

  return (
    <div className="flex flex-col gap-5">
      <div ref={tabScrollRef} className="glass-panel flex gap-1 overflow-x-auto rounded-xl p-1.5 scrollbar-thin::-webkit-scrollbar-thumb">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="ai-workspace-tab-highlight"
                    className="absolute inset-0 rounded-lg bg-primary/15 border border-primary/30"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <tab.icon className="h-3.5 w-3.5 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
        <Routes>
          <Route index element={<AIWorkspaceDashboardView />} />
          <Route path="accounts" element={<AIAccountsView />} />
          <Route path="conversations" element={<ConversationsView />} />
          <Route path="conversations/:conversationId" element={<ConversationsView />} />
          <Route path="prompts" element={<PromptLibraryView />} />
          <Route path="zips" element={<ZipManagerView />} />
          <Route path="handoffs" element={<AIHandoffsView />} />
          <Route path="knowledge" element={<KnowledgeBaseView />} />
          <Route path="analytics" element={<AIAnalyticsView />} />
          <Route path="settings" element={<AIWorkspaceSettingsView />} />
        </Routes>
      </motion.div>
    </div>
  );
}