import { useState } from "react";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import type { UUID } from "@/shared/types/api";
import {
  useDeleteDocumentMutation,
  useReindexDocumentMutation,
  useRenameDocumentMutation,
  useUploadDocumentMutation,
} from "../api/documents.endpoints";
import { validateFile } from "../lib/documentFormat";
import type { UploadResult } from "../types/document.types";

/** Mutations resolve with the payload or THROW a NormalizedApiError; uploadFiles never throws. */
export function useDocumentActions() {
  const [upload] = useUploadDocumentMutation();
  const [rename, renameS] = useRenameDocumentMutation();
  const [remove, removeS] = useDeleteDocumentMutation();
  const [reindex, reindexS] = useReindexDocumentMutation();
  const [isUploading, setIsUploading] = useState(false);

  /**
   * The backend takes ONE file per request, so files go sequentially: predictable
   * load on the API/Celery and a per-file result (e.g. 409 duplicate) instead of all-or-nothing.
   */
  async function uploadFiles(
    collectionId: UUID,
    files: File[],
  ): Promise<UploadResult[]> {
    setIsUploading(true);
    const results: UploadResult[] = [];
    try {
      for (const file of files) {
        const invalid = validateFile(file);
        if (invalid) {
          results.push({ name: file.name, ok: false, code: invalid });
          continue;
        }
        try {
          await upload({ collectionId, file }).unwrap();
          results.push({ name: file.name, ok: true });
        } catch (e) {
          results.push({
            name: file.name,
            ok: false,
            code: "server",
            message: isNormalizedApiError(e) ? e.message : undefined,
          });
        }
      }
    } finally {
      setIsUploading(false);
    }
    return results;
  }

  return {
    uploadFiles,
    renameDocument: (id: UUID, collectionId: UUID, title: string) =>
      rename({ id, collectionId, title }).unwrap(),
    deleteDocument: (id: UUID, collectionId: UUID) =>
      remove({ id, collectionId }).unwrap(),
    reindexDocument: (id: UUID, collectionId: UUID) =>
      reindex({ id, collectionId }).unwrap(),
    isUploading,
    isMutating: [renameS, removeS, reindexS].some((s) => s.isLoading),
  };
}
