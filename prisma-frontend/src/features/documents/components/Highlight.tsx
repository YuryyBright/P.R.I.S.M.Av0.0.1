import { splitByQuery } from "../lib/chunkMap";

/** Text with every case-insensitive occurrence of `q` marked. */
export function Highlight({ text, q }: { text: string; q: string }) {
  return (
    <>
      {splitByQuery(text, q).map((p, i) =>
        p.hit ? (
          <mark
            key={i}
            className="rounded-xs bg-warning-100 px-0.5 text-inherit dark:bg-warning-500/25"
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
