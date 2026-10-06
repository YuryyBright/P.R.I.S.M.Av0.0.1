import { useTranslation } from "react-i18next";
import { relativeTimeParts } from "../lib/jobFormat";

export function useRelativeTime() {
  const { t } = useTranslation();

  return (time: number) => {
    const { unit, count } = relativeTimeParts(time);

    switch (unit) {
      case "now":
        return t("header.notifications.justNow", {
          defaultValue: "щойно",
        });

      case "min":
        return t("header.notifications.minAgo", { count });

      case "hr":
        return t("header.notifications.hrAgo", { count });

      default:
        return t("header.notifications.dayAgo", {
          count,
          defaultValue: "{{count}} дн. тому",
        });
    }
  };
}
