import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/shared/ui/Alert";
import { formatDateTime } from "@/shared/lib/date";
import type { UUID } from "@/shared/types/api";
import {
  documentsApi,
  useGetDocumentChunkQuery,
} from "../api/documents.endpoints";
import { useCopy } from "../hooks/useCopy";
import { queryErrorMessage } from "../lib/errors";
import { iconBtnOutlined, mutedText } from "../lib/styles";
import type { ChunkItem } from "../types/document.types";
import { Highlight } from "./Highlight";
import { InlineLoading } from "./InlineLoading";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  SpinnerIcon,
} from "./DocumentIcons";

interface Props {
  documentId: UUID;
  index: number;
  total: number;
  q: string;
  onNavigate: (index: number) => void;
  /** Mobile only: go back to the list. */
  onBack: () => void;
}

function Fact({
  label,
  children,
  mono,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className={`text-theme-xs ${mutedText}`}>{label}</dt>
      <dd
        className={`mt-0.5 truncate text-theme-sm text-gray-800 dark:text-white/90 ${mono ? "font-mono text-theme-xs" : ""}`}
      >
        {children ?? "—"}
      </dd>
    </div>
  );
}

function pageLabel(c: ChunkItem): string | null {
  if (c.page_number == null) return null;
  return c.page_end != null && c.page_end !== c.page_number
    ? `${c.page_number}–${c.page_end}`
    : String(c.page_number);
}

