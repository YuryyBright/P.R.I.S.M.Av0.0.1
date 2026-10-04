import { useRef, type KeyboardEvent } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** Prefix of the ids; the panel must use `tabPanelId` / `tabId` to be linked. */
  idPrefix: string;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const tabPanelId = (prefix: string, id: string) =>
  `${prefix}-panel-${id}`;

/** WAI-ARIA tabs: roving tabindex, ← → Home End move focus and selection. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
}: Props<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = items.findIndex((x) => x.id === value);
    const last = items.length - 1;
    const next =
      e.key === "ArrowRight"
        ? (current + 1) % items.length
        : e.key === "ArrowLeft"
          ? (current - 1 + items.length) % items.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    const id = items[next].id;
    onChange(id);
    refs.current.get(id)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-1 border-b border-gray-200 dark:border-white/10"
    >
      {items.map((x) => {
        const selected = x.id === value;
        return (
          <button
            key={x.id}
            ref={(el) => {
              if (el) refs.current.set(x.id, el);
              else refs.current.delete(x.id);
            }}
            role="tab"
            type="button"
            id={tabId(idPrefix, x.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix, x.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(x.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-theme-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none ${
              selected
                ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
            }`}
          >
            {x.label}
          </button>
        );
      })}
    </div>
  );
}
