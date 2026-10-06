import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Modal } from "@/shared/ui/Modal";
import { btnDanger, btnSecondary, inputClass } from "@/shared/ui/classes";
import type { UUID } from "@/shared/types/api";
import {
  useDeleteConversationMutation,
  useGetConversationsPageQuery,
  useUpdateConversationMutation,
} from "../../api/ai.endpoints";
import {
  AI_ROUTES,
  CONVERSATIONS_PAGE_SIZE,
} from "../../constants/ai.constants";
import {
  conversationTitle,
  dayBucket,
  DAY_BUCKET_LABELS,
  type DayBucket,
} from "../../lib/format";
import { aiUiActions, aiUiSlice } from "../../store/aiUiSlice";
import type { Conversation } from "../../types/ai.types";
import {
  ArchiveIcon,
  BotIcon,
  CheckIcon,
  MessageIcon,
  PencilIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
  XIcon,
  btnContent,
} from "../AiIcons";
import { focusRing, skeleton } from "../AiUi";

const BUCKET_ORDER: DayBucket[] = ["today", "yesterday", "week", "older"];

const rowAction = `inline-flex size-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white/90 ${focusRing}`;

function ConversationRow({
  c,
  onRename,
  onArchive,
  onDelete,
  onNavigate,
}: {
  c: Conversation;
  onRename: (id: UUID, title: string) => Promise<void>;
  onArchive: (c: Conversation) => void;
  onDelete: (c: Conversation) => void;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (title && title !== c.title) await onRename(c.id, title);
    setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={submit} className="flex items-center gap-1 px-1 py-0.5">
        <input
          autoFocus
          value={draft}
          maxLength={255}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          aria-label={t("ai.sidebar.rename", "Перейменувати")}
          className={`${inputClass} h-8 min-w-0 flex-1 px-2 text-theme-sm`}
        />
        <button
          type="submit"
          className={rowAction}
          aria-label={t("common.save", "Зберегти")}
        >
          <CheckIcon className="size-4" />
        </button>
        <button
          type="button"
          className={rowAction}
          aria-label={t("common.cancel", "Скасувати")}
          onClick={() => setEditing(false)}
        >
          <XIcon className="size-4" />
        </button>
      </form>
    );
  }

  return (
    <div className="group/row relative">
      <NavLink
        to={AI_ROUTES.chatDetail(c.id)}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-2.5 rounded-lg py-2 ps-2.5 pe-2.5 text-theme-sm transition-colors ${focusRing} ${
            isActive
              ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
              : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
          }`
        }
      >
        {c.mode === "agent" ? (
          <BotIcon className="size-4 text-gray-400" />
        ) : (
          <MessageIcon className="size-4 text-gray-400" />
        )}
        <span className="min-w-0 flex-1 truncate">{conversationTitle(c)}</span>
      </NavLink>
      <div className="absolute inset-e-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 dark:bg-gray-800">
        <button
          type="button"
          className={rowAction}
          aria-label={t("ai.sidebar.rename", "Перейменувати")}
          onClick={() => {
            setDraft(c.title ?? "");
            setEditing(true);
          }}
        >
          <PencilIcon className="size-3.5" />
        </button>
        <button
          type="button"
          className={rowAction}
          aria-label={
            c.is_archived
              ? t("ai.sidebar.unarchive", "Повернути з архіву")
              : t("ai.sidebar.archive", "В архів")
          }
          onClick={() => onArchive(c)}
        >
          <ArchiveIcon className="size-3.5" />
        </button>
        <button
          type="button"
          className={`${rowAction} hover:text-error-600! dark:hover:text-error-400!`}
          aria-label={t("common.delete", "Видалити")}
          onClick={() => onDelete(c)}
        >
          <TrashIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function DeleteDialog({
  target,
  onClose,
}: {
  target: Conversation;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [remove, { isLoading }] = useDeleteConversationMutation();
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    try {
      await remove(target.id).unwrap();
      navigate(AI_ROUTES.chat, { replace: true });
      onClose();
    } catch (e) {
      setError(
        isNormalizedApiError(e)
          ? e.message
          : t("errors.unexpected", "Сталася неочікувана помилка"),
      );
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("ai.sidebar.deleteTitle", "Видалити діалог?")}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={`${btnSecondary} ${btnContent} w-full sm:w-auto`}
            onClick={onClose}
            disabled={isLoading}
            autoFocus
          >
            {t("common.cancel", "Скасувати")}
          </button>
          <button
            type="button"
            className={`${btnDanger} ${btnContent} w-full sm:w-auto`}
            onClick={confirm}
            disabled={isLoading}
          >
            {isLoading ? <SpinnerIcon /> : <TrashIcon />}
            {isLoading
              ? t("common.deleting", "Видалення…")
              : t("common.delete", "Видалити")}
          </button>
        </div>
      }
    >
      <p className="text-theme-sm leading-6 wrap-break-word text-gray-700 dark:text-gray-300">
        {t(
          "ai.sidebar.deleteConfirm",
          "Діалог «{{name}}» і всі його повідомлення буде видалено безповоротно.",
          {
            name: conversationTitle(target),
          },
        )}
      </p>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
    </Modal>
  );
}

export function ConversationSidebar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const ui = useSelector(aiUiSlice.selectors.selectAiUi);
  const [size, setSize] = useState(CONVERSATIONS_PAGE_SIZE);
  const [filter, setFilter] = useState("");
  const [toDelete, setToDelete] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useGetConversationsPageQuery({
    page: 1,
    size,
    archived: ui.showArchived,
  });
  const [update] = useUpdateConversationMutation();

  const items = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const rows = q.data?.items ?? [];
    return f
      ? rows.filter((c) => conversationTitle(c).toLowerCase().includes(f))
      : rows;
  }, [q.data, filter]);

  const groups = useMemo(() => {
    const map = new Map<DayBucket, Conversation[]>();
    for (const c of items) {
      const b = dayBucket(c.updated_at);
      map.set(b, [...(map.get(b) ?? []), c]);
    }
    return BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({
      bucket: b,
      rows: map.get(b)!,
    }));
  }, [items]);

  const total = q.data?.total ?? 0;
  const closeDrawer = () => dispatch(aiUiActions.closeSidebar());

  async function guard(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(
        isNormalizedApiError(e)
          ? e.message
          : t("errors.unexpected", "Сталася неочікувана помилка"),
      );
    }
  }

  return (
    <>
      {/* mobile backdrop */}
      {ui.sidebarOpen && (
        <button
          type="button"
          aria-label={t("common.close", "Закрити")}
          onClick={closeDrawer}
          className="absolute inset-0 z-20 bg-gray-900/40 backdrop-blur-[1px] md:hidden"
        />
      )}

      <aside
        aria-label={t("ai.sidebar.title", "Діалоги")}
        className={`absolute inset-y-0 inset-s-0 z-30 flex w-72 max-w-[85%] flex-col border-e border-gray-200 bg-white transition-transform duration-200 md:static md:z-auto md:w-72 md:max-w-none md:translate-x-0 md:bg-transparent dark:border-white/5 dark:bg-gray-900 md:dark:bg-transparent ${
          ui.sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="space-y-3 p-3">
          <NavLinkNew onNavigate={closeDrawer} />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("ai.sidebar.search", "Пошук у діалогах…")}
            aria-label={t("ai.sidebar.search", "Пошук у діалогах…")}
            className={`${inputClass} h-9 w-full`}
          />
          <div
            className="flex gap-1 rounded-lg bg-gray-100 p-0.5 dark:bg-white/5"
            role="tablist"
          >
            {[false, true].map((arch) => (
              <button
                key={String(arch)}
                type="button"
                role="tab"
                aria-selected={ui.showArchived === arch}
                onClick={() => dispatch(aiUiActions.setShowArchived(arch))}
                className={`h-7 flex-1 rounded-md text-theme-xs font-medium transition-colors ${focusRing} ${
                  ui.showArchived === arch
                    ? "bg-white text-gray-900 shadow-xs dark:bg-white/10 dark:text-white"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400"
                }`}
              >
                {arch
                  ? t("ai.sidebar.archived", "Архів")
                  : t("ai.sidebar.active", "Активні")}
              </button>
            ))}
          </div>
          {error && <Alert>{error}</Alert>}
        </div>

        <nav
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
          aria-busy={q.isLoading}
        >
          {q.isLoading && (
            <div className="space-y-2 px-1">
              <span className="sr-only">
                {t("common.loading", "Завантаження…")}
              </span>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`${skeleton} h-9 w-full rounded-lg`} />
              ))}
            </div>
          )}

          {q.error && !q.isLoading && (
            <div className="px-1">
              <Alert>
                {(q.error as { message?: string }).message ??
                  t("ai.sidebar.loadError", "Не вдалося завантажити діалоги")}
              </Alert>
            </div>
          )}

          {!q.isLoading && !q.error && items.length === 0 && (
            <p className="px-3 py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
              {filter
                ? t("ai.sidebar.noMatches", "Нічого не знайдено")
                : ui.showArchived
                  ? t("ai.sidebar.emptyArchive", "Архів порожній")
                  : t("ai.sidebar.empty", "Ще немає діалогів")}
            </p>
          )}

          {groups.map(({ bucket, rows }) => (
            <section key={bucket} className="mb-3">
              <h3 className="px-2.5 pb-1 text-theme-xs font-medium text-gray-400 dark:text-gray-500">
                {DAY_BUCKET_LABELS[bucket]}
              </h3>
              <div className="space-y-0.5">
                {rows.map((c) => (
                  <ConversationRow
                    key={c.id}
                    c={c}
                    onNavigate={closeDrawer}
                    onRename={(id, title) =>
                      guard(() => update({ id, body: { title } }).unwrap())
                    }
                    onArchive={(conv) =>
                      guard(() =>
                        update({
                          id: conv.id,
                          body: { is_archived: !conv.is_archived },
                        }).unwrap(),
                      )
                    }
                    onDelete={setToDelete}
                  />
                ))}
              </div>
            </section>
          ))}

          {total > (q.data?.items.length ?? 0) && !filter && (
            <button
              type="button"
              onClick={() => setSize((s) => s + CONVERSATIONS_PAGE_SIZE)}
              disabled={q.isFetching}
              className={`mx-auto mt-1 flex h-8 items-center gap-2 rounded-full px-3.5 text-theme-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-white/5 ${focusRing}`}
            >
              {q.isFetching && <SpinnerIcon className="size-3.5" />}
              {t("ai.sidebar.more", "Показати ще")}
            </button>
          )}
        </nav>
      </aside>

      {toDelete && (
        <DeleteDialog target={toDelete} onClose={() => setToDelete(null)} />
      )}
    </>
  );
}

function NavLinkNew({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  return (
    <NavLink
      to={AI_ROUTES.chat}
      end
      onClick={onNavigate}
      className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-theme-sm font-medium text-white shadow-xs transition-colors hover:bg-brand-600 ${focusRing}`}
    >
      <PlusIcon className="size-4.5" />
      {t("ai.sidebar.new", "Новий діалог")}
    </NavLink>
  );
}
