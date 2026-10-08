import {
  ACTIVE_STATUSES,
  ALLOWED_EXTENSIONS,
  DOCUMENT_STATUSES,
  MAX_FILE_BYTES,
} from "../constants/documents.constants";
import type {
  DocumentDetails,
  DocumentItem,
  DocumentStatus,
  UploadErrorCode,
} from "../types/document.types";

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export const isActiveStatus = (s: DocumentStatus): boolean =>
  ACTIVE_STATUSES.includes(s);

export const parseStatus = (v: string | null): DocumentStatus | undefined =>
  DOCUMENT_STATUSES.find((s) => s === v);

/** Client-side pre-check so obviously bad files never hit the network. */
export function validateFile(file: File): UploadErrorCode | null {
  if (file.size === 0) return "empty";
  if (file.size > MAX_FILE_BYTES) return "size";
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) return "type";
  return null;
}

/** Actions and dialogs are typed against the list row; the details card is a superset of it. */
export const toDocumentItem = (d: DocumentDetails): DocumentItem => ({
  id: d.id,
  collection_id: d.collection_id,
  title: d.title,
  filename: d.filename,
  mime_type: d.mime_type,
  size_bytes: d.size_bytes,
  status: d.status,
  language: d.language,
  author: d.author,
  created_at: d.created_at ?? "",
  indexed_at: d.indexed_at,
});
