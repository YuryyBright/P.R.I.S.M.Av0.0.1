import { STORAGE_KEYS } from "../../app/config/constants";

// Access-токен тримаємо в localStorage. Refresh-токен — HttpOnly cookie (бекенд).
export const tokenStorage = {
  get: () => localStorage.getItem(STORAGE_KEYS.accessToken),
  set: (t: string) => localStorage.setItem(STORAGE_KEYS.accessToken, t),
  clear: () => localStorage.removeItem(STORAGE_KEYS.accessToken),
};
