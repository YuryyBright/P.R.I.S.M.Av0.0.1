// Public API of the collections feature. Import from "@/features/collections" only.
// Deliberately NOT exported: endpoints/RTK hooks, components, mappers. Add something here
// only when another feature or app/ really needs it (e.g. a documents feature needing the collection list).
export { collectionsRoutes } from "./routes";
export { collectionsUiSlice } from "./store/collectionsUiSlice";
export {
  COLLECTION_PERMISSIONS,
  COLLECTIONS_ROUTES,
} from "./constants/collections.constants";
export { useCollectionActions } from "./hooks/useCollectionActions";
export type {
  Collection,
  CollectionRole,
  CollectionVisibility,
} from "./types/collection.types";
