import { motion } from "framer-motion";
import { TaskList } from "@/components/tasks/TaskList";

export default function Tasks() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <TaskList />
    </motion.div>
  );
}
