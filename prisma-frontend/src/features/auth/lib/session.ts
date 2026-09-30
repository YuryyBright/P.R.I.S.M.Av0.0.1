import type { Dispatch } from "@reduxjs/toolkit";
import { baseApi } from "@/shared/api/baseApi";
import { clearCsrfToken } from "@/shared/api/csrf";
import { authActions } from "../store/authSlice";

/**
 * Local sign-out: forget the token, drop EVERY cached response (the next user
 * must never see the previous user's data) and the CSRF pair.
 * Other features reset their own UI state by reacting to authActions.sessionEnded.
 */
export function endLocalSession(dispatch: Dispatch): void {
  dispatch(authActions.sessionEnded());
  dispatch(baseApi.util.resetApiState());
  clearCsrfToken();
}
