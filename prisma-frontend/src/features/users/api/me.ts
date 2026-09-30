import { api } from "../../../shared/api/client";
import type { ApiResponse } from "../../../shared/api/types";
import type { User } from "../../../entities/user/types";

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<ApiResponse<User>>("/users/me");
  return data.data;
}