export function ChunkReader({
  documentId,
  index,
  total,
  q,
  onNavigate,
  onBack,
}: Props) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy<"text" | "id">();
  const prefetch = documentsApi.usePrefetch("getDocumentChunk");

  const res = useGetDocumentChunkQuery({ id: documentId, index });
  // Keep showing the previous chunk (dimmed) while the next one loads — no blank flash.
  const chunk = res.data;
  const switching = res.isFetching && res.currentData === undefined;

  useEffect(() => {
    if (index + 1 < total)
      prefetch({ id: documentId, index: index + 1 }, { ifOlderThan: 60 });
    if (index > 0)
      prefetch({ id: documentId, index: index - 1 }, { ifOlderThan: 60 });
  }, [documentId, index, total, prefetch]);

  const pg = chunk ? pageLabel(chunk) : null;

  return (
    <article
      className="flex min-w-0 flex-col"
      aria-label={t("documents.chunks.reader", "Текст чанка")}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3 sm:px-5 dark:border-white/5">
        <button
          type="button"
          onClick={onBack}
          className={`${iconBtnOutlined} lg:hidden`}
          aria-label={t("documents.chunks.backToList", "До списку")}
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
          {t("documents.chunks.chunk", "Чанк")} #{index}
          <span className="ms-2 font-normal text-gray-500 dark:text-gray-400">
            {t("documents.chunks.of", "з")} {total}
          </span>
        </h3>
        {switching && <SpinnerIcon className="size-4 text-gray-400" />}

        <div className="ms-auto flex items-center gap-2">
          <span className="hidden text-theme-xs text-gray-400 xl:inline dark:text-gray-500">
            {t("documents.chunks.keys", "← → — перемикання")}
          </span>
          <button
            type="button"
            className={iconBtnOutlined}
            disabled={!chunk}
            onClick={() => chunk && copy("text", chunk.content)}
            aria-label={t("documents.chunks.copyText", "Копіювати текст")}
            title={
              copied === "text"
                ? t("documents.chunks.copied", "Скопійовано")
                : t("documents.chunks.copyText", "Копіювати текст")
            }
          >
            <CopyIcon className="size-4" />
          </button>
          <button
            type="button"
            className={iconBtnOutlined}
            disabled={index <= 0}
            onClick={() => onNavigate(index - 1)}
            aria-label={t("documents.chunks.prev", "Попередній чанк")}
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            type="button"
            className={iconBtnOutlined}
            disabled={index + 1 >= total}
            onClick={() => onNavigate(index + 1)}
            aria-label={t("documents.chunks.next", "Наступний чанк")}
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      </header>

      <span className="sr-only" aria-live="polite">
        {copied === "text" ? t("documents.chunks.copied", "Скопійовано") : ""}
      </span>

      {res.error && !chunk && (
        <div className="space-y-3 p-5">
          <Alert>
            {queryErrorMessage(
              res.error,
              t(
                "documents.chunks.chunkError",
                "Чанк не знайдено. Можливо, документ щойно переіндексували.",
              ),
            )}
          </Alert>
          {index > 0 && (
            <button
              type="button"
              className="text-theme-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              onClick={() => onNavigate(0)}
            >
              {t("documents.chunks.toFirst", "Перейти до першого чанка")}
            </button>
          )}
        </div>
      )}

      {!chunk && !res.error && <InlineLoading className="p-5" />}

      {chunk && (
        <div
          className={`space-y-5 px-4 py-5 transition-opacity sm:px-5 ${switching ? "opacity-50" : ""}`}
        >
          {chunk.heading_path.length > 0 && (
            <nav
              aria-label={t("documents.chunks.headingPath", "Розділ документа")}
            >
              <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-theme-xs text-gray-500 dark:text-gray-400">
                {chunk.heading_path.map((h, i) => (
                  <li key={i} className="flex min-w-0 items-center gap-1.5">
                    {i > 0 && (
                      <ChevronRightIcon className="size-3 text-gray-300 dark:text-gray-600" />
                    )}
                    <span
                      className={`wrap-break-word ${i === chunk.heading_path.length - 1 ? "font-medium text-gray-700 dark:text-gray-200" : ""}`}
                    >
                      {h}
                    </span>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="max-w-[72ch] text-[15px] leading-7 wrap-break-word whitespace-pre-wrap text-gray-800 dark:text-gray-200">
            <Highlight text={chunk.content} q={q} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-4 sm:grid-cols-3 dark:border-white/5">
            <Fact label={t("documents.chunks.factTokens", "Токени")}>
              {chunk.token_count.toLocaleString()}
            </Fact>
            <Fact
              label={t("documents.chunks.factChars", "Символи в документі")}
            >
              {chunk.char_start != null && chunk.char_end != null
                ? `${chunk.char_start.toLocaleString()}–${chunk.char_end.toLocaleString()}`
                : null}
            </Fact>
            <Fact label={t("documents.chunks.factPage", "Сторінка")}>{pg}</Fact>
            <Fact label={t("documents.chunks.factIndexed", "Індексація")}>
              {chunk.is_indexed
                ? `${t("documents.chunks.indexed", "У векторній БД")}${chunk.indexed_at ? ` · ${formatDateTime(chunk.indexed_at)}` : ""}`
                : t("documents.chunks.notIndexed", "Не проіндексовано")}
            </Fact>
            <Fact
              label={t("documents.chunks.factModel", "Модель ембедингу")}
              mono
            >
              {chunk.embedding_model}
            </Fact>
            <Fact
              label={t("documents.chunks.factVersion", "Версія чанкінгу")}
              mono
            >
              {chunk.chunking_version}
            </Fact>
            <div className="col-span-2 min-w-0 sm:col-span-3">
              <dt className={`text-theme-xs ${mutedText}`}>
                {t("documents.chunks.factId", "ID чанка (= точка в Qdrant)")}
              </dt>
              <dd className="mt-0.5 flex items-center gap-2">
                <code className="min-w-0 truncate font-mono text-theme-xs text-gray-800 dark:text-white/90">
                  {chunk.id}
                </code>
                <button
                  type="button"
                  onClick={() => copy("id", chunk.id)}
                  className="shrink-0 text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  {copied === "id"
                    ? t("documents.chunks.copied", "Скопійовано")
                    : t("documents.chunks.copy", "Копіювати")}
                </button>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </article>
  );
}
