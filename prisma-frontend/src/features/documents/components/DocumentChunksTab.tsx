import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { Alert } from "@/shared/ui/Alert";
import type { UUID } from "@/shared/types/api";
import { useGetDocumentChunkMapQuery } from "../api/documents.endpoints";
import {
  CHUNKS_PAGE_SIZE,
  POLL_INTERVAL_MS,
} from "../constants/documents.constants";
import { queryErrorMessage } from "../lib/errors";
import { surface } from "../lib/styles";
import type { DocumentStatus } from "../types/document.types";
import { ChunkList } from "./ChunkList";
import { ChunkMapStrip } from "./ChunkMapStrip";
import { ChunkReader } from "./ChunkReader";
import { SpinnerIcon } from "./DocumentIcons";
import { EmptyState } from "./EmptyState";
import { InlineLoading } from "./InlineLoading";

interface Props {
  documentId: UUID;
  status: DocumentStatus;
  /** Worker is still busy: chunks appear / get indexed, keep the view live. */
  active: boolean;
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/**
 * Chunk viewer: overview strip on top, list (left) + reader (right) below.
 * Selected chunk lives in the URL (?chunk=12) so a chunk is linkable and Back works.
 */
export function DocumentChunksTab({ documentId, status, active }: Props) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [mobileView, setMobileView] = useState<"list" | "reader">("list");

  const map = useGetDocumentChunkMapQuery(documentId, {
    pollingInterval: active ? POLL_INTERVAL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const count = map.data?.count ?? 0;

  const raw = Number(params.get("chunk"));
  const selected =
    Number.isInteger(raw) && raw >= 0
      ? Math.min(raw, Math.max(0, count - 1))
      : 0;

  // Latest selection, updated synchronously: fast key-repeat must not read a stale closure.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const select = useCallback(
    (index: number, opts?: { followList?: boolean }) => {
      selectedRef.current = index;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("chunk", String(index));
          return next;
        },
        { replace: true },
      );
      if (opts?.followList && !q)
        setPage(Math.floor(index / CHUNKS_PAGE_SIZE) + 1);
      setMobileView("reader");
    },
    [setParams, q],
  );

  // Arrow keys / j k move between chunks (ignored while typing in the search box).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isTyping(e.target) ||
        e.defaultPrevented ||
        count === 0
      )
        return;
      const step =
        e.key === "ArrowRight" || e.key === "j"
          ? 1
          : e.key === "ArrowLeft" || e.key === "k"
            ? -1
            : 0;
      if (!step) return;
      const next = selectedRef.current + step;
      if (next < 0 || next >= count) return;
      e.preventDefault();
      select(next, { followList: true });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, select]);

  const onQuery = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  if (map.isLoading) return <InlineLoading />;

  if (map.error) {
    return (
      <Alert>
        {queryErrorMessage(
          map.error,
          t("documents.chunks.loadError", "Не вдалося завантажити чанки"),
        )}
      </Alert>
    );
  }

  if (count === 0) {
    const failed = status === "failed";
    return (
      <EmptyState
        icon={
          active ? <SpinnerIcon className="size-6 text-brand-500" /> : undefined
        }
        title={
          active
            ? t("documents.chunks.waitingTitle", "Документ ще обробляється")
            : failed
              ? t("documents.chunks.failedTitle", "Чанки не створено")
              : t("documents.chunks.emptyTitle", "Чанків немає")
        }
        hint={
          active
            ? t(
                "documents.chunks.waitingHint",
                "Чанки з'являться тут одразу після розбиття тексту — сторінка оновиться сама.",
              )
            : failed
              ? t(
                  "documents.chunks.failedHint",
                  "Обробка завершилась помилкою. Подробиці — у вкладці «Інформація»; можна запустити переіндексацію.",
                )
              : t(
                  "documents.chunks.emptyHint",
                  "У документа немає тексту, який можна розбити на чанки.",
                )
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <section
        className={`${surface} p-4 sm:p-5`}
        aria-label={t("documents.chunks.mapTitle", "Карта документа")}
      >
        <ChunkMapStrip
          map={map.data!}
          selected={selected}
          onSelect={(i) => select(i, { followList: true })}
        />
      </section>

      <div
        className={`${surface} grid lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]`}
      >
        <div
          className={`${mobileView === "reader" ? "hidden" : "block"} border-gray-100 lg:block lg:border-e dark:border-white/5`}
        >
          <ChunkList
            documentId={documentId}
            active={active}
            selected={selected}
            page={page}
            onPage={setPage}
            q={q}
            onQuery={onQuery}
            onSelect={(i) => select(i)}
          />
        </div>
        <div
          className={`${mobileView === "list" ? "hidden" : "block"} min-w-0 lg:block`}
        >
          <ChunkReader
            documentId={documentId}
            index={selected}
            total={count}
            q={q}
            onNavigate={(i) => select(i, { followList: true })}
            onBack={() => setMobileView("list")}
          />
        </div>
      </div>
    </div>
  );
}
