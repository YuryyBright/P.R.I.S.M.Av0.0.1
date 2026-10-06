import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { isNormalizedApiError } from "@/shared/api/normalizeError";
import type { UUID } from "@/shared/types/api";
import {
  aiApi,
  useCancelRunMutation,
  useCreateConversationMutation,
  useDeleteAttachmentMutation,
  useGetCapabilitiesQuery,
  useGetConversationByIdQuery,
  useGetMessagesQuery,
  useStartRunMutation,
  useUploadAttachmentMutation,
} from "../api/ai.endpoints";
import {
  AI_ROUTES,
  MAX_MESSAGE_LENGTH,
  MESSAGES_MAX_LIMIT,
  MESSAGES_PAGE_STEP,
} from "../constants/ai.constants";
import { mergeSettings } from "../lib/format";
import type { LiveRun } from "../lib/runReducer";
import {
  aiUiActions,
  aiUiSlice,
  NEW_DRAFT_KEY,
} from "../store/aiUiSlice";
import type { ConversationSettings, Message } from "../types/ai.types";
import { useRunStream } from "./useRunStream";

export type SendResult = { ok: true } | { ok: false; message: string | null };

/** Why the composer can't send right now (null = it can). Keys map to i18n in the composer. */
export type SendBlock =
  | "empty"
  | "tooLong"
  | "noCollections"
  | "busy"
  | "noAgentModel"
  | null;

/**
 * Everything the chat page needs, in one place:
 * conversation + capabilities + messages (REST), live run (SSE), composer settings (draft),
 * and the send / stop / retry actions.
 *
 * Source of truth is the backend; Redux only keeps the "active run" pointer and unsent settings.
 */
