import { useSelector } from "react-redux";
import {
  useGetArchivedCollectionsPageQuery,
  useGetCollectionsPageQuery,
} from "../api/collections.endpoints";
import { collectionsUiSlice } from "../store/collectionsUiSlice";

/**
 * Adapts the backend's limit/offset page to the page/pages shape the shared Pagination expects.
 * Serves both lists (`ui.view`): live collections or the archive. Only the visible one is fetched.
 */
export function useCollectionsList() {
  const ui = useSelector(collectionsUiSlice.selectors.selectCollectionsUi);
  const archived = ui.view === "archived";
  const args = { page: ui.page, size: ui.size };

  const activeQ = useGetCollectionsPageQuery(args, { skip: archived });
  const archivedQ = useGetArchivedCollectionsPageQuery(args, {
    skip: !archived,
  });
  const q = archived ? archivedQ : activeQ;

  const limit = q.data?.limit ?? ui.size;
  const total = q.data?.total ?? 0;

  return {
    view: ui.view,
    rows: q.data?.items ?? [],
    page: q.data ? Math.floor(q.data.offset / limit) + 1 : ui.page,
    size: ui.size,
    total,
    pages: Math.ceil(total / limit),
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    error: q.error, // NormalizedApiError | undefined
    refetch: q.refetch,
  };
}
