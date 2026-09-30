# Prisma frontend — що де лежить

| Папка | Що там | Коли розгортати |
|---|---|---|
| `app/` | точка входу, провайдери, роутер, env | рідко: новий глобальний провайдер / маршрут |
| `pages/` | тонкі сторінки = збірка фіч | на кожен екран; логіки майже нема |
| `features/<name>/` | сценарій: `api/ hooks/ components/ lib/ types.ts` | нова бізнес-можливість (documents, search) |
| `entities/` | спільні доменні типи (User, Document) | коли тип потрібен ≥2 фічам |
| `shared/` | axios-клієнт, ui-кіт, утиліти, без знання домену | коли код не залежить від бізнесу |
| `layouts/` | каркаси (використовуємо TailAdmin AppLayout) | майже ніколи |

Залежності лише в один бік: `pages → features → entities → shared`.
Нова фіча: скопіюйте `features/users`, перейменуйте, додайте маршрут у `app/router/routes.tsx`
(захист: `<RequirePermission perms={["rag.documents.read"]} />`).

## Встановлення
    npm i axios @tanstack/react-query react-router
    cp .env.example .env
