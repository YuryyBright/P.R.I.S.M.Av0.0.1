import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useLanguage, type LanguageCode } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { AUTH_ROUTES, LogoutButton, useSession, type SessionUser } from "@/features/auth";
import { useUserActions } from "@/features/users";
import { languages } from "@/i18n/languages";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Field } from "@/shared/ui/Field";
import { Spinner } from "@/shared/ui/Spinner";
import { btnPrimary, btnSecondary, inputClass } from "@/shared/ui/classes";
import { cn } from "@/utils";

const card =
  "rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/3";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={card}>
      <h2 className="mb-5 text-base font-semibold text-gray-800 dark:text-white/90">{title}</h2>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-md px-4 py-2 text-theme-sm font-medium transition-colors",
            value === o.id
              ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------- personal data ---------------------------- */

type Feedback = { variant: "success" | "error" | "info"; text: string } | null;

function ProfileForm({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const { updateMyProfile } = useUserActions();

  const initial = {
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    contact_phone: user.contact_phone ?? "",
  };
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setFeedback(null);
  };

  async function onSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (pending) return;

    // Send only what changed: PUT /users/me must never wipe a field the user did not touch.
    const changes: Partial<Record<keyof typeof initial, string | null>> = {};
    (Object.keys(initial) as (keyof typeof initial)[]).forEach((key) => {
      const next = values[key].trim();
      if (next !== initial[key].trim()) changes[key] = next === "" ? null : next;
    });
    if (Object.keys(changes).length === 0) {
      setFeedback({ variant: "info", text: t("settings.profile.nothingToSave") });
      return;
    }

    setPending(true);
    setFieldErrors({});
    try {
      await updateMyProfile(changes);
      setFeedback({ variant: "success", text: t("settings.profile.saved") });
    } catch (err) {
      if (isNormalizedApiError(err)) {
        setFieldErrors(err.fieldErrors);
        setFeedback({ variant: "error", text: err.message });
      } else {
        setFeedback({ variant: "error", text: t("settings.profile.error") });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5" noValidate>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("settings.profile.firstName")} error={fieldErrors.first_name}>
          <input className={inputClass} value={values.first_name} onChange={set("first_name")} autoComplete="given-name" />
        </Field>
        <Field label={t("settings.profile.lastName")} error={fieldErrors.last_name}>
          <input className={inputClass} value={values.last_name} onChange={set("last_name")} autoComplete="family-name" />
        </Field>
        <Field label={t("settings.profile.phone")} error={fieldErrors.contact_phone}>
          <input className={inputClass} type="tel" value={values.contact_phone} onChange={set("contact_phone")} autoComplete="tel" />
        </Field>
        <Field label={t("settings.profile.email")}>
          <input className={cn(inputClass, "cursor-not-allowed opacity-70")} value={user.email} disabled readOnly />
          <span className="mt-1 block text-theme-xs text-gray-400">{t("settings.profile.emailHint")}</span>
        </Field>
      </div>

      {feedback && <Alert variant={feedback.variant}>{feedback.text}</Alert>}

      <button type="submit" className={`${btnPrimary} inline-flex items-center gap-2`} disabled={pending}>
        {pending && <Spinner />}
        {t(pending ? "settings.profile.saving" : "settings.profile.save")}
      </button>
    </form>
  );
}

/* --------------------------------- page --------------------------------- */

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();

  if (!user) return null; // RequireAuth guarantees the user is loaded; this is only a type guard

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">{t("settings.subtitle")}</p>
      </div>

      <Section title={t("settings.profile.title")}>
        {/* key: re-initialise the form if another account gets loaded in the same tab */}
        <ProfileForm key={user.id} user={user} />
      </Section>

      <Section title={t("settings.appearance.title")}>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">
              {t("settings.appearance.theme")}
            </p>
            <Segmented
              value={theme}
              onChange={(next) => next !== theme && toggleTheme()}
              options={[
                { id: "light", label: t("settings.appearance.light") },
                { id: "dark", label: t("settings.appearance.dark") },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-400">
              {t("settings.appearance.language")}
            </p>
            <Segmented<LanguageCode>
              value={language}
              onChange={setLanguage}
              options={languages.map((l) => ({ id: l.id, label: l.shortName }))}
            />
          </div>
        </div>
      </Section>

      <Section title={t("settings.security.title")}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {t("settings.security.changePasswordHint")}
            </p>
            <Link to={AUTH_ROUTES.changePassword} className={`${btnSecondary} inline-flex shrink-0 items-center`}>
              {t("settings.security.changePassword")}
            </Link>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">{t("settings.security.signOutHint")}</p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <LogoutButton className={`${btnSecondary} h-11`}>{t("settings.security.signOutThis")}</LogoutButton>
              <LogoutButton everywhere className={`${btnSecondary} h-11`}>
                {t("settings.security.signOutEverywhere")}
              </LogoutButton>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
