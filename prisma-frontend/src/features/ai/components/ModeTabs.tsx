import type { AiMode } from "../types/ai.types";

interface Props {
  value: AiMode;
  onChange: (mode: AiMode) => void;
}

export function ModeTabs({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
      {(["chat", "agent"] as const).map((mode) => {
        const active = value === mode;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={[
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              active
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white",
            ].join(" ")}
          >
            {mode === "chat" ? "Chat" : "Agent"}
          </button>
        );
      })}
    </div>
  );
}
