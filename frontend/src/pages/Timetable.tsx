import { motion } from "framer-motion";
import { WeeklyTimetable } from "@/components/timetable/WeeklyTimetable";

export default function Timetable() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <WeeklyTimetable />
    </motion.div>
  );
}
