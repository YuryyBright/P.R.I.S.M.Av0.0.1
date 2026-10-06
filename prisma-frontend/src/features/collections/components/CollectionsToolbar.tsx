import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Can } from "@/features/auth";
import { btnPrimary } from "@/shared/ui/classes";
import { COLLECTION_PERMISSIONS } from "../constants/collections.constants";
import {
  collectionsUiActions,
  collectionsUiSlice,
} from "../store/collectionsUiSlice";
import type { CollectionsView } from "../types/collection.types";
import { ArchiveIcon, FolderIcon, PlusIcon, btnContent } from "./CollectionIcons";

const tabBase =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-theme-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 [&>svg]:block [&>svg]:shrink-0";
const tabOn =
  "bg-white text-gray-800 shadow-xs dark:bg-white/10 dark:text-white/90";
const tabOff =
  "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90";

/** Segmented "Колекції | Архів" switch. */
function ViewSwitch() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { view } = useSelector(collectionsUiSlice.selectors.selectCollectionsUi);

  const tabs: { value: CollectionsView; label: string; icon: React.ReactNode }[] =
    [
      {
        value: "active",
        label: t("collections.views.active", "Колекції"),
        icon: <FolderIcon className="size-4.5" />,
      },
      {
        value: "archived",
        label: t("collections.views.archived", "Архів"),
        icon: <ArchiveIcon className="size-4.5" />,
      },
    ];

  return (
    <div
      role="tablist"
      aria-label={t("collections.views.label", "Режим перегляду")}
      className="inline-flex w-full items-center gap-1 rounded-lg bg-gray-100 p-1 sm:w-auto dark:bg-white/5"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={view === tab.value}
          className={`${tabBase} flex-1 sm:flex-none ${view === tab.value ? tabOn : tabOff}`}
          onClick={() => dispatch(collectionsUiActions.setView(tab.value))}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** View switch + "create" (hidden in the archive). The backend has no search/sort params. */
export function CollectionsToolbar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { view } = useSelector(collectionsUiSlice.selectors.selectCollectionsUi);
  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
      <ViewSwitch />
      {view === "active" && (
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
      )}
    </div>
  );
}
