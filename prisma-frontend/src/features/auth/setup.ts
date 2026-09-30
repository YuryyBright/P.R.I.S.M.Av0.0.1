import type { Dispatch } from "@reduxjs/toolkit";
import { configureAuthBridge } from "@/shared/api/authBridge";
import { refreshSession } from "./api/refreshSession";
import { endLocalSession } from "./lib/session";
import { authSlice, type AuthState } from "./store/authSlice";

interface StoreLike {
  dispatch: Dispatch;
  getState: () => { auth: AuthState };
}

/** Call once, before the first render (app/main.tsx): plugs auth into the shared http layer. */
export function setupAuth(store: StoreLike): void {
  configureAuthBridge({
    getAccessToken: () => authSlice.selectors.selectAccessToken(store.getState()),
    refresh: () => refreshSession(store.dispatch),
    onAuthFailed: () => endLocalSession(store.dispatch),
  });
}
