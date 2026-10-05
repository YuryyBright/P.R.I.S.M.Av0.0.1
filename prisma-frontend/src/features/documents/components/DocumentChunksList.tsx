import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/shared/ui/Alert";
import { Pagination } from "@/shared/ui/Pagination";
import { formatDateTime } from "@/shared/lib/date";
import type { UUID } from "@/shared/types/api";
import { useGetDocumentChunksQuery } from "../api/documents.endpoints";
import { CHUNKS_PAGE_SIZE, POLL_INTERVAL_MS } from "../constants/documents.constants";
import type { ChunkItem } from "../types/document.types";
import { SpinnerIcon } from "./DocumentIcons";

interface Props {
  documentId: UUID;
  /** Document is still being processed -> chunks appear/change, keep the list live. */
  active: boolean;
}

const pill =
  "rounded-md bg-gray-100 px-2 py-0.5 text-theme-xs text-gray-600 dark:bg-white/5 dark:text-gray-400";

function pages(c: ChunkItem): string | null {
  if (c.page_number == null) return null;
  return c.page_end != null && c.page_end !== c.page_number
    ? `${c.page_number}–${c.page_end}`
    : String(c.page_number);
}

function ChunkCard({ chunk: c }: { chunk: ChunkItem }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const pg = pages(c);
  const long = c.content.length > 400 || c.content.split("\n").length > 5;

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-theme-sm font-semibold text-gray-800 dark:text-white/90">
          #{c.chunk_index}
        </span>
        <span className={pill}>
          {c.token_count} {t("documents.chunks.tokens", "ток.")}
        </span>
        {pg && (
          <span className={pill}>
            {t("documents.chunks.page", "стор.")} {pg}
          </span>
        )}
        {c.char_start != null && c.char_end != null && (
          <span className={`${pill} font-mono`}>
            {c.char_start}–{c.char_end}
          </span>
        )}
        <span
          className={`rounded-md px-2 py-0.5 text-theme-xs ${
            c.is_indexed
              ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
              : "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"
          }`}
          title={c.indexed_at ? formatDateTime(c.indexed_at) : undefined}
        >
          {c.is_indexed
            ? t("documents.chunks.indexed", "У векторній БД")
            : t("documents.chunks.notIndexed", "Не проіндексовано")}
        </span>
      </div>

      {c.heading_path.length > 0 && (
        <p className="text-theme-xs wrap-break-word text-gray-500 dark:text-gray-400">
          {c.heading_path.join(" › ")}
        </p>
      )}

      <p
        className={`text-theme-sm wrap-break-word whitespace-pre-wrap text-gray-700 dark:text-gray-300 ${
          open ? "" : "line-clamp-5"
        }`}
      >
        {c.content}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {long ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {open
              ? t("documents.chunks.collapse", "Згорнути")
              : t("documents.chunks.expand", "Показати повністю")}
          </button>
        ) : (
          <span />
        )}
        <span
          className="font-mono text-theme-xs text-gray-400 dark:text-gray-500"
          title={`${t("documents.chunks.pointId", "ID чанка / точки Qdrant")}: ${c.id}\nSHA-256: ${c.content_hash}\n${c.chunking_version}${c.embedding_model ? ` · ${c.embedding_model}` : ""}`}
        >
          {c.id.slice(0, 8)}…
        </span>
      </div>
    </li>
  );
}

/** Paged chunk viewer. Mounted only when expanded, so nothing is fetched until the user asks. */
export function DocumentChunksList({ documentId, active }: Props) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(CHUNKS_PAGE_SIZE);

  const q = useGetDocumentChunksQuery(
    { id: documentId, page, size },
    { pollingInterval: active ? POLL_INTERVAL_MS : 0, skipPollingIfUnfocused: true },
  );

  // Same rule as the documents list: only a real page switch greys out the controls,
  // background polls stay invisible.
  const isSwitching = q.isFetching && q.currentData === undefined;
  const total = q.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / size));

  return (
    <div className="space-y-3">
      {q.isLoading && (
        <div className="flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400">
          <SpinnerIcon className="size-4" />
          {t("common.loading")}
        </div>
      )}

      {q.error && (
        <Alert>
          {(q.error as { message?: string }).message ??
            t("documents.chunks.loadError", "Не вдалося завантажити чанки")}
        </Alert>
      )}

      {q.data && q.data.items.length === 0 && (
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          {t("documents.chunks.empty", "Чанків ще немає — документ не пройшов етап чанкінгу.")}
        </p>
      )}

      {q.data && q.data.items.length > 0 && (
        <ul
          aria-busy={isSwitching}
          className={`max-h-[28rem] divide-y divide-gray-100 overflow-auto rounded-xl border border-gray-200 transition-opacity dark:divide-white/5 dark:border-white/5 ${
            isSwitching ? "opacity-60" : ""
          }`}
        >
          {q.data.items.map((c) => (
            <ChunkCard key={c.id} chunk={c} />
          ))}
        </ul>
      )}

      {total > size && (
        <Pagination
          page={page}
          pages={pageCount}
          total={total}
          size={size}
          totalLabel={t("documents.chunks.total", {
            count: total,
            defaultValue: "Усього чанків: {{count}}",
          })}
          disabled={isSwitching}
          onPage={setPage}
          onSize={(s) => {
            setSize(s);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
