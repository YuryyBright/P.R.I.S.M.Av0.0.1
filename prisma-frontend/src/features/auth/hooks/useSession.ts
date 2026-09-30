import { useSelector } from "react-redux";
import { useGetMeQuery } from "../api/auth.endpoints";
import { authSlice } from "../store/authSlice";

/** Who is signed in. Every caller shares one cached GET /users/me. */
export function useSession() {
  const status = useSelector(authSlice.selectors.selectSessionStatus);
  const isAuthenticated = status === "authenticated";
  const me = useGetMeQuery(undefined, { skip: !isAuthenticated });

  return {
    status,
    isAuthenticated,
    user: me.data ?? null,
    isLoadingUser: isAuthenticated && me.isLoading,
    userError: me.error,
  };
}
