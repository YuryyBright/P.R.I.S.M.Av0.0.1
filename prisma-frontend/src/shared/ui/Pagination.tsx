import { useTranslation } from "react-i18next";
import { PAGE_SIZE_OPTIONS } from "../types/api";

interface Props {
  page: number;
  pages: number;
  total: number;
  size: number;
  /**
   * Fully translated "N things" text, e.g. t("users.pagination.total", { count }).
   * Pass this (not itemsLabel) so plural forms are right in every language.
   */
  totalLabel?: string;
  /** Legacy: plain noun appended to the number ("120 users"). Not plural-aware. */
  itemsLabel?: string;
  disabled?: boolean;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}

const btn =
  "h-9 rounded-lg px-3 text-sm ring-1 ring-gray-300 disabled:opacity-40 dark:text-gray-400 dark:ring-gray-700";

/** Generic: knows nothing about users. Lives in shared/ because 2+ features will need it. */
export function Pagination({ page, pages, total, size, totalLabel, itemsLabel, disabled, onPage, onSize }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-400">
      <span>{totalLabel ?? (itemsLabel ? `${total} ${itemsLabel}` : total)}</span>
      <div className="flex items-center gap-2">
        <select className={btn} value={size} onChange={(e) => onSize(Number(e.target.value))} disabled={disabled}>
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t("shared.pagination.perPage", { size: s })}
            </option>
          ))}
        </select>
        <button className={btn} disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
          {t("shared.pagination.prev")}
        </button>
        <span>
          {page} / {Math.max(pages, 1)}
        </span>
        <button className={btn} disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}>
          {t("shared.pagination.next")}
        </button>
      </div>
    </div>
  );
}
