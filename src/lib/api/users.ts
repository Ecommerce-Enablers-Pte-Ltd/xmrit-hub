import { useQuery } from "@tanstack/react-query";
import type { User } from "@/types/db/user";
import { BaseApiClient } from "./base";

export class UserApiClient extends BaseApiClient {
  /**
   * Get all users (for assignee selection, etc.)
   */
  async getAllUsers(): Promise<User[]> {
    const response = await this.get<{ users: User[] }>("/users");
    return response.users;
  }
}

// Singleton instance
export const userApiClient = new UserApiClient();

// Query keys factory
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: () => [...userKeys.lists()] as const,
};

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch all users
 */
export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: () => userApiClient.getAllUsers(),
    staleTime: 5 * 60 * 1000, // 5 minutes - users don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
}
