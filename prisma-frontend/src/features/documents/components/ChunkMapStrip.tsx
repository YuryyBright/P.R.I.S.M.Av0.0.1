import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CHUNK_MAP_MAX_SEGMENTS } from "../constants/documents.constants";
import { buildSegments, segmentContains } from "../lib/chunkMap";
import type { ChunkMap } from "../types/document.types";

interface Props {
  map: ChunkMap;
  selected: number;
  onSelect: (index: number) => void;
}

/**
 * The whole document as one strip: a segment per chunk, width = token count, colour = whether
 * the chunk already has a vector. Click jumps to the chunk. Pure overview + navigation, so
 * segments are not tab stops — the list next to it is the keyboard / screen-reader path.
 */
export function ChunkMapStrip({ map, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const segments = useMemo(
    () => buildSegments(map, CHUNK_MAP_MAX_SEGMENTS),
    [map],
  );
  const indexed = useMemo(() => map.indexed.filter(Boolean).length, [map]);
  const pending = map.count - indexed;

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label={t("documents.chunks.mapLabel", "Карта чанків документа")}
        className="flex h-12 items-end gap-0.5"
      >
        {segments.map((s) => {
          const active = segmentContains(s, selected);
          const single = s.from === s.to;
          const label = single
            ? `#${s.from} · ${s.tokens.toLocaleString()} ${t("documents.chunks.tokens", "ток.")}`
            : `#${s.from}–#${s.to} · ${s.tokens.toLocaleString()} ${t("documents.chunks.tokens", "ток.")}`;
          return (
            <button
              key={s.from}
              type="button"
              tabIndex={-1}
              title={label}
              aria-label={label}
              aria-current={active ? "true" : undefined}
              onClick={() => onSelect(active && !single ? selected : s.from)}
              style={{
                flexGrow: Math.max(1, s.tokens),
                flexBasis: 0,
                minWidth: 3,
              }}
              className={`rounded-xs transition-[height,background-color] duration-150 motion-reduce:transition-none ${
                active
                  ? "h-12 bg-brand-600 dark:bg-brand-400"
                  : `h-7 hover:h-9 ${
                      s.indexed
                        ? "bg-brand-300 hover:bg-brand-400 dark:bg-brand-500/40 dark:hover:bg-brand-500/70"
                        : "bg-gray-200 hover:bg-gray-300 dark:bg-white/15 dark:hover:bg-white/25"
                    }`
              }`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-theme-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-xs bg-brand-300 dark:bg-brand-500/40"
          />
          {t("documents.chunks.legendIndexed", "У векторній БД")}: {indexed}
        </span>
        {pending > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-xs bg-gray-200 dark:bg-white/15"
            />
            {t("documents.chunks.legendPending", "Очікують індексації")}:{" "}
            {pending}
          </span>
        )}
        <span className="ms-auto">
          {t(
            "documents.chunks.legendWidth",
            "Ширина сегмента — кількість токенів",
          )}
        </span>
      </div>
    </div>
  );
}
