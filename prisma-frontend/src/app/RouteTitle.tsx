import { useEffect } from "react";
import { useMatches } from "react-router";
import { useTranslation } from "react-i18next";

type TitledRouteHandle = {
  titleKey?: string;
};

/** Keeps the browser tab title in sync with the deepest active route. */
export default function RouteTitle() {
  const matches = useMatches();
  const { t } = useTranslation();
  const handle = [...matches]
    .reverse()
    .map((match) => match.handle as TitledRouteHandle | undefined)
    .find((candidate) => candidate?.titleKey);
  const title = handle?.titleKey
    ? `${t(handle.titleKey)} | ${t("app.name")}`
    : t("app.name");

  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}
