import { useState } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TaskForm } from "@/components/tasks/TaskForm";
import { useCreateTask } from "@/hooks/useTasks";
import type { TaskInput } from "@/types";

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const createTask = useCreateTask();

  function handleSubmit(payload: TaskInput) {
    createTask.mutate(payload, { onSuccess: () => setOpen(false) });
  }

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glass
          bottom-20 right-4 md:bottom-8 md:right-8"
        aria-label="Quick capture a new task"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Capture</DialogTitle>
            <DialogDescription>Get it out of your head and onto the list.</DialogDescription>
          </DialogHeader>
          <TaskForm
            mode="create"
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
            submitting={createTask.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
