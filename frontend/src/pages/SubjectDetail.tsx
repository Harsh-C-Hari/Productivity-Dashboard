import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProgressRing } from "@/components/ui/progress-ring";
import { TopicManager } from "@/components/study-hub/TopicManager";
import { AssignmentList } from "@/components/study-hub/AssignmentList";
import { NoteList } from "@/components/study-hub/NoteList";
import { ResourceList } from "@/components/study-hub/ResourceList";
import { StudyTimer } from "@/components/study-hub/StudyTimer";
import { StudySessionList } from "@/components/study-hub/StudySessionList";
import { useSubject } from "@/hooks/useSubjects";
import { useStudyHubSummary } from "@/hooks/useStudyHub";
import { subjectColorHex, SUBJECT_COLOR_CLASSES } from "@/lib/subjectColors";

export default function SubjectDetail() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { data: subject, isLoading, isError } = useSubject(subjectId);
  const { data: summary } = useStudyHubSummary();

  if (isError) return <Navigate to="/study-hub" replace />;

  if (isLoading || !subject) {
    return (
      <div className="flex flex-col gap-4">
        <div className="glass-card h-24 animate-pulse bg-white/[0.02]" />
        <div className="glass-card h-96 animate-pulse bg-white/[0.02]" />
      </div>
    );
  }

  const progress = summary?.subjects_progress.find((sp) => sp.subject.id === subject.id);
  const colorClasses = SUBJECT_COLOR_CLASSES[subject.color] ?? SUBJECT_COLOR_CLASSES.purple;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex flex-col gap-5">
      <div>
        <Link
          to="/study-hub"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Study Hub
        </Link>

        <div className="glass-card p-5 flex items-center gap-4">
          <ProgressRing progress={progress?.completion_rate ?? 0} size={64} strokeWidth={5} color={subjectColorHex(subject.color)}>
            <span className="font-mono text-xs font-semibold">{progress?.completion_rate ?? 0}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BookOpen className={`h-4 w-4 shrink-0 ${colorClasses.text}`} />
              <h2 className="font-display text-lg font-semibold truncate">{subject.name}</h2>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {[subject.code, subject.instructor].filter(Boolean).join(" · ") || "No details yet"}
            </p>
          </div>
          <div className="hidden sm:flex gap-4 text-center shrink-0">
            <div>
              <p className="font-mono text-lg font-semibold leading-none">{progress?.total_assignments ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-1">assignments</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold leading-none">{progress?.hours_studied_this_week ?? 0}h</p>
              <p className="text-[10px] text-muted-foreground mt-1">this week</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold leading-none">{progress?.resource_count ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-1">resources</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <TopicManager subjectId={subject.id} />
              <AssignmentList subjectId={subject.id} />
            </div>
            <StudyTimer defaultSubjectId={subject.id} />
          </div>
        </TabsContent>

        <TabsContent value="assignments">
          <AssignmentList subjectId={subject.id} />
        </TabsContent>

        <TabsContent value="notes">
          <NoteList subjectId={subject.id} />
        </TabsContent>

        <TabsContent value="resources">
          <ResourceList subjectId={subject.id} />
        </TabsContent>

        <TabsContent value="sessions">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <StudyTimer defaultSubjectId={subject.id} />
            <div className="lg:col-span-2">
              <StudySessionList subjectId={subject.id} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
