import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateFollowUpInput,
  FollowUpQueryParams,
  UpdateFollowUpInput,
} from "@/lib/validations/follow-up";
import type {
  FollowUpWithDetails,
  PaginatedFollowUpsResponse,
} from "@/types/db/follow-up";
import { BaseApiClient } from "./base";

export class FollowUpApiClient extends BaseApiClient {
  /**
   * Get all follow-ups in a workspace with pagination and filtering
   */
  async getFollowUpsByWorkspace(
    workspaceId: string,
    params?: FollowUpQueryParams,
  ): Promise<PaginatedFollowUpsResponse> {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, String(value));
        }
      });
    }

    const queryString = searchParams.toString();
    const url = `/workspaces/${workspaceId}/follow-ups${
      queryString ? `?${queryString}` : ""
    }`;

    return await this.get<PaginatedFollowUpsResponse>(url);
  }

  /**
   * Get a single follow-up by ID
   */
  async getFollowUpById(followUpId: string): Promise<FollowUpWithDetails> {
    const response = await this.get<{ followUp: FollowUpWithDetails }>(
      `/follow-ups/${followUpId}`,
    );
    return response.followUp;
  }

  /**
   * Create a new follow-up
   */
  async createFollowUp(
    workspaceId: string,
    data: CreateFollowUpInput,
  ): Promise<FollowUpWithDetails> {
    const response = await this.post<
      { followUp: FollowUpWithDetails },
      CreateFollowUpInput
    >(`/workspaces/${workspaceId}/follow-ups`, data);
    return response.followUp;
  }

  /**
   * Update a follow-up
   */
  async updateFollowUp(
    followUpId: string,
    data: UpdateFollowUpInput,
  ): Promise<FollowUpWithDetails> {
    const response = await this.put<
      { followUp: FollowUpWithDetails },
      UpdateFollowUpInput
    >(`/follow-ups/${followUpId}`, data);
    return response.followUp;
  }

  /**
   * Delete a follow-up
   */
  async deleteFollowUp(followUpId: string): Promise<void> {
    await this.delete(`/follow-ups/${followUpId}`);
  }

  /**
   * Get all follow-ups for a submetric definition
   */
  async getFollowUpsBySubmetricDefinition(
    definitionId: string,
    slideId?: string,
  ): Promise<{
    followUps: FollowUpWithDetails[];
    count: number;
    resolved?: FollowUpWithDetails[];
    unresolved?: FollowUpWithDetails[];
    resolvedCount?: number;
    unresolvedCount?: number;
  }> {
    const url = `/submetrics/definitions/${definitionId}/follow-ups${
      slideId ? `?slideId=${slideId}` : ""
    }`;
    return await this.get(url);
  }
}

// Singleton instance
export const followUpApiClient = new FollowUpApiClient();

// Query keys factory
export const followUpKeys = {
  all: ["follow-ups"] as const,
  workspace: (workspaceId: string, params?: FollowUpQueryParams) =>
    [...followUpKeys.all, "workspace", workspaceId, params] as const,
  detail: (followUpId: string) =>
    [...followUpKeys.all, "detail", followUpId] as const,
  submetricDefinition: (definitionId: string, slideId?: string) =>
    [
      ...followUpKeys.all,
      "submetric-definition",
      definitionId,
      slideId,
    ] as const,
};

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch follow-ups in a workspace with pagination and filtering
 */
export function useFollowUps(
  workspaceId: string,
  params?: FollowUpQueryParams,
) {
  return useQuery({
    queryKey: followUpKeys.workspace(workspaceId, params),
    queryFn: () =>
      followUpApiClient.getFollowUpsByWorkspace(workspaceId, params),
    staleTime: 15 * 1000, // 15 seconds - follow-ups change frequently with status updates
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: true, // Refetch on window focus to ensure fresh data
    refetchInterval: 30 * 1000, // Poll every 30 seconds for cross-tab/session updates
    refetchIntervalInBackground: false, // Don't poll when tab is not visible
  });
}

/**
 * Hook to fetch a single follow-up
 */
