import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export default function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-bold text-brand-500">403</p>
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">{t("errors.forbidden.title")}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">{t("errors.forbidden.description")}</p>
      <Link to="/" className="text-sm text-brand-500 hover:underline">{t("errors.forbidden.backHome")}</Link>
    </div>
  );
}
