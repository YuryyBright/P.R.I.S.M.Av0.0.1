import { baseApi } from "@/shared/api/baseApi";
import type { UUID } from "@/shared/types/api";

export interface VectorSearchRequest {
  query: string;
  collection_ids: UUID[] | null;
  top_k: number;
}

export interface VectorSearchChunk {
  chunk_id: UUID;
  document_id: UUID;
  collection_id: UUID;
  document_title: string;
  text: string;
  page: number | null;
  heading_path: string[];
  score: number;
  token_count: number;
  document_url: string | null;
  chunk_index: number;
  match_type: "title_exact" | "text_exact" | "semantic" | null;
}

export interface VectorSearchResponse {
  query: string;
  results: VectorSearchChunk[];
  total: number;
  latency_ms: number;
  embedding_model: string | null;
}

export const searchApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    vectorSearch: build.mutation<VectorSearchResponse, VectorSearchRequest>({
      query: (body) => ({ url: "/rag/search", method: "POST", body }),
    }),
  }),
});

export const { useVectorSearchMutation } = searchApi;