export function useFollowUp(followUpId: string | undefined) {
  return useQuery({
    queryKey: followUpKeys.detail(followUpId || ""),
    queryFn: () => {
      if (!followUpId) {
        throw new Error("Follow-up ID is required");
      }
      return followUpApiClient.getFollowUpById(followUpId);
    },
    enabled: !!followUpId,
    staleTime: 1 * 60 * 1000, // 1 minute for detail view
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to create a follow-up
 */
export function useCreateFollowUp(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFollowUpInput) =>
      followUpApiClient.createFollowUp(workspaceId, data),
    onSuccess: (followUp) => {
      // Invalidate specific queries - will refetch if actively mounted
      // This ensures immediate visibility of new data while respecting cache

      // Invalidate submetric definition follow-ups if linked
      if (followUp.submetricDefinitionId) {
        queryClient.invalidateQueries({
          queryKey: [
            "follow-ups",
            "submetric-definition",
            followUp.submetricDefinitionId,
          ],
          refetchType: "active",
        });
      }

      // Invalidate workspace follow-ups list
      // Will auto-refetch if the query is mounted (user is viewing it)
      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "workspace", workspaceId],
        refetchType: "active",
      });
    },
  });
}

/**
 * Hook to update a follow-up
 */
export function useUpdateFollowUp(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      followUpId,
      data,
    }: {
      followUpId: string;
      data: UpdateFollowUpInput;
    }) => followUpApiClient.updateFollowUp(followUpId, data),
    onSuccess: (followUp, variables) => {
      // Update the cached detail view directly for instant update
      queryClient.setQueryData(
        followUpKeys.detail(variables.followUpId),
        followUp,
      );

      // Invalidate submetric definition follow-ups if linked
      if (followUp.submetricDefinitionId) {
        queryClient.invalidateQueries({
          queryKey: [
            "follow-ups",
            "submetric-definition",
            followUp.submetricDefinitionId,
          ],
          refetchType: "active",
        });
      }

      // Invalidate workspace list - will refetch if actively mounted
      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "workspace", workspaceId],
        refetchType: "active",
      });
    },
  });
}

/**
 * Hook to delete a follow-up
 */
export function useDeleteFollowUp(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (followUpId: string) =>
      followUpApiClient.deleteFollowUp(followUpId),
    onSuccess: (_, followUpId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: followUpKeys.detail(followUpId),
      });

      // Invalidate related queries - will refetch if actively mounted
      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "workspace", workspaceId],
        refetchType: "active",
      });

      queryClient.invalidateQueries({
        queryKey: ["follow-ups", "submetric-definition"],
        refetchType: "active",
      });
    },
  });
}

/**
 * Hook to fetch follow-ups for a submetric definition
 */
export function useSubmetricFollowUps(
  definitionId: string | undefined,
  slideId?: string,
) {
  return useQuery({
    queryKey: followUpKeys.submetricDefinition(definitionId || "", slideId),
    queryFn: () => {
      if (!definitionId) {
        throw new Error("Submetric definition ID is required");
      }
      return followUpApiClient.getFollowUpsBySubmetricDefinition(
        definitionId,
        slideId,
      );
    },
    enabled: !!definitionId,
    staleTime: 15 * 1000, // 15 seconds - follow-ups change frequently with status updates
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: true, // Refetch on window focus to ensure fresh data
    refetchInterval: 30 * 1000, // Poll every 30 seconds for cross-tab/session updates
    refetchIntervalInBackground: false, // Don't poll when tab is not visible
  });
}

/**
 * Hook to fetch count of unresolved follow-ups for a submetric definition
 */
export function useSubmetricFollowUpsCount(
  definitionId: string | undefined,
  slideId?: string,
) {
  const { data, isLoading, dataUpdatedAt } = useSubmetricFollowUps(
    definitionId,
    slideId,
  );
  // Return unresolved count if slideId is provided and breakdown is available
  // Otherwise return total count for backward compatibility
  const count = data?.unresolvedCount ?? data?.count ?? 0;
  // dataUpdatedAt helps track when the data was last refreshed
  return { count, isLoading, dataUpdatedAt };
}

/**
 * Hook to invalidate follow-up counts for a submetric definition
 * Use this after mutations to ensure the count badge updates
 */
export function useInvalidateFollowUpCounts() {
  const queryClient = useQueryClient();

  const invalidateCounts = (definitionId: string, slideId?: string) => {
    // Invalidate the specific submetric definition query
    queryClient.invalidateQueries({
      queryKey: followUpKeys.submetricDefinition(definitionId, slideId),
      refetchType: "active",
    });
  };

  const invalidateAllForWorkspace = (workspaceId: string) => {
    // Invalidate all workspace follow-ups
    queryClient.invalidateQueries({
      queryKey: ["follow-ups", "workspace", workspaceId],
      refetchType: "active",
    });
    // Invalidate all submetric definition follow-ups
    queryClient.invalidateQueries({
      queryKey: ["follow-ups", "submetric-definition"],
      refetchType: "active",
    });
  };

  return { invalidateCounts, invalidateAllForWorkspace };
}
