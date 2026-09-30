import { useContext } from "react";
import { AuthContext } from "../store/auth.context";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error("useAuth має використовуватись всередині <AuthProvider>");
  return ctx;
}
