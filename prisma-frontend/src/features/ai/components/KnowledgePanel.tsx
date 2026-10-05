interface Props {
  ragEnabled: boolean;
  rerankerEnabled: boolean;
  collectionIds: string[];
  topK: number;
  rerankTopK: number;
  onChange: (patch: Partial<Props>) => void;
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700",
      ].join(" ")}
      aria-pressed={checked}
    >
      <span
        className={[
          "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "left-6" : "left-1",
        ].join(" ")}
      />
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
      </span>

      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 transition outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-500"
      />
    </label>
  );
}

const COLLECTIONS = [
  {
    id: "default",
    name: "Default knowledge base",
  },
  {
    id: "research",
    name: "Research",
  },
  {
    id: "news",
    name: "News",
  },
];

export function KnowledgePanel({
  ragEnabled,
  rerankerEnabled,
  collectionIds,
  topK,
  rerankTopK,
  onChange,
}: Props) {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
          Knowledge
        </p>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Налаштування RAG та reranker для поточного запуску.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              RAG
            </p>

            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Використовувати knowledge base.
            </p>
          </div>

          <Toggle
            checked={ragEnabled}
            onChange={(value) => onChange({ ragEnabled: value })}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              Reranker
            </p>

            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Переранжувати знайдені результати.
            </p>
          </div>

          <Toggle
            checked={rerankerEnabled}
            onChange={(value) => onChange({ rerankerEnabled: value })}
          />
        </div>
      </div>

      {ragEnabled && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Collections
            </label>

            <select
              multiple
              value={collectionIds}
              onChange={(event) => {
                const values = Array.from(
                  event.target.selectedOptions,
                  (option) => option.value,
                );

                onChange({
                  collectionIds: values,
                });
              }}
              className="min-h-32 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 transition outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-500"
            >
              {COLLECTIONS.map((collection) => (
                <option
                  key={collection.id}
                  value={collection.id}
                  className="bg-white text-gray-800 dark:bg-gray-900 dark:text-white"
                >
                  {collection.name}
                </option>
              ))}
            </select>

            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              Утримуйте Ctrl або Cmd для вибору декількох collections.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Top K"
              value={topK}
              onChange={(value) => onChange({ topK: value })}
              min={1}
              max={100}
            />

            {rerankerEnabled && (
              <NumberField
                label="Rerank Top K"
                value={rerankTopK}
                onChange={(value) => onChange({ rerankTopK: value })}
                min={1}
                max={100}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
