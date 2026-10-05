import type { AiAttachment } from "../types/ai.types";

interface Props {
  attachments: AiAttachment[];
  onRemove: (index: number) => void;
}

export function AttachmentStrip({ attachments, onRemove }: Props) {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-gray-100 px-4 py-3 dark:border-gray-800">
      {attachments.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="group flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-xs shadow-sm dark:bg-gray-900">
            {file.kind === "image"
              ? "IMG"
              : file.kind === "video"
                ? "VID"
                : "DOC"}
          </span>

          <div className="min-w-0">
            <p className="max-w-40 truncate text-xs font-medium text-gray-800 dark:text-white/90">
              {file.name}
            </p>

            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>

          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={() => onRemove(index)}
            className="ml-1 rounded-md px-1.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
