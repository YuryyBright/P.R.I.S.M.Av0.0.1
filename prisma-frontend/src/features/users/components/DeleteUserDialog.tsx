import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      setError(isNormalizedApiError(e) ? e.message : t("errors.unexpected"));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("users.delete.title")}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            className={btnDanger}
            disabled={isMutating || isSelf}
            onClick={confirm}
          >
            {isMutating ? t("common.deleting") : t("common.delete")}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {isSelf
          ? t("users.delete.self")
          : user
            ? t("users.delete.confirm", { name: userFullName(user) })
            : t("users.delete.confirmGeneric")}
      </p>
      {error && <p className="mt-3 text-sm text-error-500">{error}</p>}
    </Modal>
  );
}
