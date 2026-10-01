import { useTranslation } from "react-i18next";
import { isActiveStatus } from "../lib/documentFormat";
import type { DocumentStatus } from "../types/document.types";

const base =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-theme-xs font-medium whitespace-nowrap";

interface Tone {
  badge: string;
  dot: string;
}

const NEUTRAL: Tone = {
  badge: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300",
  dot: "bg-gray-400 dark:bg-gray-500",
};
const ACTIVE: Tone = {
  badge: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  dot: "bg-brand-500",
};
const SUCCESS: Tone = {
  badge: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  dot: "bg-success-500",
};
const ERROR: Tone = {
  badge: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400",
  dot: "bg-error-500",
};
const MUTED: Tone = {
  badge: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400",
  dot: "bg-gray-300 dark:bg-gray-600",
};

const TONES: Record<DocumentStatus, Tone> = {
  pending: NEUTRAL,
  processing: ACTIVE,
  chunking: ACTIVE,
  embedding: ACTIVE,
  indexing: ACTIVE,
  ready: SUCCESS,
  failed: ERROR,
  deleted: MUTED,
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useTranslation();
  const tone = TONES[status];
  return (
    <span className={`${base} ${tone.badge}`}>
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${tone.dot} ${
          isActiveStatus(status) ? "animate-pulse motion-reduce:animate-none" : ""
        }`}
      />
      {t(`documents.status.${status}`)}
    </span>
  );
}
