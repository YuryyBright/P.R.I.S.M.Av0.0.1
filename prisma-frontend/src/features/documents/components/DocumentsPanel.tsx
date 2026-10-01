import { useId, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { Can } from "@/features/auth";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Pagination } from "@/shared/ui/Pagination";
import { btnPrimary, inputClass } from "@/shared/ui/classes";
import type { UUID } from "@/shared/types/api";
import {
  DOCUMENT_PERMISSIONS,
  DOCUMENT_STATUSES,
  UPLOAD_ACCEPT,
} from "../constants/documents.constants";
import { useCollectionDocuments } from "../hooks/useCollectionDocuments";
import { useDocumentActions } from "../hooks/useDocumentActions";
import { parseStatus } from "../lib/documentFormat";
import type { DocumentItem, UploadResult } from "../types/document.types";
import { DeleteDocumentDialog } from "./DeleteDocumentDialog";
import { SpinnerIcon, UploadIcon } from "./DocumentIcons";
import { DocumentsTable } from "./DocumentsTable";
import { RenameDocumentModal } from "./RenameDocumentModal";
import { UploadResults } from "./UploadResults";

interface Props {
  collectionId: UUID;
  /**
   * Whether the caller's role in this collection allows editing (owner/editor).
   * Passed in by the host page so `documents` doesn't depend on the `collections` feature.
   */
  canWrite: boolean;
}

/** Self-contained "Documents" tab: list + filter + pagination + upload + row actions. */
export function DocumentsPanel({ collectionId, canWrite }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const list = useCollectionDocuments(collectionId);
  const { uploadFiles, reindexDocument, isUploading } = useDocumentActions();

  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<DocumentItem | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentItem | null>(null);

  async function handleFiles(files: FileList | File[]) {
    const picked = Array.from(files);
    if (!picked.length || isUploading) return;
    setResults(await uploadFiles(collectionId, picked));
    list.setPage(1); // new files are sorted first; show them
  }

  async function handleReindex(doc: DocumentItem) {
    setActionError(null);
    try {
      await reindexDocument(doc.id, doc.collection_id);
    } catch (e) {
      setActionError(
        isNormalizedApiError(e) ? e.message : t("errors.unexpected"),
      );
    }
  }

  const dropProps = canWrite
    ? {
        onDragOver: (e: DragEvent<HTMLElement>) => {
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: (e: DragEvent<HTMLElement>) => {
          // Moving over a child fires dragleave on the section; ignore that to avoid flicker.
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setDragging(false);
        },
        onDrop: (e: DragEvent<HTMLElement>) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        },
      }
    : {};

  return (
    <section
      aria-labelledby={titleId}
      className="relative space-y-4"
      {...dropProps}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id={titleId}
          className="text-lg font-semibold text-gray-800 dark:text-white/90"
        >
          {t("documents.title")}
        </h2>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className={`${inputClass} h-10 w-full sm:w-auto`}
            value={list.status ?? ""}
            onChange={(e) => list.setStatus(parseStatus(e.target.value))}
            aria-label={t("documents.filter.label")}
          >
            <option value="">{t("documents.filter.all")}</option>
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`documents.status.${s}`)}
              </option>
            ))}
          </select>

          {canWrite && (
            <Can permission={DOCUMENT_PERMISSIONS.write}>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                accept={UPLOAD_ACCEPT}
                onChange={(e) => {
                  void handleFiles(e.target.files ?? []);
                  e.target.value = ""; // allow re-picking the same file
                }}
              />
              <button
                type="button"
                className={`${btnPrimary} h-10 w-full gap-2 sm:w-auto`}
                disabled={isUploading}
                aria-busy={isUploading}
                onClick={() => fileInput.current?.click()}
              >
                {isUploading ? <SpinnerIcon /> : <UploadIcon />}
                {isUploading
                  ? t("documents.upload.uploading")
                  : t("documents.upload.button")}
              </button>
            </Can>
          )}
        </div>
      </div>

      {canWrite && (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {t("documents.upload.hint")}
        </p>
      )}

      {list.error && (
        <Alert>
          {(list.error as { message?: string }).message ??
            t("documents.loadError")}
        </Alert>
      )}
      {actionError && <Alert>{actionError}</Alert>}
      <UploadResults results={results} onDismiss={() => setResults([])} />

      <DocumentsTable
        rows={list.rows}
        isLoading={list.isLoading}
        canWrite={canWrite}
        isFiltered={Boolean(list.status)}
        onUpload={() => fileInput.current?.click()}
        onRename={setRenameDoc}
        onReindex={handleReindex}
        onDelete={setDeleteDoc}
      />

      <Pagination
        page={list.page}
        pages={list.pages}
        total={list.total}
        size={list.size}
        totalLabel={t("documents.pagination.total", { count: list.total })}
        disabled={list.isFetching}
        onPage={list.setPage}
        onSize={list.setSize}
      />

      {/* Drop-zone overlay: purely visual, never intercepts pointer events. */}
      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50/80 text-brand-600 backdrop-blur-[1px] transition-opacity duration-150 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-400 starting:opacity-0"
        >
          <p className="text-theme-sm font-medium">
            {t("documents.upload.drop", "Відпустіть файли, щоб завантажити")}
          </p>
        </div>
      )}

      {renameDoc && (
        <RenameDocumentModal
          key={renameDoc.id}
          document={renameDoc}
          onClose={() => setRenameDoc(null)}
        />
      )}
      {deleteDoc && (
        <DeleteDocumentDialog
          document={deleteDoc}
          onClose={() => setDeleteDoc(null)}
        />
      )}
    </section>
  );
}
