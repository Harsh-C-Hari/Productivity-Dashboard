import { useState } from "react";
import { Plus, X, ListTree } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTopics, useCreateTopic, useDeleteTopic } from "@/hooks/useSubjects";

export function TopicManager({ subjectId }: { subjectId: string }) {
  const { data: topics, isLoading } = useTopics(subjectId);
  const createTopic = useCreateTopic();
  const deleteTopic = useDeleteTopic();
  const [newTitle, setNewTitle] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createTopic.mutate(
      { subject_id: subjectId, title: newTitle.trim(), order_index: topics?.length ?? 0 },
      { onSuccess: () => setNewTitle("") }
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
          <ListTree className="h-4 w-4 text-secondary" />
        </div>
        <CardTitle>Topics & Modules</CardTitle>
      </CardHeader>
      <div className="px-5 pb-5 flex flex-col gap-3">
        {isLoading && <div className="h-8 animate-pulse bg-white/[0.02] rounded-lg" />}

        {!isLoading && (topics ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            No topics yet. Break this subject into modules to organize assignments and notes.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {(topics ?? []).map((topic) => (
            <span
              key={topic.id}
              className="group flex items-center gap-1.5 rounded-full border border-white/10 bg-base-900/40 pl-3 pr-1.5 py-1 text-xs"
            >
              {topic.title}
              <button
                onClick={() => deleteTopic.mutate(topic.id)}
                className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-urgency-critical transition-opacity"
                aria-label={`Remove topic ${topic.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a topic, e.g. Dynamic Programming"
            className="flex-1"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!newTitle.trim() || createTopic.isPending}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
