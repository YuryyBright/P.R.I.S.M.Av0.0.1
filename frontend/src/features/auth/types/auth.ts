import type { User } from "../../../entities/user/types";

export interface AccessToken {
  access_token: string;
  token_type: "bearer" | string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse extends AccessToken {
  refresh_token?: string | null;
  user?: User;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
}
