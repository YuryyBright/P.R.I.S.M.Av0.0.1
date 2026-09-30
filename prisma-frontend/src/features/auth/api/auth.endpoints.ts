import type { Dispatch } from "@reduxjs/toolkit";
import { baseApi } from "@/shared/api/baseApi";
import type { ApiEnvelope, MessageOnly, MutationResult } from "@/shared/types/api";
import { AUTH_PATHS } from "../constants/auth.constants";
import { authActions } from "../store/authSlice";
import type {
  ChangePasswordPayload,
  EmailPayload,
  LoginPayload,
  PasswordResetConfirmPayload,
  RegisterPayload,
  SessionUser,
  Token,
  VerifyEmailPayload,
} from "../types/auth.types";

/** Public endpoints: no Bearer expected, a 401 must not start a refresh. */
const PUBLIC = { public: true } as const;

const unwrap = <T>(r: ApiEnvelope<T>): T => r.data as T;
const withMessage = <T>(r: ApiEnvelope<T>): MutationResult<T> => ({ data: r.data as T, message: r.message });
const messageOnly = (r: ApiEnvelope<unknown>): MessageOnly => ({ message: r.message });

/** Login and change_password both return a fresh Token; the cookie was rotated server-side. */
function adoptToken(dispatch: Dispatch, token: Token): void {
  dispatch(authActions.tokenReceived(token.access_token));
  // Refetch /users/me instead of upserting: keeps one source of truth for the user.
  dispatch(baseApi.util.invalidateTags(["Session"]));
}

export const authApi = baseApi.injectEndpoints({
  overrideExisting: false,
  endpoints: (build) => ({
    /** GET /users/me: the session user (auth only, no permission needed). */
    getMe: build.query<SessionUser, void>({
      query: () => AUTH_PATHS.me,
      transformResponse: unwrap<SessionUser>,
      providesTags: ["Session"],
    }),

    /**
     * POST /auth/login. `message` can be a warning ("last attempt before lockout")
     * instead of "Login successful". Errors: 422 {detail:{field_name,message}} (bad creds,
     * locked, unverified), 403 inactive, 429 rate limit (5/min).
     */
    login: build.mutation<MutationResult<Token>, LoginPayload>({
      query: (body) => ({ url: AUTH_PATHS.login, method: "POST", body }),
      extraOptions: PUBLIC,
      transformResponse: withMessage<Token>,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          adoptToken(dispatch, data.data);
        } catch {
          /* the caller gets the error through unwrap() */
        }
      },
    }),

    /** POST /auth/register: identical answer for every address (anti-enumeration). data is null. */
    register: build.mutation<MessageOnly, RegisterPayload>({
      query: (body) => ({ url: AUTH_PATHS.register, method: "POST", body }),
      extraOptions: PUBLIC,
      transformResponse: messageOnly,
    }),

    /** POST /auth/verify-email. Does NOT sign the user in. */
    verifyEmail: build.mutation<MessageOnly, VerifyEmailPayload>({
      query: (body) => ({ url: AUTH_PATHS.verifyEmail, method: "POST", body }),
      extraOptions: PUBLIC,
      transformResponse: messageOnly,
    }),

    /** POST /auth/resend-verification-email: uniform answer. */
    resendVerification: build.mutation<MessageOnly, EmailPayload>({
      query: (body) => ({ url: AUTH_PATHS.resendVerification, method: "POST", body }),
      extraOptions: PUBLIC,
      transformResponse: messageOnly,
    }),

    /** POST /auth/password-reset/request (3/hour): uniform answer. */
    requestPasswordReset: build.mutation<MessageOnly, EmailPayload>({
      query: (body) => ({ url: AUTH_PATHS.passwordResetRequest, method: "POST", body }),
      extraOptions: PUBLIC,
      transformResponse: messageOnly,
    }),

    /** POST /auth/password-reset/confirm. */
    confirmPasswordReset: build.mutation<MessageOnly, PasswordResetConfirmPayload>({
      query: (body) => ({ url: AUTH_PATHS.passwordResetConfirm, method: "POST", body }),
      extraOptions: PUBLIC,
      transformResponse: messageOnly,
    }),

    /**
     * POST /auth/change_password. Ends ALL sessions, then hands back a fresh Token
     * for this caller (new access token + rotated cookie), which adoptToken stores.
     */
    changePassword: build.mutation<MutationResult<Token>, ChangePasswordPayload>({
      query: (body) => ({ url: AUTH_PATHS.changePassword, method: "POST", body }),
      transformResponse: withMessage<Token>,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          adoptToken(dispatch, data.data);
        } catch {
          /* surfaced through unwrap() */
        }
      },
    }),

    /** POST /auth/logout: ends this session only. */
    logout: build.mutation<MessageOnly, void>({
      query: () => ({ url: AUTH_PATHS.logout, method: "POST" }),
      transformResponse: messageOnly,
    }),

    /** POST /auth/logout/all: ends every session of the account. */
    logoutAll: build.mutation<MessageOnly, void>({
      query: () => ({ url: AUTH_PATHS.logoutAll, method: "POST" }),
      transformResponse: messageOnly,
    }),
  }),
});

export const {
  useGetMeQuery,
  useLoginMutation,
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useRequestPasswordResetMutation,
  useConfirmPasswordResetMutation,
  useChangePasswordMutation,
  useLogoutMutation,
  useLogoutAllMutation,
} = authApi;
