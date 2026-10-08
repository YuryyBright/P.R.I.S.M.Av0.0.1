import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { COLLECTIONS_ROUTES } from "@/features/collections";
import { formatDateTime } from "@/shared/lib/date";
import { Alert } from "@/shared/ui/Alert";
import { Modal } from "@/shared/ui/Modal";
import { btnSecondary } from "@/shared/ui/classes";
import { useGetJobByIdQuery } from "../api/jobs.endpoints";
import { POLL_INTERVAL_MS, STAGE_ORDER } from "../constants/jobs.constants";
import { formatDuration, isActiveJob, jobTypeLabel } from "../lib/jobFormat";
import type { JobListItem, JobStage, StageStatus } from "../types/job.types";
import { AlertTriangleIcon, CheckIcon, SpinnerIcon, XIcon } from "./JobIcons";
import { JobProgress } from "./JobProgress";
import { JobStatusBadge } from "./JobStatusBadge";

interface Props {
  /** Row from the list: gives an instant first paint (title, status) before GET /jobs/{id} returns. */
  job: JobListItem;
  onClose: () => void;
}

const skeleton =
  "animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5";

const STAGE_DOT: Record<StageStatus, string> = {
  pending: "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500",
  processing: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
  completed:
    "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400",
  failed: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
  skipped: "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500",
};

function StageDot({ status }: { status: StageStatus }) {
  const cls = STAGE_DOT[status] ?? STAGE_DOT.pending;
  return (
    <span
      aria-hidden="true"
      className={`flex size-7 shrink-0 items-center justify-center rounded-full ${cls}`}
    >
      {status === "completed" ? (
        <CheckIcon className="size-4" />
      ) : status === "failed" ? (
        <XIcon className="size-4" />
      ) : status === "processing" ? (
        <SpinnerIcon className="size-4" />
      ) : (
        <span className="size-1.5 rounded-full bg-current" />
      )}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-theme-sm text-gray-800 tabular-nums dark:text-white/90">
        {value}
      </dd>
    </div>
  );
}

export function JobDetailsModal({ job, onClose }: Props) {
  const { t } = useTranslation();

  const q = useGetJobByIdQuery(job.id);
  const { refetch } = q;

  const live = q.data ?? job;
  const active = isActiveJob(live.status);
  // The timer is an external subscription; stop it as soon as the server marks the job terminal.
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      void refetch();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [active, refetch]);

  // Always show the whole pipeline: stages that haven't started yet have no row -> "pending".
  const byName = new Map<string, JobStage>(
    (q.data?.stages ?? []).map((s) => [s.stage, s]),
  );
  const names = [
    ...STAGE_ORDER,
    ...[...byName.keys()].filter((n) => !STAGE_ORDER.includes(n as never)),
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={t("jobs.details.title", "Деталі job-а")}
      footer={
        <button
          type="button"
          className={`${btnSecondary} w-full sm:w-auto`}
          onClick={onClose}
        >
          {t("common.close")}
        </button>
      }
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-theme-sm font-medium wrap-break-word text-gray-800 dark:text-white/90">
            {job.document_title ??
              (job.collection_id ? (
                <Link
                  to={COLLECTIONS_ROUTES.detail(job.collection_id)}
                  title={job.collection_id}
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  {t("jobs.table.collectionReference", "Колекція")}: {job.collection_id.slice(0, 8)}…
                </Link>
              ) : (
                t("jobs.table.noDocument", "Без пов’язаного документа")
              ))}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <JobStatusBadge status={live.status} />
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              {t(`jobs.type.${live.job_type}`, {
                defaultValue: jobTypeLabel(live.job_type),
              })}
            </span>
          </div>
          <JobProgress job={live} />
        </div>

        {(live.error_code || live.error_message) && (
          <Alert>
            <div className="flex items-start gap-2">
              <AlertTriangleIcon className="mt-0.5 size-4" />
              <div className="min-w-0 space-y-1">
                {live.error_code && (
                  <p className="font-mono text-theme-xs">{live.error_code}</p>
                )}
                {live.error_message && (
                  <p className="text-theme-sm wrap-break-word whitespace-pre-wrap">
                    {live.error_message}
                  </p>
                )}
              </div>
            </div>
          </Alert>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Fact
            label={t("jobs.details.created", "Створено")}
            value={formatDateTime(live.created_at)}
          />
          <Fact
            label={t("jobs.details.started", "Початок")}
            value={live.started_at ? formatDateTime(live.started_at) : "—"}
          />
          <Fact
            label={t("jobs.details.finished", "Завершено")}
            value={live.finished_at ? formatDateTime(live.finished_at) : "—"}
          />
          <Fact
            label={t("jobs.table.columns.duration")}
            value={formatDuration(live.started_at, live.finished_at)}
          />
          <Fact
            label={t("jobs.details.retries", "Повторів")}
            value={String(live.retry_count)}
          />
        </dl>

        <section aria-labelledby="job-stages-title">
          <h3
            id="job-stages-title"
            className="mb-3 text-theme-sm font-semibold text-gray-800 dark:text-white/90"
          >
            {t("jobs.details.stages", "Етапи")}
          </h3>

          {q.isLoading ? (
            <div aria-busy="true" className="space-y-3">
              <span className="sr-only">{t("common.loading")}</span>
              {STAGE_ORDER.map((n) => (
                <div key={n} className={`${skeleton} h-9 w-full`} />
              ))}
            </div>
          ) : q.error ? (
            <Alert>
              {(q.error as { message?: string }).message ??
                t("jobs.loadError", "Не вдалося завантажити job-и.")}
            </Alert>
          ) : (
            <ol className="space-y-3">
              {names.map((name) => {
                const s = byName.get(name);
                const status: StageStatus = s?.status ?? "pending";
                return (
                  <li key={name} className="flex items-start gap-3">
                    <StageDot status={status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                          {t(`jobs.stage.${name}`, { defaultValue: name })}
                        </p>
                        <p className="text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
                          {t(`jobs.stageStatus.${status}`, {
                            defaultValue: status,
                          })}
                          {s && s.items_total > 0 && (
                            <span className="ms-2">
                              {s.items_processed} / {s.items_total}
                            </span>
                          )}
                          {s?.started_at && (
                            <span className="ms-2">
                              {formatDuration(s.started_at, s.finished_at)}
                            </span>
                          )}
                        </p>
                      </div>
                      {s?.error_message && (
                        <p className="mt-1 text-theme-xs wrap-break-word text-error-600 dark:text-error-400">
                          {s.error_message}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </Modal>
  );
}
