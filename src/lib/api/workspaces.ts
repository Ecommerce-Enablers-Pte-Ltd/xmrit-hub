// Workspace API client and hooks

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Slide } from "@/types/db/slide";
import type { Workspace, WorkspaceWithSlides } from "@/types/db/workspace";
import { BaseApiClient } from "./base";

export class WorkspaceApiClient extends BaseApiClient {
  async getAllWorkspaces(): Promise<Workspace[]> {
    const response = await this.request<{ workspaces: Workspace[] }>(
      "/workspaces",
    );
    return response.workspaces;
  }

  async getWorkspaceById(workspaceId: string): Promise<WorkspaceWithSlides> {
    const response = await this.request<{ workspace: WorkspaceWithSlides }>(
      `/workspaces/${workspaceId}`,
    );
    return response.workspace;
  }

  // Lightweight endpoint for sidebar - only slide metadata
  async getWorkspaceSlidesList(workspaceId: string): Promise<Slide[]> {
    const response = await this.request<{ slides: Slide[] }>(
      `/workspaces/${workspaceId}/slides-list`,
    );
    return response.slides;
  }

  async createWorkspace(data: Partial<Workspace>): Promise<Workspace> {
    const response = await this.request<{ workspace: Workspace }>(
      "/workspaces",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    return response.workspace;
  }

  async updateWorkspace(
    workspaceId: string,
    data: Partial<Workspace>,
  ): Promise<Workspace> {
    const response = await this.request<{ workspace: Workspace }>(
      `/workspaces/${workspaceId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
    return response.workspace;
  }

  async deleteWorkspace(
    workspaceId: string,
  ): Promise<{ message: string; workspaceId: string }> {
    return this.request(`/workspaces/${workspaceId}`, {
      method: "DELETE",
    });
  }
}

// Default workspace client instance
export const workspaceApiClient = new WorkspaceApiClient();

// Query keys for React Query cache management
export const workspaceKeys = {
  all: ["workspaces"] as const,
  lists: () => [...workspaceKeys.all, "list"] as const,
  list: () => [...workspaceKeys.lists()] as const,
  details: () => [...workspaceKeys.all, "detail"] as const,
  detail: (id: string) => [...workspaceKeys.details(), id] as const,
  slidesList: (id: string) =>
    [...workspaceKeys.all, "slides-list", id] as const,
};

// React Query hooks for workspace data fetching with optimizations
export function useWorkspaces(initialData?: Workspace[]) {
  const query = useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: () => workspaceApiClient.getAllWorkspaces(),
    initialData, // Hydrate from SSR data
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache (formerly cacheTime)
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  return {
    workspaces: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isFetching: query.isFetching, // Background refetch indicator
  };
}

export function useWorkspace(
  workspaceId: string,
  initialData?: WorkspaceWithSlides,
) {
  const query = useQuery({
    queryKey: workspaceKeys.detail(workspaceId),
    queryFn: () => workspaceApiClient.getWorkspaceById(workspaceId),
    enabled: !!workspaceId,
    initialData, // Hydrate from SSR data
    staleTime: 30 * 1000, // 30 seconds - shorter stale time to ensure fresh data with nested structure
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    // Stale-while-revalidate: show stale data while refetching
    placeholderData: (previousData) => previousData,
  });

  return {
    workspace: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isFetching: query.isFetching, // Background refetch indicator
  };
}

// Lightweight hook for sidebar - only loads slide metadata
export function useWorkspaceSlidesList(workspaceId: string) {
  const query = useQuery({
    queryKey: workspaceKeys.slidesList(workspaceId),
    queryFn: () => workspaceApiClient.getWorkspaceSlidesList(workspaceId),
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000, // 10 minutes - slides list rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnWindowFocus: false, // Don't refetch on focus for better performance
  });

  return {
    slides: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

// Prefetch workspace on hover for instant navigation
export function usePrefetchWorkspace() {
  const queryClient = useQueryClient();

  return (workspaceId: string) => {
    queryClient.prefetchQuery({
      queryKey: workspaceKeys.detail(workspaceId),
      queryFn: () => workspaceApiClient.getWorkspaceById(workspaceId),
      staleTime: 5 * 60 * 1000,
    });
  };
}

// Mutation hooks for workspace operations
export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Workspace>) =>
      workspaceApiClient.createWorkspace(data),
    onSuccess: (newWorkspace) => {
      // Optimistically add new workspace to cache for immediate availability
      // This ensures the workspace is found when navigating to it
      queryClient.setQueryData<Workspace[]>(workspaceKeys.list(), (old) => {
        if (!old) return [newWorkspace];
        return [...old, newWorkspace];
      });
      // Also invalidate to ensure data is fresh in background
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string;
      data: Partial<Workspace>;
    }) => workspaceApiClient.updateWorkspace(workspaceId, data),
    onSuccess: (_, variables) => {
      // Invalidate specific workspace and list
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(variables.workspaceId),
      });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) =>
      workspaceApiClient.deleteWorkspace(workspaceId),
    onMutate: async (workspaceId) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: workspaceKeys.list() });

      // Snapshot the previous value for rollback
      const previousWorkspaces = queryClient.getQueryData<Workspace[]>(
        workspaceKeys.list(),
      );

      // Optimistically remove the workspace from the list immediately
      // This prevents the layout from detecting "missing workspace" and redirecting to 404
      queryClient.setQueryData<Workspace[]>(workspaceKeys.list(), (old) => {
        if (!old) return [];
        return old.filter((w) => w.id !== workspaceId);
      });

      return { previousWorkspaces };
    },
    onError: (_err, _workspaceId, context) => {
      // If the mutation fails, roll back to the previous value
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(
          workspaceKeys.list(),
          context.previousWorkspaces,
        );
      }
    },
    onSuccess: (_, workspaceId) => {
      // Remove detail cache and invalidate list to ensure fresh data
      queryClient.removeQueries({
        queryKey: workspaceKeys.detail(workspaceId),
      });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}
