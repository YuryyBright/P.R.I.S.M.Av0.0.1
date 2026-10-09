import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { COLLECTIONS_ROUTES } from "@/features/collections";
import { formatDateTime } from "@/shared/lib/date";
import { formatDuration, jobTypeLabel } from "../lib/jobFormat";
import type { JobListItem } from "../types/job.types";
import { JobActions } from "./JobActions";
import { QueueIcon } from "./JobIcons";
import { JobProgress } from "./JobProgress";
import { JobStatusBadge } from "./JobStatusBadge";

interface Props {
  rows: JobListItem[];
  isLoading: boolean;
  isFiltered?: boolean;
  onDetails: (job: JobListItem) => void;
  onCancel: (job: JobListItem) => void;
  onRetry: (job: JobListItem) => void;
}

const th =
  "px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400";
const td =
  "px-5 py-4 align-middle text-theme-sm text-gray-700 dark:text-gray-300";
const surface =
  "overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3";
const cardInteractive =
  "group/card relative transition-all duration-200 hover:border-brand-200 hover:shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/15 dark:hover:border-brand-500/30 dark:focus-within:border-brand-500/40 dark:focus-within:ring-brand-500/10";
const skeleton =
  "animate-pulse rounded-md bg-gray-100 motion-reduce:animate-none dark:bg-white/5";
const docLink =
  "rounded font-medium text-gray-800 underline-offset-4 transition-colors hover:text-brand-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-white/90 dark:hover:text-brand-400";

function JobTile() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 ring-1 ring-gray-200/70 transition-colors ring-inset group-hover/card:bg-brand-50 group-hover/card:text-brand-500 group-hover/card:ring-brand-200 group-hover/row:bg-brand-50 group-hover/row:text-brand-500 group-hover/row:ring-brand-200 dark:bg-white/5 dark:text-gray-400 dark:ring-white/5 dark:group-hover/card:bg-brand-500/15 dark:group-hover/card:text-brand-400 dark:group-hover/card:ring-brand-500/20 dark:group-hover/row:bg-brand-500/15 dark:group-hover/row:text-brand-400 dark:group-hover/row:ring-brand-500/20">
      <QueueIcon className="size-5" />
    </span>
  );
}

/** Document title (link to its collection) + job type underneath. */
function JobTitle({ job, wrap }: { job: JobListItem; wrap?: boolean }) {
  const { t } = useTranslation();
  const typeLabel = t(`jobs.type.${job.job_type}`, {
    defaultValue: jobTypeLabel(job.job_type),
  });
  const textCls = wrap ? "wrap-break-word" : "max-w-md truncate";

  return (
    <div className="min-w-0">
      {job.document_title ? (
        job.collection_id ? (
          <Link
            to={COLLECTIONS_ROUTES.detail(job.collection_id)}
            className={`${docLink} block ${textCls}`}
            title={job.document_title}
          >
            {job.document_title}
          </Link>
        ) : (
          <p
            className={`${textCls} font-medium text-gray-800 dark:text-white/90`}
            title={job.document_title}
          >
            {job.document_title}
          </p>
        )
      ) : job.collection_id ? (
        <Link
          to={COLLECTIONS_ROUTES.detail(job.collection_id)}
          className={`${docLink} block ${textCls}`}
          title={job.collection_id}
        >
          {t("jobs.table.collectionReference", "Колекція")}:{" "}
          {job.collection_id.slice(0, 8)}…
        </Link>
      ) : (
        <p className="text-gray-400 italic dark:text-gray-500">
          {t("jobs.table.noDocument", "Без пов’язаного документа")}
        </p>
      )}
      <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
        {typeLabel}
        {job.retry_count > 0 && (
          <span className="ms-2">
            ·{" "}
            {t("jobs.table.retries", {
              count: job.retry_count,
              defaultValue: "повторів: {count}",
            })}
          </span>
        )}
      </p>
    </div>
  );
}

function EmptyState({ isFiltered }: { isFiltered?: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className={`${surface} flex flex-col items-center px-6 py-14 text-center`}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-200/70 ring-inset dark:bg-white/5 dark:text-gray-500 dark:ring-white/5">
        <QueueIcon className="size-6" />
      </span>
      <h2 className="mt-4 text-theme-sm font-medium text-gray-800 dark:text-white/90">
        {t("jobs.table.empty", "Job-ів поки немає")}
      </h2>
      <p className="mt-1 max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
        {isFiltered
          ? t(
              "jobs.table.emptyFiltered",
              "Немає job-ів з таким статусом. Змініть фільтр, щоб побачити інші.",
            )
          : t(
              "jobs.table.emptyHint",
              "Тут з'являться завдання індексації після завантаження або переіндексації документів.",
            )}
      </p>
    </div>
  );
}

