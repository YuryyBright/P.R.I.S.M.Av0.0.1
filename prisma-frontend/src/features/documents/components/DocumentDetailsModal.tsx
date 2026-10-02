import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/shared/ui/Alert";
import { Modal } from "@/shared/ui/Modal";
import { btnSecondary } from "@/shared/ui/classes";
import { formatDateTime } from "@/shared/lib/date";
import { POLL_INTERVAL_MS } from "../constants/documents.constants";
import { useGetDocumentDetailsQuery } from "../api/documents.endpoints";
import { formatBytes, isActiveStatus } from "../lib/documentFormat";
import type { DocumentItem } from "../types/document.types";
import { SpinnerIcon, btnContent } from "./DocumentIcons";
import { DocumentStatusBadge } from "./DocumentStatusBadge";

interface Props {
  /** Row from the list: shown instantly while the full card loads. */
  document: DocumentItem;
  onClose: () => void;
}

const EMPTY = "—";
const dt = (v: string | null | undefined) => (v ? formatDateTime(v) : EMPTY);

/** Only http(s) URLs become links — a `javascript:` URL from parsed content must stay inert text. */
const isHttpUrl = (v: string) => /^https?:\/\//i.test(v);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-theme-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {title}
      </h3>
      <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-white/5 dark:border-white/5">
        {children}
      </dl>
    </section>
  );
}

function Row({
  label,
  children,
  mono,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-3 sm:gap-4">
      <dt className="text-theme-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd
        className={`min-w-0 text-theme-sm wrap-break-word text-gray-800 sm:col-span-2 dark:text-white/90 ${
          mono ? "font-mono text-theme-xs" : ""
        }`}
      >
        {children === null || children === undefined || children === "" ? EMPTY : children}
      </dd>
    </div>
  );
}

