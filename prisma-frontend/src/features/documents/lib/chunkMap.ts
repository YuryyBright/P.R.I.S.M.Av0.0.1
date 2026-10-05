import type { ChunkMap } from "../types/document.types";

export interface MapSegment {
  /** First and last chunk_index covered by this segment (inclusive). */
  from: number;
  to: number;
  tokens: number;
  /** True only if EVERY chunk in the segment has a vector. */
  indexed: boolean;
}

/**
 * One segment per chunk; if there are more chunks than `max`, neighbours are merged into
 * buckets so the strip stays readable (and cheap to render) for documents with thousands.
 */
export function buildSegments(map: ChunkMap, max: number): MapSegment[] {
  const n = map.count;
  if (n === 0) return [];
  const size = Math.max(1, Math.ceil(n / max));
  const out: MapSegment[] = [];
  for (let from = 0; from < n; from += size) {
    const to = Math.min(n, from + size) - 1;
    let tokens = 0;
    let indexed = true;
    for (let i = from; i <= to; i++) {
      tokens += map.tokens[i] ?? 0;
      indexed = indexed && Boolean(map.indexed[i]);
    }
    out.push({ from, to, tokens, indexed });
  }
  return out;
}

export const segmentContains = (s: MapSegment, index: number) =>
  index >= s.from && index <= s.to;

/** Wraps case-insensitive occurrences of `q` for highlighting. */
export function splitByQuery(
  text: string,
  q: string,
): { text: string; hit: boolean }[] {
  const needle = q.trim();
  if (needle.length < 2) return [{ text, hit: false }];
  const re = new RegExp(
    `(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  return text
    .split(re)
    .filter((p) => p !== "")
    .map((p) => ({ text: p, hit: p.toLowerCase() === needle.toLowerCase() }));
}
