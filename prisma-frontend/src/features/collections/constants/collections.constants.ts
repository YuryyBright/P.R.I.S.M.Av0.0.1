import type {
  CollectionVisibility,
  MemberRole,
} from "../types/collection.types";

/** Paths are relative to API_BASE_URL. Router prefix "/collections" is assumed. */
export const COLLECTIONS_PATHS = {
  root: "/collections",
  byId: (id: string) => `/collections/${id}`,
  members: (id: string) => `/collections/${id}/members`,
  member: (id: string, userId: string) =>
    `/collections/${id}/members/${userId}`,
} as const;

/** Browser routes owned by this feature. */
export const COLLECTIONS_ROUTES = { list: "/collections" } as const;

/**
 * VERIFY against PERM_COLLECTIONS_* in app/api/deps.py and the seeded permissions.
 * (enums.py mentions "rag.collections.read"; the rest is by analogy.)
 */
export const COLLECTION_PERMISSIONS = {
  read: "rag.collections.read", // GET list / GET {id}
  create: "rag.collections.create", // POST
  manage: "rag.collections.manage", // PATCH, DELETE, members/*
} as const;

export const VISIBILITY_OPTIONS: {
  value: CollectionVisibility;
  label: string;
  hint: string;
}[] = [
  { value: "private", label: "Private", hint: "Only you and members" },
  {
    value: "shared",
    label: "Shared",
    hint: "You and explicitly invited members",
  },
  {
    value: "public",
    label: "Public",
    hint: "Everyone with collections read access",
  },
];

export const MEMBER_ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
];
