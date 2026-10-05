import type { DocumentStatus } from "../types/document.types";

export const DOCUMENTS_PATHS = {
  inCollection: (collectionId: string) =>
    `/collections/${collectionId}/documents`,
  byId: (id: string) => `/documents/${id}`,
  details: (id: string) => `/documents/${id}/details`,
  reindex: (id: string) => `/documents/${id}/reindex`,
  chunks: (id: string) => `/documents/${id}/chunks`,
  chunk: (id: string, index: number) => `/documents/${id}/chunks/${index}`,
  chunkMap: (id: string) => `/documents/${id}/chunks/map`,
} as const;

/** VERIFY against PERM_DOCUMENTS_* in app/api/deps.py and the seeded permissions. */
export const DOCUMENT_PERMISSIONS = {
  read: "rag.documents.read",
  write: "rag.documents.write",
} as const;

/** Mirrors MIME_BY_EXT in app/rag/domain/uploads.py. The backend stays the source of truth. */
export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
  ".docx",
  ".html",
  ".htm",
  ".xhtml",
  ".json",
  ".jsonl",
  ".ndjson",
] as const;
export const UPLOAD_ACCEPT = ALLOWED_EXTENSIONS.join(",");

/** VERIFY: must equal IngestionSettings.max_file_mb. Only a UX pre-check. */
export const MAX_FILE_MB = 50;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  "pending",
  "processing",
  "chunking",
  "embedding",
  "indexing",
  "ready",
  "failed",
];

/** Statuses where a worker is still busy -> keep polling the list. */
export const ACTIVE_STATUSES: readonly DocumentStatus[] = [
  "pending",
  "processing",
  "chunking",
  "embedding",
  "indexing",
];

export const POLL_INTERVAL_MS = 3000;
export const MAX_PAGE_SIZE = 100; // backend: Query(le=100)
export const CHUNKS_PAGE_SIZE = 20;
/** The chunk map never draws more segments than this; bigger documents are bucketed. */
export const CHUNK_MAP_MAX_SEGMENTS = 160;

/** Browser routes. Kept local so `documents` doesn't import the collections feature. */
export const DOCUMENTS_ROUTES = {
  /** Route pattern for react-router (registered via `documentsRoutes`). */
  pattern: "/collections/:collectionId/documents/:documentId",
  detail: (collectionId: string, id: string) =>
    `/collections/${collectionId}/documents/${id}`,
  collection: (collectionId: string) => `/collections/${collectionId}`,
  collections: "/collections",
} as const;
