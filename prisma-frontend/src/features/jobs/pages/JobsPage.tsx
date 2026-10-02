import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Can } from "@/features/auth";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Pagination } from "@/shared/ui/Pagination";
import { CancelJobDialog } from "../components/CancelJobDialog";
import { JobDetailsModal } from "../components/JobDetailsModal";
import { JobsTable } from "../components/JobsTable";
import { JobsToolbar } from "../components/JobsToolbar";
import { JOB_PERMISSIONS } from "../constants/jobs.constants";
import { useJobActions } from "../hooks/useJobActions";
import { useJobsList } from "../hooks/useJobsList";
import type { JobListItem } from "../types/job.types";

/**
 * /jobs — own jobs + jobs of documents in collections where the user is editor/owner
 * (superusers see everything; see JOB_LIST_MIN_ROLE on the backend).
 * List + status filter + pagination, live-polling while something is running,
 * details (stages) in a modal, cancel / retry as row actions.
 */
export default function JobsPage() {
  const { t } = useTranslation();
  const list = useJobsList();
  const { retryJob } = useJobActions();

  const [details, setDetails] = useState<JobListItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<JobListItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRetry(job: JobListItem) {
    setActionError(null);
    try {
      await retryJob(job.id); // 202: a NEW job for the same document
      list.setPage(1); // new jobs are sorted first
    } catch (e) {
      // 409: already processing / not retryable, 404: document is gone
      setActionError(isNormalizedApiError(e) ? e.message : t("errors.unexpected"));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            {t("jobs.title", "Job-и")}
          </h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {t(
              "jobs.subtitle",
              "Стан обробки документів: парсинг, чанкінг, ембединг та індексація.",
            )}
          </p>
        </div>

        <JobsToolbar
          status={list.status}
          onStatus={list.setStatus}
          onRefresh={() => void list.refetch()}
          isFetching={list.isFetching}
          isPolling={list.isPolling}
        />
      </header>

      <Can
        permission={JOB_PERMISSIONS.read}
        fallback={<Alert>{t("jobs.noPermission", "Недостатньо прав для перегляду job-ів.")}</Alert>}
      >
        {list.error && (
          <Alert>
            {(list.error as { message?: string }).message ??
              t("jobs.loadError", "Не вдалося завантажити job-и.")}
          </Alert>
        )}

        {actionError && <Alert>{actionError}</Alert>}

        <JobsTable
          rows={list.rows}
          isLoading={list.isLoading}
          isFiltered={Boolean(list.status)}
          onDetails={setDetails}
          onCancel={setCancelTarget}
          onRetry={handleRetry}
        />

        <Pagination
          page={list.page}
          pages={list.pages}
          total={list.total}
          size={list.size}
          totalLabel={t("jobs.pagination.total", { count: list.total })}
          disabled={list.isFetching}
          onPage={list.setPage}
          onSize={list.setSize}
        />
      </Can>

      {details && (
        <JobDetailsModal
          key={details.id}
          job={details}
          onClose={() => setDetails(null)}
        />
      )}

      {cancelTarget && (
        <CancelJobDialog
          job={cancelTarget}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}
