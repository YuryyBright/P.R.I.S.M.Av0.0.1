# React Frontend for FastAPI Auth Backend

Secure React + TypeScript UI for the FastAPI PRISMA backend.

## Documentation (MkDocs)

Canonical admin_frontend docs live on the documentation site — prefer those over duplicating long guides here:

| Topic                        | Doc                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| Overview + future frameworks | [`docs/admin_frontend/index.md`](../docs/admin_frontend/index.md)                                   |
| Setup & env                  | [`docs/admin_frontend/react/setup.md`](../docs/admin_frontend/react/setup.md)                       |
| Architecture                 | [`docs/admin_frontend/react/architecture.md`](../docs/admin_frontend/react/architecture.md)         |
| Authentication               | [`docs/admin_frontend/react/auth.md`](../docs/admin_frontend/react/auth.md)                         |
| Redux state                  | [`docs/admin_frontend/react/state.md`](../docs/admin_frontend/react/state.md)                       |
| ShadCN UI                    | [`docs/admin_frontend/react/ui.md`](../docs/admin_frontend/react/ui.md)                             |
| Testing                      | [`docs/admin_frontend/react/testing.md`](../docs/admin_frontend/react/testing.md)                   |
| Deployment                   | [`docs/admin_frontend/react/deployment.md`](../docs/admin_frontend/react/deployment.md)             |
| Troubleshooting              | [`docs/troubleshooting/admin_frontend-issues.md`](../docs/troubleshooting/admin_frontend-issues.md) |

Package-local e2e runbooks remain under [`E2E_TESTING.md`](./E2E_TESTING.md) and [`e2e/`](./e2e/).

## Quick start

```bash
cd admin_frontend
npm install
cp .env.example .env.development
npm run dev
```

Requires Node.js 20+. Point `VITE_API_BASE_URL` at a running API. Full steps: [Setup](../docs/admin_frontend/react/setup.md).

## Features (summary)

- JWT auth with in-memory access token + refresh token handling
- Redux Toolkit, React Router, ShadCN UI / Tailwind
- CSRF integration with the backend
- Vitest + Playwright test suites
- Docker / Nginx deployment layouts

## Commands

See [Setup — Common commands](../docs/admin_frontend/react/setup.md#common-commands) for the full list (`dev`, `build`, `lint`, `test`, `test:e2e`, …).
