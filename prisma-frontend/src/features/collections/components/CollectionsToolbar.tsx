import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Can } from "@/features/auth";
import { btnPrimary } from "@/shared/ui/classes";
import { COLLECTION_PERMISSIONS } from "../constants/collections.constants";
import { collectionsUiActions } from "../store/collectionsUiSlice";
import { PlusIcon, btnContent } from "./CollectionIcons";

/** The backend has no search/sort params for collections, so the toolbar is just "create". */
export function CollectionsToolbar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  return (
    <Can permission={COLLECTION_PERMISSIONS.create}>
      <button
        type="button"
        className={`${btnPrimary} ${btnContent} w-full sm:w-auto`}
        onClick={() => dispatch(collectionsUiActions.openCreateForm())}
      >
        <PlusIcon className="size-4.5" />
        {t("collections.toolbar.new")}
      </button>
    </Can>
  );
}
