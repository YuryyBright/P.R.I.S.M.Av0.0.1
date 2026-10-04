import { useTranslation } from "react-i18next";
import { mutedText } from "../lib/styles";
import { SpinnerIcon } from "./DocumentIcons";

export function InlineLoading({ className = "py-10" }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 text-theme-sm ${mutedText} ${className}`}
    >
      <SpinnerIcon className="size-4" />
      {t("common.loading")}
    </div>
  );
}
