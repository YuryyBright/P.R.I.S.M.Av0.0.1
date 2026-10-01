import type { RouteObject } from "react-router";
import { RequirePermission } from "@/features/auth";
import { COLLECTIONS_ROUTES, COLLECTION_PERMISSIONS } from "./constants/collections.constants";

/** The feature hands its routes to app/router; app never needs to know its pages. */
export const collectionsRoutes: RouteObject[] = [
  {
    path: COLLECTIONS_ROUTES.list,
    element: <RequirePermission permission={COLLECTION_PERMISSIONS.read} />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import("./pages/CollectionsPage")).default }) },
    ],
  },
];
