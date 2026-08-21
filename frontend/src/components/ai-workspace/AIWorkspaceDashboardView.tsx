import { Link } from "react-router-dom";
import {
  Bot,
  MessageSquare,
  BookOpen,
  Archive,
  ClipboardList,
  Library,
  Coins,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAIWorkspaceSummary, useTokenLimitsReached } from "@/hooks/useAIAnalytics";
import { useAIAccounts } from "@/hooks/useAIAccounts";
import { CONVERSATION_STATUS_META } from "@/lib/aiWorkspaceMeta";
import { formatDistanceToNow } from "date-fns";

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  to,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  to: string;
  accent?: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors h-full">
        <div className="flex items-center justify-between">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent ?? "bg-primary/10"}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
        <div>
          <p className="font-display text-2xl font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
      </Card>
    </Link>
  );
}

export function AIWorkspaceDashboardView() {
  const { data: summary, isLoading } = useAIWorkspaceSummary();
  const { data: accounts } = useAIAccounts();
  const { data: tokenLimits } = useTokenLimitsReached();

  if (isLoading || !summary) {
    return (
      <div className="flex flex-col gap-6" role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading AI workspace…</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="glass-card h-28 animate-pulse bg-white/[0.02]" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="glass-card h-56 animate-pulse bg-white/[0.02]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-semibold">AI Workspace</h2>
        <p className="text-xs text-muted-foreground">Everything about how you work with AI assistants, in one place.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={Bot} label="AI accounts" value={summary.total_accounts} sub={`${summary.active_accounts} active`} to="/ai-workspace/accounts" accent="bg-primary/10 text-primary" />
        <SummaryCard icon={MessageSquare} label="Conversations" value={summary.total_conversations} sub={`${summary.active_conversations} active`} to="/ai-workspace/conversations" accent="bg-secondary/10 text-secondary" />
        <SummaryCard icon={BookOpen} label="Prompt templates" value={summary.total_prompt_templates} to="/ai-workspace/prompts" accent="bg-urgency-low/10 text-urgency-low" />
        <SummaryCard icon={Archive} label="Zip snapshots" value={summary.total_zips} to="/ai-workspace/zips" accent="bg-urgency-medium/10 text-urgency-medium" />
        <SummaryCard icon={ClipboardList} label="Handoffs" value={summary.total_handoffs} to="/ai-workspace/handoffs" accent="bg-primary/10 text-primary" />
        <SummaryCard icon={Library} label="Knowledge articles" value={summary.total_knowledge_articles} to="/ai-workspace/knowledge" accent="bg-secondary/10 text-secondary" />
        <SummaryCard
          icon={Coins}
          label="Tokens used"
          value={summary.token_usage.total_tokens.toLocaleString()}
          sub={`$${summary.token_usage.total_estimated_cost_usd.toFixed(2)} est.`}
          to="/ai-workspace/analytics"
          accent="bg-urgency-low/10 text-urgency-low"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Recent limit events"
          value={tokenLimits?.count ?? 0}
          sub="last 30 days"
          to="/ai-workspace/analytics"
          accent="bg-urgency-critical/10 text-urgency-critical"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold">Recent conversations</h3>
            <Link to="/ai-workspace/conversations" className="text-xs text-primary flex items-center gap-1 hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {summary.recent_conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {summary.recent_conversations.map((c) => {
                const statusMeta = CONVERSATION_STATUS_META[c.status];
                const account = (accounts ?? []).find((a) => a.id === c.ai_account_id);
                return (
                  <Link key={c.id} to={`/ai-workspace/conversations/${c.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-base-900/40 px-3 py-2 hover:border-primary/30 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{account?.name ?? "Unknown account"}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] rounded-full px-2 py-0.5 border ${statusMeta.color} ${statusMeta.text}`}>{statusMeta.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-semibold">Recent handoffs</h3>
            <Link to="/ai-workspace/handoffs" className="text-xs text-primary flex items-center gap-1 hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {summary.recent_handoffs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No handoffs recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {summary.recent_handoffs.map((h) => (
                <div key={h.id} className="rounded-lg border border-white/10 bg-base-900/40 px-3 py-2">
                  <p className="text-sm line-clamp-1">{h.completed_work || "Handoff notes"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