function DesktopSkeletonRows() {
  const { t } = useTranslation();
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <tr key={i}>
          <td className={td}>
            <div className="flex items-center gap-3">
              <div className={`${skeleton} size-10 rounded-xl`} />
              <div className="space-y-2">
                <div className={`${skeleton} h-3.5 w-48`} />
                <div className={`${skeleton} h-3 w-24`} />
              </div>
            </div>
            {i === 0 && <span className="sr-only">{t("common.loading")}</span>}
          </td>
          <td className={td}>
            <div className={`${skeleton} h-5 w-24 rounded-full`} />
          </td>
          <td className={td}>
            <div className={`${skeleton} h-3.5 w-36`} />
          </td>
          <td className={td}>
            <div className={`${skeleton} h-3.5 w-28`} />
          </td>
          <td className={td}>
            <div className={`${skeleton} h-3.5 w-14`} />
          </td>
          <td className={td} />
        </tr>
      ))}
    </>
  );
}

function CardSkeletons() {
  const { t } = useTranslation();
  return (
    <>
      {[0, 1, 2].map((i) => (
        <li key={i} className={`${surface} p-4`}>
          <div className="flex items-center gap-3">
            <div className={`${skeleton} size-10 rounded-xl`} />
            <div className="flex-1 space-y-2">
              <div className={`${skeleton} h-3.5 w-2/3`} />
              <div className={`${skeleton} h-3 w-1/3`} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <div className={`${skeleton} h-5 w-20 rounded-full`} />
          </div>
          {i === 0 && <span className="sr-only">{t("common.loading")}</span>}
        </li>
      ))}
    </>
  );
}

export function JobsTable({
  rows,
  isLoading,
  isFiltered,
  onDetails,
  onCancel,
  onRetry,
}: Props) {
  const { t } = useTranslation();

  if (!isLoading && rows.length === 0) {
    return <EmptyState isFiltered={isFiltered} />;
  }

  return (
    <div aria-busy={isLoading}>
      {/* Desktop / tablet */}
      <div className={`${surface} hidden md:block`}>
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-full">
            <caption className="sr-only">
              {t("jobs.table.caption", "Список job-ів індексації")}
            </caption>
            <thead className="border-b border-gray-100 dark:border-white/5">
              <tr>
                <th scope="col" className={th}>
                  {t("jobs.table.columns.job")}
                </th>
                <th scope="col" className={th}>
                  {t("jobs.table.columns.status")}
                </th>
                <th scope="col" className={th}>
                  {t("jobs.table.columns.progress")}
                </th>
                <th scope="col" className={th}>
                  {t("jobs.table.columns.created")}
                </th>
                <th scope="col" className={th}>
                  {t("jobs.table.columns.duration")}
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">
                    {t("jobs.table.columns.actions", "Дії")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {isLoading ? (
                <DesktopSkeletonRows />
              ) : (
                rows.map((j) => (
                  <tr
                    key={j.id}
                    className="group/row transition-colors focus-within:bg-brand-50/40 hover:bg-brand-50/40 dark:focus-within:bg-brand-500/5 dark:hover:bg-brand-500/5"
                  >
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <JobTile />
                        <JobTitle job={j} />
                      </div>
                    </td>
                    <td className={td}>
                      <JobStatusBadge status={j.status} />
                    </td>
                    <td className={td}>
                      <JobProgress job={j} />
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {formatDateTime(j.created_at)}
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums`}>
                      {formatDuration(j.started_at, j.finished_at)}
                    </td>
                    <td className={`${td} text-end`}>
                      <JobActions
                        job={j}
                        variant="icon"
                        className="justify-end"
                        onDetails={() => onDetails(j)}
                        onCancel={() => onCancel(j)}
                        onRetry={() => onRetry(j)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile */}
      <ul className="space-y-3 md:hidden">
        {isLoading ? (
          <CardSkeletons />
        ) : (
          rows.map((j) => (
            <li key={j.id} className={`${surface} ${cardInteractive} p-4`}>
              <div className="flex items-start gap-3">
                <JobTile />
                <div className="min-w-0 flex-1">
                  <JobTitle job={j} wrap />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <JobStatusBadge status={j.status} />
                <span className="text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
                  {formatDuration(j.started_at, j.finished_at)}
                </span>
              </div>
              <JobProgress job={j} className="mt-3" />
              <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
                {formatDateTime(j.created_at)}
              </p>
              <JobActions
                job={j}
                variant="labeled"
                className="mt-4 flex-wrap border-t border-gray-100 pt-4 *:flex-1 dark:border-white/5"
                onDetails={() => onDetails(j)}
                onCancel={() => onCancel(j)}
                onRetry={() => onRetry(j)}
              />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
