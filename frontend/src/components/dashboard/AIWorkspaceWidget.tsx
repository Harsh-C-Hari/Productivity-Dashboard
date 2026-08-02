import { Link } from "react-router-dom";
import { Bot, MessageSquare, Archive, BookOpen, Library } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useAIWorkspaceSummary } from "@/hooks/useAIAnalytics";
import { CONVERSATION_STATUS_META } from "@/lib/aiWorkspaceMeta";

/** Self-contained like OpenBugsWidget -- queries `/api/ai-analytics/summary`
 * directly rather than through `/api/dashboard`, since wiring AI Workspace
 * into `DashboardOut` was explicitly deferred to a future backend session
 * (see AI_HANDOFF.md "Next Task" #3). Dashboard.tsx only mounts this when
 * there's actually AI Workspace data to show. */
export function AIWorkspaceWidget() {
  const { data: summary, isLoading } = useAIWorkspaceSummary();

  if (isLoading) return <div className="glass-card h-56 animate-pulse bg-white/[0.02]" />;
  if (!summary) return null;

  const hasData =
    summary.total_accounts > 0 ||
    summary.total_conversations > 0 ||
    summary.total_prompt_templates > 0 ||
    summary.total_zips > 0 ||
    summary.total_handoffs > 0 ||
    summary.total_knowledge_articles > 0;
  if (!hasData) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <CardTitle>AI Workspace</CardTitle>
        </div>
        <Link to="/ai-workspace" className="text-xs text-primary hover:underline">Open</Link>
      </CardHeader>

      <div className="px-5 pb-5 flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <MiniStat icon={Bot} value={summary.total_accounts} label="accounts" />
          <MiniStat icon={MessageSquare} value={summary.total_conversations} label="convos" />
          <MiniStat icon={BookOpen} value={summary.total_prompt_templates} label="prompts" />
          <MiniStat icon={Library} value={summary.total_knowledge_articles} label="articles" />
        </div>

        {summary.recent_conversations.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {summary.recent_conversations.slice(0, 3).map((c) => {
              const meta = CONVERSATION_STATUS_META[c.status];
              return (
                <Link key={c.id} to={`/ai-workspace/conversations/${c.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-white/5 transition-colors">
                  <span className="text-sm truncate">{c.title}</span>
                  <span className={`shrink-0 text-[10px] rounded-full px-2 py-0.5 border ${meta.color} ${meta.text}`}>{meta.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        {summary.total_zips > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Archive className="h-3.5 w-3.5" /> {summary.total_zips} zip snapshot{summary.total_zips === 1 ? "" : "s"} saved
          </p>
        )}
      </div>
    </Card>
  );
}

function MiniStat({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-base-900/40 py-2">
      <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
      <p className="font-mono text-sm font-semibold mt-1">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
