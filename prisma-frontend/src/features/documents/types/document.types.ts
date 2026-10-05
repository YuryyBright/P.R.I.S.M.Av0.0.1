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

export type DocumentSourceType =
  "upload" | "telegram" | "rss" | "web" | "api" | "generated";

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

/** app/rag/schemas.py — ChunkStatsRead */
export interface ChunkStats {
  total: number;
  total_tokens: number;
  /** Chunks that already have a vector in Qdrant. */
  indexed: number;
  last_indexed_at: ISODateString | null;
  max_page: number | null;
  embedding_models: string[];
  chunking_versions: string[];
}

/** app/rag/schemas.py — DocumentJobBrief */
export interface DocumentJobBrief {
  id: UUID;
  job_type: string;
  status: string;
  created_at: ISODateString | null;
}

/** GET /documents/{id}/details — app/rag/schemas.py DocumentDetailRead */
export interface DocumentDetails {
  id: UUID;
  collection_id: UUID;
  collection_name: string | null;
  title: string;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  source_type: DocumentSourceType;
  source_id: UUID | null;
  external_id: string | null;
  language: string | null;
  author: string | null;
  url: string | null;
  published_at: ISODateString | null;
  status: DocumentStatus;
  version: number;
  content_hash: string | null;
  has_original: boolean;
  /** Superuser only. */
  storage_path: string | null;
  owner_id: UUID | null;
  /** Only for users with write access to the collection. */
  owner_email: string | null;
  acl_count: number | null;
  meta: Record<string, unknown>;
  created_at: ISODateString | null;
  updated_at: ISODateString | null;
  indexed_at: ISODateString | null;
  chunks: ChunkStats;
  recent_jobs: DocumentJobBrief[];
}

/** GET /documents/{id}/chunks — app/rag/schemas.py ChunkRead */
export interface ChunkItem {
  id: UUID; // = point id in Qdrant
  chunk_index: number;
  content: string;
  token_count: number;
  content_hash: string;
  page_number: number | null;
  page_end: number | null;
  char_start: number | null;
  char_end: number | null;
  heading_path: string[];
  chunking_version: string;
  embedding_model: string | null;
  embedding_version: string | null;
  indexed_at: ISODateString | null;
  is_indexed: boolean;
}

/** GET /documents/{id}/chunks — ChunkBriefRead: a list row, preview only (no full text). */
export interface ChunkBrief {
  id: UUID;
  chunk_index: number;
  preview: string;
  token_count: number;
  page_number: number | null;
  heading_path: string[];
  is_indexed: boolean;
}

/** GET /documents/{id}/chunks/map — parallel arrays indexed by chunk_index. */
export interface ChunkMap {
  count: number;
  tokens: number[];
  indexed: boolean[];
}

export interface ChunksPageArgs {
  id: UUID;
  page?: number;
  size?: number;
  /** Substring search in chunk text (min 2 chars). */
  q?: string;
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
