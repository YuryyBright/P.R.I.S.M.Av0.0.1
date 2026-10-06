import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { authActions } from "@/features/auth";
import { DEFAULT_PAGE_SIZE, type UUID } from "@/shared/types/api";
import type { CollectionsView } from "../types/collection.types";

export type CollectionFormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; collectionId: UUID };

/** UI-only state. Server data lives in RTK Query, never duplicated here. */
export interface CollectionsUiState {
  /** Live collections or the archive (soft-deleted). */
  view: CollectionsView;
  page: number;
  size: number;
  form: CollectionFormState;
  deleteTargetId: UUID | null;
  /** Archived collection awaiting the "delete forever" confirmation. */
  purgeTargetId: UUID | null;
  membersTargetId: UUID | null;
}

const initialState: CollectionsUiState = {
  view: "active",
  page: 1,
  size: DEFAULT_PAGE_SIZE,
  form: { mode: "closed" },
  deleteTargetId: null,
  purgeTargetId: null,
  membersTargetId: null,
};

export const collectionsUiSlice = createSlice({
  name: "collectionsUi",
  initialState,
  reducers: {
    setPage(s, a: PayloadAction<number>) {
      s.page = Math.max(1, a.payload);
    },
    setView(s, a: PayloadAction<CollectionsView>) {
      if (s.view === a.payload) return;
      s.view = a.payload;
      s.page = 1;
    },
    setSize(s, a: PayloadAction<number>) {
      s.size = a.payload;
      s.page = 1;
    },
    openCreateForm(s) {
      s.form = { mode: "create" };
    },
    openEditForm(s, a: PayloadAction<UUID>) {
      s.form = { mode: "edit", collectionId: a.payload };
    },
    closeForm(s) {
      s.form = { mode: "closed" };
    },
    requestDelete(s, a: PayloadAction<UUID>) {
      s.deleteTargetId = a.payload;
    },
    cancelDelete(s) {
      s.deleteTargetId = null;
    },
    requestPurge(s, a: PayloadAction<UUID>) {
      s.purgeTargetId = a.payload;
    },
    cancelPurge(s) {
      s.purgeTargetId = null;
    },
    openMembers(s, a: PayloadAction<UUID>) {
      s.membersTargetId = a.payload;
    },
    closeMembers(s) {
      s.membersTargetId = null;
    },
  },
  // auth never knows about collections: collections listens to the session ending and cleans itself up.
  extraReducers: (builder) => {
    builder.addCase(authActions.sessionEnded, () => initialState);
  },
  selectors: {
    selectCollectionsUi: (s) => s,
  },
});

export const collectionsUiActions = collectionsUiSlice.actions;
