import { useSelector } from "react-redux";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useGetUsersPageQuery, useSearchUsersByEmailQuery } from "../api/users.endpoints";
import { usersUiSlice } from "../store/usersUiSlice";

/**
 * One table, two sources:
 *  - no email filter -> paginated GET /users/list (or order_by_created_at)
 *  - email filter    -> GET /users?email=  (not paginated server-side)
 */
export function useUsersList() {
  const ui = useSelector(usersUiSlice.selectors.selectUsersUi);
  const email = useDebouncedValue(ui.emailQuery.trim(), 300);
  const isSearch = email.length > 0;

  const pageQ = useGetUsersPageQuery(
    { page: ui.page, size: ui.size, orderBy: ui.orderBy },
    { skip: isSearch },
  );
  const searchQ = useSearchUsersByEmailQuery(email, { skip: !isSearch });

  const active = isSearch ? searchQ : pageQ;
  const rows = isSearch ? (searchQ.data ?? []) : (pageQ.data?.items ?? []);

  return {
    rows,
    isSearch,
    page: isSearch ? 1 : (pageQ.data?.page ?? ui.page),
    size: ui.size,
    total: isSearch ? rows.length : (pageQ.data?.total ?? 0),
    pages: isSearch ? 1 : (pageQ.data?.pages ?? 0),
    isLoading: active.isLoading,
    isFetching: active.isFetching,
    error: active.error, // NormalizedApiError | undefined
    refetch: active.refetch,
  };
}
