import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Can } from "@/features/auth";
import { Alert } from "@/shared/ui/Alert";
import { useGetDocumentDetailsQuery } from "../api/documents.endpoints";
import { DeleteDocumentDialog } from "../components/DeleteDocumentDialog";
import { DocumentActions } from "../components/DocumentActions";
import { DocumentBreadcrumbs } from "../components/DocumentBreadcrumbs";
import { DocumentChunksTab } from "../components/DocumentChunksTab";
import { DocumentHeader } from "../components/DocumentHeader";
import { DocumentInfoTab } from "../components/DocumentInfoTab";
import { RenameDocumentModal } from "../components/RenameDocumentModal";
import { Tabs, tabId, tabPanelId, type TabItem } from "../components/Tabs";
import {
  DOCUMENTS_ROUTES,
  DOCUMENT_PERMISSIONS,
  POLL_INTERVAL_MS,
} from "../constants/documents.constants";
import { useDocumentActions } from "../hooks/useDocumentActions";
import { isActiveStatus, toDocumentItem } from "../lib/documentFormat";
import { actionErrorMessage, queryErrorMessage } from "../lib/errors";
import { linkClass, mutedText, pageContainer, skeleton } from "../lib/styles";

type Tab = "chunks" | "info";
type Dialog = "rename" | "delete" | null;

const TAB_PREFIX = "doc";

function PageSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" className={pageContainer}>
      <span className="sr-only">{t("common.loading")}</span>
      <div className={`${skeleton} h-4 w-64`} />
      <div className={`${skeleton} h-28 w-full rounded-2xl`} />
      <div className={`${skeleton} h-12 w-full rounded-2xl`} />
      <div className={`${skeleton} h-96 w-full rounded-2xl`} />
    </div>
  );
}

/**
 * /collections/:collectionId/documents/:documentId
 * Header + tabs: «Чанки» (overview strip, list, reader) and «Інформація» (metadata).
 * Access is decided by the backend: 404 = missing / no access.
 */
export default function DocumentDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { collectionId = "", documentId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "info" ? "info" : "chunks";
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { reindexDocument } = useDocumentActions();

  // Poll only while the worker is busy. The flag follows the card's own status, so it can't be
  // derived before the query runs (the query needs it, the status comes from the query).
  const [live, setLive] = useState(true);
  const { data, error, isLoading } = useGetDocumentDetailsQuery(documentId, {
    pollingInterval: live ? POLL_INTERVAL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const active = data ? isActiveStatus(data.status) : false;
  useEffect(() => {
    if (data) setLive(active);
  }, [data, active]);

  useEffect(() => {
    if (data?.title) document.title = data.title;
  }, [data?.title]);

  const setTab = (next: Tab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "chunks") p.delete("tab");
        else p.set("tab", next);
        return p;
      },
      { replace: true },
    );

  const toCollection = DOCUMENTS_ROUTES.collection(collectionId);

  if (isLoading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className={pageContainer}>
        <Link
          to={toCollection}
          className={`inline-flex items-center gap-1.5 text-theme-sm ${mutedText} ${linkClass}`}
        >
          {t("documents.detail.back", "До колекції")}
        </Link>
        <Alert>
          {queryErrorMessage(
            error,
            t(
              "documents.details.loadError",
              "Не вдалося завантажити інформацію про документ",
            ),
          )}
        </Alert>
      </div>
    );
  }

  const item = toDocumentItem(data);
  // The card returns acl_count only to users with WRITE on the collection.
  const canWrite = data.acl_count !== null;

  async function reindex() {
    setActionError(null);
    try {
      await reindexDocument(item.id, item.collection_id);
    } catch (e) {
      setActionError(actionErrorMessage(e, t("errors.unexpected")));
    }
  }

  const tabs: TabItem<Tab>[] = [
    {
      id: "chunks",
      label: `${t("documents.chunks.title", "Чанки")}${data.chunks.total ? ` · ${data.chunks.total}` : ""}`,
    },
    { id: "info", label: t("documents.detail.tabInfo", "Інформація") },
  ];

  return (
    <div className={pageContainer}>
      <DocumentBreadcrumbs
        collectionId={collectionId}
        collectionName={data.collection_name}
        title={data.title}
      />

      <DocumentHeader
        data={data}
        actions={
          canWrite && (
            <Can permission={DOCUMENT_PERMISSIONS.write}>
              <DocumentActions
                document={item}
                canWrite
                variant="labeled"
                className="flex-wrap md:justify-end"
                onRename={() => setDialog("rename")}
                onReindex={reindex}
                onDelete={() => setDialog("delete")}
              />
            </Can>
          )
        }
      />

      {actionError && <Alert>{actionError}</Alert>}

      <Tabs
        items={tabs}
        value={tab}
        onChange={setTab}
        idPrefix={TAB_PREFIX}
        label={t("documents.detail.sections", "Розділи документа")}
      />

      <div
        role="tabpanel"
        id={tabPanelId(TAB_PREFIX, tab)}
        aria-labelledby={tabId(TAB_PREFIX, tab)}
      >
        {tab === "chunks" ? (
          <DocumentChunksTab
            documentId={data.id}
            status={data.status}
            active={active}
          />
        ) : (
          <DocumentInfoTab data={data} />
        )}
      </div>

      {dialog === "rename" && (
        <RenameDocumentModal
          key={item.id}
          document={item}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <DeleteDocumentDialog
          document={item}
          onClose={() => setDialog(null)}
          onDeleted={() => navigate(toCollection, { replace: true })}
        />
      )}
    </div>
  );
}
