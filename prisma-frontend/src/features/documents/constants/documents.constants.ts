import type { DocumentStatus } from "../types/document.types";

export const DOCUMENTS_PATHS = {
  inCollection: (collectionId: string) => `/collections/${collectionId}/documents`,
  byId: (id: string) => `/documents/${id}`,
  details: (id: string) => `/documents/${id}/details`,
  reindex: (id: string) => `/documents/${id}/reindex`,
} as const;

/** VERIFY against PERM_DOCUMENTS_* in app/api/deps.py and the seeded permissions. */
export const DOCUMENT_PERMISSIONS = {
  read: "rag.documents.read",
  write: "rag.documents.write",
} as const;

/** Mirrors MIME_BY_EXT in app/rag/domain/uploads.py. The backend stays the source of truth. */
export const ALLOWED_EXTENSIONS = [
  ".pdf", ".txt", ".md", ".markdown", ".docx", ".html", ".htm", ".xhtml", ".json", ".jsonl", ".ndjson",
] as const;
export const UPLOAD_ACCEPT = ALLOWED_EXTENSIONS.join(",");

/** VERIFY: must equal IngestionSettings.max_file_mb. Only a UX pre-check. */
export const MAX_FILE_MB = 50;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  "pending", "processing", "chunking", "embedding", "indexing", "ready", "failed",
];

/** Statuses where a worker is still busy -> keep polling the list. */
export const ACTIVE_STATUSES: readonly DocumentStatus[] = [
  "pending", "processing", "chunking", "embedding", "indexing",
];

export const POLL_INTERVAL_MS = 3000;
export const MAX_PAGE_SIZE = 100; // backend: Query(le=100)
