import { PAGE_SIZE_OPTIONS } from "../types/api";

interface Props {
  page: number;
  pages: number;
  total: number;
  size: number;
  /** e.g. "users" -> "120 users" */
  itemsLabel?: string;
  disabled?: boolean;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}

const btn =
  "h-9 rounded-lg px-3 text-sm ring-1 ring-gray-300 disabled:opacity-40 dark:text-gray-400 dark:ring-gray-700";

/** Generic: knows nothing about users. Lives in shared/ because 2+ features will need it. */
export function Pagination({ page, pages, total, size, itemsLabel = "items", disabled, onPage, onSize }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-400">
      <span>
        {total} {itemsLabel}
      </span>
      <div className="flex items-center gap-2">
        <select className={btn} value={size} onChange={(e) => onSize(Number(e.target.value))} disabled={disabled}>
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>
        <button className={btn} disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </button>
        <span>
          {page} / {Math.max(pages, 1)}
        </span>
        <button className={btn} disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
