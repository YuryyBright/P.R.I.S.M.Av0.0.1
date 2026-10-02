import type { ISODateString, UUID } from "@/shared/types/api";

/* app/rag/schemas.py — JobRead / StageRead / JobListItem (new, see backend patch).
 * VERIFY the string values against app/rag/domain/enums.py (JobStatus, JobType,
 * IngestionStageName, StageStatus): the code below assumes lower-case values,
 * like DocumentStatus. Unknown values never crash the UI (badges fall back to neutral). */

export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type JobType = "document_ingest" | "reindex";

export type StageName = "parse" | "chunk" | "embed" | "index" | "finalize";

export type StageStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped";

/** StageRead */
export interface JobStage {
  stage: StageName;
  status: StageStatus;
  items_total: number;
  items_processed: number;
  started_at: ISODateString | null;
  finished_at: ISODateString | null;
  error_message: string | null;
}

/** JobRead — GET /jobs/{id}. Includes the stages. */
export interface Job {
  id: UUID;
  document_id: UUID | null;
  job_type: JobType;
  status: JobStatus;
  current_stage: StageName | null;
  progress: number; // 0..100
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  started_at: ISODateString | null;
  finished_at: ISODateString | null;
  created_at: ISODateString;
  stages: JobStage[];
}

/** JobListItem — GET /jobs rows: a Job without stages + document info for the table. */
export type JobListItem = Omit<Job, "stages"> & {
  /** null = the document was physically deleted (FK SET NULL). */
  document_title: string | null;
  collection_id: UUID | null;
};

/** Page[T] = {items, total, limit, offset} */
export interface LimitOffsetPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** 202 from POST /jobs/{id}/retry (the NEW job). */
export interface JobRetryResponse {
  document_id: UUID;
  job_id: UUID;
  status: JobStatus;
}

/** UI speaks page/size; the endpoint converts to limit/offset. */
export interface JobsPageArgs {
  page?: number;
  size?: number;
  status?: JobStatus;
  documentId?: UUID;
}
