import type { UUID } from "@/shared/types/api";
import {
  useCreateCollectionMutation,
  useDeleteCollectionMutation,
  useRemoveMemberMutation,
  useUpdateCollectionMutation,
  useUpsertMemberMutation,
} from "../api/collections.endpoints";
import type { CollectionCreatePayload, CollectionUpdatePayload, MemberRole } from "../types/collection.types";

/**
 * Every action resolves with the server payload (void for deletes) or THROWS a
 * NormalizedApiError (use isNormalizedApiError in catch).
 */
export function useCollectionActions() {
  const [create, createS] = useCreateCollectionMutation();
  const [update, updateS] = useUpdateCollectionMutation();
  const [remove, removeS] = useDeleteCollectionMutation();
  const [upsert, upsertS] = useUpsertMemberMutation();
  const [dropMember, dropS] = useRemoveMemberMutation();

  return {
    createCollection: (body: CollectionCreatePayload) => create(body).unwrap(),
    updateCollection: (id: UUID, body: CollectionUpdatePayload) => update({ id, body }).unwrap(),
    deleteCollection: (id: UUID) => remove(id).unwrap(),
    /** Adds the member or changes the role. */
    upsertMember: (collectionId: UUID, member: { user_id: UUID; role: MemberRole }) =>
      upsert({ collectionId, ...member }).unwrap(),
    removeMember: (collectionId: UUID, userId: UUID) => dropMember({ collectionId, userId }).unwrap(),
    isMutating: [createS, updateS, removeS, upsertS, dropS].some((s) => s.isLoading),
  };
}
