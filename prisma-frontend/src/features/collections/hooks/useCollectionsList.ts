import { useSelector } from "react-redux";
import { useGetCollectionsPageQuery } from "../api/collections.endpoints";
import { collectionsUiSlice } from "../store/collectionsUiSlice";

/** Adapts the backend's limit/offset page to the page/pages shape the shared Pagination expects. */
export function useCollectionsList() {
  const ui = useSelector(collectionsUiSlice.selectors.selectCollectionsUi);
  const q = useGetCollectionsPageQuery({ page: ui.page, size: ui.size });

  const limit = q.data?.limit ?? ui.size;
  const total = q.data?.total ?? 0;

  return {
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
