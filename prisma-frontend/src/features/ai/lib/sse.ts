/**
 * Minimal fetch-based SSE client (EventSource can't send Authorization headers).
 *
 * - Backend envelope: `id:` = Redis Stream id, `event:` = type, `data:` = JSON.
 * - Reconnect resumes from the last seen id via `?last_id=` (the backend accepts it
 *   "for fetch clients", same as the Last-Event-ID header) -> no lost events.
 * - 401/403/404 are fatal (no retry loop); network errors / 5xx back off and retry.
 * - The server closes the stream after a terminal event; `isDone()` tells us not to reconnect.
 */

export interface SseMessage {
  id: string | null;
  event: string;
  data: string;
}

export type SseStatus = "connecting" | "open" | "retrying" | "closed";

/* ───────── transport config (set once at app bootstrap) ───────── */

export interface AiTransportConfig {
  /** Same base as baseApi, e.g. "/api/v1". */
  baseUrl: string;
  /** Same headers baseApi's prepareHeaders adds (Authorization etc.). */
  getHeaders: () => Record<string, string> | Promise<Record<string, string>>;
}

const envBase = (
  import.meta as ImportMeta & { env?: Record<string, string | undefined> }
).env?.VITE_API_BASE_URL;

let transport: AiTransportConfig = {
  baseUrl: envBase ?? "/api/v1",
  getHeaders: () => ({}),
};

/**
 * Call once in app bootstrap (see README), with the SAME token source baseApi uses:
 *   configureAiTransport({ baseUrl: API_BASE_URL, getHeaders: () => ({ Authorization: `Bearer ${token()}` }) })
 */
export function configureAiTransport(next: Partial<AiTransportConfig>) {
  transport = { ...transport, ...next };
}

export const getAiTransport = () => transport;

export class SseHttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SseHttpError";
    this.status = status;
  }
}

const FATAL = new Set([400, 401, 403, 404, 422]);

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; detail?: unknown };
    if (typeof body.message === "string") return body.message;
    if (typeof body.detail === "string") return body.detail;
  } catch {
    /* not json */
  }
  return `HTTP ${res.status}`;
}

/* ───────── frame parser ───────── */

/** Incremental parser: feed decoded text, get complete messages back. */
export function createSseParser() {
  let buffer = "";
  let id: string | null = null;
  let event = "message";
  let data: string[] = [];

  const flush = (out: SseMessage[]) => {
    if (data.length) out.push({ id, event, data: data.join("\n") });
    event = "message";
    data = [];
  };

  return (chunk: string): SseMessage[] => {
    buffer += chunk;
    const out: SseMessage[] = [];
    let nl: number;
    // Split on "\n" only and strip a trailing "\r": a "\r\n" pair cut between two chunks stays intact.
    while ((nl = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line === "") {
        flush(out);
      } else if (line.startsWith(":")) {
        /* keep-alive comment */
      } else {
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "id") id = value;
        else if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
    }
    return out;
  };
}

/* ───────── connection with resume ───────── */

export interface OpenStreamOptions {
  /** Path relative to baseUrl, e.g. AI_PATHS.runEvents(id). */
  path: string;
  onMessage: (msg: SseMessage) => void;
  onStatus?: (status: SseStatus, error?: Error) => void;
  /** Checked after the server closes the stream: true -> stop, false -> reconnect. */
  isDone: () => boolean;
}

/** Returns a `close()` function. Safe to call multiple times. */
export function openEventStream(opts: OpenStreamOptions): () => void {
  const ctrl = new AbortController();
  let lastId: string | null = null;
  let attempt = 0;

  const run = async () => {
    while (!ctrl.signal.aborted) {
      try {
        opts.onStatus?.(attempt === 0 ? "connecting" : "retrying");
        const { baseUrl, getHeaders } = transport;
        const qs = lastId ? `?last_id=${encodeURIComponent(lastId)}` : "";
        const res = await fetch(`${baseUrl}${opts.path}${qs}`, {
          method: "GET",
          headers: { Accept: "text/event-stream", ...(await getHeaders()) },
          credentials: "include",
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          throw new SseHttpError(res.status, await readErrorMessage(res));
        }

        opts.onStatus?.("open");
        attempt = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const feed = createSseParser();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const msg of feed(decoder.decode(value, { stream: true }))) {
            if (msg.id) lastId = msg.id;
            opts.onMessage(msg);
          }
        }
        if (opts.isDone()) break;
      } catch (e) {
        if (ctrl.signal.aborted) break;
        const err = e instanceof Error ? e : new Error(String(e));
        if (err instanceof SseHttpError && FATAL.has(err.status)) {
          opts.onStatus?.("closed", err);
          return;
        }
        if (opts.isDone()) break;
        opts.onStatus?.("retrying", err);
      }

      attempt += 1;
      const delay = Math.min(1000 * 2 ** Math.min(attempt, 4), 10000);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delay);
        ctrl.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
    }
    opts.onStatus?.("closed");
  };

  void run();
  return () => ctrl.abort();
}

/** Authorized GET returning a Blob (artifact download). Throws SseHttpError on failure. */
export async function fetchBlob(
  path: string,
): Promise<{ blob: Blob; filename: string | null }> {
  const { baseUrl, getHeaders } = transport;
  const res = await fetch(`${baseUrl}${path}`, {
    headers: await getHeaders(),
    credentials: "include",
  });
  if (!res.ok) throw new SseHttpError(res.status, await readErrorMessage(res));
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return {
    blob: await res.blob(),
    filename: m ? decodeURIComponent(m[1]) : null,
  };
}
