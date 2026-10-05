import type { ReactNode } from "react";
import { FileIcon } from "./DocumentIcons";
import { mutedText, surface } from "../lib/styles";

interface Props {
  title: string;
  hint?: string;
  /** Replaces the default file icon (e.g. a spinner while a worker is busy). */
  icon?: ReactNode;
  action?: ReactNode;
}

/** Centered "nothing here" block shared by the list and the chunk viewer. */
export function EmptyState({ title, hint, icon, action }: Props) {
  return (
    <div
      className={`${surface} flex flex-col items-center px-6 py-14 text-center`}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-200/70 ring-inset dark:bg-white/5 dark:text-gray-500 dark:ring-white/5">
        {icon ?? <FileIcon className="size-6" />}
      </span>
      <h3 className="mt-4 text-theme-sm font-medium text-gray-800 dark:text-white/90">
        {title}
      </h3>
      {hint && (
        <p className={`mt-1 max-w-sm text-theme-sm ${mutedText}`}>{hint}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
