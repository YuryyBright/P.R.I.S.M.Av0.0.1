import type { UUID } from "@/shared/types/api";
import {
  useAssignUserRolesMutation,
  useBulkUpdateUsersMutation,
  useCreateUserMutation,
  useDeleteUserMutation,
  useUpdateMyProfileMutation,
  useUpdateUserMutation,
} from "../api/users.endpoints";
import type {
  UserBulkUpdatePayload,
  UserCreatePayload,
  UserProfileUpdatePayload,
  UserUpdatePayload,
} from "../types/user.types";

/**
 * Every action resolves with the server payload or THROWS a NormalizedApiError
 * (use isNormalizedApiError in catch). Toasts/forms decide what to do with it.
 */
export function useUserActions() {
  const [create, createS] = useCreateUserMutation();
  const [update, updateS] = useUpdateUserMutation();
  const [updateProfile, profileS] = useUpdateMyProfileMutation();
  const [bulk, bulkS] = useBulkUpdateUsersMutation();
  const [remove, removeS] = useDeleteUserMutation();
  const [assign, assignS] = useAssignUserRolesMutation();

  return {
    createUser: (body: UserCreatePayload) => create(body).unwrap(),
    updateUser: (id: UUID, body: UserUpdatePayload) => update({ id, body }).unwrap(),
    updateMyProfile: (body: UserProfileUpdatePayload) => updateProfile(body).unwrap(),
    bulkUpdateUsers: (body: UserBulkUpdatePayload) => bulk(body).unwrap(),
    deleteUser: (id: UUID) => remove(id).unwrap(),
    /** Replaces the user's entire role set. */
    assignRoles: (userId: UUID, roleIds: UUID[]) =>
      assign({ user_id: userId, role_ids: roleIds }).unwrap(),
    isMutating: [createS, updateS, profileS, bulkS, removeS, assignS].some((s) => s.isLoading),
  };
}
