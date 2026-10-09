import type { RouteObject } from "react-router";
import { SEARCH_ROUTE } from "./constants";

export const searchRoutes: RouteObject[] = [
  {
    path: SEARCH_ROUTE,
    handle: { titleKey: "search.title" },
    lazy: async () => ({ Component: (await import("./pages/VectorSearchPage")).default }),
  },
];
