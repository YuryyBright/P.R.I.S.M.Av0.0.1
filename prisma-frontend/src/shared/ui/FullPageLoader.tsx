import { useTranslation } from "react-i18next";

export function FullPageLoader({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      {label ?? t("shared.loading")}
    </div>
  );
}
