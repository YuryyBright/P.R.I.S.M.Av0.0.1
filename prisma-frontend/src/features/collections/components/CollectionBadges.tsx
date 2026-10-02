import { useTranslation } from "react-i18next";
import type {
  CollectionRole,
  CollectionVisibility,
} from "../types/collection.types";

const base =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-theme-xs font-medium whitespace-nowrap capitalize";

interface Tone {
  badge: string;
  dot: string;
}

const NEUTRAL: Tone = {
  badge: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300",
  dot: "bg-gray-400 dark:bg-gray-500",
};
const SUCCESS: Tone = {
  badge:
    "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  dot: "bg-success-500",
};
const WARNING: Tone = {
  badge:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-orange-400",
  dot: "bg-warning-500",
};
const BRAND: Tone = {
  badge: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  dot: "bg-brand-500",
};

const VISIBILITY_TONES: Record<CollectionVisibility, Tone> = {
  private: NEUTRAL,
  shared: WARNING,
  public: SUCCESS,
};

const ROLE_TONES: Record<CollectionRole, Tone> = {
  owner: BRAND,
  editor: SUCCESS,
  viewer: NEUTRAL,
};

/** API values can differ in case or be new/unknown: normalise and never crash. */
const norm = (value: string) => value.trim().toLowerCase();

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`${base} ${tone.badge}`}>
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${tone.dot}`}
      />
      {children}
    </span>
  );
}

export function VisibilityBadge({
  visibility,
}: {
  visibility: CollectionVisibility;
}) {
  const { t } = useTranslation();
  const key = norm(String(visibility ?? ""));
  const tone = VISIBILITY_TONES[key as CollectionVisibility] ?? NEUTRAL;
  return (
    <Badge tone={tone}>
      {t(`collections.visibility.${key}.label`, { defaultValue: key || "—" })}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: CollectionRole | null }) {
  const { t } = useTranslation();
  if (!role) {
    return (
      <span
        className="text-gray-400 dark:text-gray-500"
        aria-label={t("collections.roles.none", "Немає ролі")}
      >
        —
      </span>
    );
  }
  const key = norm(String(role));
  const tone = ROLE_TONES[key as CollectionRole] ?? NEUTRAL;
  return (
    <Badge tone={tone}>
      {t(`collections.roles.${key}`, { defaultValue: key })}
    </Badge>
  );
}
