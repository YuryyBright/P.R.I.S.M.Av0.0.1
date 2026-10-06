import { baseApi } from "@/shared/api/baseApi";
import type { UUID } from "@/shared/types/api";
import {
  AI_PATHS,
  CONVERSATIONS_PAGE_SIZE,
  MESSAGES_PAGE_STEP,
} from "../constants/ai.constants";
import type {
  AgentProfile,
  ChatAttachment,
  Capabilities,
  Conversation,
  ConversationCreatePayload,
  ConversationsPageArgs,
  ConversationUpdatePayload,
  Message,
  MessagesArgs,
  Page,
  ProfileCreatePayload,
  Run,
  RunStep,
  StartRunPayload,
  StartRunResponse,
  Task,
  TaskArtifact,
  TaskCreatePayload,
  TaskCreateResponse,
  TasksArgs,
} from "../types/ai.types";

const LIST = "LIST" as const;

/**
 * NOTE: add to `tagTypes` in baseApi:
 *   "AiConversation" | "AiMessages" | "AiCapabilities" | "AiProfile" | "AiTask" | "AiArtifact"
 * No envelope here -> mutations resolve with the plain body.
 *
 * Live run / task events are NOT here: they are SSE streams (see lib/sse.ts + hooks/useRunStream.ts).
 */
