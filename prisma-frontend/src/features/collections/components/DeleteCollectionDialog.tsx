import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Modal } from "@/shared/ui/Modal";
import { btnDanger, btnSecondary } from "@/shared/ui/classes";
import { useGetCollectionByIdQuery } from "../api/collections.endpoints";
import { useCollectionActions } from "../hooks/useCollectionActions";

interface Props {
  collectionId: string;
  onClose: () => void;
  onDeleted?: (message: string) => void;
}

export function DeleteCollectionDialog({ collectionId, onClose, onDeleted }: Props) {
  const { t } = useTranslation();
  const { data: collection } = useGetCollectionByIdQuery(collectionId);
  const { deleteCollection, isMutating } = useCollectionActions();
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    try {
      await deleteCollection(collectionId); // 204, no body
      onDeleted?.(t("collections.delete.deleted"));
      onClose();
    } catch (e) {
      setError(isNormalizedApiError(e) ? e.message : t("errors.unexpected"));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("collections.delete.title")}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className={btnDanger} disabled={isMutating} onClick={confirm}>
            {isMutating ? t("common.deleting") : t("common.delete")}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {collection
          ? t("collections.delete.confirm", { name: collection.name })
          : t("collections.delete.confirmGeneric")}
      </p>
      {error && <p className="mt-3 text-sm text-error-500">{error}</p>}
    </Modal>
  );
}
