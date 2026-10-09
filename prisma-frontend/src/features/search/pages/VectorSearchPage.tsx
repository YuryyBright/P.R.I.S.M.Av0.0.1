import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { CollectionPicker, useCollectionOptions } from "@/features/ai";
import { SearchIcon } from "@/icons";
import type { UUID } from "@/shared/types/api";
import { Alert } from "@/shared/ui/Alert";
import { btnPrimary, inputClass } from "@/shared/ui/classes";
import {
  useVectorSearchMutation,
  type VectorSearchChunk,
} from "../api/search.endpoints";

const TOP_K_OPTIONS = [5, 10, 20, 50] as const;
const MAX_QUERY = 2000;

/** Розміри сітки результатів: від них залежить, скільки карток влізе на екран без прокрутки. */
const CARD_H = 188; // px, фіксована висота картки
const CARD_MIN_W = 340; // px, мінімальна ширина картки
const GAP = 12; // px
const MOBILE_PAGE_SIZE = 5;

/* ───────────────────────── helpers ───────────────────────── */

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTerms(query: string): string[] {
  const unique = new Set(
    query
      .toLowerCase()
      .split(/[\s,.;:!?()"'«»\-–—/\\]+/)
      .filter((word) => word.length >= 3),
  );
  return [...unique].slice(0, 12).map(escapeRegExp);
}

function highlight(text: string, terms: string[]): ReactNode {
  if (!terms.length) return text;
  const regex = new RegExp(`(${terms.join("|")})`, "gi");
  return text.split(regex).map((part, index) =>
    index % 2 === 1 ? (
      <mark
        key={index}
        className="rounded bg-brand-500/15 px-0.5 text-inherit dark:bg-brand-500/30"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function scoreTone(score: number) {
  if (score >= 0.75)
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
    };
  if (score >= 0.5)
    return { bar: "bg-brand-500", text: "text-brand-600 dark:text-brand-300" };
  return { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
}

/* ───────────────────────── hooks ───────────────────────── */

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard може бути недоступний (незахищений контекст) */
    }
  }, []);
  return { copied, copy };
}

/**
 * Висота = залишок вікна від верху елемента до низу екрана.
 * Не залежить від розміру шапки, тому сторінка не дає зайвого скролу при вході.
 * `bottomGap` — нижній відступ layout (padding обгортки + футер, якщо є).
 */
function useFillViewport(enabled: boolean, bottomGap = 24) {
  const ref = useRef<HTMLElement>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const update = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(
        Math.max(420, Math.floor(window.innerHeight - top - bottomGap)),
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [enabled, bottomGap]);

  return { ref, height: enabled ? height : undefined };
}

/** Вимірює контейнер і рахує, скільки карток (колонки × рядки) поміститься без прокрутки. */
function useGridFit(isDesktop: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cols = Math.max(
    1,
    Math.min(4, Math.floor((size.w + GAP) / (CARD_MIN_W + GAP))),
  );
  const rows = isDesktop
    ? Math.max(1, Math.floor((size.h + GAP) / (CARD_H + GAP)))
    : Math.max(1, Math.ceil(MOBILE_PAGE_SIZE / cols));

  return { ref, cols, rows, pageSize: cols * rows };
}

/* ───────────────────────── icons ───────────────────────── */

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const CopyIcon = ({ className = "size-4" }) => (
  <svg {...iconProps} className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);
const CheckIcon = ({ className = "size-4" }) => (
  <svg {...iconProps} className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
const ExternalIcon = ({ className = "size-4" }) => (
  <svg {...iconProps} className={className}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
);
const FolderIcon = ({ className = "size-3.5" }) => (
  <svg {...iconProps} className={className}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </svg>
);
const ChevronIcon = ({
  className = "size-4",
  dir = "right",
}: {
  className?: string;
  dir?: "left" | "right";
}) => (
  <svg {...iconProps} className={className}>
    <path d={dir === "right" ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
  </svg>
);
const CloseIcon = ({ className = "size-4" }) => (
  <svg {...iconProps} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/* ───────────────────────── shared styles ───────────────────────── */

const chipCls =
  "inline-flex min-w-0 items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-theme-xs text-gray-600 dark:bg-white/5 dark:text-gray-400";
const ghostBtn =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-theme-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white";

function ScoreMeter({
  score,
  className = "",
}: {
  score: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const percent = Math.max(0, Math.min(100, Math.round(score * 100)));
  const tone = scoreTone(score);
  return (
    <div className={className} title={`score: ${score.toFixed(4)}`}>
      <p className={`text-theme-sm font-semibold tabular-nums ${tone.text}`}>
        {score.toFixed(3)}
      </p>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t("search.relevance", "Релевантність")}
      >
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/* ───────────────────────── compact result card ───────────────────────── */

interface ResultCardProps {
  rank: number;
  result: VectorSearchChunk;
  collectionName: string;
  terms: string[];
  onOpen: () => void;
}

function ResultCard({
  rank,
  result,
  collectionName,
  terms,
  onOpen,
}: ResultCardProps) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();
  const body = useMemo(
    () => highlight(result.text, terms),
    [result.text, terms],
  );

  const stop = (fn: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    fn();
  };

  return (
    <article
      onClick={onOpen}
      className="flex h-full min-h-0 cursor-pointer flex-col gap-2.5 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-theme-sm dark:border-white/10 dark:bg-gray-900 dark:hover:border-brand-500/40"
    >
      <header className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-theme-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          {rank}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2
            className="truncate font-semibold text-gray-800 dark:text-white/90"
            title={result.document_title}
          >
            {result.document_title}
          </h2>
          {result.match_type && result.match_type !== "semantic" && (
            <span className="inline-flex text-theme-xs font-medium text-emerald-600 dark:text-emerald-400">
              {result.match_type === "title_exact"
                ? t("search.exactTitle", "Точний збіг у назві")
                : t("search.exactText", "Точний збіг у тексті")}
            </span>
          )}
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            <span className={`${chipCls} shrink`} title={collectionName}>
              <FolderIcon />
              <span className="truncate">{collectionName}</span>
            </span>
            <span className={`${chipCls} shrink-0`}>
              #{result.chunk_index + 1}
            </span>
            {result.page != null && (
              <span className={`${chipCls} shrink-0`}>
                {t("search.pageShort", "стор. {{page}}", { page: result.page })}
              </span>
            )}
          </div>
        </div>
        <ScoreMeter score={result.score} className="w-16 shrink-0 text-right" />
      </header>

      <p className="wrap-break-words line-clamp-3 flex-1 text-theme-sm leading-6 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
        {body}
      </p>

      <footer className="-mb-1 flex items-center justify-between gap-2">
        <div className="-ml-2 flex items-center">
          <button type="button" onClick={stop(onOpen)} className={ghostBtn}>
            {t("search.details", "Детальніше")}
          </button>
          <button
            type="button"
            onClick={stop(() => void copy(result.text))}
            className={ghostBtn}
            aria-label={t("search.copy", "Копіювати")}
          >
            {copied ? (
              <CheckIcon className="size-3.5 text-emerald-500" />
            ) : (
              <CopyIcon className="size-3.5" />
            )}
          </button>
        </div>
        <span className="text-theme-xs text-gray-400 dark:text-gray-500">
          {t("search.tokens", "{count} токенів", {
            count: result.token_count,
          })}
        </span>
      </footer>
    </article>
  );
}

/* ───────────────────────── detail dialog (full text, no page scroll) ───────────────────────── */

interface DetailDialogProps {
  result: VectorSearchChunk;
  index: number;
  total: number;
  collectionName: string;
  terms: string[];
  onClose: () => void;
  onNavigate: (delta: number) => void;
}

function DetailDialog({
  result,
  index,
  total,
  collectionName,
  terms,
  onClose,
  onNavigate,
}: DetailDialogProps) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();
  const body = useMemo(
    () => highlight(result.text, terms),
    [result.text, terms],
  );

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onNavigate(-1);
      if (event.key === "ArrowRight") onNavigate(1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onNavigate]);

  return (
    <div
      className="fixed inset-0 z-99999 flex items-center justify-center bg-gray-900/60 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={result.document_title}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-900"
      >
        <header className="flex items-start gap-3 border-b border-gray-100 p-4 sm:p-5 dark:border-white/5">
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {result.document_title}
            </h2>
            {result.match_type && result.match_type !== "semantic" && (
              <p className="text-theme-xs font-medium text-emerald-600 dark:text-emerald-400">
                {result.match_type === "title_exact"
                  ? t("search.exactTitle", "Точний збіг у назві")
                  : t("search.exactText", "Точний збіг у тексті")}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <span className={chipCls}>
                <FolderIcon />
                <span className="truncate">{collectionName}</span>
              </span>
              <span className={chipCls}>
                {t("search.chunk", "Фрагмент {index}", {
                  index: result.chunk_index + 1,
                })}
              </span>
              {result.page != null && (
                <span className={chipCls}>
                  {t("search.page", "Сторінка {{page}}", { page: result.page })}
                </span>
              )}
              {result.heading_path.length > 0 && (
                <span className={chipCls}>
                  {result.heading_path.join(" / ")}
                </span>
              )}
            </div>
          </div>
          <ScoreMeter
            score={result.score}
            className="w-24 shrink-0 text-right"
          />
          <button
            type="button"
            onClick={onClose}
            className={ghostBtn}
            aria-label={t("search.close", "Закрити")}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <p className="wrap-break-words text-theme-sm leading-7 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {body}
          </p>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 p-3 sm:px-5 dark:border-white/5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void copy(result.text)}
              className={ghostBtn}
            >
              {copied ? (
                <CheckIcon className="size-3.5 text-emerald-500" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
              {copied
                ? t("search.copied", "Скопійовано")
                : t("search.copy", "Копіювати")}
            </button>
            {result.document_url && (
              <a
                href={result.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className={ghostBtn}
              >
                <ExternalIcon className="size-3.5" />
                {t("search.openDocument", "Відкрити документ")}
              </a>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onNavigate(-1)}
              disabled={index === 0}
              className={ghostBtn}
              aria-label={t("search.prev", "Попередній")}
            >
              <ChevronIcon dir="left" />
            </button>
            <span className="min-w-14 text-center text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={() => onNavigate(1)}
              disabled={index >= total - 1}
              className={ghostBtn}
              aria-label={t("search.next", "Наступний")}
            >
              <ChevronIcon dir="right" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ───────────────────────── skeleton / placeholder ───────────────────────── */

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex h-full min-h-65 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center dark:border-white/15">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
        <SearchIcon className="size-6" />
      </span>
      <p className="font-medium text-gray-800 dark:text-white/90">{title}</p>
      <p className="max-w-md text-theme-sm text-gray-500 dark:text-gray-400">
        {hint}
      </p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="animate-pulse space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-gray-900"
      aria-hidden
    >
      <div className="flex items-center gap-3">
        <div className="size-7 rounded-lg bg-gray-200 dark:bg-white/10" />
        <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-white/10" />
      </div>
      <div className="h-3 w-full rounded bg-gray-100 dark:bg-white/5" />
      <div className="h-3 w-11/12 rounded bg-gray-100 dark:bg-white/5" />
      <div className="h-3 w-8/12 rounded bg-gray-100 dark:bg-white/5" />
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function VectorSearchPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [collectionIds, setCollectionIds] = useState<UUID[]>([]);
  const [topK, setTopK] = useState<number>(10);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [search, state] = useVectorSearchMutation();
  const { byId } = useCollectionOptions();

  // Сторінка прив'язана до конкретної відповіді: новий результат автоматично дає сторінку 0 без effect.
  const [pageState, setPageState] = useState<{ data: unknown; page: number }>({
    data: null,
    page: 0,
  });
  const page = pageState.data === state.data ? pageState.page : 0;
  const setPage = (next: number) =>
    setPageState({ data: state.data, page: next });

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  // Висота сторінки = залишок екрана від верху `main` (без залежності від розміру шапки).
  const { ref: pageRef, height: pageHeight } = useFillViewport(isDesktop);
  const { ref: gridRef, cols, pageSize } = useGridFit(isDesktop);

  const trimmed = query.trim();
  const canSubmit = trimmed.length > 0 && !state.isLoading;
  const results = state.data?.results ?? [];
  const terms = useMemo(
    () => extractTerms(state.data?.query ?? ""),
    [state.data?.query],
  );

  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * pageSize;
  const visible = results.slice(pageStart, pageStart + pageSize);

  const collectionName = (id: UUID) => byId.get(id)?.name ?? id;

  const run = () => {
    if (!canSubmit) return;
    void search({
      query: trimmed,
      collection_ids: collectionIds.length ? collectionIds : null,
      top_k: topK,
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      run();
    }
  };

  const reset = () => {
    setQuery("");
    setCollectionIds([]);
    setOpenIndex(null);
    state.reset();
  };

  const navigate = useCallback(
    (delta: number) =>
      setOpenIndex((current) => {
        if (current == null) return current;
        return Math.max(0, Math.min(results.length - 1, current + delta));
      }),
    [results.length],
  );
  const closeDialog = useCallback(() => setOpenIndex(null), []);

  const isMac =
    typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridAutoRows: `${CARD_H}px`,
    gap: `${GAP}px`,
  };
  const openResult = openIndex != null ? results[openIndex] : undefined;

  return (
    <main
      ref={pageRef}
      style={pageHeight ? { height: pageHeight } : undefined}
      className="flex w-full flex-col gap-4 lg:overflow-hidden"
    >
      <header className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
        <h1 className="shrink-0 text-title-sm font-semibold text-gray-800 dark:text-white/90">
          {t("search.title", "Пошук у базі знань")}
        </h1>
        <p className="text-theme-sm text-gray-500 lg:truncate dark:text-gray-400">
          {t(
            "search.subtitle",
            "Семантичний пошук по проіндексованих документах. Результати повертаються без генерації відповіді AI.",
          )}
        </p>
      </header>

      <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
        {/* ── Панель пошуку ── */}
        <aside className="lg:min-h-0">
          <form
            onSubmit={submit}
            className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 lg:h-full lg:overflow-y-auto dark:border-white/10 dark:bg-gray-900"
          >
            <label className="flex flex-col gap-2 lg:min-h-28 lg:flex-1">
              <span className="flex items-center justify-between text-theme-sm font-medium text-gray-800 dark:text-white/90">
                {t("search.query", "Що шукаємо?")}
                <span
                  className={`text-theme-xs font-normal tabular-nums ${query.length > MAX_QUERY * 0.9 ? "text-amber-500" : "text-gray-400 dark:text-gray-500"}`}
                >
                  {query.length}/{MAX_QUERY}
                </span>
              </span>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                maxLength={MAX_QUERY}
                rows={4}
                required
                autoFocus
                placeholder={t(
                  "search.queryPlaceholder",
                  "Введіть запит або тему…",
                )}
                className={`${inputClass} h-auto min-h-24 resize-y lg:min-h-0 lg:flex-1 lg:resize-none`}
              />
            </label>

            <div className="shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                  {t("search.collections", "Колекції")}
                </p>
                {collectionIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCollectionIds([])}
                    className="text-theme-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
                  >
                    {t("search.clearCollections", "Скинути")} (
                    {collectionIds.length})
                  </button>
                )}
              </div>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                {collectionIds.length
                  ? t(
                      "search.selectedCollections",
                      "Пошук лише у вибраних колекціях",
                    )
                  : t(
                      "search.allCollections",
                      "Якщо нічого не вибрано, пошук виконується в усіх доступних колекціях.",
                    )}
              </p>
              <CollectionPicker
                value={collectionIds}
                onChange={setCollectionIds}
                label={t("search.collections", "Колекції")}
              />
            </div>

            <fieldset className="shrink-0 space-y-2">
              <legend className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                {t("search.topK", "Кількість результатів")}
              </legend>
              <div
                className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/5"
                role="radiogroup"
              >
                {TOP_K_OPTIONS.map((value) => {
                  const active = topK === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTopK(value)}
                      className={`rounded-lg py-1.5 text-theme-sm font-medium transition focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none ${
                        active
                          ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-800 dark:text-brand-300"
                          : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex shrink-0 gap-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className={`${btnPrimary} inline-flex flex-1 items-center justify-center gap-2`}
              >
                <SearchIcon className="size-4" />
                {state.isLoading
                  ? t("search.searching", "Шукаємо…")
                  : t("search.submit", "Шукати")}
                {!state.isLoading && (
                  <kbd className="ml-1 hidden rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium sm:inline">
                    {isMac ? "⌘" : "Ctrl"} ↵
                  </kbd>
                )}
              </button>
              {(query || collectionIds.length > 0 || state.data) && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg px-3 text-theme-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  {t("search.reset", "Очистити")}
                </button>
              )}
            </div>
          </form>
        </aside>

        {/* ── Результати ── */}
        <section
          className="flex min-w-0 flex-col gap-3 lg:min-h-0"
          aria-live="polite"
          aria-busy={state.isLoading}
        >
          {state.isError && (
            <Alert>
              {t(
                "search.error",
                "Не вдалося виконати пошук. Перевірте підключення та спробуйте ще раз.",
              )}
            </Alert>
          )}

          {state.data && !state.isLoading && (
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-theme-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-800 dark:text-white/90">
                {t("search.resultCount", "Знайдено: {count}", {
                  count: state.data.total,
                })}
              </span>
              <span className="tabular-nums">{state.data.latency_ms} ms</span>
              {state.data.embedding_model && (
                <span className="truncate">{state.data.embedding_model}</span>
              )}
            </div>
          )}

          {/* Область сітки: на desktop займає весь залишок висоти, картки розраховуються під неї */}
          <div
            ref={gridRef}
            className="lg:min-h-0 lg:flex-1 lg:overflow-hidden"
          >
            {state.isLoading ? (
              <div className="grid" style={gridStyle}>
                {Array.from({ length: pageSize }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : !state.data ? (
              !state.isError && (
                <Placeholder
                  title={t("search.placeholderTitle", "Почніть із запиту")}
                  hint={t(
                    "search.placeholderHint",
                    "Опишіть тему своїми словами — пошук знайде найбільш схожі за змістом фрагменти документів, навіть якщо слова не збігаються дослівно.",
                  )}
                />
              )
            ) : !results.length ? (
              <Placeholder
                title={t("search.empty", "За цим запитом нічого не знайдено.")}
                hint={t(
                  "search.emptyHint",
                  "Спробуйте переформулювати запит, використати інші слова або вибрати більше колекцій.",
                )}
              />
            ) : (
              <div className="grid" style={gridStyle}>
                {visible.map((result, i) => (
                  <ResultCard
                    key={result.chunk_id}
                    rank={pageStart + i + 1}
                    result={result}
                    collectionName={collectionName(result.collection_id)}
                    terms={terms}
                    onOpen={() => setOpenIndex(pageStart + i)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Пагінація замість прокрутки */}
          {results.length > 0 && !state.isLoading && (
            <nav
              className="flex shrink-0 items-center justify-between gap-3"
              aria-label={t("search.pagination", "Сторінки результатів")}
            >
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                {pageStart + 1}–{Math.min(pageStart + pageSize, results.length)}{" "}
                {t("search.of", "з")} {results.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 0}
                  className={ghostBtn}
                  aria-label={t("search.prevPage", "Попередня сторінка")}
                >
                  <ChevronIcon dir="left" />
                </button>
                <span className="min-w-14 text-center text-theme-sm text-gray-700 tabular-nums dark:text-gray-300">
                  {safePage + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount - 1}
                  className={ghostBtn}
                  aria-label={t("search.nextPage", "Наступна сторінка")}
                >
                  <ChevronIcon dir="right" />
                </button>
              </div>
            </nav>
          )}
        </section>
      </div>

      {openResult && openIndex != null && (
        <DetailDialog
          result={openResult}
          index={openIndex}
          total={results.length}
          collectionName={collectionName(openResult.collection_id)}
          terms={terms}
          onClose={closeDialog}
          onNavigate={navigate}
        />
      )}
    </main>
  );
}
