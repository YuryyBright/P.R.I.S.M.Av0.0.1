// Public API of the jobs feature. Import from "@/features/jobs" only.
// Deliberately NOT exported: endpoints/RTK hooks, components, hooks, lib.
export { jobsRoutes } from "./routes";
export { JOBS_ROUTES, JOB_PERMISSIONS } from "./constants/jobs.constants";
export type {
  Job,
  JobListItem,
  JobStatus,
  JobType,
  StageName,
} from "./types/job.types";

// Header bell integration
export { useJobNotifications } from "./hooks/useJobNotifications";
export type { BellTone } from "./hooks/useJobNotifications";
export { JobNotificationBody } from "./components/JobNotificationItem";
