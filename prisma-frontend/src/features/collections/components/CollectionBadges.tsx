import { useTranslation } from "react-i18next";
import type { CollectionRole, CollectionVisibility } from "../types/collection.types";

const base = "inline-flex rounded-full px-2.5 py-0.5 text-theme-xs font-medium capitalize";

const VISIBILITY_STYLES: Record<CollectionVisibility, string> = {
  private: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-white/80",
  shared: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400",
  public: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
};

const ROLE_STYLES: Record<CollectionRole, string> = {
  owner: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
  editor: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
  viewer: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-white/80",
};

export function VisibilityBadge({ visibility }: { visibility: CollectionVisibility }) {
  const { t } = useTranslation();
  return (
    <span className={`${base} ${VISIBILITY_STYLES[visibility]}`}>
      {t(`collections.visibility.${visibility}.label`)}
    </span>
  );
}

export function RoleBadge({ role }: { role: CollectionRole | null }) {
  const { t } = useTranslation();
  if (!role) return <span className="text-gray-400">—</span>;
  return <span className={`${base} ${ROLE_STYLES[role]}`}>{t(`collections.roles.${role}`)}</span>;
}
