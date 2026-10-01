import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-bold text-brand-500">404</p>
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">{t("errors.notFound.title")}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">{t("errors.notFound.description")}</p>
      <Link to="/" className="text-sm text-brand-500 hover:underline">{t("errors.notFound.backHome")}</Link>
    </div>
  );
}
