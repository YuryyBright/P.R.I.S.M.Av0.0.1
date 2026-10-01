import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router";
import "@/i18n";
import "../index.css";
import { store } from "./store";
import { setupAuth } from "@/features/auth";

import { router } from "./router";
import AppProviders from "../app/providers/AppProviders";

setupAuth(store);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </Provider>
  </StrictMode>,
);