export function useChat(conversationId: UUID | undefined) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const ui = useSelector(aiUiSlice.selectors.selectAiUi);

  const conversation = useGetConversationByIdQuery(conversationId as UUID, {
    skip: !conversationId,
  });
  const capabilities = useGetCapabilitiesQuery();

  const [limit, setLimit] = useState(MESSAGES_PAGE_STEP);
  useEffect(() => setLimit(MESSAGES_PAGE_STEP), [conversationId]);

  const messagesQ = useGetMessagesQuery(
    { conversationId: conversationId as UUID, limit },
    { skip: !conversationId },
  );
  const messages: Message[] = messagesQ.data ?? [];

  const [createConversation, createS] = useCreateConversationMutation();
  const [startRun, startS] = useStartRunMutation();
  const [cancelRun, cancelS] = useCancelRunMutation();
  const [uploadAttachment, uploadAttachmentS] = useUploadAttachmentMutation();
  const [deleteAttachment, deleteAttachmentS] = useDeleteAttachmentMutation();

  /* ───────── settings: defaults <- conversation <- unsent draft ───────── */

  const draftKey = conversationId ?? NEW_DRAFT_KEY;
  const draft = ui.drafts[draftKey];
  const settings = useMemo(
    () => mergeSettings(conversation.data?.settings, draft),
    [conversation.data?.settings, draft],
  );
  const patchSettings = useCallback(
    (patch: Partial<ConversationSettings>) =>
      dispatch(aiUiActions.patchDraft({ key: draftKey, patch })),
    [dispatch, draftKey],
  );

  /* ───────── live run ───────── */

  const activeRunId = conversationId ? (ui.activeRuns[conversationId] ?? null) : null;

  const onFinished = useCallback(
    (run: LiveRun) => {
      if (!conversationId) return;
      // pull the persisted assistant message (and refreshed title / ordering)
      dispatch(
        aiApi.util.invalidateTags([
          { type: "AiMessages", id: conversationId },
          { type: "AiConversation", id: conversationId },
          { type: "AiConversation", id: "LIST" },
        ]),
      );
      void run;
    },
    [conversationId, dispatch],
  );
  const stream = useRunStream(activeRunId, onFinished);
  const liveRun = stream.run;

  // Hand over from the live bubble to the persisted message without a flicker/duplicate.
  useEffect(() => {
    if (!conversationId || !liveRun?.finished) return;
    if (liveRun.messageId && messages.some((m) => m.id === liveRun.messageId)) {
      dispatch(aiUiActions.runEnded(conversationId));
    }
  }, [conversationId, liveRun, messages, dispatch]);

  const isRunActive = Boolean(liveRun && !liveRun.finished) || (Boolean(activeRunId) && !liveRun);
  const dismissRun = useCallback(() => {
    if (conversationId) dispatch(aiUiActions.runEnded(conversationId));
  }, [conversationId, dispatch]);

  /* ───────── send / stop / retry ───────── */

  const agentModelOk =
    settings.mode !== "agent" ||
    !capabilities.data ||
    capabilities.data.models.some(
      (m) => m.tools && (settings.model ? m.alias === settings.model : true),
    );

  const sendBlock = useCallback(
    (text: string): SendBlock => {
      const trimmed = text.trim();
      if (!trimmed) return "empty";
      if (trimmed.length > MAX_MESSAGE_LENGTH) return "tooLong";
      if (isRunActive) return "busy";
      if (
        settings.rag_enabled &&
        settings.collection_ids !== null &&
        settings.collection_ids.length === 0
      )
        return "noCollections";
      if (!agentModelOk) return "noAgentModel";
      return null;
    },
    [isRunActive, settings.rag_enabled, settings.collection_ids, agentModelOk],
  );

  const send = useCallback(
    async (text: string, attachmentIds: UUID[] = []): Promise<SendResult> => {
      const content = text.trim();
      if (sendBlock(text)) return { ok: false, message: null };

      try {
        let id = conversationId;
        if (!id) {
          const created = await createConversation({ settings }).unwrap();
          id = created.id;
        }
        const res = await startRun({
          conversationId: id,
          body: { content, mode: settings.mode, settings, attachment_ids: attachmentIds },
        }).unwrap();

        dispatch(aiUiActions.runStarted({ conversationId: id, runId: res.run_id }));
        dispatch(aiUiActions.clearDraft(draftKey));
        if (!conversationId) {
          navigate(AI_ROUTES.chatDetail(id), { replace: true });
        }
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          message: isNormalizedApiError(e) ? e.message : null,
        };
      }
    },
    [
      sendBlock,
      conversationId,
      createConversation,
      settings,
      startRun,
      dispatch,
      draftKey,
      navigate,
    ],
  );

  const upload = useCallback(
    async (file: File) => uploadAttachment(file).unwrap(),
    [uploadAttachment],
  );

  const removeAttachment = useCallback(
    async (id: UUID) => {
      await deleteAttachment(id).unwrap();
    },
    [deleteAttachment],
  );

  const stop = useCallback(async () => {
    if (!activeRunId) return;
    try {
      await cancelRun(activeRunId).unwrap();
    } catch {
      /* already finished: the stream will tell */
    }
  }, [activeRunId, cancelRun]);

  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "user") ?? null,
    [messages],
  );

  const canLoadEarlier =
    limit < MESSAGES_MAX_LIMIT && messages.length >= limit && !messagesQ.isFetching;
  const loadEarlier = useCallback(
    () => setLimit((l) => Math.min(l * 2, MESSAGES_MAX_LIMIT)),
    [],
  );

  return {
    conversation,
    capabilities,
    messages,
    messagesLoading: messagesQ.isLoading,
    messagesError: messagesQ.error,
    canLoadEarlier,
    loadEarlier,
    loadingEarlier: messagesQ.isFetching && !messagesQ.isLoading,
    settings,
    patchSettings,
    hasDraft: Boolean(draft && Object.keys(draft).length),
    liveRun,
    streamState: stream,
    isRunActive,
    isStarting: createS.isLoading || startS.isLoading,
    uploadAttachment: upload,
    deleteAttachment: removeAttachment,
    isDeletingAttachment: deleteAttachmentS.isLoading,
    isUploadingAttachment: uploadAttachmentS.isLoading,
    isStopping: cancelS.isLoading,
    dismissRun,
    sendBlock,
    send,
    stop,
    lastUserMessage,
  };
}
