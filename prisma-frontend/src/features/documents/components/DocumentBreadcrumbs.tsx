import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { DOCUMENTS_ROUTES } from "../constants/documents.constants";
import { linkClass, mutedText } from "../lib/styles";
import type { UUID } from "@/shared/types/api";
import { ChevronRightIcon } from "./DocumentIcons";

function Separator() {
  return (
    <li aria-hidden="true" className="flex shrink-0 items-center">
      <ChevronRightIcon className="size-4" />
    </li>
  );
}

interface Props {
  collectionId: UUID;
  collectionName: string | null;
  title: string;
}

export function DocumentBreadcrumbs({
  collectionId,
  collectionName,
  title,
}: Props) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("common.breadcrumb", "Навігаційний ланцюжок")}>
      <ol className={`flex items-center gap-1.5 text-theme-sm ${mutedText}`}>
        <li className="shrink-0">
          <Link to={DOCUMENTS_ROUTES.collections} className={linkClass}>
            {t("collections.title")}
          </Link>
        </li>
        <Separator />
        <li className="min-w-0 shrink">
          <Link
            to={DOCUMENTS_ROUTES.collection(collectionId)}
            className={`block truncate ${linkClass}`}
          >
            {collectionName ?? t("documents.detail.collection", "Колекція")}
          </Link>
        </li>
        <Separator />
        <li className="min-w-0 flex-1">
          <span
            aria-current="page"
            className="block truncate font-medium text-gray-800 dark:text-white/90"
          >
            {title}
          </span>
        </li>
      </ol>
    </nav>
  );
}
