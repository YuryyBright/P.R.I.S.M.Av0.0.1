# React testing

Unit/integration tests use **Vitest** + **React Testing Library**. End-to-end tests use **Playwright**.

Related: [Setup](./setup.md), [Architecture](./architecture.md), backend testing in [Testing Guide](../../development/TESTING.md) and `backend/test/README.md`.

## Unit and integration (Vitest)

### Categories

- Component rendering and interaction
- API service layer (often with MSW)
- Authentication flows
- User / role / permission feature suites
- Redux store integration
- CSRF / security-oriented client tests

### Commands

Run from `admin_frontend/`:

```bash
npm test                 # Vitest (interactive / watch-oriented)
npm run test:run         # single run
npm run test:watch       # explicit watch
npm run test:ui          # Vitest UI
npm run test:coverage    # V8 coverage
npm test -- UsersList.test.tsx
```

### Configuration notes

- Framework: Vitest + React Testing Library
- API mocking: MSW where used
- Coverage: `@vitest/coverage-v8`
- Environment: jsdom

Wrap components/hooks that need Redux with a `Provider` and realistic preloaded auth state. See [Frontend Issues — Tests](../../troubleshooting/admin_frontend-issues.md#tests).

## End-to-end (Playwright)

```bash
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:headed
npm run test:e2e:debug
npm run test:e2e:report
npm run test:e2e:codegen
```

Specs and helpers live under `admin_frontend/e2e/`. Deeper runbooks remain in the package:

- [`admin_frontend/E2E_TESTING.md`](../../../admin_frontend/E2E_TESTING.md)
- [`admin_frontend/e2e/README.md`](../../../admin_frontend/e2e/README.md)
- [`admin_frontend/e2e/QUICK_START.md`](../../../admin_frontend/e2e/QUICK_START.md)

Ensure the app (and usually the API) are available for e2e as described in those guides.

## Coverage expectations

Treat the counts in `admin_frontend/README.md` / CI as snapshots — they drift. Prefer green CI and meaningful assertions over chasing a fixed number in this page.
