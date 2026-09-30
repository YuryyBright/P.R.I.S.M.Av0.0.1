import axios from "axios";

export interface ApiFieldError {
  field?: string | null;
  field_name?: string | null;
  code?: string | null;
  message: string;
  msg?: string;
}

export interface ApiErrorPayload {
  message?: string;
  detail?: string | ApiFieldError[] | {
    message?: string;
    field_name?: string;
    code?: string;
    errors?: ApiFieldError[];
  };
  errors?: ApiFieldError[];
  meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null,
    public readonly code?: string,
    public readonly field?: string,
    public readonly errors: ApiFieldError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return new ApiError(error instanceof Error ? error.message : "Невідома помилка");
  }

  const status = error.response?.status ?? null;
  const body = error.response?.data as ApiErrorPayload | undefined;

  if (!body) {
    return new ApiError(error.message || "Сервер недоступний", status);
  }

  const detail = body.detail;
  if (typeof detail === "string") return new ApiError(detail, status);

  if (Array.isArray(detail)) {
    const errors = detail.map((item) => ({
      ...item,
      message: item.message || item.msg || "Некоректне значення",
    }));
    return new ApiError(errors.map((item) => item.message).join("; "), status, undefined, undefined, errors);
  }

  if (detail && typeof detail === "object") {
    const errors = detail.errors ?? [];
    return new ApiError(
      detail.message || errors[0]?.message || errors[0]?.msg || body.message || `Помилка ${status ?? "API"}`,
      status,
      detail.code,
      detail.field_name,
      errors,
    );
  }

  return new ApiError(
    body.message || body.errors?.[0]?.message || body.errors?.[0]?.msg || `Помилка ${status ?? "API"}`,
    status,
    undefined,
    undefined,
    body.errors ?? [],
  );
}
