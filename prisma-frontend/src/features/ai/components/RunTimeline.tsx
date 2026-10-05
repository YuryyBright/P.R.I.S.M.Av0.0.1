import type { AiRunEvent } from "../types/ai.types";

interface Props {
  events: AiRunEvent[];
}

function prettyEvent(type: string) {
  return type
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function eventTone(type: string) {
  if (type.includes("error") || type.includes("failed")) {
    return "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400";
  }

  if (type.includes("completed") || type.includes("done")) {
    return "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400";
  }

  if (type.includes("tool")) {
    return "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400";
  }

  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

export function RunTimeline({ events }: Props) {
  const visibleEvents = events.filter(
    (event) => event.type !== "heartbeat" && event.type !== "llm.delta",
  );

  if (!visibleEvents.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Run events will appear here.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
          Run timeline
        </p>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Події поточного AI run.
        </p>
      </div>

      <div className="space-y-2">
        {visibleEvents.map((event, index) => {
          const data =
            typeof event.data === "object" && event.data !== null
              ? event.data
              : {};

          return (
            <div
              key={`${event.type}-${index}`}
              className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    "mt-0.5 rounded-full px-2 py-1 text-[10px] font-medium",
                    eventTone(event.type),
                  ].join(" ")}
                >
                  {prettyEvent(event.type)}
                </span>

                {event.timestamp && (
                  <span className="ml-auto shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {Object.keys(data).length > 0 && (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {JSON.stringify(data, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
