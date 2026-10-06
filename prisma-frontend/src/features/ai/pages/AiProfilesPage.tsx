import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import { Alert } from "@/shared/ui/Alert";
import { Modal } from "@/shared/ui/Modal";
import { btnDanger, btnPrimary, btnSecondary } from "@/shared/ui/classes";
import {
  useArchiveProfileMutation,
  useGetCapabilitiesQuery,
  useGetProfilesQuery,
} from "../api/ai.endpoints";
import { ProfileFormModal } from "../components/agent/ProfileFormModal";
import {
  AlertTriangleIcon,
  BotIcon,
  MessageIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
  btnContent,
} from "../components/AiIcons";
import { IconTile, Pill, focusRing, skeleton, surface } from "../components/AiUi";
import { AI_ROUTES } from "../constants/ai.constants";
import { useFitViewport } from "../hooks/useFitViewport";
import { aiUiActions, aiUiSlice } from "../store/aiUiSlice";
import type { AgentProfile } from "../types/ai.types";

const MAX_TOOL_CHIPS = 4;

function ProfileCard({ profile, modelLabel, onDelete }: { profile: AgentProfile; modelLabel: string | null; onDelete: () => void }) {
  const { t } = useTranslation();
  const isSystem = profile.owner_id === null;
  const extra = profile.allowed_tools.length - MAX_TOOL_CHIPS;

  return (
    <li
      className={`${surface} flex flex-col p-5 transition-all duration-200 hover:border-brand-200 hover:shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/15 dark:hover:border-brand-500/30 dark:focus-within:border-brand-500/40 dark:focus-within:ring-brand-500/10`}
    >
      <div className="flex items-start gap-3">
        <IconTile className="size-10">
          <BotIcon className="size-5" />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 font-medium wrap-break-word text-gray-800 dark:text-white/90">{profile.name}</h2>
            {isSystem && <Pill tone="brand">{t("ai.agents.system", "Системний")}</Pill>}
          </div>
          {profile.description && (
            <p className="mt-0.5 line-clamp-2 text-theme-xs text-gray-500 dark:text-gray-400">{profile.description}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {profile.allowed_tools.length === 0 ? (
          <Pill>{t("ai.agents.allTools", "Усі інструменти")}</Pill>
        ) : (
          <>
            {profile.allowed_tools.slice(0, MAX_TOOL_CHIPS).map((name) => (
              <code
                key={name}
                className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-white/5 dark:text-gray-300"
              >
                {name}
              </code>
            ))}
            {extra > 0 && <span className="px-1 text-theme-xs text-gray-500 dark:text-gray-400">+{extra}</span>}
          </>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4 dark:border-white/5">
        {[
          [t("ai.agents.model", "Модель"), modelLabel ?? t("ai.settings.defaultModel", "За замовчуванням")],
          [t("ai.agents.steps", "Кроків"), String(profile.max_steps)],
          [t("ai.agents.collections", "Колекцій"), profile.default_collection_ids.length ? String(profile.default_collection_ids.length) : "—"],
        ].map(([k, val]) => (
          <div key={k} className="min-w-0">
            <dt className="text-theme-xs text-gray-500 dark:text-gray-400">{k}</dt>
            <dd className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">{val}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`${AI_ROUTES.chat}?profile=${profile.id}`}
          className={`${btnContent} h-10 rounded-lg border border-gray-200 bg-white px-3 text-theme-sm font-medium text-gray-700 shadow-xs transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/3 dark:text-gray-300 dark:hover:bg-white/6 ${focusRing}`}
        >
          <MessageIcon className="size-4.5" />
          {t("ai.agents.use", "Використати в чаті")}
        </Link>
        {!isSystem && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`${t("common.delete", "Видалити")}: ${profile.name}`}
            className={`inline-flex size-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-error-50 hover:text-error-600 dark:text-gray-400 dark:hover:bg-error-500/10 dark:hover:text-error-400 ${focusRing}`}
          >
            <TrashIcon className="size-5" />
          </button>
        )}
      </div>
    </li>
  );
}

function DeleteProfileDialog({ profile, onClose }: { profile: AgentProfile; onClose: () => void }) {
  const { t } = useTranslation();
  const [archive, { isLoading }] = useArchiveProfileMutation();
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    try {
      await archive(profile.id).unwrap();
      onClose();
    } catch (e) {
      setError(isNormalizedApiError(e) ? e.message : t("errors.unexpected", "Сталася неочікувана помилка"));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("ai.agents.deleteTitle", "Видалити профіль?")}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={`${btnSecondary} ${btnContent} w-full sm:w-auto`} onClick={onClose} disabled={isLoading} autoFocus>
            {t("common.cancel", "Скасувати")}
          </button>
          <button type="button" className={`${btnDanger} ${btnContent} w-full sm:w-auto`} onClick={confirm} disabled={isLoading}>
            {isLoading ? <SpinnerIcon /> : <TrashIcon />}
            {isLoading ? t("common.deleting", "Видалення…") : t("common.delete", "Видалити")}
          </button>
        </div>
      }
    >
      <div className="flex gap-4">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-error-50 text-error-600 ring-8 ring-error-50/50 dark:bg-error-500/15 dark:text-error-400 dark:ring-error-500/5"
        >
          <AlertTriangleIcon className="size-5" />
        </span>
        <p className="min-w-0 text-theme-sm leading-6 wrap-break-word text-gray-700 dark:text-gray-300">
          {t("ai.agents.deleteConfirm", "Профіль «{{name}}» буде архівовано. Існуючі діалоги не постраждають.", {
            name: profile.name,
          })}
        </p>
      </div>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
    </Modal>
  );
}

export default function AiProfilesPage() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const ui = useSelector(aiUiSlice.selectors.selectAiUi);
  const fitRef = useFitViewport<HTMLDivElement>(24);
  const profiles = useGetProfilesQuery();
  const caps = useGetCapabilitiesQuery();

  const rows = profiles.data ?? [];
  const modelLabel = (alias: string | null) =>
    alias ? (caps.data?.models.find((m) => m.alias === alias)?.label ?? alias) : null;
  const deleteTarget = rows.find((p) => p.id === ui.profileDeleteId) ?? null;
  const agentAvailable = caps.data ? caps.data.modes.includes("agent") : true;

  return (
    <div ref={fitRef} className="flex min-h-80 flex-col gap-4">
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            {t("ai.agents.title", "Профілі агента")}
          </h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {t("ai.agents.subtitle", "Готові набори промпту, моделі та інструментів для режиму агента.")}
          </p>
        </div>
        <button
          type="button"
          className={`${btnPrimary} ${btnContent} w-full sm:w-auto`}
          onClick={() => dispatch(aiUiActions.openProfileForm())}
          disabled={!agentAvailable}
        >
          <PlusIcon className="size-4.5" />
          {t("ai.agents.new", "Новий профіль")}
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pe-1">
        {!agentAvailable && (
          <Alert>
            {t("ai.agents.unavailable", "Режим агента недоступний: на сервері немає моделі з підтримкою інструментів.")}
          </Alert>
        )}
        {profiles.error && (
          <Alert>
            {(profiles.error as { message?: string }).message ?? t("ai.agents.loadError", "Не вдалося завантажити профілі")}
          </Alert>
        )}

        {profiles.isLoading ? (
          <ul aria-busy="true" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <span className="sr-only">{t("common.loading", "Завантаження…")}</span>
            {[0, 1, 2].map((i) => (
              <li key={i} className={`${surface} space-y-4 p-5`}>
                <div className="flex items-center gap-3">
                  <div className={`${skeleton} size-10 rounded-xl`} />
                  <div className="flex-1 space-y-2">
                    <div className={`${skeleton} h-3.5 w-2/3`} />
                    <div className={`${skeleton} h-3 w-full`} />
                  </div>
                </div>
                <div className={`${skeleton} h-5 w-3/4`} />
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className={`${surface} flex flex-col items-center px-6 py-14 text-center`}>
            <IconTile className="size-12 rounded-2xl">
              <BotIcon className="size-6" />
            </IconTile>
            <h2 className="mt-4 text-theme-sm font-medium text-gray-800 dark:text-white/90">
              {t("ai.agents.empty", "Профілів ще немає")}
            </h2>
            <p className="mt-1 max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
              {t("ai.agents.emptyHint", "Створіть профіль, щоб швидко запускати агента з потрібними інструментами.")}
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                modelLabel={modelLabel(p.model)}
                onDelete={() => dispatch(aiUiActions.requestProfileDelete(p.id))}
              />
            ))}
          </ul>
        )}

      </div>

      {ui.profileFormOpen && <ProfileFormModal onClose={() => dispatch(aiUiActions.closeProfileForm())} />}
      {deleteTarget && (
        <DeleteProfileDialog profile={deleteTarget} onClose={() => dispatch(aiUiActions.cancelProfileDelete())} />
      )}
    </div>
  );
}
