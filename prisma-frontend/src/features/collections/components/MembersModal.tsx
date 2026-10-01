import { useState, useRef, useEffect, type FormEvent } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useTranslation } from "react-i18next";

import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Modal } from "@/shared/ui/Modal";
import { btnPrimary, btnSecondary, inputClass } from "@/shared/ui/classes";
import { Alert } from "@/shared/ui/Alert";
import type { UUID } from "@/shared/types/api";

import { MEMBER_ROLE_OPTIONS } from "../constants/collections.constants";
import {
  useGetCollectionByIdQuery,
  useListMembersQuery,
} from "../api/collections.endpoints";
import { useCollectionActions } from "../hooks/useCollectionActions";
import type { MemberRole } from "../types/collection.types";

import { useSearchUsersByEmailQuery } from "@/features/users/api/users.endpoints";
import type { User } from "@/features/users/types/user.types";

interface Props {
  collectionId: UUID;
  onClose: () => void;
}

type UserSummary = Pick<User, "id" | "email" | "first_name" | "last_name">;

export function MembersModal({ collectionId, onClose }: Props) {
  const { t } = useTranslation();

  const { data: collection } = useGetCollectionByIdQuery(collectionId);

  const { data: members = [], isLoading: membersLoading } =
    useListMembersQuery(collectionId);

  const { upsertMember, removeMember, isMutating } = useCollectionActions();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [role, setRole] = useState<MemberRole>("viewer");
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  /**
   * GET /users?email=...
   *
   * searchUsersByEmail вже має:
   *
   * transformResponse:
   *   (r) => r.data?.items ?? []
   *
   * тому usersResponse має тип User[], а не ApiEnvelope.
   *
   * skipToken не дозволяє виконувати запит,
   * коли поле пошуку порожнє.
   */
  const { data: usersResponse = [], isFetching: usersLoading } =
    useSearchUsersByEmailQuery(
      searchQuery.trim() ? searchQuery.trim() : skipToken,
    );

  /**
   * Endpoint вже повертає User[].
   */
  const rawUsers: UserSummary[] = usersResponse;

  /**
   * Не показуємо:
   * - власника колекції;
   * - користувачів, які вже є учасниками.
   */
  const availableUsers = rawUsers.filter(
    (user) =>
      user.id !== collection?.owner_id &&
      !members.some((member) => member.user_id === user.id),
  );

  /**
   * Закриття dropdown при кліку за його межами.
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /**
   * Універсальний wrapper для mutation.
   */
  async function run(fn: () => Promise<unknown>) {
    setError(null);

    try {
      await fn();
    } catch (e) {
      setError(isNormalizedApiError(e) ? e.message : t("errors.unexpected"));
    }
  }

  /**
   * Додавання нового учасника.
   */
  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedUser) {
      setError(
        t(
          "collections.members.selectUserRequired",
          "Оберіть користувача зі списку",
        ),
      );

      return;
    }

    void run(async () => {
      await upsertMember(collectionId, {
        user_id: selectedUser.id,
        role,
      });

      setSelectedUser(null);
      setSearchQuery("");
      setIsDropdownOpen(false);
    });
  }

  /**
   * Повне ім'я користувача.
   */
  function getFullName(user: UserSummary) {
    return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  }

  /**
   * Перша літера для avatar.
   */
  function getInitial(user: UserSummary) {
    return (
      user.first_name?.[0] ??
      user.last_name?.[0] ??
      user.email?.[0] ??
      "?"
    ).toUpperCase();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        collection
          ? t("collections.members.title", {
              name: collection.name,
            })
          : t("collections.members.titleGeneric")
      }
      footer={
        <button type="button" className={btnSecondary} onClick={onClose}>
          {t("common.close")}
        </button>
      }
    >
      <div className="space-y-6">
        {error && <Alert>{error}</Alert>}

        {/* =========================
            ADD MEMBER
        ========================= */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/5 dark:bg-white/[0.02]">
          <h4 className="mb-3 text-theme-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
            {t("collections.members.addNew", "Додати учасника")}
          </h4>

          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            {/* =========================
                USER AUTOCOMPLETE
            ========================= */}
            <div ref={dropdownRef} className="relative flex-1">
              <div className="relative">
                <input
                  type="text"
                  className={`${inputClass} w-full pr-9`}
                  placeholder={
                    selectedUser
                      ? `${getFullName(selectedUser)} (${selectedUser.email})`
                      : t(
                          "collections.members.searchPlaceholder",
                          "Введіть email для пошуку...",
                        )
                  }
                  value={selectedUser ? selectedUser.email : searchQuery}
                  onChange={(event) => {
                    setSelectedUser(null);
                    setSearchQuery(event.target.value);
                    setIsDropdownOpen(true);
                    setError(null);
                  }}
                  onFocus={() => {
                    setIsDropdownOpen(true);
                  }}
                  autoComplete="off"
                />

                {selectedUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null);
                      setSearchQuery("");
                      setIsDropdownOpen(true);
                    }}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={t("common.clear", "Очистити")}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* =========================
                  SEARCH RESULTS
              ========================= */}
              {isDropdownOpen && !selectedUser && (
                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-gray-800">
                  {usersLoading && (
                    <div className="px-3 py-2 text-theme-xs text-gray-400">
                      {t("common.loading", "Пошук...")}
                    </div>
                  )}

                  {!usersLoading &&
                    searchQuery.trim() &&
                    availableUsers.length === 0 && (
                      <div className="px-3 py-2 text-theme-xs text-gray-500">
                        {t(
                          "collections.members.noUsersFound",
                          "Користувачів не знайдено",
                        )}
                      </div>
                    )}

                  {!usersLoading && !searchQuery.trim() && (
                    <div className="px-3 py-2 text-theme-xs text-gray-500">
                      {t(
                        "collections.members.startTyping",
                        "Почніть вводити для пошуку",
                      )}
                    </div>
                  )}

                  {availableUsers.map((user) => {
                    const fullName = getFullName(user);

                    return (
                      <button
                        key={user.id}
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gray-100/70 dark:hover:bg-white/5"
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchQuery("");
                          setIsDropdownOpen(false);
                          setError(null);
                        }}
                      >
                        {/* Avatar */}
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                          {getInitial(user)}
                        </div>

                        {/* User info */}
                        <div className="min-w-0 flex-1">
                          {fullName && (
                            <p className="truncate text-theme-xs font-medium text-gray-800 dark:text-white/90">
                              {fullName}
                            </p>
                          )}

                          <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                            {user.email}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* =========================
                ROLE
            ========================= */}
            <select
              className={`${inputClass} sm:w-36`}
              value={role}
              onChange={(event) => {
                setRole(event.target.value as MemberRole);
              }}
            >
              {MEMBER_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`collections.roles.${option.value}`, option.label)}
                </option>
              ))}
            </select>

            {/* =========================
                ADD BUTTON
            ========================= */}
            <button
              type="submit"
              className={`${btnPrimary} whitespace-nowrap`}
              disabled={isMutating || !selectedUser}
            >
              {t("common.add", "Додати")}
            </button>
          </form>
        </div>

        {/* =========================
            CURRENT MEMBERS
        ========================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-theme-xs text-gray-500 dark:text-gray-400">
            <span>
              {t("collections.members.currentMembers", "Учасники")} (
              {members.length})
            </span>

            {collection && (
              <span className="max-w-[200px] truncate">
                {t("collections.members.owner", "Власник")}:{" "}
                <span className="font-mono text-gray-700 dark:text-gray-300">
                  {collection.owner_id}
                </span>
              </span>
            )}
          </div>

          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-white/5 dark:border-white/5">
            {/* Loading */}
            {membersLoading && (
              <div className="p-4 text-center text-theme-sm text-gray-400">
                {t("common.loading")}
              </div>
            )}

            {/* Empty */}
            {!membersLoading && members.length === 0 && (
              <div className="p-6 text-center text-theme-sm text-gray-500">
                {t("collections.members.empty", "Учасників ще немає")}
              </div>
            )}

            {/* Members */}
            {!membersLoading &&
              members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
                >
                  {/* User */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 dark:bg-white/5 dark:text-gray-300">
                      ID
                    </div>

                    <div className="min-w-0">
                      <p className="font-mono truncate text-theme-xs text-gray-700 dark:text-gray-300">
                        {member.user_id}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-3">
                    <select
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-theme-xs text-gray-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-gray-800 dark:text-gray-300"
                      value={member.role}
                      disabled={isMutating}
                      onChange={(event) => {
                        void run(() =>
                          upsertMember(collectionId, {
                            user_id: member.user_id,
                            role: event.target.value as MemberRole,
                          }),
                        );
                      }}
                    >
                      {MEMBER_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(`collections.roles.${option.value}`, option.label)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-error-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-error-500/10"
                      disabled={isMutating}
                      title={t("common.remove")}
                      onClick={() => {
                        void run(() =>
                          removeMember(collectionId, member.user_id),
                        );
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
