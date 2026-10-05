# Integration checklist

## 1. Router

```ts
import { aiRoutes } from "@/features/ai";

const routes = [
  // ...
  ...aiRoutes,
];
```

## 2. RTK Query

`ai/api/ai.endpoints.ts` використовує той самий `baseApi`, що й collections/documents.

## 3. SSE

Frontend відкриває:

`GET /ai/runs/:id/events`

після успішного `POST /ai/runs`.

Не роби polling кожні 1–3 секунди для run execution: SSE вже є transport для прогресу.

## 4. Event protocol

Рекомендую зберегти один discriminated union на backend:

```ts
type RunEvent =
  | { type: "run.started"; ... }
  | { type: "retrieval.started"; ... }
  | { type: "retrieval.result"; ... }
  | { type: "tool.started"; ... }
  | { type: "tool.result"; ... }
  | { type: "llm.delta"; ... }
  | { type: "citation.created"; ... }
  | { type: "run.completed"; ... }
  | { type: "run.failed"; ... }
  | { type: "run.cancelled"; ... };
```

Це важливіше за конкретний UI-компонент: після цього UI можна змінювати без зміни runtime.

## 5. Message rendering

Поточний шаблон навмисно простий. Наступним кроком варто додати:

- markdown;
- code blocks;
- streaming cursor;
- citation `[1]` → Source drawer;
- collapsed retrieval steps;
- tool calls як expandable cards;
- token/latency badges;
- retry failed run.

## 6. Conversation model

Не змішуй `conversation` і `run`.

Рекомендована модель:

conversation
→ user message
→ run
→ run steps/events
→ assistant message
→ citations

Це дозволить повторно запускати один user message з іншою моделлю/RAG config.
