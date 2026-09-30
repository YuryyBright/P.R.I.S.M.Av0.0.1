export interface ApiMeta {
  request_id?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface ApiResponse<T> {
  message: string;
  meta: ApiMeta;
  data: T;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
