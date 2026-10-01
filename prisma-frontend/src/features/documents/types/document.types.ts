import type { ISODateString, UUID } from "@/shared/types/api";

/* app/rag/schemas.py — DocumentRead / UploadResponse.
 * VERIFY the field list against DocumentRead; only fields used by the UI are declared. */

export type DocumentStatus =
  | "pending"
  | "processing"
  | "chunking"
  | "embedding"
  | "indexing"
  | "ready"
  | "failed"
  | "deleted";

export type DocumentSourceType = "upload" | "telegram" | "rss" | "web" | "api" | "generated";

/** Named DocumentItem to avoid clashing with the DOM `Document` global. */
export interface DocumentItem {
  id: UUID;
  collection_id: UUID;
  title: string;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  source_type: DocumentSourceType;
  status: DocumentStatus;
  created_at: ISODateString;
}

/** Page[T] = {items, total, limit, offset} */
export interface LimitOffsetPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** 202 from POST /collections/{id}/documents and POST /documents/{id}/reindex */
export interface UploadResponse {
  document_id: UUID;
  job_id: UUID;
}

export interface DocumentsPageArgs {
  collectionId: UUID;
  page?: number;
  size?: number;
  status?: DocumentStatus;
}

export type UploadErrorCode = "type" | "size" | "empty" | "server";

export interface UploadResult {
  name: string;
  ok: boolean;
  code?: UploadErrorCode;
  /** Server message (409 duplicate, 413, 415...) when code === "server". */
  message?: string;
}
