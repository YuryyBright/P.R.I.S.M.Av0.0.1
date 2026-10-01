import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Modal } from "@/shared/ui/Modal";
import { btnPrimary, btnSecondary, inputClass } from "@/shared/ui/classes";
import { Alert } from "@/shared/ui/Alert";
import type { UUID } from "@/shared/types/api";
import { MEMBER_ROLE_OPTIONS } from "../constants/collections.constants";
import { useGetCollectionByIdQuery, useListMembersQuery } from "../api/collections.endpoints";
import { useCollectionActions } from "../hooks/useCollectionActions";
import { isUuid } from "../lib/collectionMappers";
import type { MemberRole } from "../types/collection.types";

interface Props {
  collectionId: UUID;
  onClose: () => void;
}

const td = "py-2 pr-3 text-theme-sm text-gray-700 dark:text-gray-300";

export function MembersModal({ collectionId, onClose }: Props) {
  const { t } = useTranslation();
  const { data: collection } = useGetCollectionByIdQuery(collectionId);
  const { data: members = [], isLoading } = useListMembersQuery(collectionId);
  const { upsertMember, removeMember, isMutating } = useCollectionActions();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<MemberRole>("viewer");
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(isNormalizedApiError(e) ? e.message : t("errors.unexpected"));
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const id = userId.trim();
    if (!isUuid(id)) return setError(t("collections.members.invalidUuid"));
    void run(async () => {
      await upsertMember(collectionId, { user_id: id, role });
      setUserId("");
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        collection
          ? t("collections.members.title", { name: collection.name })
          : t("collections.members.titleGeneric")
      }
      footer={
        <button className={btnSecondary} onClick={onClose}>
          {t("common.close")}
        </button>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}

        {collection && (
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {t("collections.members.owner")} <span className="font-mono">{collection.owner_id}</span>
          </p>
        )}

        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputClass} min-w-0 flex-1`}
            placeholder={t("collections.members.userIdPlaceholder")}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <select
            className={`${inputClass} w-auto`}
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
          >
            {MEMBER_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
          <button type="submit" className={btnPrimary} disabled={isMutating}>
            {t("common.add")}
          </button>
        </form>

        <table className="min-w-full">
          <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {isLoading && (
              <tr>
                <td className={td}>{t("common.loading")}</td>
              </tr>
            )}
            {!isLoading && members.length === 0 && (
              <tr>
                <td className={td}>{t("collections.members.empty")}</td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.user_id}>
                <td className={`${td} font-mono text-theme-xs`}>{m.user_id}</td>
                <td className={td}>
                  {/* same endpoint as "add": POST is an upsert */}
                  <select
                    className={`${inputClass} w-auto`}
                    value={m.role}
                    disabled={isMutating}
                    onChange={(e) =>
                      void run(() => upsertMember(collectionId, { user_id: m.user_id, role: e.target.value as MemberRole }))
                    }
                  >
                    {MEMBER_ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(o.labelKey)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`${td} text-end`}>
                  <button
                    className="text-error-500 hover:underline"
                    disabled={isMutating}
                    onClick={() => void run(() => removeMember(collectionId, m.user_id))}
                  >
                    {t("common.remove")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
