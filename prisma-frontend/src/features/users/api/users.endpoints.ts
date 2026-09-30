import { baseApi } from "@/shared/api/baseApi";
import {
  emptyPage,
  type ApiEnvelope,
  type MessageOnly,
  type MutationResult,
  type PageData,
  type UUID,
} from "@/shared/types/api";
import { USERS_PATHS } from "../constants/users.constants";
import type {
  User,
  UserBulkUpdatePayload,
  UserCreatePayload,
  UserProfileUpdatePayload,
  UserRolesAssignPayload,
  UserUpdatePayload,
  UsersPageArgs,
} from "../types/user.types";

const LIST = "LIST" as const;

const unwrap = <T>(r: ApiEnvelope<T>): T => r.data as T;
const withMessage = <T>(r: ApiEnvelope<T>): MutationResult<T> => ({ data: r.data as T, message: r.message });

export const usersApi = baseApi.injectEndpoints({
  overrideExisting: false,
  endpoints: (build) => ({
    /** GET /users/list | /users/order_by_created_at  -> envelope<PageData<User>> */
    getUsersPage: build.query<PageData<User>, UsersPageArgs | void>({
      query: (args) => {
        const { page = 1, size = 20, orderBy = "default" } = args ?? {};
        return {
          url: orderBy === "created_at" ? USERS_PATHS.byCreatedAt : USERS_PATHS.list,
          params: { page, size },
        };
      },
      transformResponse: (r: ApiEnvelope<PageData<User>>) => r.data ?? emptyPage<User>(),
      providesTags: (res) => [
        ...(res?.items ?? []).map((u) => ({ type: "User" as const, id: u.id })),
        { type: "User" as const, id: LIST },
      ],
    }),

    /**
     * GET /users?email=...  -> envelope<PageData<User>> with a FAKE page
     * (page=1,pages=1). The backend ignores page/size on this route.
     */
    searchUsersByEmail: build.query<User[], string>({
      query: (email) => ({ url: USERS_PATHS.root, params: { email } }),
      transformResponse: (r: ApiEnvelope<PageData<User>>) => r.data?.items ?? [],
      providesTags: (res) => [
        ...(res ?? []).map((u) => ({ type: "User" as const, id: u.id })),
        { type: "User" as const, id: LIST },
      ],
    }),

    /** GET /users/{id} */
    getUserById: build.query<User, UUID>({
      query: (id) => USERS_PATHS.byId(id),
      transformResponse: unwrap<User>,
      providesTags: (_r, _e, id) => [{ type: "User", id }],
    }),

    /** POST /users -> 201 */
    createUser: build.mutation<MutationResult<User>, UserCreatePayload>({
      query: (body) => ({ url: USERS_PATHS.root, method: "POST", body }),
      transformResponse: withMessage<User>,
      invalidatesTags: [{ type: "User", id: LIST }],
    }),

    /** PUT /users/{id}  (message: "User updated successfully" | "No changes to update") */
    updateUser: build.mutation<MutationResult<User>, { id: UUID; body: UserUpdatePayload }>({
      query: ({ id, body }) => ({ url: USERS_PATHS.byId(id), method: "PUT", body }),
      transformResponse: withMessage<User>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "User", id },
        { type: "User", id: LIST },
        "Session",
      ],
    }),

    /** PUT /users/me */
    updateMyProfile: build.mutation<MutationResult<User>, UserProfileUpdatePayload>({
      query: (body) => ({ url: USERS_PATHS.me, method: "PUT", body }),
      transformResponse: withMessage<User>,
      invalidatesTags: [
        "Session",
        { type: "User", id: LIST },
      ],
    }),

    /** PUT /users/bulk-update -> envelope<User[]> (unknown ids are silently skipped) */
    bulkUpdateUsers: build.mutation<MutationResult<User[]>, UserBulkUpdatePayload>({
      query: (body) => ({ url: USERS_PATHS.bulkUpdate, method: "PUT", body }),
      transformResponse: withMessage<User[]>,
      invalidatesTags: (_r, _e, { user_ids }) => [
        ...user_ids.map((id) => ({ type: "User" as const, id })),
        { type: "User" as const, id: LIST },
      ],
    }),

    /** DELETE /users/{id} -> 200 + envelope<User> (the deleted user), NOT 204 */
    deleteUser: build.mutation<MutationResult<User>, UUID>({
      query: (id) => ({ url: USERS_PATHS.byId(id), method: "DELETE" }),
      transformResponse: withMessage<User>,
      invalidatesTags: (_r, _e, id) => [
        { type: "User", id },
        { type: "User", id: LIST },
      ],
    }),

    /** POST /users/{id}/roles -> {message} only. REPLACES the user's whole role set. */
    assignUserRoles: build.mutation<MessageOnly, UserRolesAssignPayload>({
      query: (body) => ({ url: USERS_PATHS.roles(body.user_id), method: "POST", body }),
      invalidatesTags: (_r, _e, { user_id }) => [
        { type: "User", id: user_id },
        { type: "User", id: LIST },
        "Session",
      ],
    }),
  }),
});

export const {
  useGetUsersPageQuery,
  useSearchUsersByEmailQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useUpdateMyProfileMutation,
  useBulkUpdateUsersMutation,
  useDeleteUserMutation,
  useAssignUserRolesMutation,
} = usersApi;
