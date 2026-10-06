import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Modal } from "@/shared/ui/Modal";
import { Pagination } from "@/shared/ui/Pagination";
import { btnSecondary } from "@/shared/ui/classes";

import { useGetCollectionByIdQuery } from "../api/collections.endpoints";
import { CollectionFormModal } from "../components/CollectionFormModal";
import { CollectionsTable } from "../components/CollectionsTable";
import { CollectionsToolbar } from "../components/CollectionsToolbar";
import { DeleteCollectionDialog } from "../components/DeleteCollectionDialog";
import { MembersModal } from "../components/MembersModal";
import { useCollectionActions } from "../hooks/useCollectionActions";
import { useCollectionsList } from "../hooks/useCollectionsList";
import {
  collectionsUiActions,
  collectionsUiSlice,
} from "../store/collectionsUiSlice";

const skeleton =
  "animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5";

function EditCollectionModal({ collectionId }: { collectionId: string }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const { data: collection, error } = useGetCollectionByIdQuery(collectionId);

  const close = () => {
    dispatch(collectionsUiActions.closeForm());
  };

  if (collection) {
    return (
      <CollectionFormModal
        key={collection.id}
        collection={collection}
        onClose={close}
      />
    );
  }

  return (
    <Modal
      open
      onClose={close}
      title={t("collections.form.editTitle", "Редагувати колекцію")}
      footer={
        <button
          type="button"
          className={`${btnSecondary} w-full sm:w-auto`}
          onClick={close}
        >
          {t("common.close")}
        </button>
      }
    >
      {error ? (
        <Alert>
          {(error as { message?: string }).message ??
            t("collections.loadError")}
        </Alert>
      ) : (
        <div aria-busy="true" className="space-y-5">
          <span className="sr-only">{t("common.loading")}</span>

          <div className={`${skeleton} h-10 w-full`} />
          <div className={`${skeleton} h-28 w-full`} />
          <div className={`${skeleton} h-10 w-full`} />
        </div>
      )}
    </Modal>
  );
}

export default function CollectionsPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const ui = useSelector(collectionsUiSlice.selectors.selectCollectionsUi);

  const list = useCollectionsList();
  const { restoreCollection } = useCollectionActions();

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isArchivedView = list.view === "archived";

  const getCollectionName = (id: string) =>
    list.rows.find((collection) => collection.id === id)?.name;

  const handleRestore = async (id: string) => {
    setActionError(null);
    setRestoringId(id);

    try {
      await restoreCollection(id);
    } catch (error) {
      setActionError(
        isNormalizedApiError(error) ? error.message : t("errors.unexpected"),
      );
    } finally {
      setRestoringId(null);
    }
  };

  const openCreateForm = () => {
    dispatch(collectionsUiActions.openCreateForm());
  };

  const openEditForm = (id: string) => {
    dispatch(collectionsUiActions.openEditForm(id));
  };

  const openMembers = (id: string) => {
    dispatch(collectionsUiActions.openMembers(id));
  };

  const requestDelete = (id: string) => {
    dispatch(collectionsUiActions.requestDelete(id));
  };

  const requestPurge = (id: string) => {
    dispatch(collectionsUiActions.requestPurge(id));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            {t("collections.title")}
          </h1>

          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {isArchivedView
              ? t(
                  "collections.archive.subtitle",
                  "Заархівовані колекції не видно в пошуку. Відновіть їх або видаліть назавжди.",
                )
              : t(
                  "collections.subtitle",
                  "Керуйте колекціями матеріалів та доступом учасників.",
                )}
          </p>
        </div>

        <CollectionsToolbar />
      </header>

      {list.error && (
        <Alert>
          {(list.error as { message?: string }).message ??
            t("collections.loadError")}
        </Alert>
      )}

      {actionError && <Alert>{actionError}</Alert>}

      <CollectionsTable
        rows={list.rows}
        isLoading={list.isLoading}
        mode={list.view}
        restoringId={restoringId}
        onRestore={handleRestore}
        onPurge={requestPurge}
        onEdit={openEditForm}
        onMembers={openMembers}
        onDelete={requestDelete}
        onCreate={openCreateForm}
      />

      <Pagination
        page={list.page}
        pages={list.pages}
        total={list.total}
        size={list.size}
        totalLabel={t("collections.pagination.total", {
          count: list.total,
        })}
        disabled={list.isFetching}
        onPage={(page) => dispatch(collectionsUiActions.setPage(page))}
        onSize={(size) => dispatch(collectionsUiActions.setSize(size))}
      />

      {ui.form.mode === "create" && (
        <CollectionFormModal
          key="create"
          onClose={() => dispatch(collectionsUiActions.closeForm())}
        />
      )}

      {ui.form.mode === "edit" && (
        <EditCollectionModal collectionId={ui.form.collectionId} />
      )}

      {ui.deleteTargetId && (
        <DeleteCollectionDialog
          collectionId={ui.deleteTargetId}
          collectionName={getCollectionName(ui.deleteTargetId)}
          onClose={() => dispatch(collectionsUiActions.cancelDelete())}
        />
      )}

      {ui.purgeTargetId && (
        <DeleteCollectionDialog
          mode="purge"
          collectionId={ui.purgeTargetId}
          collectionName={getCollectionName(ui.purgeTargetId)}
          onClose={() => dispatch(collectionsUiActions.cancelPurge())}
        />
      )}

      {ui.membersTargetId && (
        <MembersModal
          collectionId={ui.membersTargetId}
          onClose={() => dispatch(collectionsUiActions.closeMembers())}
        />
      )}
    </div>
  );
}
