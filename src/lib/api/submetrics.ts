import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { TrafficLightColor } from "@/types/db/submetric";
import { BaseApiClient } from "./base";
import { slideKeys } from "./slides";

/**
 * API client for submetric-related operations
 */
export class SubmetricApiClient extends BaseApiClient {
  /**
   * Update the traffic light color for a submetric
   */
  async updateTrafficLightColor(
    submetricId: string,
    trafficLightColor: TrafficLightColor | null,
  ) {
    return this.patch(`/submetrics/${submetricId}`, {
      trafficLightColor,
    });
  }
}

// Singleton instance
export const submetricApiClient = new SubmetricApiClient();

/**
 * React Query hook to update a submetric's traffic light color
 */
export function useUpdateTrafficLightColor(slideId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      submetricId,
      trafficLightColor,
    }: {
      submetricId: string;
      trafficLightColor: TrafficLightColor | null;
    }) =>
      submetricApiClient.updateTrafficLightColor(
        submetricId,
        trafficLightColor,
      ),
    onMutate: async ({ submetricId, trafficLightColor }) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: slideKeys.detail(slideId) });

      // Snapshot the previous value
      const previousSlide = queryClient.getQueryData(slideKeys.detail(slideId));

      // Optimistically update the cache
      // Note: The cache stores SlideWithMetrics directly, not wrapped in { slide: ... }
      queryClient.setQueryData<SlideWithMetrics>(
        slideKeys.detail(slideId),
        (old) => {
          if (!old?.metrics) return old;

          return {
            ...old,
            metrics: old.metrics.map((metric) => ({
              ...metric,
              submetrics: metric.submetrics.map((submetric) =>
                submetric.id === submetricId
                  ? { ...submetric, trafficLightColor }
                  : submetric,
              ),
            })),
          };
        },
      );

      // Return context with the previous value
      return { previousSlide };
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousSlide) {
        queryClient.setQueryData(
          slideKeys.detail(slideId),
          context.previousSlide,
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we're in sync with the server
      queryClient.invalidateQueries({
        queryKey: slideKeys.detail(slideId),
      });
    },
  });
}
