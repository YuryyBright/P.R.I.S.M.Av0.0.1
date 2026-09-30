# P.R.I.S.M.A. frontend auth contract

This frontend is aligned with the current P.R.I.S.M.A. backend auth design.

## Required endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/auth/csrf-token` | Issue CSRF token + cookie |
| POST | `/api/v1/auth/login` | JSON login, creates refresh session cookie |
| POST | `/api/v1/auth/new_access_token` | Rotate/issue access token from refresh cookie |
| POST | `/api/v1/auth/logout` | Revoke current session |
| POST | `/api/v1/auth/logout/all` | Revoke all user sessions |
| GET | `/api/v1/users/me` | Current user, roles and permissions |

## Login request

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

## Wrapped response

The frontend expects the backend response wrapper:

```json
{
  "message": "...",
  "meta": {},
  "data": {}
}
```

For login, `data` must contain at least:

```json
{
  "access_token": "...",
  "token_type": "bearer"
}
```

`user` may also be included. If it is omitted, the frontend calls `/users/me`.

## CSRF

Mutating auth requests send `X-CSRFToken` and `withCredentials: true`.

If the backend does not currently expose `/auth/csrf-token`, add that endpoint before using this frontend build. The endpoint should generate the unsigned token returned to JavaScript and set the signed token in the CSRF cookie according to the project's `fastapi-csrf-protect` configuration.

## Token storage

The access token is kept in JavaScript memory only. The refresh token must remain an HttpOnly cookie. A page reload therefore bootstraps the session by calling `/auth/new_access_token` and then `/users/me`.

## Authorization

Frontend permission checks are UX controls only. Every protected API endpoint must continue enforcing authorization on the backend.

Permission strings follow the `resource.action` convention, for example:

- `users.read`
- `users.create`
- `users.update`
- `users.delete`
- `roles.manage`
- `rag.collections.read`
- `rag.collections.manage`
- `rag.documents.read`
- `rag.documents.write`
- `rag.jobs.create`
- `rag.jobs.manage`
