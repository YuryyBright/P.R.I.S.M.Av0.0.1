import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { inputClass } from "@/shared/ui/classes";
import type { UUID } from "@/shared/types/api";
import { useCollectionOptions } from "../hooks/useCollectionOptions";
import { SearchIcon, SpinnerIcon } from "./AiIcons";

interface Props {
  value: UUID[];
  onChange: (next: UUID[]) => void;
  /** Accessible name of the list. */
  label: string;
  maxHeightClass?: string;
}

/** Multi-select of readable collections (search + checkboxes). */
export function CollectionPicker({
  value,
  onChange,
  label,
  maxHeightClass = "max-h-52",
}: Props) {
  const { t } = useTranslation();
  const { options, isLoading, truncated } = useCollectionOptions();
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((o) => o.name.toLowerCase().includes(q))
      : options;
  }, [options, query]);

  const toggle = (id: UUID) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("ai.settings.searchCollections", "Пошук колекції…")}
          aria-label={t("ai.settings.searchCollections", "Пошук колекції…")}
          className={`${inputClass} h-9 w-full ps-9`}
        />
      </div>

      <ul
        aria-label={label}
        className={`${maxHeightClass} space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-1 dark:border-white/10`}
      >
        {isLoading && (
          <li className="flex items-center gap-2 px-3 py-2 text-theme-xs text-gray-500">
            <SpinnerIcon className="size-4" />{" "}
            {t("common.loading", "Завантаження…")}
          </li>
        )}
        {!isLoading && filtered.length === 0 && (
          <li className="px-3 py-2 text-theme-xs text-gray-500 dark:text-gray-400">
            {t("ai.settings.noCollections", "Колекцій не знайдено")}
          </li>
        )}
        {filtered.map((o) => (
          <li key={o.id}>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-gray-50 has-focus-visible:ring-2 has-focus-visible:ring-brand-500/40 dark:hover:bg-white/5">
              <input
                type="checkbox"
                checked={selected.has(o.id)}
                onChange={() => toggle(o.id)}
                className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-brand-500 focus:ring-brand-500/40 dark:border-white/20 dark:bg-transparent"
              />
              <span className="min-w-0">
                <span className="block truncate text-theme-sm text-gray-800 dark:text-white/90">
                  {o.name}
                </span>
                {o.description && (
                  <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                    {o.description}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between text-theme-xs text-gray-500 dark:text-gray-400">
        <span>
          {t("ai.settings.selectedCount", "Вибрано: {count}", {
            count: value.length,
          })}
        </span>
        {truncated && (
          <span>
            {t("ai.settings.truncated", "Показано перші 100 колекцій.")}
          </span>
        )}
      </div>
    </div>
  );
}
