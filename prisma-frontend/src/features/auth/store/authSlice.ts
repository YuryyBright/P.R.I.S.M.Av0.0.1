import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** unknown = boot-time refresh still running; guards must wait, not redirect. */
export type SessionStatus = "unknown" | "authenticated" | "anonymous";

export interface AuthState {
  /** In memory only, never localStorage: a reload is recovered through the refresh cookie. */
  accessToken: string | null;
  status: SessionStatus;
}

const initialState: AuthState = { accessToken: null, status: "unknown" };

/**
 * Holds ONLY the token and the session status. The user object is server data
 * and lives in the RTK Query cache (GET /users/me, tag "Session").
 */
export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    tokenReceived(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
      state.status = "authenticated";
    },
    sessionEnded(state) {
      state.accessToken = null;
      state.status = "anonymous";
    },
  },
  selectors: {
    selectAccessToken: (s) => s.accessToken,
    selectSessionStatus: (s) => s.status,
  },
});

export const authActions = authSlice.actions;
