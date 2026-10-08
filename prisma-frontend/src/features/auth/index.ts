// Public API of the auth feature. Other code imports from "@/features/auth" ONLY.
// Deliberately NOT exported: endpoints, refreshSession, AUTH_PATHS, pages (routes are the entry point).

// composition (used by app/)
export { authSlice, authActions } from "./store/authSlice";
export { setupAuth } from "./setup";
export { authGuestRoutes, authOpenRoutes, authProtectedRoutes } from "./routes";
export { SessionGate, RequireAuth, GuestOnly, RequirePermission } from "./components/guards";
export { AUTH_ROUTES } from "./constants/auth.constants";

// for other features
export { useSession } from "./hooks/useSession";
export { useSessionBootstrap } from "./hooks/useSessionBootstrap";
export { usePermissions } from "./hooks/usePermissions";
export { Can } from "./components/Can";
export { LogoutButton } from "./components/LogoutButton";
export type { SessionUser, SessionRole } from "./types/auth.types";
