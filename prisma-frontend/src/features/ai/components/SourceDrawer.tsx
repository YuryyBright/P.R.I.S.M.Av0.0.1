import type { AiCitation, AiRunEvent } from "../types/ai.types";

interface Props {
  events: AiRunEvent[];
  streamingText: string;
  citations?: AiCitation[];
}

function getCitationsFromEvents(events: AiRunEvent[]): AiCitation[] {
  return events
    .filter((event) => event.type === "citation.created")
    .map((event) => event.data as AiCitation);
}

export function SourceDrawer({ events, streamingText, citations = [] }: Props) {
  const eventCitations = getCitationsFromEvents(events);

  const allCitations = citations.length > 0 ? citations : eventCitations;

  if (!allCitations.length && !streamingText) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
              Sources
            </p>

            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Джерела, використані під час генерації відповіді.
            </p>
          </div>

          {allCitations.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {allCitations.length}
            </span>
          )}
        </div>
      </div>

      {streamingText && (
        <div className="border-b border-gray-100 px-4 py-4 dark:border-gray-800">
          <p className="mb-2 text-xs font-medium tracking-wide text-gray-400 uppercase dark:text-gray-500">
            Response
          </p>

          <p className="text-sm leading-6 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {streamingText}
          </p>
        </div>
      )}

      {allCitations.length > 0 && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {allCitations.map((citation, index) => (
            <div
              key={`${citation.chunkId}-${index}`}
              className="p-4 transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-xs font-semibold text-white dark:bg-white dark:text-gray-900">
                  {citation.number || index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {citation.title || "Untitled source"}
                  </p>

                  {citation.page !== undefined && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Page {citation.page}
                    </p>
                  )}

                  {citation.headingPath && citation.headingPath.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {citation.headingPath.join(" / ")}
                    </p>
                  )}

                  {citation.snippet && (
                    <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                      <p className="line-clamp-4 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                        {citation.snippet}
                      </p>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
                      {citation.chunkId}
                    </span>

                    {citation.score !== undefined && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        Score: {citation.score.toFixed(3)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
