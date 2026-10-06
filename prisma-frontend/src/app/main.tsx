import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router";
import "@/i18n";
import "../index.css";

import { store } from "./store";
import { router } from "./router";
import AppProviders from "../app/providers/AppProviders";
import { configureAiTransport } from "@/features/ai";
import { getAuthBridge } from "@/shared/api/authBridge";
import { API_BASE_URL } from "@/shared/config/env";
import { setupAuth } from "@/features/auth";

setupAuth(store);

configureAiTransport({
  baseUrl: API_BASE_URL,

  getHeaders: (): Record<string, string> => {
    const accessToken = getAuthBridge().getAccessToken();

    if (!accessToken) {
      return {};
    }

    return {
      Authorization: `Bearer ${accessToken}`,
    };
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </Provider>
  </StrictMode>,
);
