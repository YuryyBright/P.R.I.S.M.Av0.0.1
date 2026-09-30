/** Python UUID -> JSON string. */
export type UUID = string;
/** Python datetime -> ISO 8601 string. May come WITHOUT timezone (see lib/date.ts). */
export type ISODateString = string;

/** IResponseBase[T] from response_schema.py. `data` is null only on empty results. */
export interface ApiEnvelope<T> {
  message: string;
  meta: Record<string, unknown>;
  data: T | null;
}

/**
 * Inner `data` of BOTH paginated shapes:
 *  - IGetResponsePaginated (fastapi-pagination): items,page,size,total,pages,next_page,previous_page
 *  - hand-built dict in users/roles routes:      items,total,page,size,pages
 */
export interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
  next_page?: number | null;
  previous_page?: number | null;
}

/** fastapi-pagination Params: page >= 1, 1 <= size <= 100. */
export interface PageParams {
  page?: number;
  size?: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** Responses that return only `{message}` (e.g. POST /users/{id}/roles). */
export interface MessageOnly {
  message: string;
}

/** What mutations resolve with: payload + server message (for toasts). */
export interface MutationResult<T> {
  data: T;
  message: string;
}

/* ---------- error bodies the backend can produce ---------- */

/** ErrorDetail from response_schema.py */
export interface ErrorDetail {
  field: string | null;
  code: string | null;
  message: string;
}
/** IErrorResponse (custom exceptions). */
export interface ApiErrorEnvelope {
  status: "error";
  message: string;
  errors: ErrorDetail[];
  meta: Record<string, unknown>;
}
/** FastAPI HTTPException. */
export interface HttpExceptionBody {
  detail: string;
}
/** FastAPI 422. */
export interface ValidationErrorBody {
  detail: Array<{ loc: Array<string | number>; msg: string; type: string }>;
}

export function emptyPage<T>(size = DEFAULT_PAGE_SIZE): PageData<T> {
  return { items: [], total: 0, page: 1, size, pages: 0 };
}
