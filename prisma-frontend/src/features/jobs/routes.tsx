import type { RouteObject } from "react-router";
import { JOBS_ROUTES } from "./constants/jobs.constants";

/**
 * Jobs are guarded by the documents permissions (see JOB_PERMISSIONS).
 * The page itself renders a "no permission" alert via <Can>; the backend enforces
 * access per job (own jobs / collection role / superuser).
 */
export const jobsRoutes: RouteObject[] = [
  {
    path: JOBS_ROUTES.list,
    lazy: async () => ({
      Component: (await import("./pages/JobsPage")).default,
    }),
  },
];
