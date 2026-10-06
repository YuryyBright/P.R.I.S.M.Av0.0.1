import { useMemo } from "react";
// REQUIRES one line in features/collections/index.ts (its public API is intentionally minimal):
//   export { useGetCollectionsPageQuery } from "./api/collections.endpoints";

import type { UUID } from "@/shared/types/api";
import { useGetCollectionsPageQuery } from "@/features/collections/api/collections.endpoints";
export interface CollectionOption {
  id: UUID;
  name: string;
  description: string | null;
}

/**
 * Collections the current user can read, for scope pickers (chat RAG scope, agent profile
 * defaults, task sources). ACL is enforced by the backend: `my_role === null` means no access.
 * The collections endpoint has no search; we load the first 100 and filter client-side.
 */
export function useCollectionOptions() {
  const q = useGetCollectionsPageQuery({ page: 1, size: 100 });

  const options = useMemo<CollectionOption[]>(
    () =>
      (q.data?.items ?? [])
        .filter((c) => c.is_active && c.my_role !== null)
        .map((c) => ({ id: c.id, name: c.name, description: c.description })),
    [q.data],
  );

  const byId = useMemo(
    () => new Map(options.map((o) => [o.id, o] as const)),
    [options],
  );

  return {
    options,
    byId,
    total: q.data?.total ?? 0,
    isLoading: q.isLoading,
    truncated: (q.data?.total ?? 0) > (q.data?.items.length ?? 0),
  };
}
