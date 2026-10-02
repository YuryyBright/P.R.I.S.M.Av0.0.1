import type { UUID } from "@/shared/types/api";
import {
  useCancelJobMutation,
  useRetryJobMutation,
} from "../api/jobs.endpoints";

/** Every action resolves with the server payload or THROWS a NormalizedApiError. */
export function useJobActions() {
  const [cancel, cancelS] = useCancelJobMutation();
  const [retry, retryS] = useRetryJobMutation();

  return {
    cancelJob: (id: UUID) => cancel(id).unwrap(),
    /** Creates a NEW reindex job for the same document (history is kept). */
    retryJob: (id: UUID) => retry(id).unwrap(),
    isMutating: [cancelS, retryS].some((s) => s.isLoading),
  };
}
