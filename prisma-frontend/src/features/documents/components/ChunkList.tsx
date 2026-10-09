import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/shared/ui/Alert";
import type { UUID } from "@/shared/types/api";
import { useGetDocumentChunksQuery } from "../api/documents.endpoints";
import {
  CHUNKS_PAGE_SIZE,
  POLL_INTERVAL_MS,
} from "../constants/documents.constants";
import { queryErrorMessage } from "../lib/errors";
import { iconBtnGhost, mutedText } from "../lib/styles";
import type { ChunkBrief } from "../types/document.types";
import { Highlight } from "./Highlight";
import { InlineLoading } from "./InlineLoading";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "./DocumentIcons";

function Row({
  chunk: c,
  active,
  q,
  onSelect,
}: {
  chunk: ChunkBrief;
  active: boolean;
  q: string;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const heading = c.heading_path.at(-1);
  const indexedLabel = c.is_indexed
    ? t("documents.chunks.indexed", "У векторній БД")
    : t("documents.chunks.notIndexed", "Не проіндексовано");
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={`group block w-full border-s-2 px-4 py-3 text-start transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none focus-visible:ring-inset ${
          active
            ? "border-brand-500 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-500/10"
            : "border-transparent hover:bg-gray-50 dark:hover:bg-white/5"
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="font-mono text-theme-xs font-semibold text-gray-800 tabular-nums dark:text-white/90">
            #{c.chunk_index}
          </span>
          {heading && (
            <span className="min-w-0 flex-1 truncate text-theme-xs font-medium text-gray-600 dark:text-gray-300">
              {heading}
            </span>
          )}
          <span className="ms-auto flex shrink-0 items-center gap-2 text-theme-xs text-gray-400 tabular-nums dark:text-gray-500">
            {c.token_count}
            <span
              role="img"
              aria-label={indexedLabel}
              title={indexedLabel}
              className={`size-2 rounded-full ${c.is_indexed ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`}
            />
          </span>
        </span>
        <span className="mt-1 line-clamp-2 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
          <Highlight text={c.preview} q={q} />
        </span>
      </button>
    </li>
  );
}

interface Props {
  documentId: UUID;
  active: boolean;
  selected: number;
  page: number;
  onPage: (p: number) => void;
  q: string;
  onQuery: (q: string) => void;
  onSelect: (index: number) => void;
}

export function ChunkList({
  documentId,
  active,
  selected,
  page,
  onPage,
  q,
  onQuery,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(q);

  // Debounce typing -> query (also resets to page 1 via the parent).
  useEffect(() => {
    const id = setTimeout(() => draft !== q && onQuery(draft.trim()), 300);
    return () => clearTimeout(id);
  }, [draft, q, onQuery]);

  const res = useGetDocumentChunksQuery(
    {
      id: documentId,
      page,
      size: CHUNKS_PAGE_SIZE,
      q: q.length >= 2 ? q : undefined,
    },
    {
      pollingInterval: active ? POLL_INTERVAL_MS : 0,
      skipPollingIfUnfocused: true,
    },
  );
  // Background polls must not dim or disable anything — only a real page / query switch does.
  const switching = res.isFetching && res.currentData === undefined;
  const total = res.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / CHUNKS_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * CHUNKS_PAGE_SIZE + 1;
  const to = Math.min(total, page * CHUNKS_PAGE_SIZE);
  const searching = q.length >= 2;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative border-b border-gray-100 p-3 dark:border-white/5">
        <SearchIcon className="pointer-events-none absolute start-6 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("documents.chunks.search", "Пошук у тексті чанків")}
          aria-label={t("documents.chunks.search", "Пошук у тексті чанків")}
          className="h-10 w-full rounded-lg border border-gray-200 bg-transparent ps-9 pe-3 text-theme-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-white/10 dark:text-white/90"
        />
      </div>

      {res.error && (
        <div className="p-3">
          <Alert>
            {queryErrorMessage(
              res.error,
              t("documents.chunks.loadError", "Не вдалося завантажити чанки"),
            )}
          </Alert>
        </div>
      )}

      {res.isLoading && <InlineLoading className="p-4" />}

      {res.data && res.data.items.length === 0 && (
        <p className={`p-4 text-center text-theme-sm ${mutedText}`}>
          {searching
            ? t(
                "documents.chunks.noMatches",
                "Нічого не знайдено. Спробуйте інше слово.",
              )
            : t("documents.chunks.empty", "Чанків ще немає.")}
        </p>
      )}

      {res.data && res.data.items.length > 0 && (
        <ul
          aria-busy={switching}
          className={`min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto transition-opacity lg:max-h-[34rem] dark:divide-white/5 ${
            switching ? "opacity-60" : ""
          }`}
        >
          {res.data.items.map((c) => (
            <Row
              key={c.id}
              chunk={c}
              q={searching ? q : ""}
              active={c.chunk_index === selected}
              onSelect={() => onSelect(c.chunk_index)}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2 text-theme-xs text-gray-500 dark:border-white/5 dark:text-gray-400">
        <span className="tabular-nums" aria-live="polite">
          {searching
            ? t("documents.chunks.found", {
                count: total,
                defaultValue: "Знайдено: {count}",
              })
            : `${from}–${to} ${t("documents.chunks.of", "з")} ${total}`}
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t("common.prev", "Назад")}
            disabled={page <= 1 || switching}
            onClick={() => onPage(page - 1)}
            className={iconBtnGhost}
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t("common.next", "Далі")}
            disabled={page >= pages || switching}
            onClick={() => onPage(page + 1)}
            className={iconBtnGhost}
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </span>
      </div>
    </div>
  );
}
