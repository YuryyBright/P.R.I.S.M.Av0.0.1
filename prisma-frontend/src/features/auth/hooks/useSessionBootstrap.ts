import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { refreshSessionOnce } from "@/shared/api/authBridge";
import { authActions, authSlice } from "../store/authSlice";

/**
 * The access token is memory-only, so after a reload we are "unknown" until the
 * refresh cookie proves otherwise. Returns true once the status is settled.
 * refreshSessionOnce is single-flight, so StrictMode's double effect is harmless.
 */
export function useSessionBootstrap(): boolean {
  const dispatch = useDispatch();
  const status = useSelector(authSlice.selectors.selectSessionStatus);

  useEffect(() => {
    if (status !== "unknown") return;
    // On success refreshSession already dispatched tokenReceived.
    void refreshSessionOnce().then((ok) => {
      if (!ok) dispatch(authActions.sessionEnded());
    });
  }, [status, dispatch]);

  return status !== "unknown";
}
