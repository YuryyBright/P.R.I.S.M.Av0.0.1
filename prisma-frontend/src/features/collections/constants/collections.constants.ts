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

/**
 * Option labels are i18n KEYS, not text: components call t(option.labelKey),
 * so they re-render in the active language.
 */
export const VISIBILITY_OPTIONS: {
  value: CollectionVisibility;
  labelKey: string;
  hintKey: string;
}[] = [
  {
    value: "private",
    labelKey: "collections.visibility.private.label",
    hintKey: "collections.visibility.private.hint",
  },
  {
    value: "shared",
    labelKey: "collections.visibility.shared.label",
    hintKey: "collections.visibility.shared.hint",
  },
  {
    value: "public",
    labelKey: "collections.visibility.public.label",
    hintKey: "collections.visibility.public.hint",
  },
];

export const MEMBER_ROLE_OPTIONS: { value: MemberRole; labelKey: string }[] = [
  { value: "viewer", labelKey: "collections.memberRole.viewer" },
  { value: "editor", labelKey: "collections.memberRole.editor" },
];
