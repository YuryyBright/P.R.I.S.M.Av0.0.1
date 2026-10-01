import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import i18n from "@/i18n";
import type { ErrorDetail } from "../types/api";

export type NormalizedStatus = number | "NETWORK" | "PARSE" | "TIMEOUT" | "UNKNOWN";

export interface NormalizedApiError {
  status: NormalizedStatus;
  message: string;
  errors: ErrorDetail[];
  /** first message per field, ready for forms */
  fieldErrors: Record<string, string>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

const STRING_STATUS: Record<string, NormalizedStatus> = {
  FETCH_ERROR: "NETWORK",
  PARSING_ERROR: "PARSE",
  TIMEOUT_ERROR: "TIMEOUT",
  CUSTOM_ERROR: "UNKNOWN",
};

/**
 * Error bodies the backend can produce (5 shapes, not 3):
 *  1. {status:"error", message, errors:[{field,code,message}]}   custom exceptions (IErrorResponse)
 *  2. {detail: "text"}                                            HTTPException
 *  3. {detail: [{loc,msg,type}]}                                  FastAPI 422
 *  4. {detail: {field_name?, message}} | {detail: {status:false, message}}   auth.py (login, refresh)
 *  5. {error: "Rate limit exceeded: 5 per 1 minute"}              slowapi default 429 body
 */
export function normalizeError(error: FetchBaseQueryError): NormalizedApiError {
  const status: NormalizedStatus =
    typeof error.status === "number" ? error.status : (STRING_STATUS[error.status] ?? "UNKNOWN");

  let message =
    typeof status === "number"
      ? i18n.t("errors.api.requestFailed", { status })
      : i18n.t("errors.api.requestFailedNoStatus");
  let errors: ErrorDetail[] = [];
  const body = "data" in error ? error.data : undefined;

  if (isRecord(body)) {
    if (Array.isArray(body.errors)) {
      errors = body.errors.filter(isRecord).map((e) => ({
        field: str(e.field),
        code: str(e.code),
        message: String(e.message ?? ""),
      }));
      message = str(body.message) ?? message;
    } else if (typeof body.detail === "string") {
      message = body.detail;
    } else if (Array.isArray(body.detail)) {
      errors = body.detail.filter(isRecord).map((d) => ({
        field: Array.isArray(d.loc) ? String(d.loc[d.loc.length - 1]) : null,
        code: str(d.type),
        message: String(d.msg ?? ""),
      }));
      message = i18n.t("errors.api.validation");
    } else if (isRecord(body.detail)) {
      const d = body.detail;
      message = str(d.message) ?? message;
      const field = str(d.field_name) ?? str(d.field);
      if (field) errors = [{ field, code: null, message }];
    } else if (typeof body.message === "string") {
      message = body.message;
    } else if (typeof body.error === "string") {
      message = body.error;
    }
  } else if (status === "NETWORK") {
    message = i18n.t("errors.api.network");
  }

  if (status === 429 && !isRecord(body)) message = i18n.t("errors.api.tooManyRequests");

  const fieldErrors: Record<string, string> = {};
  for (const e of errors) if (e.field && !(e.field in fieldErrors)) fieldErrors[e.field] = e.message;

  return { status, message, errors, fieldErrors };
}

export function isNormalizedApiError(e: unknown): e is NormalizedApiError {
  return isRecord(e) && "fieldErrors" in e && "status" in e && typeof e.message === "string";
}
