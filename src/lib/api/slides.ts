// Slide API client and hooks

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSlideInput,
  UpdateSlideInput,
} from "@/lib/validations/slide";
import type { Slide, SlideWithMetrics } from "@/types/db/slide";
import { BaseApiClient } from "./base";
import { workspaceKeys } from "./workspaces";

export class SlideApiClient extends BaseApiClient {
  async getSlideById(slideId: string): Promise<SlideWithMetrics> {
    const response = await this.request<{ slide: SlideWithMetrics }>(
      `/slides/${slideId}`,
    );
    return response.slide;
  }

  async createSlide(
    workspaceId: string,
    data: CreateSlideInput,
  ): Promise<SlideWithMetrics> {
    const response = await this.request<{ slide: SlideWithMetrics }>(
      `/workspaces/${workspaceId}/slides`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    return response.slide;
  }

  async updateSlide(
    slideId: string,
    data: UpdateSlideInput,
  ): Promise<SlideWithMetrics> {
    const response = await this.request<{ slide: SlideWithMetrics }>(
      `/slides/${slideId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
    return response.slide;
  }

  async deleteSlide(
    slideId: string,
  ): Promise<{ message: string; slideId: string }> {
    return this.request(`/slides/${slideId}`, {
      method: "DELETE",
    });
  }
}

// Default slide client instance
export const slideApiClient = new SlideApiClient();

// Query keys for React Query cache management
export const slideKeys = {
  all: ["slides"] as const,
  lists: () => [...slideKeys.all, "list"] as const,
  list: (workspaceId?: string) =>
    workspaceId
      ? ([...slideKeys.lists(), workspaceId] as const)
      : slideKeys.lists(),
  details: () => [...slideKeys.all, "detail"] as const,
  detail: (id: string) => [...slideKeys.details(), id] as const,
};

// React Query hooks for slide data fetching with optimizations
export function useSlide(slideId: string, initialData?: SlideWithMetrics) {
  const query = useQuery({
    queryKey: slideKeys.detail(slideId),
    queryFn: () => slideApiClient.getSlideById(slideId),
    enabled: !!slideId,
    initialData, // Hydrate from SSR data
    staleTime: 30 * 1000, // 30 seconds - reduced to catch new ingested data faster
    gcTime: 20 * 60 * 1000, // 20 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // Poll every 30 seconds for new data
    // Stale-while-revalidate: show stale data while refetching
    placeholderData: (previousData) => previousData,
  });

  return {
    slide: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
    isFetching: query.isFetching, // Background refetch indicator
  };
}

// Prefetch slide on hover for instant navigation
export function usePrefetchSlide() {
  const queryClient = useQueryClient();

  return (slideId: string) => {
    queryClient.prefetchQuery({
      queryKey: slideKeys.detail(slideId),
      queryFn: () => slideApiClient.getSlideById(slideId),
      staleTime: 30 * 1000, // Match the useSlide staleTime
    });
  };
}

// Mutation hooks for slide operations
export function useCreateSlide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string;
      data: CreateSlideInput;
    }) => slideApiClient.createSlide(workspaceId, data),
    onSuccess: (_, variables) => {
      // Invalidate workspace to refetch slides
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(variables.workspaceId),
      });
      // Invalidate the slides list cache used by the sidebar
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.slidesList(variables.workspaceId),
      });
    },
  });
}

export function useUpdateSlide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      slideId,
      workspaceId: _workspaceId,
      data,
    }: {
      slideId: string;
      workspaceId: string;
      data: UpdateSlideInput;
    }) => slideApiClient.updateSlide(slideId, data),
    onSuccess: (updatedSlide, variables) => {
      // Directly update the slide cache instead of invalidating
      queryClient.setQueryData<SlideWithMetrics>(
        slideKeys.detail(variables.slideId),
        (oldData) => {
          if (!oldData) return updatedSlide;
          // Merge the updated fields with the existing data
          return {
            ...oldData,
            ...updatedSlide,
          };
        },
      );

      // Update the workspace cache to reflect slide changes in the list
      queryClient.setQueryData<{ slides?: Slide[] }>(
        workspaceKeys.detail(variables.workspaceId),
        (oldWorkspace) => {
          if (!oldWorkspace?.slides) return oldWorkspace;
          return {
            ...oldWorkspace,
            slides: oldWorkspace.slides.map((slide) =>
              slide.id === variables.slideId
                ? { ...slide, ...updatedSlide }
                : slide,
            ),
          };
        },
      );

      // Update the slides list cache used by the sidebar
      queryClient.setQueryData<Slide[]>(
        workspaceKeys.slidesList(variables.workspaceId),
        (oldSlides) => {
          if (!oldSlides) return oldSlides;
          return oldSlides.map((slide) =>
            slide.id === variables.slideId
              ? { ...slide, ...updatedSlide }
              : slide,
          );
        },
      );
    },
  });
}

export function useDeleteSlide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      slideId,
      workspaceId: _workspaceId,
    }: {
      slideId: string;
      workspaceId: string;
    }) => slideApiClient.deleteSlide(slideId),
    onSuccess: (_, variables) => {
      // Remove slide from cache
      queryClient.removeQueries({
        queryKey: slideKeys.detail(variables.slideId),
      });
      // Invalidate the specific workspace to update the slides list
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(variables.workspaceId),
      });
      // Invalidate the slides list cache used by the sidebar
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.slidesList(variables.workspaceId),
      });
      // Also invalidate workspace list in case we're on a different page
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export interface ChartInfo {
  id: string;
  metricId: string;
  category: string;
  name: string;
  slug: string;
  metricName: string;
}
