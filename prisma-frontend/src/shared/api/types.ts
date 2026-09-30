// Обгортка з response_schema.py: { message, meta, data }
export interface ApiResponse<T> {
  message: string;
  meta: Record<string, unknown>;
  data: T;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
