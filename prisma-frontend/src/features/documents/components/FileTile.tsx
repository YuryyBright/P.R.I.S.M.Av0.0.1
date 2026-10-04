import { FileIcon } from "./DocumentIcons";

const SIZES = {
  md: { box: "size-10 rounded-xl", icon: "size-5" },
  lg: { box: "size-12 rounded-2xl", icon: "size-6" },
} as const;

/** File icon in a rounded tile. Reacts to an ancestor marked `group/item` (rows, cards). */
export function FileTile({ size = "md" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-gray-50 text-gray-500 ring-1 ring-gray-200/70 transition-colors ring-inset group-hover/item:bg-brand-50 group-hover/item:text-brand-500 group-hover/item:ring-brand-200 dark:bg-white/5 dark:text-gray-400 dark:ring-white/5 dark:group-hover/item:bg-brand-500/15 dark:group-hover/item:text-brand-400 dark:group-hover/item:ring-brand-500/20 ${s.box}`}
    >
      <FileIcon className={s.icon} />
    </span>
  );
}
