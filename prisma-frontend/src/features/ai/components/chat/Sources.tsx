import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { truncate } from "../../lib/format";
import type { LiveCitation, LiveRun } from "../../lib/runReducer";
import type { Citation } from "../../types/ai.types";
import { ChevronDownIcon, FileIcon } from "../AiIcons";
import type { CitationLookup } from "./Markdown";

export interface SourceItem {
  n: number;
  title: string;
  page: number | null;
  text: string;
  url?: string | null;
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;

export function persistedSources(citations: Citation[]): SourceItem[] {
  return citations
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((c) => ({
      n: c.rank,
      title:
        str(c.meta?.document_title) ??
        str(c.meta?.title) ??
        str(c.meta?.filename) ??
        "Документ",
      page: typeof c.meta?.page === "number" ? (c.meta.page as number) : null,
      text: c.citation_text,
      url: str(c.meta?.url),
    }));
}

export function liveSources(run: LiveRun): SourceItem[] {
  // `citation` events (only the sources the answer really references) win over raw retrieval chunks
  if (run.citations.length) {
    return run.citations.map((c: LiveCitation) => ({
      n: c.rank,
      title: c.documentTitle,
      page: c.page,
      text: c.text,
      url: c.url,
    }));
  }
  const seen = new Map<number, SourceItem>();
  for (const s of run.steps) {
    for (const c of s.retrieval?.chunks ?? []) {
      if (!seen.has(c.n))
        seen.set(c.n, {
          n: c.n,
          title: c.document_title,
          page: c.page,
          text: c.preview,
        });
    }
  }
  return [...seen.values()].sort((a, b) => a.n - b.n);
}

export const toLookup = (items: SourceItem[]): CitationLookup =>
  new Map(items.map((s) => [s.n, { title: s.title, page: s.page }] as const));

interface SourcesProps {
  items: SourceItem[];
  /** [n] clicked in the answer: expand and highlight. */
  activeN: number | null;
  onToggle: (open: boolean) => void;
  open: boolean;
}

/** Collapsible "Sources" block under an answer. */
export function Sources({ items, activeN, open, onToggle }: SourcesProps) {
  const { t } = useTranslation();
  const uid = useId();
  const activeRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (open && activeN !== null)
      activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, activeN]);

  if (!items.length) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-theme-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-white/5"
      >
        <FileIcon className="size-3.5" />
        {t("ai.chat.sources", "Джерела")}
        <span className="rounded-full bg-gray-100 px-1.5 text-[11px] text-gray-600 tabular-nums dark:bg-white/10 dark:text-gray-300">
          {items.length}
        </span>
        <ChevronDownIcon
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ol id={`${uid}-list`} className="mt-2 space-y-1.5">
          {items.map((s) => {
            const active = s.n === activeN;
            return (
              <li
                key={s.n}
                ref={active ? activeRef : undefined}
                className={`rounded-xl border px-3 py-2 transition-colors ${
                  active
                    ? "border-brand-300 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white dark:border-white/10 dark:bg-white/3"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-px inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-md bg-brand-50 px-1 text-[11px] font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    {s.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-theme-xs font-medium text-gray-800 dark:text-white/90">
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="hover:text-brand-600 hover:underline dark:hover:text-brand-400"
                        >
                          {s.title}
                        </a>
                      ) : (
                        s.title
                      )}
                      {s.page ? (
                        <span className="font-normal text-gray-500 dark:text-gray-400">
                          {" "}
                          · {t("ai.chat.page", "с.")} {s.page}
                        </span>
                      ) : null}
                    </p>
                    {s.text && (
                      <p className="mt-0.5 text-theme-xs leading-5 wrap-break-word text-gray-500 dark:text-gray-400">
                        {truncate(s.text, active ? 1200 : 220)}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
