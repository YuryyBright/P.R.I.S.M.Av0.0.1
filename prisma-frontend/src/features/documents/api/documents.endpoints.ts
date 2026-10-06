import { baseApi } from "@/shared/api/baseApi";
import { DEFAULT_PAGE_SIZE, type UUID } from "@/shared/types/api";
import {
  CHUNKS_PAGE_SIZE,
  DOCUMENTS_PATHS,
} from "../constants/documents.constants";
import type {
  ChunkBrief,
  ChunkItem,
  ChunkMap,
  ChunksPageArgs,
  DocumentDetails,
  DocumentItem,
  DocumentsPageArgs,
  LimitOffsetPage,
  UploadResponse,
} from "../types/document.types";

/** One LIST tag per collection, so invalidating one collection doesn't refetch others. */
const listTag = (collectionId: UUID) => ({
  type: "Document" as const,
  id: `LIST:${collectionId}`,
});

/** Upload / reindex / delete create or cancel jobs, so the jobs list must refetch too. */
const JOB_LIST = { type: "Job" as const, id: "LIST" };

/**
 * NOTE: add "Document" to `tagTypes` in baseApi.
 * Upload sends multipart/form-data: baseApi.prepareHeaders must NOT force
 * Content-Type: application/json, otherwise the browser can't set the boundary.
 */
export const documentsApi = baseApi.injectEndpoints({
  overrideExisting: false,
  endpoints: (build) => ({
    /** GET /collections/{id}/documents?limit&offset&status */
    getDocumentsPage: build.query<
      LimitOffsetPage<DocumentItem>,
      DocumentsPageArgs
    >({
      query: ({
        collectionId,
        page = 1,
        size = DEFAULT_PAGE_SIZE,
        status,
      }) => ({
        url: DOCUMENTS_PATHS.inCollection(collectionId),
        params: { limit: size, offset: (page - 1) * size, status }, // undefined params are dropped
      }),
      providesTags: (res, _e, { collectionId }) => [
        ...(res?.items ?? []).map((d) => ({
          type: "Document" as const,
          id: d.id,
        })),
        listTag(collectionId),
      ],
    }),

    /** GET /documents/{id}/details — full card: DB metadata, chunk stats, recent jobs. */
    getDocumentDetails: build.query<DocumentDetails, UUID>({
      query: (id) => ({ url: DOCUMENTS_PATHS.details(id) }),
      // Same tag as rename/reindex/delete, so those refresh an open card automatically.
      providesTags: (_r, _e, id) => [{ type: "Document" as const, id }],
    }),

    /** GET /documents/{id}/chunks?limit&offset&q — list rows with preview. */
    getDocumentChunks: build.query<LimitOffsetPage<ChunkBrief>, ChunksPageArgs>(
      {
        query: ({ id, page = 1, size = CHUNKS_PAGE_SIZE, q }) => ({
          url: DOCUMENTS_PATHS.chunks(id),
          params: { limit: size, offset: (page - 1) * size, q: q || undefined },
        }),
        providesTags: (_r, _e, { id }) => [{ type: "Document" as const, id }],
      },
    ),

    /** GET /documents/{id}/chunks/{index} — one chunk with full text. */
    getDocumentChunk: build.query<ChunkItem, { id: UUID; index: number }>({
      query: ({ id, index }) => ({ url: DOCUMENTS_PATHS.chunk(id, index) }),
      providesTags: (_r, _e, { id }) => [{ type: "Document" as const, id }],
    }),

    /** GET /documents/{id}/chunks/map — compact outline of every chunk. */
    getDocumentChunkMap: build.query<ChunkMap, UUID>({
      query: (id) => ({ url: DOCUMENTS_PATHS.chunkMap(id) }),
      providesTags: (_r, _e, id) => [{ type: "Document" as const, id }],
    }),

    /** POST /collections/{id}/documents -> 202 {document_id, job_id}. One file per request. */
    uploadDocument: build.mutation<
      UploadResponse,
      { collectionId: UUID; file: File }
    >({
      query: ({ collectionId, file }) => {
        const body = new FormData();
        body.append("file", file);
        return {
          url: DOCUMENTS_PATHS.inCollection(collectionId),
          method: "POST",
          body,
        };
      },
      invalidatesTags: (_r, _e, { collectionId }) => [
        listTag(collectionId),
        JOB_LIST,
      ],
    }),

    /** PATCH /documents/{id} {title} */
    renameDocument: build.mutation<
      DocumentItem,
      { id: UUID; collectionId: UUID; title: string }
    >({
      query: ({ id, title }) => ({
        url: DOCUMENTS_PATHS.byId(id),
        method: "PATCH",
        body: { title },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Document", id }],
    }),

    /** DELETE /documents/{id} -> 204. Soft delete; Celery purges vectors/blobs. */
    deleteDocument: build.mutation<void, { id: UUID; collectionId: UUID }>({
      query: ({ id }) => ({ url: DOCUMENTS_PATHS.byId(id), method: "DELETE" }),
      invalidatesTags: (_r, _e, { id, collectionId }) => [
        { type: "Document", id },
        listTag(collectionId),
        JOB_LIST,
      ],
    }),

    /** POST /documents/{id}/reindex -> 202 (new job). 409 if already processing. */
    reindexDocument: build.mutation<
      UploadResponse,
      { id: UUID; collectionId: UUID }
    >({
      query: ({ id }) => ({ url: DOCUMENTS_PATHS.reindex(id), method: "POST" }),
      invalidatesTags: (_r, _e, { id, collectionId }) => [
        { type: "Document", id },
        listTag(collectionId),
        JOB_LIST,
      ],
    }),
  }),
});

export const {
  useGetDocumentsPageQuery,
  useGetDocumentDetailsQuery,
  useGetDocumentChunksQuery,
  useGetDocumentChunkQuery,
  useGetDocumentChunkMapQuery,
  useUploadDocumentMutation,
  useRenameDocumentMutation,
  useDeleteDocumentMutation,
  useReindexDocumentMutation,
} = documentsApi;
