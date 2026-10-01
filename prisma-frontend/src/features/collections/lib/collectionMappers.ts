import type {
  Collection,
  CollectionCreatePayload,
  CollectionUpdatePayload,
  CollectionVisibility,
} from "../types/collection.types";

/** Form state: everything is a string. */
export interface CollectionFormValues {
  name: string;
  description: string;
  visibility: CollectionVisibility;
}

export const emptyCollectionForm: CollectionFormValues = {
  name: "",
  description: "",
  visibility: "private",
};

export const collectionToForm = (c: Collection): CollectionFormValues => ({
  name: c.name,
  description: c.description ?? "",
  visibility: c.visibility,
});

export const formToCreatePayload = (f: CollectionFormValues): CollectionCreatePayload => ({
  name: f.name.trim(),
  description: f.description.trim() || null,
  visibility: f.visibility,
});

/**
 * Diff against the original: only changed keys go out. Unlike users, the PATCH
 * here honours explicit nulls, so clearing the description alone works.
 */
export function formToUpdatePayload(f: CollectionFormValues, original: Collection): CollectionUpdatePayload {
  const out: CollectionUpdatePayload = {};
  const name = f.name.trim();
  if (name && name !== original.name) out.name = name;

  const description = f.description.trim();
  if (description !== (original.description ?? "")) out.description = description || null;

  if (f.visibility !== original.visibility) out.visibility = f.visibility;
  return out;
}

/** Only the owner (or a superuser, who gets `owner`) may PATCH/DELETE/manage members. */
export const canManageCollection = (c: Pick<Collection, "my_role">): boolean => c.my_role === "owner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v.trim());
