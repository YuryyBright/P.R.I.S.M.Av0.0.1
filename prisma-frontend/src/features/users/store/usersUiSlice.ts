import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { authActions } from "@/features/auth";
import { DEFAULT_PAGE_SIZE, type UUID } from "@/shared/types/api";
import type { UserOrderBy } from "../types/user.types";

export type UserFormState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; userId: UUID };

/** UI-only state. Server data lives in RTK Query, never duplicated here. */
export interface UsersUiState {
  page: number;
  size: number;
  orderBy: UserOrderBy;
  emailQuery: string;
  selectedIds: UUID[];
  form: UserFormState;
  deleteTargetId: UUID | null;
}

const initialState: UsersUiState = {
  page: 1,
  size: DEFAULT_PAGE_SIZE,
  orderBy: "default",
  emailQuery: "",
  selectedIds: [],
  form: { mode: "closed" },
  deleteTargetId: null,
};

export const usersUiSlice = createSlice({
  name: "usersUi",
  initialState,
  reducers: {
    setPage(s, a: PayloadAction<number>) {
      s.page = Math.max(1, a.payload);
    },
    setSize(s, a: PayloadAction<number>) {
      s.size = a.payload;
      s.page = 1;
    },
    setOrderBy(s, a: PayloadAction<UserOrderBy>) {
      s.orderBy = a.payload;
      s.page = 1;
    },
    setEmailQuery(s, a: PayloadAction<string>) {
      s.emailQuery = a.payload;
      s.page = 1;
    },
    toggleSelected(s, a: PayloadAction<UUID>) {
      s.selectedIds = s.selectedIds.includes(a.payload)
        ? s.selectedIds.filter((id) => id !== a.payload)
        : [...s.selectedIds, a.payload];
    },
    setSelection(s, a: PayloadAction<UUID[]>) {
      s.selectedIds = a.payload;
    },
    clearSelection(s) {
      s.selectedIds = [];
    },
    openCreateForm(s) {
      s.form = { mode: "create" };
    },
    openEditForm(s, a: PayloadAction<UUID>) {
      s.form = { mode: "edit", userId: a.payload };
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
  },
  // auth never knows about users: users listens to the session ending and cleans itself up.
  extraReducers: (builder) => {
    builder.addCase(authActions.sessionEnded, () => initialState);
  },
  // slice.selectors need no hand-written "root state" type: they accept { usersUi: UsersUiState }.
  selectors: {
    selectUsersUi: (s) => s,
  },
});

export const usersUiActions = usersUiSlice.actions;
