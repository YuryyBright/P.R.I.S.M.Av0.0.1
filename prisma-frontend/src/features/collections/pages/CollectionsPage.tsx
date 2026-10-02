import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
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
import { useCollectionsList } from "../hooks/useCollectionsList";
import {
  collectionsUiActions,
  collectionsUiSlice,
} from "../store/collectionsUiSlice";

const skeleton =
  "animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5";

/** Fetches the collection, shows a skeleton while loading and an error if it fails. */
function EditCollectionModal({ collectionId }: { collectionId: string }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { data: collection, error } = useGetCollectionByIdQuery(collectionId);
  const close = () => dispatch(collectionsUiActions.closeForm());

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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            {t("collections.title")}
          </h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {t(
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

      <CollectionsTable
        rows={list.rows}
        isLoading={list.isLoading}
        onEdit={(id) => dispatch(collectionsUiActions.openEditForm(id))}
        onMembers={(id) => dispatch(collectionsUiActions.openMembers(id))}
        onDelete={(id) => dispatch(collectionsUiActions.requestDelete(id))}
        onCreate={() => dispatch(collectionsUiActions.openCreateForm())}
      />

      <Pagination
        page={list.page}
        pages={list.pages}
        total={list.total}
        size={list.size}
        totalLabel={t("collections.pagination.total", { count: list.total })}
        disabled={list.isFetching}
        onPage={(p) => dispatch(collectionsUiActions.setPage(p))}
        onSize={(s) => dispatch(collectionsUiActions.setSize(s))}
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
          onClose={() => dispatch(collectionsUiActions.cancelDelete())}
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
