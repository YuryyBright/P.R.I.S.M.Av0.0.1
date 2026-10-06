import { baseApi } from "@/shared/api/baseApi";
import { DEFAULT_PAGE_SIZE, type UUID } from "@/shared/types/api";
import { COLLECTIONS_PATHS } from "../constants/collections.constants";
import type {
  Collection,
  CollectionCreatePayload,
  CollectionMember,
  CollectionsPageArgs,
  CollectionUpdatePayload,
  LimitOffsetPage,
  MemberRole,
  MemberUpsertPayload,
} from "../types/collection.types";

const LIST = "LIST" as const;
const ARCHIVE = "ARCHIVE" as const;

/**
 * NOTE: add "Collection" and "CollectionMember" to `tagTypes` in baseApi.
 * No envelope here -> no unwrap/withMessage; mutations resolve with the plain body.
 */
export const collectionsApi = baseApi.injectEndpoints({
  overrideExisting: false,
  endpoints: (build) => ({
    /** GET /collections?limit&offset -> Page<Collection> */
    getCollectionsPage: build.query<
      LimitOffsetPage<Collection>,
      CollectionsPageArgs | void
    >({
      query: (args) => {
        const { page = 1, size = DEFAULT_PAGE_SIZE } = args ?? {};
        return {
          url: COLLECTIONS_PATHS.root,
          params: { limit: size, offset: (page - 1) * size },
        };
      },
      providesTags: (res) => [
        ...(res?.items ?? []).map((c) => ({
          type: "Collection" as const,
          id: c.id,
        })),
        { type: "Collection" as const, id: LIST },
      ],
    }),

    /** GET /collections/archived?limit&offset -> Page<Collection> (owner's soft-deleted collections) */
    getArchivedCollectionsPage: build.query<
      LimitOffsetPage<Collection>,
      CollectionsPageArgs | void
    >({
      query: (args) => {
        const { page = 1, size = DEFAULT_PAGE_SIZE } = args ?? {};
        return {
          url: COLLECTIONS_PATHS.archived,
          params: { limit: size, offset: (page - 1) * size },
        };
      },
      providesTags: [{ type: "Collection" as const, id: ARCHIVE }],
    }),

    /** GET /collections/{id} */
    getCollectionById: build.query<Collection, UUID>({
      query: (id) => COLLECTIONS_PATHS.byId(id),
      providesTags: (_r, _e, id) => [{ type: "Collection", id }],
    }),

    /** POST /collections -> 201 */
    createCollection: build.mutation<Collection, CollectionCreatePayload>({
      query: (body) => ({ url: COLLECTIONS_PATHS.root, method: "POST", body }),
      invalidatesTags: [{ type: "Collection", id: LIST }],
    }),

    /** PATCH /collections/{id} (owner only) */
    updateCollection: build.mutation<
      Collection,
      { id: UUID; body: CollectionUpdatePayload }
    >({
      query: ({ id, body }) => ({
        url: COLLECTIONS_PATHS.byId(id),
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Collection", id },
        { type: "Collection", id: LIST },
      ],
    }),

    /** DELETE /collections/{id} -> 204, NO body. Soft delete = move to archive (restorable). */
    deleteCollection: build.mutation<void, UUID>({
      query: (id) => ({ url: COLLECTIONS_PATHS.byId(id), method: "DELETE" }),
      invalidatesTags: [
        { type: "Collection", id: LIST },
        { type: "Collection", id: ARCHIVE },
        "Document",
        "Job",
      ],
    }),

    /** POST /collections/{id}/restore -> Collection. Archive -> active. */
    restoreCollection: build.mutation<Collection, UUID>({
      query: (id) => ({ url: COLLECTIONS_PATHS.restore(id), method: "POST" }),
      invalidatesTags: [
        { type: "Collection", id: LIST },
        { type: "Collection", id: ARCHIVE },
        "Document",
      ],
    }),

    /** DELETE /collections/{id}/purge -> 202. Permanent: Celery wipes documents/vectors, no way back. */
    purgeCollection: build.mutation<void, UUID>({
      query: (id) => ({ url: COLLECTIONS_PATHS.purge(id), method: "DELETE" }),
      invalidatesTags: [{ type: "Collection", id: ARCHIVE }],
    }),

    /** GET /collections/{id}/members -> MemberRead[] (not paginated, owner not included) */
    listMembers: build.query<CollectionMember[], UUID>({
      query: (id) => COLLECTIONS_PATHS.members(id),
      providesTags: (_r, _e, id) => [{ type: "CollectionMember", id }],
    }),

    /** POST /collections/{id}/members -> upsert: adds the member or changes the role */
    upsertMember: build.mutation<
      { user_id: UUID; role: MemberRole },
      MemberUpsertPayload
    >({
      query: ({ collectionId, ...body }) => ({
        url: COLLECTIONS_PATHS.members(collectionId),
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { collectionId }) => [
        { type: "CollectionMember", id: collectionId },
      ],
    }),

    /** DELETE /collections/{id}/members/{user_id} -> 204 */
    removeMember: build.mutation<void, { collectionId: UUID; userId: UUID }>({
      query: ({ collectionId, userId }) => ({
        url: COLLECTIONS_PATHS.member(collectionId, userId),
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { collectionId }) => [
        { type: "CollectionMember", id: collectionId },
      ],
    }),
  }),
});

export const {
  useGetCollectionsPageQuery,
  useGetArchivedCollectionsPageQuery,
  useGetCollectionByIdQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
  useRestoreCollectionMutation,
  usePurgeCollectionMutation,
  useListMembersQuery,
  useUpsertMemberMutation,
  useRemoveMemberMutation,
} = collectionsApi;
