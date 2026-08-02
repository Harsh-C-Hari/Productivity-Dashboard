import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Coins, MessageSquare, BookOpen, Library, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useAIWorkspaceSummary,
  useConversationsPerProject,
  useConversationsPerProvider,
  usePromptCategoryBreakdown,
  useZipUploadBreakdown,
  useKnowledgeArticleBreakdown,
  useProviderUsage,
  useConversationStatusBreakdown,
  useTokenLimitsReached,
} from "@/hooks/useAIAnalytics";
import { AI_PROVIDER_META, CONVERSATION_STATUS_META } from "@/lib/aiWorkspaceMeta";
import type { AIProvider, ConversationStatus } from "@/types";
import { formatDistanceToNow } from "date-fns";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-lg px-3 py-2 text-xs">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono font-medium" style={{ color: p.color }}>
          {p.value} {p.name}
        </p>
      ))}
    </div>
  );
}

function ChartCard({ title, icon: Icon, children, empty }: { title: string; icon: React.ElementType; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="px-5 pb-5">
        {empty ? <p className="text-sm text-muted-foreground text-center py-8">Not enough activity yet to chart.</p> : children}
      </div>
    </Card>
  );
}

function HorizontalBar({ data, colorFor, singleColor }: { data: { name: string; count: number; key: string }[]; colorFor?: (key: string) => string; singleColor?: string }) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: "#9A9A9F" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: "#C9C6C0" }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14} fill={singleColor ?? "#D9A75B"}>
            {colorFor && data.map((entry) => <Cell key={entry.key} fill={colorFor(entry.key)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const PROVIDER_COLORS: Record<string, string> = { claude: "#D9A75B", gpt: "#7FA872", gemini: "#8FA98C", other: "#9A9A9F" };
const STATUS_COLORS: Record<string, string> = { active: "#7FA872", completed: "#D9A75B", archived: "#9A9A9F" };

export function AIAnalyticsView() {
  const { data: summary, isLoading: summaryLoading } = useAIWorkspaceSummary();
  const { data: perProject } = useConversationsPerProject();
  const { data: perProvider } = useConversationsPerProvider();
  const { data: promptCategories } = usePromptCategoryBreakdown();
  const { data: zipBreakdown } = useZipUploadBreakdown();
  const { data: knowledgeBreakdown } = useKnowledgeArticleBreakdown();
  const { data: providerUsage } = useProviderUsage();
  const { data: statusBreakdown } = useConversationStatusBreakdown();
  const { data: tokenLimits } = useTokenLimitsReached();

  if (summaryLoading || !summary) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Crunching numbers…</div>;
  }

  const providerData = (perProvider ?? []).map((p) => ({
    name: AI_PROVIDER_META[(p.provider as AIProvider) ?? "other"]?.label ?? p.provider,
    count: p.conversation_count,
    key: p.provider,
  }));
  const projectData = (perProject ?? []).map((p) => ({ name: p.project_name, count: p.conversation_count, key: p.project_id }));
  const statusData = (statusBreakdown ?? []).map((s) => ({
    name: CONVERSATION_STATUS_META[(s.status as ConversationStatus) ?? "active"]?.label ?? s.status,
    count: s.count,
    key: s.status,
  }));
  const categoryData = (promptCategories ?? []).map((c) => ({ name: c.category, count: c.count, key: c.category }));
  const zipData = (zipBreakdown?.by_project ?? []).map((z) => ({ name: z.project_name, count: z.zip_count, key: z.project_id }));
  const knowledgeCategoryData = (knowledgeBreakdown?.by_category ?? []).map((k) => ({ name: k.category, count: k.count, key: k.category }));
  const usageData = (providerUsage ?? []).map((p) => ({ name: AI_PROVIDER_META[(p.provider as AIProvider) ?? "other"]?.label ?? p.provider, count: p.total_tokens, key: p.provider }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Analytics</h2>
        <p className="text-xs text-muted-foreground">How you're using AI across projects, providers, and time.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={MessageSquare} label="Conversations" value={String(summary.total_conversations)} color="text-primary" />
        <StatTile icon={Coins} label="Tokens used" value={summary.token_usage.total_tokens.toLocaleString()} color="text-urgency-low" />
        <StatTile icon={BookOpen} label="Prompts" value={String(summary.total_prompt_templates)} color="text-secondary" />
        <StatTile icon={Library} label="Knowledge articles" value={String(summary.total_knowledge_articles)} color="text-urgency-medium" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Conversations by provider" icon={MessageSquare} empty={!providerData.length}>
          <HorizontalBar data={providerData} colorFor={(k) => PROVIDER_COLORS[k] ?? "#9A9A9F"} />
        </ChartCard>
        <ChartCard title="Conversation status" icon={MessageSquare} empty={!statusData.length}>
          <HorizontalBar data={statusData} colorFor={(k) => STATUS_COLORS[k] ?? "#9A9A9F"} />
        </ChartCard>
        <ChartCard title="Conversations per project" icon={MessageSquare} empty={!projectData.length}>
          <HorizontalBar data={projectData} singleColor="#8FA98C" />
        </ChartCard>
        <ChartCard title="Provider token usage" icon={Coins} empty={!usageData.length}>
          <HorizontalBar data={usageData} colorFor={(k) => PROVIDER_COLORS[k] ?? "#9A9A9F"} />
        </ChartCard>
        <ChartCard title="Prompt categories" icon={BookOpen} empty={!categoryData.length}>
          <HorizontalBar data={categoryData} singleColor="#D9A75B" />
        </ChartCard>
        <ChartCard title="Zip uploads by project" icon={Library} empty={!zipData.length}>
          <HorizontalBar data={zipData} singleColor="#D9915A" />
        </ChartCard>
        <ChartCard title="Knowledge base by category" icon={Library} empty={!knowledgeCategoryData.length}>
          <HorizontalBar data={knowledgeCategoryData} singleColor="#7FA872" />
        </ChartCard>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-urgency-critical/10">
              <AlertTriangle className="h-4 w-4 text-urgency-critical" />
            </div>
            <CardTitle>Recent token limit events</CardTitle>
          </CardHeader>
          <div className="px-5 pb-5">
            {!tokenLimits?.events.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No limit events recorded — nice.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                {tokenLimits.events.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs rounded-lg border border-white/10 bg-base-900/40 px-3 py-2">
                    <span className="text-muted-foreground">{e.message}</span>
                    <span className="shrink-0 text-muted-foreground/70">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-base-900/40 p-3 flex flex-col gap-1">
      <Icon className={`h-4 w-4 ${color}`} />
      <p className="font-mono text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
