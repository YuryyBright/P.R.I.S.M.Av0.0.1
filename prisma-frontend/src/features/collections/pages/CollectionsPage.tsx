import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Alert } from "@/shared/ui/Alert";
import { Pagination } from "@/shared/ui/Pagination";
import { useGetCollectionByIdQuery } from "../api/collections.endpoints";
import { CollectionFormModal } from "../components/CollectionFormModal";
import { CollectionsTable } from "../components/CollectionsTable";
import { CollectionsToolbar } from "../components/CollectionsToolbar";
import { DeleteCollectionDialog } from "../components/DeleteCollectionDialog";
import { MembersModal } from "../components/MembersModal";
import { useCollectionsList } from "../hooks/useCollectionsList";
import { collectionsUiActions, collectionsUiSlice } from "../store/collectionsUiSlice";

function EditCollectionModal({ collectionId }: { collectionId: string }) {
  const dispatch = useDispatch();
  const { data: collection } = useGetCollectionByIdQuery(collectionId);
  if (!collection) return null; // loading; add a skeleton if you like
  return (
    <CollectionFormModal
      key={collection.id}
      collection={collection}
      onClose={() => dispatch(collectionsUiActions.closeForm())}
    />
  );
}

export default function CollectionsPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const ui = useSelector(collectionsUiSlice.selectors.selectCollectionsUi);
  const list = useCollectionsList();

  return (
    <div className="space-y-5">
      <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">{t("collections.title")}</h1>
      <CollectionsToolbar />

      {list.error && <Alert>{(list.error as { message?: string }).message ?? t("collections.loadError")}</Alert>}

      <CollectionsTable
        rows={list.rows}
        isLoading={list.isLoading}
        onEdit={(id) => dispatch(collectionsUiActions.openEditForm(id))}
        onMembers={(id) => dispatch(collectionsUiActions.openMembers(id))}
        onDelete={(id) => dispatch(collectionsUiActions.requestDelete(id))}
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
        <CollectionFormModal key="create" onClose={() => dispatch(collectionsUiActions.closeForm())} />
      )}
      {ui.form.mode === "edit" && <EditCollectionModal collectionId={ui.form.collectionId} />}
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
