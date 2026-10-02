import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { Can } from "@/features/auth";
import { DOCUMENT_PERMISSIONS, DocumentsPanel } from "@/features/documents";
import { formatDateTime } from "@/shared/lib/date";
import { Alert } from "@/shared/ui/Alert";
import { useGetCollectionByIdQuery } from "../api/collections.endpoints";
import { CollectionActions } from "../components/CollectionActions";
import { RoleBadge, VisibilityBadge } from "../components/CollectionBadges";
import { CollectionFormModal } from "../components/CollectionFormModal";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  FolderIcon,
} from "../components/CollectionIcons";
import { DeleteCollectionDialog } from "../components/DeleteCollectionDialog";
import { MembersModal } from "../components/MembersModal";
import { COLLECTIONS_ROUTES } from "../constants/collections.constants";
import { canWriteDocuments } from "../lib/collectionMappers";
type Dialog = "edit" | "members" | "delete" | null;
const linkClass =
  "rounded transition-colors hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:hover:text-white/90";
const skeleton =
  "animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5";
/** * /collections/:collectionId * * Header + documents of the collection. * * Access is decided by the backend: * 404 = missing/inactive * 403 = no role */ export default function CollectionDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { collectionId = "" } = useParams();
  const {
    data: collection,
    isLoading,
    error,
  } = useGetCollectionByIdQuery(collectionId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const back = (
    <Link
      to={COLLECTIONS_ROUTES.list}
      className={`inline-flex items-center gap-1.5 text-theme-sm text-gray-500 dark:text-gray-400 ${linkClass}`}
    >
      {" "}
      <ArrowLeftIcon className="size-5" /> {t("collections.detail.back")}{" "}
    </Link>
  );
  if (isLoading) {
    return (
      <div aria-busy="true" className="space-y-6">
        {" "}
        <span className="sr-only"> {t("common.loading")} </span>{" "}
        <div className={`${skeleton} h-4 w-48`} />{" "}
        <div className="space-y-3">
          {" "}
          <div className={`${skeleton} h-8 w-72 max-w-full`} />{" "}
          <div className={`${skeleton} h-4 w-full max-w-xl`} />{" "}
          <div className="flex gap-2">
            {" "}
            <div className={`${skeleton} h-5 w-20 rounded-full`} />{" "}
            <div className={`${skeleton} h-5 w-16 rounded-full`} />{" "}
          </div>{" "}
        </div>{" "}
        <div className={`${skeleton} h-64 w-full rounded-2xl`} />{" "}
      </div>
    );
  }
  if (error || !collection) {
    return (
      <div className="space-y-4">
        {" "}
        {back}{" "}
        <Alert>
          {" "}
          {(error as { message?: string } | undefined)?.message ??
            t("collections.loadError")}{" "}
        </Alert>{" "}
      </div>
    );
  }
  const close = () => setDialog(null);
  return (
    <div className="space-y-6">
      {" "}
      <nav aria-label={t("common.breadcrumb", "Навігаційний ланцюжок")}>
        {" "}
        <ol className="flex items-center gap-1.5 text-theme-sm text-gray-500 dark:text-gray-400">
          {" "}
          <li className="shrink-0">
            {" "}
            <Link to={COLLECTIONS_ROUTES.list} className={linkClass}>
              {" "}
              {t("collections.title")}{" "}
            </Link>{" "}
          </li>{" "}
          <li
            aria-hidden="true"
            className="flex shrink-0 items-center justify-center"
          >
            {" "}
            <ChevronRightIcon className="size-4" />{" "}
          </li>{" "}
          <li className="min-w-0">
            {" "}
            <span
              aria-current="page"
              className="block truncate font-medium text-gray-800 dark:text-white/90"
            >
              {" "}
              {collection.name}{" "}
            </span>{" "}
          </li>{" "}
        </ol>{" "}
      </nav>{" "}
      <header className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 md:flex-row md:items-start md:justify-between md:p-6 dark:border-white/5 dark:bg-white/3">
        {" "}
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {" "}
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 ring-1 ring-brand-200/60 ring-inset dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/20">
            {" "}
            <FolderIcon className="size-6" />{" "}
          </span>{" "}
          <div className="min-w-0 flex-1 space-y-3">
            {" "}
            <h1 className="text-title-sm font-semibold wrap-break-word text-gray-800 dark:text-white/90">
              {" "}
              {collection.name}{" "}
            </h1>{" "}
            {collection.description && (
              <p className="max-w-2xl text-theme-sm leading-6 text-gray-500 dark:text-gray-400">
                {" "}
                {collection.description}{" "}
              </p>
            )}{" "}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {" "}
              <VisibilityBadge visibility={collection.visibility} />{" "}
              <RoleBadge role={collection.my_role} />{" "}
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                {" "}
                {t("collections.detail.created", "Створено")}{" "}
                {formatDateTime(collection.created_at)}{" "}
              </span>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
        <CollectionActions
          collection={collection}
          variant="labeled"
          className="flex-wrap md:justify-end"
          onMembers={() => setDialog("members")}
          onEdit={() => setDialog("edit")}
          onDelete={() => setDialog("delete")}
        />{" "}
      </header>{" "}
      <Can
        permission={DOCUMENT_PERMISSIONS.read}
        fallback={<Alert> {t("documents.noPermission")} </Alert>}
      >
        {" "}
        <DocumentsPanel
          collectionId={collection.id}
          canWrite={canWriteDocuments(collection)}
        />{" "}
      </Can>{" "}
      {dialog === "edit" && (
        <CollectionFormModal
          key={collection.id}
          collection={collection}
          onClose={close}
        />
      )}{" "}
      {dialog === "members" && (
        <MembersModal collectionId={collection.id} onClose={close} />
      )}{" "}
      {dialog === "delete" && (
        <DeleteCollectionDialog
          collectionId={collection.id}
          onClose={close}
          onDeleted={() => navigate(COLLECTIONS_ROUTES.list, { replace: true })}
        />
      )}{" "}
    </div>
  );
}
