import type { RouteObject } from "react-router";
import { DOCUMENTS_ROUTES } from "./constants/documents.constants";

/**
 * Document page: /collections/:collectionId/documents/:documentId.
 * Register next to `collectionsRoutes` (same authenticated layout). Access is enforced by the
 * backend (collection READ), exactly like for the collection page.
 */
export const documentsRoutes: RouteObject[] = [
  {
    path: DOCUMENTS_ROUTES.pattern,
    lazy: async () => ({
      Component: (await import("./pages/DocumentDetailPage")).default,
    }),
  },
];
