# Frontend

Documentation for the UI layer of FastAPI PRISMA.

## Current implementation

The shipped UI is a **React + TypeScript + Vite** app in [`admin_frontend/`](https://github.com/mnaimfaizy/prisma/tree/main/admin_frontend).

| Page                                                           | Covers                                 |
| -------------------------------------------------------------- | -------------------------------------- |
| [Setup](./react/setup.md)                                      | Install, env files, local dev commands |
| [Architecture](./react/architecture.md)                        | Project layout and coding patterns     |
| [Authentication](./react/auth.md)                              | Client auth, tokens, PRISMA guards     |
| [State management](./react/state.md)                           | Redux Toolkit slices and thunks        |
| [UI components](./react/ui.md)                                 | ShadCN / Tailwind                      |
| [Testing](./react/testing.md)                                  | Vitest and Playwright                  |
| [Deployment](./react/deployment.md)                            | Docker, Nginx, production build        |
| [Troubleshooting](../troubleshooting/admin_frontend-issues.md) | Common client issues                   |

Cross-cutting system context: [System Architecture](../reference/architecture.md).

## Future admin_frontend frameworks

This section is structured so additional UIs can be documented beside React without rewriting the nav:

```
docs/admin_frontend/
├── index.md                 # this page
├── react/                   # current SPA (documented)
├── nextjs/                  # reserved — SSR / App Router (not implemented)
└── angular/                 # reserved — alternative client (not implemented)
```

When a second framework ships:

1. Add a subdirectory under `docs/admin_frontend/` (for example `nextjs/`).
2. Mirror the same topic split (setup, architecture, auth, …) where it applies.
3. Register pages under the **Frontend** nav group in `mkdocs.yml`.
4. Keep shared backend contracts in [API Reference](../reference/index.md); do not fork API docs per UI.

Until then, treat **React** as the only supported admin_frontend.
