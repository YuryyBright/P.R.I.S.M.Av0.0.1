import { Navigate, type RouteObject } from "react-router";
import { AI_ROUTES } from "./constants/ai.constants";

/**
 * AI routes are available to every authenticated user.
 * Chat/agent endpoints need auth only; the tasks UI additionally gates actions with
 * <Can permission="ai.tasks.*"> and the backend enforces the same permissions.
 *
 * `chat/:conversationId?` is ONE route with an optional segment on purpose: the page
 * instance survives "first message -> conversation created -> URL changes".
 */
export const aiRoutes: RouteObject[] = [
  {
    path: "ai",
    children: [
      { index: true, element: <Navigate to={AI_ROUTES.chat} replace /> },
      {
        path: "chat/:conversationId?",
        lazy: async () => ({
          Component: (await import("./pages/AiChatPage")).default,
        }),
      },
      {
        path: "tasks",
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import("./pages/AiTasksPage")).default,
            }),
          },
          {
            path: ":taskId",
            lazy: async () => ({
              Component: (await import("./pages/AiTaskDetailPage")).default,
            }),
          },
        ],
      },
      {
        path: "agents",
        lazy: async () => ({
          Component: (await import("./pages/AiProfilesPage")).default,
        }),
      },
    ],
  },
];
