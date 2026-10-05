import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Can } from "@/features/auth";
import { Alert } from "@/shared/ui/Alert";
import { Pagination } from "@/shared/ui/Pagination";
import { btnPrimary, inputClass } from "@/shared/ui/classes";
import type { UUID } from "@/shared/types/api";
import {
  DOCUMENT_PERMISSIONS,
  DOCUMENTS_ROUTES,
  DOCUMENT_STATUSES,
  UPLOAD_ACCEPT,
} from "../constants/documents.constants";
import { useCollectionDocuments } from "../hooks/useCollectionDocuments";
import { useDocumentActions } from "../hooks/useDocumentActions";
import { useFileDrop } from "../hooks/useFileDrop";
import { actionErrorMessage, queryErrorMessage } from "../lib/errors";
import { parseStatus } from "../lib/documentFormat";
import { btnContent, mutedText } from "../lib/styles";
import type { DocumentItem, UploadResult } from "../types/document.types";
import { DeleteDocumentDialog } from "./DeleteDocumentDialog";
import { SpinnerIcon, UploadIcon } from "./DocumentIcons";
import { DocumentsTable } from "./DocumentsTable";
import { RenameDocumentModal } from "./RenameDocumentModal";
import { UploadResults } from "./UploadResults";

interface Props {
  collectionId: UUID;

  /**
   * Whether the caller's role in this collection allows editing.
   * Passed in by the host page so DocumentsPanel doesn't depend on
   * the collections feature.
   */
  canWrite: boolean;
}

/** Visual only: never intercepts pointer events. */
function DropOverlay() {
  const { t } = useTranslation();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -inset-2 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50/80 text-brand-600 backdrop-blur-[1px] transition-opacity duration-150 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-400 starting:opacity-0"
    >
      <UploadIcon className="size-8" />
      <p className="text-theme-sm font-medium">
        {t("documents.upload.drop", "Відпустіть файли, щоб завантажити")}
      </p>
    </div>
  );
}

/** Self-contained documents tab: list + filter + pagination + upload + row actions. */
export function DocumentsPanel({ collectionId, canWrite }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const titleId = useId();

  const list = useCollectionDocuments(collectionId);
  const { uploadFiles, reindexDocument, isUploading } = useDocumentActions();

  const fileInput = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<DocumentItem | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentItem | null>(null);

  async function handleFiles(files: File[]) {
    if (!files.length || isUploading) return;
    setResults(await uploadFiles(collectionId, files));
    list.setPage(1); // new files are sorted first
  }

  async function handleReindex(doc: DocumentItem) {
    setActionError(null);
    try {
      await reindexDocument(doc.id, doc.collection_id);
    } catch (e) {
      setActionError(actionErrorMessage(e, t("errors.unexpected")));
    }
  }

  const { dragging, dropProps } = useFileDrop(
    canWrite,
    (files) => void handleFiles(files),
  );

  const openFilePicker = () => fileInput.current?.click();

  return (
    <section
      aria-labelledby={titleId}
      className="relative space-y-4"
      {...dropProps}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2
            id={titleId}
            className="text-lg font-semibold text-gray-800 dark:text-white/90"
          >
            {t("documents.title")}
          </h2>
          {canWrite && (
            <p className={`text-theme-xs ${mutedText}`}>
              {t("documents.upload.hint")}
            </p>
          )}
        </div>

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
                  void handleFiles(Array.from(e.target.files ?? []));
                  e.target.value = ""; // allow selecting the same file again
                }}
              />
              <button
                type="button"
                className={`${btnPrimary} ${btnContent} h-10 w-full sm:w-auto`}
                disabled={isUploading}
                aria-busy={isUploading}
                onClick={openFilePicker}
              >
                {isUploading ? (
                  <SpinnerIcon className="size-5" />
                ) : (
                  <UploadIcon className="size-5" />
                )}
                {isUploading
                  ? t("documents.upload.uploading")
                  : t("documents.upload.button")}
              </button>
            </Can>
          )}
        </div>
      </div>

      {list.error && (
        <Alert>{queryErrorMessage(list.error, t("documents.loadError"))}</Alert>
      )}
      {actionError && <Alert>{actionError}</Alert>}

      <UploadResults results={results} onDismiss={() => setResults([])} />

      <DocumentsTable
        rows={list.rows}
        isLoading={list.isLoading}
        canWrite={canWrite}
        isFiltered={Boolean(list.status)}
        onUpload={openFilePicker}
        onDetails={(d) =>
          navigate(DOCUMENTS_ROUTES.detail(d.collection_id, d.id))
        }
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
        disabled={list.isSwitching}
        onPage={list.setPage}
        onSize={list.setSize}
      />

      {dragging && <DropOverlay />}

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
