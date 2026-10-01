import { useTranslation } from "react-i18next";

export default function SidebarWidget() {
  const { t } = useTranslation();

  return (
    <div className="pb-20">
      <div className="mx-auto w-full max-w-60 rounded-2xl bg-gray-50 px-4 py-5 text-center dark:bg-white/3">
        <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
          {t("sidebar.widget.title")}
        </h3>
        <p className="mb-4 text-theme-sm text-gray-500 dark:text-gray-400">
          {t("sidebar.widget.description")}
        </p>
      </div>
    </div>
  );
}
