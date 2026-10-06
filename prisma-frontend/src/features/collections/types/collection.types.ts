import type { ISODateString, UUID } from "@/shared/types/api";

/* =====================================================================
 * RESPONSE TYPES  (app/rag/schemas.py)
 * RAG API has NO {data, message} envelope: bodies are plain objects,
 * lists are Page[T] = {items, total, limit, offset}.
 * ===================================================================== */

export type CollectionVisibility = "private" | "shared" | "public";
export type CollectionRole = "owner" | "editor" | "viewer";
/** `owner` can't be granted through /members (backend validator rejects it). */
export type MemberRole = Exclude<CollectionRole, "owner">;

/** CollectionRead. `my_role` is the caller's effective role (null = no access). */
export interface Collection {
  id: UUID;
  name: string;
  description: string | null;
  visibility: CollectionVisibility;
  is_active: boolean;
  owner_id: UUID;
  created_at: ISODateString;
  /** Set only for archived (soft-deleted) collections. */
  deleted_at?: ISODateString | null;
  my_role: CollectionRole | null;
}

export interface CollectionMember {
  user_id: UUID;
  role: CollectionRole;
}

/** Page[T] from the backend (limit/offset, not page/pages). */
export interface LimitOffsetPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/* =====================================================================
 * REQUEST PAYLOADS
 * ===================================================================== */

/** POST /collections */
export interface CollectionCreatePayload {
  name: string;
  description?: string | null;
  visibility?: CollectionVisibility;
}

/** PATCH /collections/{id}: only sent keys change; `description: null` clears it. */
export interface CollectionUpdatePayload {
  name?: string;
  description?: string | null;
  visibility?: CollectionVisibility;
}

/** POST /collections/{id}/members (upsert: adds or changes role) */
export interface MemberUpsertPayload {
  collectionId: UUID;
  user_id: UUID;
  role: MemberRole;
}

/* =====================================================================
 * QUERY ARGS
 * ===================================================================== */

/** UI speaks page/size; the endpoint converts to limit/offset. */
/** Which list the page shows: live collections or the archive (soft-deleted, restorable). */
export type CollectionsView = "active" | "archived";

export interface CollectionsPageArgs {
  page?: number;
  size?: number;
}
