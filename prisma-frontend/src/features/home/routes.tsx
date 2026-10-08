import type { RouteObject } from "react-router";

/** The landing page of the protected area (index route of AppLayout). */
export const homeRoutes: RouteObject[] = [
  {
    index: true,
    handle: { titleKey: "home.title" },
    lazy: async () => ({
      Component: (await import("./pages/HomePage")).default,
    }),
  },
];
