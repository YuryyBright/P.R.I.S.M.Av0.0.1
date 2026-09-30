import axios from "axios";

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

// FastAPI віддає detail як рядок або масив помилок валідації, або {message, errors[]}.
export function toApiError(e: unknown): ApiError {
  if (!axios.isAxiosError(e))
    return new ApiError(e instanceof Error ? e.message : "Невідома помилка");
  const status = e.response?.status;
  const body = e.response?.data as any;
  const detail = body?.detail ?? body?.message;
  if (typeof detail === "string") return new ApiError(detail, status);
  if (Array.isArray(detail))
    return new ApiError(detail.map((d) => d.msg).join("; "), status);
  if (!e.response) return new ApiError("Сервер недоступний", status);
  return new ApiError(`Помилка ${status}`, status);
}
