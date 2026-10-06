import { useTranslation } from "react-i18next";
import { SUGGESTED_PROMPTS } from "../../constants/ai.constants";
import type { RunMode } from "../../types/ai.types";
import { BotIcon, MessageIcon, SparklesIcon } from "../AiIcons";
import { focusRing, IconTile } from "../AiUi";

interface Props {
  onPick: (text: string, mode: RunMode) => void;
}

export function EmptyChat({ onPick }: Props) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
      <IconTile tone="brand" className="size-14 rounded-2xl">
        <SparklesIcon className="size-7" />
      </IconTile>
      <h2 className="mt-5 text-title-sm font-semibold text-gray-800 dark:text-white/90">
        {t("ai.empty.title", "Чим можу допомогти?")}
      </h2>
      <p className="mt-1.5 max-w-md text-theme-sm text-gray-500 dark:text-gray-400">
        {t(
          "ai.empty.subtitle",
          "Ставте запитання, шукайте в базах знань або доручіть завдання агенту — він сам підбере інструменти.",
        )}
      </p>

      <ul className="mt-8 grid w-full gap-3 sm:grid-cols-3">
        {SUGGESTED_PROMPTS.map((p, i) => (
          <li key={p.title}>
            <button
              type="button"
              onClick={() => onPick(t(`ai.empty.prompts.${i}.text`, p.text), p.mode)}
              className={`group flex h-full w-full flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-start transition-all duration-200 hover:border-brand-200 hover:shadow-sm dark:border-white/5 dark:bg-white/3 dark:hover:border-brand-500/30 ${focusRing}`}
            >
              <span className="flex items-center gap-2 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                <span className="text-gray-400 transition-colors group-hover:text-brand-500">
                  {p.mode === "agent" ? (
                    <BotIcon className="size-4.5" />
                  ) : (
                    <MessageIcon className="size-4.5" />
                  )}
                </span>
                {t(`ai.empty.prompts.${i}.title`, p.title)}
              </span>
              <span className="line-clamp-3 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {t(`ai.empty.prompts.${i}.text`, p.text)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
