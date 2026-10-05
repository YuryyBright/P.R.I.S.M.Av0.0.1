import { MessageSquare, MoreHorizontal, Plus } from "lucide-react";
import type { AiChat } from "../types/ai.types";

interface Props {
  chats: AiChat[];
  activeChatId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export function ChatHistory({
  chats,
  activeChatId,
  onSelect,
  onNewChat,
}: Props) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-800">
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Plus className="size-4" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 px-2 text-xs font-medium text-gray-400">
          Recent chats
        </p>

        <div className="space-y-1">
          {chats.map((chat) => {
            const active = chat.id === activeChatId;

            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => onSelect(chat.id)}
                className={[
                  "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                  active
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/60 dark:hover:text-white",
                ].join(" ")}
              >
                <MessageSquare className="size-4 shrink-0 text-gray-400" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {chat.title}
                  </span>

                  <span className="mt-0.5 block text-xs text-gray-400">
                    {chat.updatedAt}
                  </span>
                </span>

                <MoreHorizontal className="size-4 shrink-0 opacity-0 transition group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
