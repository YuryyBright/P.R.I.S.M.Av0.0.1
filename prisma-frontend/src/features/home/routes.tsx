import type { RouteObject } from "react-router";

/** The landing page of the protected area (index route of AppLayout). */
export const homeRoutes: RouteObject[] = [
  {
    index: true,
    lazy: async () => ({
      Component: (await import("./pages/HomePage")).default,
    }),
  },
];
