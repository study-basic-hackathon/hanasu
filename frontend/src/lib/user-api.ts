import { apiRequest } from "@/lib/api-client";
import type { SignedInUser } from "@/lib/domain";

export function getCurrentUser(signal?: AbortSignal): Promise<SignedInUser> {
  return apiRequest<SignedInUser>("/users/me", { signal });
}
