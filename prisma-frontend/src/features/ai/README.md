# AI Workspace — frontend template

Цей feature додається поруч із `collections` та `documents` у твоєму frontend.

## UX-модель

Не робити окремі сторінки `Chat` і `Agent`. Рекомендована модель:

- `/ai` — один AI Workspace.
- верхній перемикач: `Chat | Agent`;
- composer спільний для обох режимів;
- attachments: image / video / document;
- права панель: model + generation + Knowledge;
- Knowledge:
  - RAG on/off;
  - collections;
  - top K;
  - reranker on/off;
  - rerank K;
- Agent додає нижче allow-list tools;
- run execution показується timeline-ом із SSE;
- sources/citations показуються окремим блоком після/під відповіддю.

## Backend contract, який очікує цей шаблон

### Start

`POST /ai/runs`

`multipart/form-data`:

- `message`: string
- `config`: JSON string
- `files`: zero or more files

Response:

```json
{
  "id": "uuid",
  "status": "queued",
  "mode": "chat",
  "createdAt": "2026-10-05T10:00:00Z",
  "config": {}
}
```

### SSE

`GET /ai/runs/{run_id}/events`

Recommended:

```text
event: run.started
data: {"type":"run.started","runId":"...","timestamp":"...","data":{}}

event: retrieval.started
data: {"type":"retrieval.started","runId":"...","timestamp":"...","data":{}}

event: retrieval.result
data: {"type":"retrieval.result","runId":"...","timestamp":"...","data":{"chunks":[]}}

event: llm.delta
data: {"type":"llm.delta","runId":"...","timestamp":"...","data":{"text":"Hello"}}

event: citation.created
data: {"type":"citation.created","runId":"...","timestamp":"...","data":{"number":1,"chunkId":"..."}}

event: run.completed
data: {"type":"run.completed","runId":"...","timestamp":"...","data":{}}
```

### Cancel

`POST /ai/runs/{run_id}/cancel`

## SSE vs WebSocket

Для цієї архітектури рекомендований **SSE**, а не WebSocket:

- сервер → UI є основним напрямком після запуску run;
- SSE природно відповідає event protocol;
- reconnect простіший;
- легко прокинути через nginx/load balancer;
- browser має нативний `EventSource`;
- cancel можна зробити окремим `POST`.

WebSocket має сенс лише якщо пізніше з'являться вимоги до справжньої двосторонньої realtime-сесії: live voice, live tool control, interactive agent steering тощо.

## Важливо для production

1. `EventSource` не дозволяє довільний Authorization header. Якщо frontend і API на різних origins та auth = Bearer header, заміни `EventSource` на `fetch()` streaming parser або використай короткоживучий SSE ticket.
2. SSE endpoint повинен віддавати `text/event-stream`, flush кожної події і heartbeat приблизно кожні 10–20 секунд.
3. Підтримай `Last-Event-ID`, якщо потрібен reliable reconnect.
4. Backend має зберігати `ai_run_steps`, а SSE — лише транслювати canonical `RunEvent`.
5. UI не повинен інтерпретувати внутрішній Celery/vLLM state напряму. Йому потрібен лише `RunEvent` protocol.
6. RAG authorization залишається на backend: collection IDs з UI — це запит, а не дозвіл.

## Інтеграція

Додай `aiRoutes` до authenticated router поруч із:

```ts
collectionsRoutes
documentsRoutes
```

і зареєструй `AI` у `baseApi.tagTypes`, якщо пізніше додаси cache tags.

Для collections у production заміни demo `<option>` у `KnowledgePanel` на дані з existing `useGetCollectionsPageQuery`.
