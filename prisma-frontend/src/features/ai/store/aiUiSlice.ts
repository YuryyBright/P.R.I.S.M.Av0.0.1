import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { authActions } from "@/features/auth";
import type { UUID } from "@/shared/types/api";
import type { ConversationSettings } from "../types/ai.types";

export type TasksFilter = "all" | "active" | "done";

/** Key of the composer draft before the conversation exists. */
export const NEW_DRAFT_KEY = "new";

/**
 * UI-only state. Server data lives in RTK Query; live run/task events live in hooks.
 * `activeRuns` is just a *pointer* (conversation -> run id) so the stream can be re-attached
 * after in-app navigation; the run itself is always re-read from the backend (SSE replay).
 */
export interface AiUiState {
  /** conversationId -> runId of the run currently streaming. */
  activeRuns: Record<UUID, UUID>;
  /** Unsent settings changes per conversation (or NEW_DRAFT_KEY). */
  drafts: Record<string, Partial<ConversationSettings>>;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  showArchived: boolean;
  tasksFilter: TasksFilter;
  taskCreateOpen: boolean;
  profileFormOpen: boolean;
  profileDeleteId: UUID | null;
}

const initialState: AiUiState = {
  activeRuns: {},
  drafts: {},
  sidebarOpen: false,
  settingsOpen: false,
  showArchived: false,
  tasksFilter: "all",
  taskCreateOpen: false,
  profileFormOpen: false,
  profileDeleteId: null,
};

export const aiUiSlice = createSlice({
  name: "aiUi",
  initialState,
  reducers: {
    runStarted(s, a: PayloadAction<{ conversationId: UUID; runId: UUID }>) {
      s.activeRuns[a.payload.conversationId] = a.payload.runId;
    },
    runEnded(s, a: PayloadAction<UUID>) {
      delete s.activeRuns[a.payload];
    },
    patchDraft(
      s,
      a: PayloadAction<{ key: string; patch: Partial<ConversationSettings> }>,
    ) {
      s.drafts[a.payload.key] = {
        ...s.drafts[a.payload.key],
        ...a.payload.patch,
      };
    },
    clearDraft(s, a: PayloadAction<string>) {
      delete s.drafts[a.payload];
    },
    openSidebar(s) {
      s.sidebarOpen = true;
    },
    closeSidebar(s) {
      s.sidebarOpen = false;
    },
    toggleSettings(s) {
      s.settingsOpen = !s.settingsOpen;
    },
    closeSettings(s) {
      s.settingsOpen = false;
    },
    setShowArchived(s, a: PayloadAction<boolean>) {
      s.showArchived = a.payload;
    },
    setTasksFilter(s, a: PayloadAction<TasksFilter>) {
      s.tasksFilter = a.payload;
    },
    openTaskCreate(s) {
      s.taskCreateOpen = true;
    },
    closeTaskCreate(s) {
      s.taskCreateOpen = false;
    },
    openProfileForm(s) {
      s.profileFormOpen = true;
    },
    closeProfileForm(s) {
      s.profileFormOpen = false;
    },
    requestProfileDelete(s, a: PayloadAction<UUID>) {
      s.profileDeleteId = a.payload;
    },
    cancelProfileDelete(s) {
      s.profileDeleteId = null;
    },
  },
  // auth never knows about ai: ai listens to the session ending and cleans itself up.
  extraReducers: (builder) => {
    builder.addCase(authActions.sessionEnded, () => initialState);
  },
  selectors: {
    selectAiUi: (s) => s,
  },
});

export const aiUiActions = aiUiSlice.actions;
