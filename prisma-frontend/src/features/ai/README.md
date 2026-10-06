# features/ai — UI для AI-чату, агента та завдань

Фронтенд до бекенду `ai_module_v2` (v0.3.0). Побудований за тією ж архітектурою, що й `features/collections`:
`api/ types/ constants/ store/ hooks/ lib/ components/ pages/ routes.tsx index.ts`,
Tailwind-токени (brand/gray/success/warning/error, `text-theme-*`), RTK Query, react-i18next, `Can`, `Modal/Alert/Field`.

## Що всередині

| Маршрут | Сторінка | Що робить |
|---|---|---|
| `/ai/chat/:conversationId?` | `AiChatPage` | діалоги, стрімінг відповіді (SSE), цитати `[n]`, режим **Чат/Агент**, таймлайн кроків агента, налаштування (модель, RAG-колекції, reranker, інтернет, профіль, промпт) |
| `/ai/tasks` | `AiTasksPage` | список довготривалих завдань, фільтри, створення, Stop/Resume |
| `/ai/tasks/:taskId` | `AiTaskDetailPage` | live-прогрес (SSE), етапи, лічильники, помилки елементів, журнал подій, артефакти |
| `/ai/agents` | `AiProfilesPage` | профілі агента (промпт + модель + інструменти), «Використати в чаті» |

## Інтеграція (6 кроків)

1. **Скопіювати** папку `ai/` у `src/features/ai/`.
2. **baseApi → `tagTypes`** додати:
   `"AiConversation" | "AiMessages" | "AiCapabilities" | "AiProfile" | "AiTask" | "AiArtifact"`.
3. **Store**: додати `aiUiSlice` у `combineReducers` (за аналогією з `collectionsUiSlice`):
   `import { aiUiSlice } from "@/features/ai"` → `[aiUiSlice.reducerPath]: aiUiSlice.reducer`.
4. **Маршрути**: `import { aiRoutes } from "@/features/ai"` і розкласти поруч із `collectionsRoutes`.
5. **SSE-транспорт** (один раз при старті застосунку; ті самі заголовки, що й у `baseApi.prepareHeaders`):
   ```ts
   import { configureAiTransport } from "@/features/ai";
   configureAiTransport({
     baseUrl: API_BASE_URL,
     getHeaders: () => ({ Authorization: `Bearer ${selectAccessToken(store.getState())}` }),
   });
   ```
   `EventSource` не вміє `Authorization`, тому використано fetch-стрім із відновленням за `Last-Event-ID` (`?last_id=`).
6. **Колекції**: у `features/collections/index.ts` додати один рядок (публічний API навмисно мінімальний):
   `export { useGetCollectionsPageQuery } from "./api/collections.endpoints";`

Також: пункти меню (`AI_ROUTES.chat / tasks / agents`) і права `ai.tasks.read|create|manage` у seed RBAC
(див. `docs/INTEGRATION.md` бекенду). Чат і профілі потребують лише авторизації.

Локалізація: усі рядки мають українське значення за замовчуванням у `t(key, "…")`;
`locales/uk.ai.json` — готовий словник для злиття (ключі `common.*`/`errors.*` беруться з вашого).

## Ключові рішення

- **Бекенд — джерело правди.** Redux тримає лише UI-стан і «вказівник» активного run; живий run відновлюється
  повтором SSE-стріму (Redis replay), завдання — `GET /ai/tasks/{id}` + SSE-накладка (reload дає ту саму картку).
- **Протокол подій** згорнуто чистим редюсером (`lib/runReducer.ts`): `token.delta` належить останньому `llm_call`,
  крок із tool-викликами — лише «коментар», відповідь — текст останнього кроку без викликів. Токени
  застосовуються пачкою раз на кадр.
- **Markdown** — власний безпечний рендерер без `dangerouslySetInnerHTML` (заголовки, списки, таблиці, код із копіюванням,
  посилання http/https, маркери `[n]` → клікабельні джерела). За потреби замініть на `react-markdown`.
- Список завдань оновлюється опитуванням (4 с, лише поки є активні), SSE — тільки на сторінці завдання
  (ліміт ~6 з'єднань на origin).
- Доступність: `role=log`, `aria-live`, `role=switch/radiogroup/progressbar`, фокус-кільця, `motion-reduce`.

## Прогалини бекенду, які варто закрити

1. **Завантаження артефактів**: є лише список метаданих. UI вже викликає
   `GET /ai/tasks/{id}/artifacts/{artifact_id}/download` (див. `AI_PATHS.taskArtifactDownload`) — потрібен endpoint,
   що віддає байти з `ArtifactStore` з `Content-Disposition`.
2. **Активний run діалогу**: після повного перезавантаження сторінки UI не знає `run_id` поточного запиту.
   Рекомендація: додати `active_run_id` до `ConversationOut` (або `GET /conversations/{id}/active-run`).
3. **Пошук/total для завдань**: `GET /ai/tasks` повертає масив без `total`; пагінація зроблена як «показати ще».
4. Вкладення: UI тепер підтримує до 5 файлів на повідомлення. Перед відправленням файл завантажується через `POST /ai/attachments` (`multipart/form-data`, поле `file`), після чого отриманий `id` передається в `POST /ai/conversations/{id}/runs` як `attachment_ids`. Backend має повертати метадані вкладення та дозволяти ці IDs для поточного користувача. `GET /ai/conversations/{id}/messages` має повертати `attachments` у user-message, щоб вкладення зберігалися після reload.

## Перевірено

`tsc --strict --noUnusedLocals` проти заглушок `@/shared/*` — без помилок; юніт-перевірки парсера SSE
(розрив кадрів між чанками, `\r\n`), редюсерів run/task (replay-safety, семантика агента) та Markdown-парсера.
Візуально в браузері не запускалось — підтягніть у ваш dev-сервер і гляньте на стилі в темній/світлій темі.


## Chat attachments contract

The frontend expects the following backend contract:

### `POST /ai/attachments`

`multipart/form-data`:

```text
file=<binary>
```

Response:

```json
{
  "id": "uuid",
  "filename": "document.pdf",
  "mime_type": "application/pdf",
  "size": 123456
}
```

The attachment must be owned by the authenticated user. The backend should enforce its own MIME/size/security policy; the UI additionally limits each file to 25 MiB and each message to 5 files.

### `POST /ai/conversations/{conversation_id}/runs`

The existing JSON body may contain:

```json
{
  "content": "Проаналізуй цей файл",
  "mode": "agent",
  "settings": {},
  "attachment_ids": ["uuid"]
}
```

The backend must validate that every attachment belongs to the authenticated user and is available to the requested conversation/run.

### `GET /ai/conversations/{conversation_id}/messages`

User messages should expose:

```json
{
  "attachments": [
    {
      "id": "uuid",
      "filename": "document.pdf",
      "mime_type": "application/pdf",
      "size": 123456
    }
  ]
}
```

This keeps attachment chips visible after a page reload and lets retry reuse the same attachment IDs.

> Important: this archive contains the frontend feature only. If the backend still rejects `attachment_ids`, the backend endpoint/schema/service must be updated according to the contract above.
