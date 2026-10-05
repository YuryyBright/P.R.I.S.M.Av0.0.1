const TOOLS = [
  ["search_knowledge", "Search knowledge", "low"],
  ["read_document", "Read document", "medium"],
  ["list_collections", "List collections", "low"],
] as const;

interface Props {
  selected: string[];
  onChange: (value: string[]) => void;
}

const riskClasses = {
  low: "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400",
  medium:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400",
} as const;

export function AgentToolsPanel({ selected, onChange }: Props) {
  function toggleTool(tool: string) {
    if (selected.includes(tool)) {
      onChange(selected.filter((item) => item !== tool));
      return;
    }

    onChange([...selected, tool]);
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
          Agent tools
        </p>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          UI відображає allow-list профілю. Backend залишається джерелом істини.
        </p>
      </div>

      <div className="space-y-2">
        {TOOLS.map(([id, label, risk]) => {
          const active = selected.includes(id);

          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleTool(id)}
              className={[
                "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition",
                active
                  ? "border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800",
              ].join(" ")}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                  {label}
                </p>

                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {id}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                    riskClasses[risk],
                  ].join(" ")}
                >
                  {risk}
                </span>

                <span
                  className={[
                    "flex h-5 w-5 items-center justify-center rounded-md border transition",
                    active
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900",
                  ].join(" ")}
                >
                  {active && (
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      className="h-3.5 w-3.5"
                    >
                      <path
                        d="M3.5 8.25 6.5 11l6-6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
