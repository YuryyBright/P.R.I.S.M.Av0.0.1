import { useTranslation } from "react-i18next";
import { Alert } from "@/shared/ui/Alert";
import { MAX_FILE_MB } from "../constants/documents.constants";
import type { UploadResult } from "../types/document.types";
import { XIcon } from "./DocumentIcons";

/** Shows only the problems; successful files simply appear in the list. */
export function UploadResults({
  results,
  onDismiss,
}: {
  results: UploadResult[];
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) return null;

  return (
    <Alert>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="font-medium">
            {t("documents.upload.failedTitle", {
              count: failed.length,
              defaultValue: "Не вдалося завантажити файлів: {{count}}",
            })}
          </p>
          <ul className="space-y-1 text-theme-sm">
            {failed.map((r, i) => (
              <li key={`${r.name}-${i}`} className="wrap-break-word">
                <span className="font-medium">{r.name}</span>:{" "}
                {r.code === "server" && r.message
                  ? r.message
                  : t(`documents.upload.errors.${r.code ?? "server"}`, {
                      max: MAX_FILE_MB,
                    })}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          className="-m-1 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:hover:bg-white/10"
          onClick={onDismiss}
          aria-label={t("common.close")}
        >
          <XIcon />
        </button>
      </div>
    </Alert>
  );
}
