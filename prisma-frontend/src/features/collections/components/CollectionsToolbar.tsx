import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Can } from "@/features/auth";
import { btnPrimary } from "@/shared/ui/classes";
import { COLLECTION_PERMISSIONS } from "../constants/collections.constants";
import { collectionsUiActions } from "../store/collectionsUiSlice";

/** The backend has no search/sort params for collections, so the toolbar is just "create". */
export function CollectionsToolbar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  return (
    <div className="flex items-center">
      <div className="ml-auto">
        <Can permission={COLLECTION_PERMISSIONS.create}>
          <button className={btnPrimary} onClick={() => dispatch(collectionsUiActions.openCreateForm())}>
            {t("collections.toolbar.new")}
          </button>
        </Can>
      </div>
    </div>
  );
}
