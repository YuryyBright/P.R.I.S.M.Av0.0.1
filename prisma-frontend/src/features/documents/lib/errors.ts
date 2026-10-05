import { isNormalizedApiError } from "@/shared/api/normalizeError";

/** Message of a failed RTK Query request (`error` from a query hook), or the fallback. */
export function queryErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { message?: unknown } | null | undefined)?.message;
  return typeof message === "string" && message ? message : fallback;
}

/** Message of an error thrown by `.unwrap()`: only API errors are shown to the user as is. */
export function actionErrorMessage(error: unknown, fallback: string): string {
  return isNormalizedApiError(error) ? error.message : fallback;
}