export const aiApi = baseApi.injectEndpoints({
  overrideExisting: false,
  endpoints: (build) => ({
    /* ───────── capabilities ───────── */

    /** GET /ai/capabilities: what the UI may actually enable (models, tools, reranker, profiles). */
    getCapabilities: build.query<Capabilities, void>({
      query: () => AI_PATHS.capabilities,
      providesTags: [{ type: "AiCapabilities", id: LIST }],
    }),

    /* ───────── conversations ───────── */

    /** GET /ai/conversations?archived&limit&offset -> Page<Conversation> */
    getConversationsPage: build.query<
      Page<Conversation>,
      ConversationsPageArgs | void
    >({
      query: (args) => {
        const {
          page = 1,
          size = CONVERSATIONS_PAGE_SIZE,
          archived = false,
        } = args ?? {};
        return {
          url: AI_PATHS.conversations,
          params: { archived, limit: size, offset: (page - 1) * size },
        };
      },
      providesTags: (res) => [
        ...(res?.items ?? []).map((c) => ({
          type: "AiConversation" as const,
          id: c.id,
        })),
        { type: "AiConversation" as const, id: LIST },
      ],
    }),

    getConversationById: build.query<Conversation, UUID>({
      query: (id) => AI_PATHS.conversation(id),
      providesTags: (_r, _e, id) => [{ type: "AiConversation", id }],
    }),

    /* ───────── chat attachments ───────── */

    /**
     * POST /ai/attachments (multipart/form-data, field: `file`).
     * The backend persists the file and returns metadata; the returned id is
     * passed to POST /ai/conversations/{id}/runs as `attachment_ids`.
     */
    uploadAttachment: build.mutation<ChatAttachment, File>({
      query: (file) => {
        const body = new FormData();
        body.append("file", file);
        return {
          url: AI_PATHS.attachments,
          method: "POST",
          body,
        };
      },
    }),

    /** DELETE /ai/attachments/{id} -> 204. Removes an uploaded but unsent attachment. */
    deleteAttachment: build.mutation<void, UUID>({
      query: (id) => ({
        url: `${AI_PATHS.attachments}/${id}`,
        method: "DELETE",
      }),
    }),

    /** POST /ai/conversations -> 201 */
    createConversation: build.mutation<Conversation, ConversationCreatePayload>(
      {
        query: (body) => ({
          url: AI_PATHS.conversations,
          method: "POST",
          body,
        }),
        invalidatesTags: [{ type: "AiConversation", id: LIST }],
      },
    ),

    /** PATCH /ai/conversations/{id}: title / is_archived / settings (merged server-side). */
    updateConversation: build.mutation<
      Conversation,
      { id: UUID; body: ConversationUpdatePayload }
    >({
      query: ({ id, body }) => ({
        url: AI_PATHS.conversation(id),
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "AiConversation", id },
        { type: "AiConversation", id: LIST },
      ],
    }),

    /** DELETE -> 204. 409 `ConflictError` while a run is active. */
    deleteConversation: build.mutation<void, UUID>({
      query: (id) => ({ url: AI_PATHS.conversation(id), method: "DELETE" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "AiConversation", id },
        { type: "AiConversation", id: LIST },
        { type: "AiMessages", id },
      ],
    }),

    /**
     * GET /ai/conversations/{id}/messages?limit -> Message[] NEWEST FIRST.
     * We reverse it to chronological order here, so components never think about it.
     * "Load earlier" simply raises `limit` (50 -> 100 -> 200).
     */
    getMessages: build.query<Message[], MessagesArgs>({
      query: ({ conversationId, limit = MESSAGES_PAGE_STEP }) => ({
        url: AI_PATHS.messages(conversationId),
        params: { limit },
      }),
      transformResponse: (rows: Message[]) => [...rows].reverse(),
      serializeQueryArgs: ({ queryArgs }) => queryArgs.conversationId,
      merge: (_cache, next) => next,
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.limit !== previousArg?.limit,
      providesTags: (_r, _e, { conversationId }) => [
        { type: "AiMessages", id: conversationId },
      ],
    }),

    /* ───────── runs ───────── */

    /** POST /ai/conversations/{id}/runs -> 202. 409 `conversation_busy` if a run is already active. */
    startRun: build.mutation<
      StartRunResponse,
      { conversationId: UUID; body: StartRunPayload }
    >({
      query: ({ conversationId, body }) => ({
        url: AI_PATHS.startRun(conversationId),
        method: "POST",
        body,
      }),
      // user message is persisted immediately; the assistant one arrives after run.finished
      invalidatesTags: (_r, _e, { conversationId }) => [
        { type: "AiMessages", id: conversationId },
        { type: "AiConversation", id: conversationId },
        { type: "AiConversation", id: LIST },
      ],
    }),

    getRun: build.query<Run, UUID>({
      query: (id) => AI_PATHS.run(id),
    }),

    /** Persisted steps of a finished run (history view of the agent's work). */
    getRunSteps: build.query<RunStep[], UUID>({
      query: (id) => AI_PATHS.runSteps(id),
    }),

    cancelRun: build.mutation<Run, UUID>({
      query: (id) => ({ url: AI_PATHS.runCancel(id), method: "POST" }),
    }),

    /* ───────── agent profiles ───────── */

    getProfiles: build.query<AgentProfile[], void>({
      query: () => AI_PATHS.profiles,
      providesTags: [{ type: "AiProfile", id: LIST }],
    }),

    createProfile: build.mutation<AgentProfile, ProfileCreatePayload>({
      query: (body) => ({ url: AI_PATHS.profiles, method: "POST", body }),
      invalidatesTags: [
        { type: "AiProfile", id: LIST },
        { type: "AiCapabilities", id: LIST },
      ],
    }),

    /** DELETE -> 204 (archives). */
    archiveProfile: build.mutation<void, UUID>({
      query: (id) => ({ url: AI_PATHS.profile(id), method: "DELETE" }),
      invalidatesTags: [
        { type: "AiProfile", id: LIST },
        { type: "AiCapabilities", id: LIST },
      ],
    }),

    /* ───────── tasks ───────── */

    /** GET /ai/tasks?limit&offset -> Task[] (plain array: no total). */
    getTasks: build.query<Task[], TasksArgs | void>({
      query: (args) => ({
        url: AI_PATHS.tasks,
        params: { limit: args?.limit ?? 30, offset: args?.offset ?? 0 },
      }),
      providesTags: (res) => [
        ...(res ?? []).map((t) => ({ type: "AiTask" as const, id: t.id })),
        { type: "AiTask" as const, id: LIST },
      ],
    }),

    getTaskById: build.query<Task, UUID>({
      query: (id) => AI_PATHS.task(id),
      providesTags: (_r, _e, id) => [{ type: "AiTask", id }],
    }),

    /** POST /ai/tasks -> 202 {task_id, status} */
    createTask: build.mutation<TaskCreateResponse, TaskCreatePayload>({
      query: (body) => ({ url: AI_PATHS.tasks, method: "POST", body }),
      invalidatesTags: [{ type: "AiTask", id: LIST }],
    }),

    /** POST /ai/tasks/{id}/cancel -> 202 Task (graceful: status becomes `cancelling`). */
    cancelTask: build.mutation<Task, UUID>({
      query: (id) => ({ url: AI_PATHS.taskCancel(id), method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "AiTask", id },
        { type: "AiTask", id: LIST },
      ],
    }),

    /** POST /ai/tasks/{id}/resume -> 202 Task (FAILED/CANCELLED/PAUSED -> QUEUED). */
    resumeTask: build.mutation<Task, UUID>({
      query: (id) => ({ url: AI_PATHS.taskResume(id), method: "POST" }),
      invalidatesTags: (_r, _e, id) => [
        { type: "AiTask", id },
        { type: "AiTask", id: LIST },
      ],
    }),

    getTaskArtifacts: build.query<TaskArtifact[], UUID>({
      query: (id) => AI_PATHS.taskArtifacts(id),
      providesTags: (_r, _e, id) => [{ type: "AiArtifact", id }],
    }),
  }),
});

export const {
  useGetCapabilitiesQuery,
  useGetConversationsPageQuery,
  useGetConversationByIdQuery,
  useUploadAttachmentMutation,
  useDeleteAttachmentMutation,
  useCreateConversationMutation,
  useUpdateConversationMutation,
  useDeleteConversationMutation,
  useGetMessagesQuery,
  useStartRunMutation,
  useGetRunQuery,
  useGetRunStepsQuery,
  useCancelRunMutation,
  useGetProfilesQuery,
  useCreateProfileMutation,
  useArchiveProfileMutation,
  useGetTasksQuery,
  useGetTaskByIdQuery,
  useCreateTaskMutation,
  useCancelTaskMutation,
  useResumeTaskMutation,
  useGetTaskArtifactsQuery,
} = aiApi;
