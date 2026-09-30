import { useState } from "react";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Modal } from "@/shared/ui/Modal";
import { useSession } from "@/features/auth";
import { btnDanger, btnSecondary } from "@/shared/ui/classes";
import { useGetUserByIdQuery } from "../api/users.endpoints";
import { useUserActions } from "../hooks/useUserActions";
import { userFullName } from "../lib/userMappers";

interface Props {
  userId: string;
  onClose: () => void;
  onDeleted?: (message: string) => void;
}

export function DeleteUserDialog({ userId, onClose, onDeleted }: Props) {
  const { data: user } = useGetUserByIdQuery(userId);
  const { user: me } = useSession();
  const { deleteUser, isMutating } = useUserActions();
  const [error, setError] = useState<string | null>(null);
  const isSelf = me?.id === userId; // backend refuses self-delete anyway

  async function confirm() {
    try {
      const res = await deleteUser(userId);
      onDeleted?.(res.message);
      onClose();
    } catch (e) {
      setError(isNormalizedApiError(e) ? e.message : "Unexpected error");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete user"
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            className={btnDanger}
            disabled={isMutating || isSelf}
            onClick={confirm}
          >
            {isMutating ? "Deleting…" : "Delete"}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {isSelf
          ? "You can't delete your own account."
          : `Delete ${user ? userFullName(user) : "this user"}? This cannot be undone.`}
      </p>
      {error && <p className="mt-3 text-sm text-error-500">{error}</p>}
    </Modal>
  );
}
