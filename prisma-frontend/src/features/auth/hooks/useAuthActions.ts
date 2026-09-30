import { useDispatch } from "react-redux";
import {
  useChangePasswordMutation,
  useConfirmPasswordResetMutation,
  useLoginMutation,
  useLogoutAllMutation,
  useLogoutMutation,
  useRegisterMutation,
  useRequestPasswordResetMutation,
  useResendVerificationMutation,
  useVerifyEmailMutation,
} from "../api/auth.endpoints";
import { endLocalSession } from "../lib/session";
import type {
  ChangePasswordPayload,
  EmailPayload,
  LoginPayload,
  PasswordResetConfirmPayload,
  RegisterPayload,
} from "../types/auth.types";

/** Every action resolves with the server message/payload or THROWS a NormalizedApiError. */
export function useAuthActions() {
  const dispatch = useDispatch();
  const [login, loginS] = useLoginMutation();
  const [register, registerS] = useRegisterMutation();
  const [verifyEmail, verifyS] = useVerifyEmailMutation();
  const [resend, resendS] = useResendVerificationMutation();
  const [requestReset, requestResetS] = useRequestPasswordResetMutation();
  const [confirmReset, confirmResetS] = useConfirmPasswordResetMutation();
  const [changePassword, changeS] = useChangePasswordMutation();
  const [logout] = useLogoutMutation();
  const [logoutAll] = useLogoutAllMutation();

  return {
    login: (body: LoginPayload) => login(body).unwrap(),
    register: (body: RegisterPayload) => register(body).unwrap(),
    verifyEmail: (token: string) => verifyEmail({ token }).unwrap(),
    resendVerification: (body: EmailPayload) => resend(body).unwrap(),
    requestPasswordReset: (body: EmailPayload) => requestReset(body).unwrap(),
    confirmPasswordReset: (body: PasswordResetConfirmPayload) => confirmReset(body).unwrap(),
    changePassword: (body: ChangePasswordPayload) => changePassword(body).unwrap(),
    /**
     * Best effort: the local session is ALWAYS cleared, even if the server call fails
     * (e.g. 400 "Unable to identify the current session" when the cookie is gone).
     */
    signOut: async (everywhere = false) => {
      try {
        await (everywhere ? logoutAll() : logout()).unwrap();
      } catch {
        /* nothing to recover: we are leaving anyway */
      } finally {
        endLocalSession(dispatch);
      }
    },
    isPending: [loginS, registerS, verifyS, resendS, requestResetS, confirmResetS, changeS].some(
      (s) => s.isLoading,
    ),
  };
}
