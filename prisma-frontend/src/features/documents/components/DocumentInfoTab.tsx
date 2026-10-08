import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/shared/lib/date";
import { formatBytes } from "../lib/documentFormat";
import { mutedText, sectionLabel } from "../lib/styles";
import { jobTypeLabel } from "@/features/jobs/lib/jobFormat";
import type { DocumentDetails } from "../types/document.types";

const EMPTY = "—";
const dt = (v: string | null | undefined) => (v ? formatDateTime(v) : EMPTY);

/** Only http(s) URLs become links — a `javascript:` URL from parsed content must stay inert text. */
const isHttpUrl = (v: string) => /^https?:\/\//i.test(v);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className={sectionLabel}>{title}</h3>
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
      <dt className={`text-theme-sm ${mutedText}`}>{label}</dt>
      <dd
        className={`min-w-0 text-theme-sm wrap-break-word text-gray-800 sm:col-span-2 dark:text-white/90 ${
          mono ? "font-mono text-theme-xs" : ""
        }`}
      >
        {children === null || children === undefined || children === ""
          ? EMPTY
          : children}
      </dd>
    </div>
  );
}

export function DocumentInfoTab({ data }: { data: DocumentDetails }) {
  const { t } = useTranslation();
  const metaEntries = Object.keys(data.meta ?? {});

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Section title={t("documents.details.sections.general", "Загальне")}>
        <Row label={t("documents.details.filename", "Файл")}>
          {data.filename}
        </Row>
        <Row label={t("documents.details.mime", "Тип (MIME)")} mono>
          {data.mime_type}
        </Row>
        <Row label={t("documents.table.columns.size")}>
          {formatBytes(data.size_bytes)}
        </Row>
        <Row label={t("documents.details.collection", "Колекція")}>
          {data.collection_name ?? data.collection_id}
        </Row>
        <Row label={t("documents.details.language", "Мова")}>
          {data.language}
        </Row>
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
        <Row label={t("documents.details.pages", "Сторінок")}>
          {data.chunks.max_page}
        </Row>
        <Row
          label={t("documents.details.embeddingModel", "Модель ембедингу")}
          mono
        >
          {data.chunks.embedding_models.join(", ")}
        </Row>
        <Row
          label={t("documents.details.chunkingVersion", "Версія чанкінгу")}
          mono
        >
          {data.chunks.chunking_versions.join(", ")}
        </Row>
        <Row label={t("documents.details.version", "Версія документа")}>
          {data.version}
        </Row>
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
          <Row
            label={t("documents.details.storagePath", "Шлях у сховищі")}
            mono
          >
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
        <Row label={t("documents.table.columns.added")}>
          {dt(data.created_at)}
        </Row>
        <Row label={t("documents.details.updatedAt", "Оновлено")}>
          {dt(data.updated_at)}
        </Row>
      </Section>

      {metaEntries.length > 0 && (
        <section className="space-y-2">
          <h3 className={sectionLabel}>
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
            <Row key={j.id} label={t(`jobs.type.${j.job_type}`, { defaultValue: jobTypeLabel(j.job_type) })}>
              <span className="me-2">{t(`jobs.status.${j.status}`, { defaultValue: j.status })}</span>
              <span className={mutedText}>{dt(j.created_at)}</span>
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}
