# Auth/RBAC frontend changes

## Included

- Strongly typed `ApiResponse<T>` and API metadata.
- Structured API error parsing without unsafe `as ErrorResponse` casts.
- Full `User` type including roles, permissions and account state fields.
- Central permission constants and extensible `PermissionCode` type.
- `hasPermission`, `hasAllPermissions`, `hasAnyPermission`.
- `hasRole`, `hasAnyRole`, `isSuperuser`.
- `RequireAuth`, `GuestOnly`, and typed `RequirePermission`.
- `<Can>` component for permission-aware UI.
- Session bootstrap on application start using refresh cookie.
- In-memory access token storage instead of `localStorage`.
- Single-flight access-token refresh in the Axios interceptor.
- CSRF token API and CSRF headers for auth mutations.
- Current-session and all-session logout methods.
- Backend endpoint names aligned with `/auth/login` and `/auth/new_access_token`.
- React `FormEvent` import changed to a type-only import.

## Important backend dependency

The frontend expects `/auth/csrf-token` to exist. If the current backend branch does not expose it, add the endpoint described in `BACKEND_AUTH_CONTRACT.md`.

## Security boundary

Route guards and `<Can>` only control the frontend UI. Backend JWT, session, Redis allowlist/revocation and permission checks remain authoritative.
