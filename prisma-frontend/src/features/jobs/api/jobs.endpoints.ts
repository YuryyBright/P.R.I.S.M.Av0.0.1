import { baseApi } from "@/shared/api/baseApi";
import { DEFAULT_PAGE_SIZE, type UUID } from "@/shared/types/api";
import { JOBS_PATHS } from "../constants/jobs.constants";
import type {
  Job,
  JobListItem,
  JobRetryResponse,
  JobsPageArgs,
  LimitOffsetPage,
} from "../types/job.types";

const LIST = "LIST" as const;

/**
 * NOTE: add "Job" to `tagTypes` in baseApi.
 * Cancel / retry also change the document status, so they invalidate every
 * "Document" tag (the documents feature needs no knowledge of jobs for that).
 * The reverse (upload / reindex / delete create or cancel jobs) is wired by adding
 * `{ type: "Job", id: "LIST" }` to those documents mutations — see INTEGRATION.md.
 */
export const jobsApi = baseApi.injectEndpoints({
  overrideExisting: false,
  endpoints: (build) => ({
    /** GET /jobs?limit&offset&status&document_id -> Page<JobListItem> */
    getJobsPage: build.query<
      LimitOffsetPage<JobListItem>,
      JobsPageArgs | void
    >({
      query: (args) => {
        const { page = 1, size = DEFAULT_PAGE_SIZE, status, documentId } =
          args ?? {};
        return {
          url: JOBS_PATHS.root,
          params: {
            limit: size,
            offset: (page - 1) * size,
            status,
            document_id: documentId,
          }, // undefined params are dropped
        };
      },
      providesTags: (res) => [
        ...(res?.items ?? []).map((j) => ({
          type: "Job" as const,
          id: j.id,
        })),
        { type: "Job" as const, id: LIST },
      ],
    }),

    /** GET /jobs/{id} -> JobRead (with stages). 404 also when the caller has no access. */
    getJobById: build.query<Job, UUID>({
      query: (id) => JOBS_PATHS.byId(id),
      providesTags: (_r, _e, id) => [{ type: "Job", id }],
    }),

    /** POST /jobs/{id}/cancel -> JobRead. 409 if the job is not active. */
    cancelJob: build.mutation<Job, UUID>({
      query: (id) => ({ url: JOBS_PATHS.cancel(id), method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Job", id },
        { type: "Job", id: LIST },
        "Document",
      ],
    }),

    /** POST /jobs/{id}/retry -> 202 {document_id, job_id}: a NEW reindex job. */
    retryJob: build.mutation<JobRetryResponse, UUID>({
      query: (id) => ({ url: JOBS_PATHS.retry(id), method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Job", id },
        { type: "Job", id: LIST },
        "Document",
      ],
    }),
  }),
});

export const {
  useGetJobsPageQuery,
  useGetJobByIdQuery,
  useCancelJobMutation,
  useRetryJobMutation,
} = jobsApi;
