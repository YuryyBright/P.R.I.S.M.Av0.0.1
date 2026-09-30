// Public API of the users feature. Import from "@/features/users" only.
// Deliberately NOT exported: endpoints/RTK hooks, components, mappers. Add something here
// only when another feature or app/ really needs it.
export { usersRoutes } from "./routes";
export { usersUiSlice } from "./store/usersUiSlice";
export { USER_PERMISSIONS, USERS_ROUTES } from "./constants/users.constants";
export { useUserActions } from "./hooks/useUserActions";
export type { User, UserRole } from "./types/user.types";