export function DocumentDetailsModal({ document: doc, onClose }: Props) {
  const { t } = useTranslation();
  const { data, error, isLoading, isFetching } = useGetDocumentDetailsQuery(doc.id, {
    // Keep the card live while the worker is still processing the document.
    pollingInterval: isActiveStatus(doc.status) ? POLL_INTERVAL_MS : 0,
  });

  // Live status from the card wins over the (possibly stale) list row.
  const status = data?.status ?? doc.status;
  const metaEntries = data ? Object.keys(data.meta ?? {}) : [];

  return (
    <Modal
      open
      onClose={onClose}
      title={t("documents.details.title", "Інформація про документ")}
      footer={
        <div className="flex w-full justify-end">
          <button
            type="button"
            className={`${btnSecondary} ${btnContent} w-full sm:w-auto`}
            onClick={onClose}
          >
            {t("common.close", "Закрити")}
          </button>
        </div>
      }
    >
      <div className="space-y-5" aria-busy={isLoading || isFetching}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-base font-medium wrap-break-word text-gray-800 dark:text-white/90">
            {data?.title ?? doc.title}
          </p>
          <DocumentStatusBadge status={status} />
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400">
            <SpinnerIcon className="size-4" />
            {t("common.loading")}
          </div>
        )}

        {error && (
          <Alert>
            {(error as { message?: string }).message ??
              t("documents.details.loadError", "Не вдалося завантажити інформацію про документ")}
          </Alert>
        )}

        {data && (
          <>
            <Section title={t("documents.details.sections.general", "Загальне")}>
              <Row label={t("documents.details.filename", "Файл")}>{data.filename}</Row>
              <Row label={t("documents.details.mime", "Тип (MIME)")} mono>
                {data.mime_type}
              </Row>
              <Row label={t("documents.table.columns.size")}>{formatBytes(data.size_bytes)}</Row>
              <Row label={t("documents.details.collection", "Колекція")}>
                {data.collection_name ?? data.collection_id}
              </Row>
              <Row label={t("documents.details.language", "Мова")}>{data.language}</Row>
              <Row label={t("documents.details.author", "Автор")}>{data.author}</Row>
              <Row label={t("documents.details.url", "Посилання")}>
                {data.url && isHttpUrl(data.url) ? (
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {data.url}
                  </a>
                ) : (
                  data.url
                )}
              </Row>
              <Row label={t("documents.details.publishedAt", "Опубліковано")}>
                {dt(data.published_at)}
              </Row>
            </Section>

            <Section title={t("documents.details.sections.source", "Джерело")}>
              <Row label={t("documents.details.sourceType", "Тип джерела")}>
                {t(`documents.sourceType.${data.source_type}`, {
                  defaultValue: data.source_type,
                })}
              </Row>
              <Row label={t("documents.details.externalId", "Зовнішній ID")} mono>
                {data.external_id}
              </Row>
              <Row label={t("documents.details.sourceId", "ID джерела")} mono>
                {data.source_id}
              </Row>
            </Section>

            <Section title={t("documents.details.sections.indexing", "Індексація")}>
              <Row label={t("documents.details.chunks", "Чанки")}>
                {t("documents.details.chunksValue", {
                  indexed: data.chunks.indexed,
                  total: data.chunks.total,
                  defaultValue: "{indexed} з {total} проіндексовано",
                })}
              </Row>
              <Row label={t("documents.details.tokens", "Токени")}>
                {data.chunks.total_tokens.toLocaleString()}
              </Row>
              <Row label={t("documents.details.pages", "Сторінок")}>{data.chunks.max_page}</Row>
              <Row label={t("documents.details.embeddingModel", "Модель ембедингу")} mono>
                {data.chunks.embedding_models.join(", ")}
              </Row>
              <Row label={t("documents.details.chunkingVersion", "Версія чанкінгу")} mono>
                {data.chunks.chunking_versions.join(", ")}
              </Row>
              <Row label={t("documents.details.version", "Версія документа")}>{data.version}</Row>
              <Row label={t("documents.details.indexedAt", "Проіндексовано")}>
                {dt(data.indexed_at)}
              </Row>
            </Section>

            <Section title={t("documents.details.sections.technical", "Технічне")}>
              <Row label="ID" mono>
                {data.id}
              </Row>
              <Row label={t("documents.details.hash", "SHA-256")} mono>
                {data.content_hash}
              </Row>
              <Row label={t("documents.details.hasOriginal", "Оригінал у сховищі")}>
                {data.has_original ? t("common.yes", "Так") : t("common.no", "Ні")}
              </Row>
              {data.storage_path && (
                <Row label={t("documents.details.storagePath", "Шлях у сховищі")} mono>
                  {data.storage_path}
                </Row>
              )}
              {(data.owner_email || data.owner_id) && (
                <Row label={t("documents.details.owner", "Власник")}>
                  {data.owner_email ?? data.owner_id}
                </Row>
              )}
              {data.acl_count !== null && (
                <Row label={t("documents.details.acl", "Персональних доступів")}>
                  {data.acl_count}
                </Row>
              )}
              <Row label={t("documents.table.columns.added")}>{dt(data.created_at)}</Row>
              <Row label={t("documents.details.updatedAt", "Оновлено")}>{dt(data.updated_at)}</Row>
            </Section>

            {metaEntries.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-theme-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  {t("documents.details.sections.meta", "Метадані (meta)")}
                </h3>
                <pre className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-theme-xs text-gray-700 dark:border-white/5 dark:bg-white/3 dark:text-gray-300">
                  {JSON.stringify(data.meta, null, 2)}
                </pre>
              </section>
            )}

            {data.recent_jobs.length > 0 && (
              <Section title={t("documents.details.sections.jobs", "Останні задачі")}>
                {data.recent_jobs.map((j) => (
                  <Row key={j.id} label={j.job_type}>
                    <span className="mr-2">{j.status}</span>
                    <span className="text-gray-500 dark:text-gray-400">{dt(j.created_at)}</span>
                  </Row>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
