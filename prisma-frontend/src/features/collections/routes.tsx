import type { RouteObject } from "react-router";
import { COLLECTIONS_ROUTES } from "./constants/collections.constants";

/**
 * Collections are available to every authenticated user.
 *
 * Access to individual collections is enforced by the backend
 * according to visibility and ownership/sharing rules.
 */
export const collectionsRoutes: RouteObject[] = [
  {
    path: COLLECTIONS_ROUTES.list,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import("./pages/CollectionsPage")).default,
        }),
      },
      {
        path: ":collectionId",
        lazy: async () => ({
          Component: (await import("./pages/CollectionDetailPage")).default,
        }),
      },
    ],
  },
];
