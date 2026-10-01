import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
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
import { RoleBadge } from "./CollectionBadges";
import { SearchIcon, SpinnerIcon, UserIcon, XIcon } from "./CollectionIcons";

import { useSearchUsersByEmailQuery } from "@/features/users/api/users.endpoints";
import type { User } from "@/features/users/types/user.types";

interface Props {
  collectionId: UUID;
  onClose: () => void;
}

type UserSummary = Pick<User, "id" | "email" | "first_name" | "last_name">;

const roleSelect =
  "h-10 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm text-gray-700 shadow-xs transition-colors hover:border-gray-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-white/20";

const skeleton =
  "animate-pulse rounded-md bg-gray-100 motion-reduce:animate-none dark:bg-white/5";

function getFullName(user: UserSummary) {
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
}

function getInitial(user: UserSummary) {
  return (
    user.first_name?.[0] ??
    user.last_name?.[0] ??
    user.email?.[0] ??
    "?"
  ).toUpperCase();
}

function Avatar({ children }: { children?: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-theme-xs font-semibold text-gray-600 dark:bg-white/5 dark:text-gray-300"
    >
      {children ?? <UserIcon className="size-4" />}
    </span>
  );
}

export function MembersModal({ collectionId, onClose }: Props) {
  const { t } = useTranslation();
  const listboxId = useId();

  const { data: collection } = useGetCollectionByIdQuery(collectionId);

  const { data: members = [], isLoading: membersLoading } =
    useListMembersQuery(collectionId);

  const { upsertMember, removeMember, isMutating } = useCollectionActions();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [role, setRole] = useState<MemberRole>("viewer");
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  /**
   * GET /users?email=...
   *
   * searchUsersByEmail already has:
   *   transformResponse: (r) => r.data?.items ?? []
   * so the data is User[], not ApiEnvelope.
   *
   * skipToken prevents the request while the search field is empty.
   */
  const trimmedQuery = searchQuery.trim();
  const { data: usersResponse = [], isFetching: usersLoading } =
    useSearchUsersByEmailQuery(trimmedQuery ? trimmedQuery : skipToken);

  const rawUsers: UserSummary[] = usersResponse;

  /** Hide the collection owner and users who are already members. */
  const availableUsers = rawUsers.filter(
    (user) =>
      user.id !== collection?.owner_id &&
      !members.some((member) => member.user_id === user.id),
  );

  const showList = isDropdownOpen && !selectedUser;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  /** Close the dropdown on outside click. */
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

  /** Generic wrapper for mutations. */
  async function run(fn: () => Promise<unknown>) {
    setError(null);

    try {
      await fn();
    } catch (e) {
      setError(isNormalizedApiError(e) ? e.message : t("errors.unexpected"));
    }
  }

  function selectUser(user: UserSummary) {
    setSelectedUser(user);
    setSearchQuery("");
    setIsDropdownOpen(false);
    setError(null);
  }

  function clearSelection() {
    setSelectedUser(null);
    setSearchQuery("");
    setIsDropdownOpen(true);
  }

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

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isDropdownOpen) {
        setIsDropdownOpen(true);
        return;
      }
      setActiveIndex((i) =>
        Math.min(i + 1, Math.max(availableUsers.length - 1, 0)),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && showList) {
      const user = availableUsers[activeIndex];
      if (user) {
        event.preventDefault();
        selectUser(user);
      }
    } else if (event.key === "Escape" && isDropdownOpen) {
      // Close only the list, not the whole modal.
      event.stopPropagation();
      setIsDropdownOpen(false);
    }
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
        <button
          type="button"
          className={`${btnSecondary} w-full sm:w-auto`}
          onClick={onClose}
        >
          {t("common.close")}
        </button>
      }
    >
      <div className="space-y-6">
        {error && <Alert>{error}</Alert>}

        {/* ───────── Add member ───────── */}
        <section
          aria-labelledby={`${listboxId}-add-title`}
          className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/5 dark:bg-white/2"
        >
          <h3
            id={`${listboxId}-add-title`}
            className="text-theme-sm font-medium text-gray-800 dark:text-white/90"
          >
            {t("collections.members.addNew", "Додати учасника")}
          </h3>
          <p className="mt-0.5 mb-3 text-theme-xs text-gray-500 dark:text-gray-400">
            {t(
              "collections.members.addHint",
              "Знайдіть користувача за email і виберіть його роль.",
            )}
          </p>

          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-2 sm:flex-row sm:items-start"
          >
            {/* User autocomplete (combobox) */}
            <div ref={dropdownRef} className="relative flex-1">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />

                <input
                  type="text"
                  role="combobox"
                  aria-label={t(
                    "collections.members.searchLabel",
                    "Пошук користувача за email",
                  )}
                  aria-expanded={showList && availableUsers.length > 0}
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    showList && availableUsers.length > 0
                      ? optionId(activeIndex)
                      : undefined
                  }
                  className={`${inputClass} h-10 w-full pr-9 pl-9`}
                  placeholder={t(
                    "collections.members.searchPlaceholder",
                    "Введіть email для пошуку...",
                  )}
                  value={selectedUser ? selectedUser.email : searchQuery}
                  onChange={(event) => {
                    setSelectedUser(null);
                    setSearchQuery(event.target.value);
                    setActiveIndex(0);
                    setIsDropdownOpen(true);
                    setError(null);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                />

                {selectedUser && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:hover:bg-white/5 dark:hover:text-gray-200"
                    aria-label={t("common.clear", "Очистити")}
                  >
                    <XIcon className="size-4" />
                  </button>
                )}
              </div>

              {selectedUser && getFullName(selectedUser) && (
                <p className="mt-1.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {getFullName(selectedUser)}
                </p>
              )}

              {/* Search results */}
              {showList && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg transition duration-150 ease-out dark:border-white/10 dark:bg-gray-800 starting:-translate-y-1 starting:opacity-0">
                  {usersLoading && (
                    <p
                      role="status"
                      className="flex items-center gap-2 px-3 py-2.5 text-theme-xs text-gray-500 dark:text-gray-400"
                    >
                      <SpinnerIcon className="size-3.5" />
                      {t("collections.members.searching", "Пошук...")}
                    </p>
                  )}

                  {!usersLoading && !trimmedQuery && (
                    <p className="px-3 py-2.5 text-theme-xs text-gray-500 dark:text-gray-400">
                      {t(
                        "collections.members.startTyping",
                        "Почніть вводити для пошуку",
                      )}
                    </p>
                  )}

                  {!usersLoading &&
                    trimmedQuery &&
                    availableUsers.length === 0 && (
                      <p
                        role="status"
                        className="px-3 py-2.5 text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        {t(
                          "collections.members.noUsersFound",
                          "Користувачів не знайдено",
                        )}
                      </p>
                    )}

                  <ul
                    id={listboxId}
                    role="listbox"
                    aria-label={t(
                      "collections.members.results",
                      "Результати пошуку",
                    )}
                  >
                    {availableUsers.map((user, index) => {
                      const fullName = getFullName(user);
                      const isActive = index === activeIndex;

                      return (
                        <li
                          key={user.id}
                          id={optionId(index)}
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseDown={(event) => {
                            // keep input focus; select on mousedown
                            event.preventDefault();
                            selectUser(user);
                          }}
                          className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors ${
                            isActive
                              ? "bg-gray-100 dark:bg-white/5"
                              : "bg-transparent"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-semibold text-brand-600 dark:text-brand-400"
                          >
                            {getInitial(user)}
                          </span>

                          <span className="min-w-0 flex-1">
                            {fullName && (
                              <span className="block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                                {fullName}
                              </span>
                            )}
                            <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                              {user.email}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Role */}
            <select
              className={`${roleSelect} sm:w-36`}
              aria-label={t("collections.members.roleLabel", "Роль")}
              value={role}
              onChange={(event) => setRole(event.target.value as MemberRole)}
            >
              {MEMBER_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(`collections.roles.${option.value}`, option.label)}
                </option>
              ))}
            </select>

            {/* Add */}
            <button
              type="submit"
              className={`${btnPrimary} h-10 w-full gap-2 whitespace-nowrap sm:w-auto`}
              disabled={isMutating || !selectedUser}
            >
              {isMutating ? <SpinnerIcon /> : null}
              {t("common.add", "Додати")}
            </button>
          </form>
        </section>

        {/* ───────── Current members ───────── */}
        <section className="space-y-3">
          <h3 className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
            {t("collections.members.currentMembers", "Учасники")}{" "}
            <span className="font-normal text-gray-500 tabular-nums dark:text-gray-400">
              ({members.length})
            </span>
          </h3>

          <ul
            aria-busy={membersLoading}
            className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 dark:divide-white/5 dark:border-white/5"
          >
            {/* Owner (always first, cannot be changed here) */}
            {collection && (
              <li className="flex items-center justify-between gap-3 bg-gray-50/50 p-3 dark:bg-white/2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar />
                  <div className="min-w-0">
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {t("collections.members.owner", "Власник")}
                    </p>
                    <p
                      className="font-mono truncate text-theme-xs text-gray-700 dark:text-gray-300"
                      title={collection.owner_id}
                    >
                      {collection.owner_id}
                    </p>
                  </div>
                </div>
                <RoleBadge role="owner" />
              </li>
            )}

            {/* Loading */}
            {membersLoading &&
              [0, 1].map((i) => (
                <li key={i} className="flex items-center gap-3 p-3">
                  <div className={`${skeleton} size-9 rounded-full`} />
                  <div className={`${skeleton} h-3.5 w-48 max-w-full`} />
                  {i === 0 && (
                    <span className="sr-only">{t("common.loading")}</span>
                  )}
                </li>
              ))}

            {/* Empty */}
            {!membersLoading && members.length === 0 && (
              <li className="px-4 py-8 text-center">
                <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("collections.members.empty", "Учасників ще немає")}
                </p>
                <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                  {t(
                    "collections.members.emptyHint",
                    "Додайте першого учасника за допомогою форми вище.",
                  )}
                </p>
              </li>
            )}

            {/* Members */}
            {!membersLoading &&
              members.map((member) => (
                <li
                  key={member.user_id}
                  className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-gray-50/50 dark:hover:bg-white/2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar />
                    <p
                      className="font-mono truncate text-theme-xs text-gray-700 dark:text-gray-300"
                      title={member.user_id}
                    >
                      {member.user_id}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <select
                      className={`${roleSelect} h-9`}
                      aria-label={t(
                        "collections.members.changeRole",
                        "Змінити роль учасника",
                      )}
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
                      className="flex size-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none active:bg-error-100 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-error-500/10 dark:hover:text-error-400"
                      disabled={isMutating}
                      aria-label={t("common.remove")}
                      title={t("common.remove")}
                      onClick={() => {
                        void run(() =>
                          removeMember(collectionId, member.user_id),
                        );
                      }}
                    >
                      <XIcon className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
