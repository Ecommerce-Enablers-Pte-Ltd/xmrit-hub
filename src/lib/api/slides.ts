// Slide API client and hooks

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSlideInput,
  UpdateSlideInput,
} from "@/lib/validations/slide";
import type { Slide, SlideWithMetrics } from "@/types/db/slide";
import type { DataPointJson } from "@/types/db/submetric";
import { BaseApiClient } from "./base";
import { workspaceKeys } from "./workspaces";

export class SlideApiClient extends BaseApiClient {
  async getSlideById(slideId: string): Promise<SlideWithMetrics> {
    const response = await this.request<{ slide: SlideWithMetrics }>(
      `/slides/${slideId}`,
    );
    return response.slide;
  }

  /**
   * Batch fetch dataPoints for multiple submetrics
   * Returns map of submetricId -> dataPoints array
   */
  async getSubmetricDataPoints(
    slideId: string,
    submetricIds: string[],
  ): Promise<Record<string, DataPointJson[]>> {
    const response = await this.request<{
      dataPointsBySubmetricId: Record<string, DataPointJson[]>;
    }>(`/slides/${slideId}/submetrics/data-points`, {
      method: "POST",
      body: JSON.stringify({ submetricIds }),
    });
    return response.dataPointsBySubmetricId;
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
  // DataPoints keys for lazy loading
  dataPoints: () => [...slideKeys.all, "dataPoints"] as const,
  dataPointsForSlide: (slideId: string) =>
    [...slideKeys.dataPoints(), slideId] as const,
  dataPointsForSubmetric: (slideId: string, submetricId: string) =>
    [...slideKeys.dataPointsForSlide(slideId), submetricId] as const,
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

/**
 * Hook to fetch dataPoints for a single submetric (lazy loading)
 * Uses the batch endpoint but caches per-submetric for efficient reuse
 */
export function useSubmetricDataPoints(
  slideId: string,
  submetricId: string | undefined,
  enabled = true,
) {
  const query = useQuery({
    queryKey: slideKeys.dataPointsForSubmetric(slideId, submetricId ?? ""),
    queryFn: async () => {
      if (!submetricId) return null;

      // Fetch via batch endpoint (single item)
      const result = await slideApiClient.getSubmetricDataPoints(slideId, [
        submetricId,
      ]);
      return result[submetricId] ?? null;
    },
    enabled: enabled && !!slideId && !!submetricId,
    staleTime: 5 * 60 * 1000, // 5 minutes - dataPoints change infrequently
    gcTime: 30 * 60 * 1000, // 30 minutes
    // Don't refetch on window focus - dataPoints are relatively stable
    refetchOnWindowFocus: false,
  });

  return {
    dataPoints: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error?.message ?? null,
  };
}

/**
 * Hook to batch-prefetch dataPoints for multiple submetrics
 * Used by SlideContainer to prefetch visible charts' data
 */
export function usePrefetchSubmetricDataPoints() {
  const queryClient = useQueryClient();

  return async (slideId: string, submetricIds: string[]) => {
    if (!slideId || submetricIds.length === 0) return;

    // Filter out already-cached submetrics
    const uncachedIds = submetricIds.filter((id) => {
      const cached = queryClient.getQueryData(
        slideKeys.dataPointsForSubmetric(slideId, id),
      );
      return cached === undefined;
    });

    if (uncachedIds.length === 0) return;

    try {
      // Fetch all uncached dataPoints in one batch request
      const results = await slideApiClient.getSubmetricDataPoints(
        slideId,
        uncachedIds,
      );

      // Populate individual caches
      for (const [submetricId, dataPoints] of Object.entries(results)) {
        queryClient.setQueryData(
          slideKeys.dataPointsForSubmetric(slideId, submetricId),
          dataPoints,
        );
      }
    } catch (error) {
      console.error(
        "[usePrefetchSubmetricDataPoints] Batch fetch failed:",
        error,
      );
    }
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
