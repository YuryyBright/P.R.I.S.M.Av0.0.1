import type { RouteObject } from "react-router";

export const AI_ROUTES = {
  workspace: "/ai",
} as const;

export const aiRoutes: RouteObject[] = [
  {
    path: AI_ROUTES.workspace,
    lazy: async () => ({
      Component: (await import("./pages/AiWorkspacePage")).default,
    }),
  },
];
