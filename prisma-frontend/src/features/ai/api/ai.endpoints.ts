import { baseApi } from "@/shared/api/baseApi";
import { AI_PATHS } from "../constants/ai.constants";
import type { AiRun, AiRunRequest } from "../types/ai.types";

export const aiApi = baseApi.injectEndpoints({
  overrideExisting: false,
  endpoints: (build) => ({
    /**
     * Starts a run. Multipart is intentional so images/video/documents can travel
     * with the user message. If your backend uses presigned uploads, keep this
     * endpoint JSON-only and replace this mutation with the upload handshake.
     */
    startAiRun: build.mutation<AiRun, AiRunRequest>({
      query: ({ message, config, attachments = [] }) => {
        const body = new FormData();
        body.append("message", message);
        body.append("config", JSON.stringify(config));
        for (const file of attachments) body.append("files", file);

        return {
          url: AI_PATHS.runs,
          method: "POST",
          body,
        };
      },
    }),

    cancelAiRun: build.mutation<void, string>({
      query: (runId) => ({
        url: AI_PATHS.cancel(runId),
        method: "POST",
      }),
    }),
  }),
});

export const {
  useStartAiRunMutation,
  useCancelAiRunMutation,
} = aiApi;
