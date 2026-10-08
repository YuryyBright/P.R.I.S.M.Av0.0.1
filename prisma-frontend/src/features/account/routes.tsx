import type { RouteObject } from "react-router";
import { ACCOUNT_ROUTES } from "./constants/account.constants";

/** "My profile & access" and "Settings": available to every signed-in user (no permission needed). */
export const accountRoutes: RouteObject[] = [
  {
    path: ACCOUNT_ROUTES.profile,
    handle: { titleKey: "access.title" },
    lazy: async () => ({
      Component: (await import("./pages/ProfilePage")).default,
    }),
  },
  {
    path: ACCOUNT_ROUTES.settings,
    handle: { titleKey: "settings.title" },
    lazy: async () => ({
      Component: (await import("./pages/SettingsPage")).default,
    }),
  },
];
