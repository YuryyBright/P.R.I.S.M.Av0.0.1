import { useRef, useState } from "react";
import { ACCEPTED_AI_ATTACHMENTS } from "../constants/ai.constants";
import type { AiAttachment } from "../types/ai.types";
import { AttachmentStrip } from "./AttachmentStrip";

interface Props {
  disabled?: boolean;
  attachments: AiAttachment[];
  onAttachments: (items: AiAttachment[]) => void;
  onSubmit: (message: string) => void;
}

function fileKind(file: File): AiAttachment["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

export function ChatComposer({
  disabled,
  attachments,
  onAttachments,
  onSubmit,
}: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: File[]) {
    const accepted = files.filter((file) =>
      ACCEPTED_AI_ATTACHMENTS.includes(
        file.type as (typeof ACCEPTED_AI_ATTACHMENTS)[number],
      ),
    );

    onAttachments([
      ...attachments,
      ...accepted.map((file) => ({
        file,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        kind: fileKind(file),
      })),
    ]);
  }

  function submit() {
    const text = value.trim();

    if ((!text && !attachments.length) || disabled) {
      return;
    }

    onSubmit(text);
    setValue("");
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <AttachmentStrip
        attachments={attachments}
        onRemove={(index) =>
          onAttachments(attachments.filter((_, i) => i !== index))
        }
      />

      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Напишіть запит…"
        rows={4}
        className="w-full resize-none border-0 bg-transparent px-4 py-4 text-sm text-gray-800 outline-hidden placeholder:text-gray-400 focus:ring-0 dark:text-white/90"
      />

      <div className="flex flex-col gap-3 border-t border-gray-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
        <div className="flex min-w-0 items-center gap-2">
          <input
            ref={inputRef}
            hidden
            type="file"
            multiple
            accept={ACCEPTED_AI_ATTACHMENTS.join(",")}
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="h-10 shrink-0 rounded-lg px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            + Фото / відео / файл
          </button>

          <span className="hidden truncate text-[11px] text-gray-500 sm:inline dark:text-gray-400">
            Enter — відправити · Shift+Enter — новий рядок
          </span>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={disabled || (!value.trim() && !attachments.length)}
          className="h-11 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Відправити
        </button>
      </div>
    </div>
  );
}
