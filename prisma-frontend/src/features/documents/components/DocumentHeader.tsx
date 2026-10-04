import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatBytes } from "../lib/documentFormat";
import { mutedText, surface } from "../lib/styles";
import type { DocumentDetails } from "../types/document.types";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { FileTile } from "./FileTile";

interface Props {
  data: DocumentDetails;
  /** Row of action buttons (rename / reindex / delete); omitted for read-only users. */
  actions?: ReactNode;
}

export function DocumentHeader({ data, actions }: Props) {
  const { t } = useTranslation();
  const { chunks } = data;

  const facts = [
    formatBytes(data.size_bytes),
    chunks.total > 0 &&
      `${chunks.total.toLocaleString()} ${t("documents.detail.chunksWord", "чанків")}`,
    chunks.total_tokens > 0 &&
      `${chunks.total_tokens.toLocaleString()} ${t("documents.chunks.tokens", "ток.")}`,
    chunks.max_page &&
      `${chunks.max_page} ${t("documents.detail.pagesWord", "стор.")}`,
  ].filter(Boolean);

  const showFilename = data.filename && data.filename !== data.title;

  return (
    <header
      className={`${surface} flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <FileTile size="lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-title-sm font-semibold wrap-break-word text-gray-800 dark:text-white/90">
            {data.title}
          </h1>
          {showFilename && (
            <p
              title={data.filename ?? undefined}
              className={`truncate text-theme-sm ${mutedText}`}
            >
              {data.filename}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <DocumentStatusBadge status={data.status} />
            {facts.length > 0 && (
              <span className={`text-theme-xs tabular-nums ${mutedText}`}>
                {facts.join(" · ")}
              </span>
            )}
          </div>
        </div>
      </div>
      {actions}
    </header>
  );
}
