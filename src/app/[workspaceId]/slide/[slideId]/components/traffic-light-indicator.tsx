"use client";

import { useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useState } from "react";
import { slideKeys } from "@/lib/api/slides";
import { useUpdateTrafficLightColor } from "@/lib/api/submetrics";
import type { SlideWithMetrics } from "@/types/db/slide";
import type { TrafficLightColor } from "@/types/db/submetric";

interface TrafficLightIndicatorProps {
  submetricId: string;
  slideId: string;
  initialColor?: TrafficLightColor | null;
}

/**
 * Isolated traffic light indicator component that subscribes directly to React Query cache.
 * Uses manual cache subscription to avoid triggering fetches, preventing
 * the entire chart from re-rendering when only the traffic light color changes.
 */
export const TrafficLightIndicator = memo(
  function TrafficLightIndicator({
    submetricId,
    slideId,
    initialColor,
  }: TrafficLightIndicatorProps) {
    const queryClient = useQueryClient();
    const updateTrafficLightMutation = useUpdateTrafficLightColor(slideId);

    // Extract traffic light color from cache
    const getTrafficLightColor = useCallback((): TrafficLightColor => {
      const slideData = queryClient.getQueryData<SlideWithMetrics>(
        slideKeys.detail(slideId),
      );

      if (!slideData) return initialColor ?? "green";

      const submetric = slideData.metrics
        .flatMap((m) => m.submetrics)
        .find((s) => s.id === submetricId);

      return submetric?.trafficLightColor ?? initialColor ?? "green";
    }, [queryClient, slideId, submetricId, initialColor]);

    // State to track traffic light color and trigger re-renders
    const [controlIndicatorColor, setControlIndicatorColor] =
      useState<TrafficLightColor>(() => getTrafficLightColor());

    // Subscribe to cache updates without triggering fetches
    useEffect(() => {
      // Update state when cache changes
      const updateColor = () => {
        setControlIndicatorColor(getTrafficLightColor());
      };

      // Initial update
      updateColor();

      // Subscribe to cache updates
      const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
        // Only update if the event is for our slide query
        if (
          event?.query?.queryKey &&
          JSON.stringify(event.query.queryKey) ===
            JSON.stringify(slideKeys.detail(slideId))
        ) {
          updateColor();
        }
      });

      return unsubscribe;
    }, [queryClient, slideId, getTrafficLightColor]);

    const handleTrafficLightClick = useCallback(() => {
      const colorCycle: Record<TrafficLightColor | "green", TrafficLightColor> =
        {
          green: "yellow",
          yellow: "red",
          red: "none",
          none: "green",
        };

      const nextColor = colorCycle[controlIndicatorColor];

      updateTrafficLightMutation.mutate(
        {
          submetricId,
          trafficLightColor: nextColor,
        },
        {
          onSuccess: () => {
            console.log("Traffic light updated successfully to:", nextColor);
          },
          onError: (error) => {
            console.error("Failed to update traffic light:", error);
          },
        },
      );
    }, [controlIndicatorColor, submetricId, updateTrafficLightMutation]);

    return (
      <button
        type="button"
        onClick={handleTrafficLightClick}
        disabled={updateTrafficLightMutation.isPending}
        className={`w-8 h-8 rounded-sm shadow-lg ring-4 cursor-pointer transition-all hover:scale-110 active:scale-95 ${
          updateTrafficLightMutation.isPending ? "opacity-60 animate-pulse" : ""
        } ${
          controlIndicatorColor === "red"
            ? "bg-red-500 ring-red-200 dark:ring-red-900"
            : controlIndicatorColor === "yellow"
              ? "bg-yellow-500 ring-yellow-200 dark:ring-yellow-900"
              : controlIndicatorColor === "none"
                ? "bg-gray-400 ring-gray-200 dark:ring-gray-700"
                : "bg-green-500 ring-green-200 dark:ring-green-900"
        }`}
        title={
          updateTrafficLightMutation.isPending
            ? "Updating..."
            : controlIndicatorColor === "red"
              ? "Red - Click to cycle to None"
              : controlIndicatorColor === "yellow"
                ? "Yellow - Click to cycle to Red"
                : controlIndicatorColor === "none"
                  ? "None - Click to cycle to Green"
                  : "Green - Click to cycle to Yellow"
        }
      />
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if submetricId or slideId changes
    // The component will automatically re-render when the cache updates
    // because we're using getQueryData which triggers re-renders on cache changes
    return (
      prevProps.submetricId === nextProps.submetricId &&
      prevProps.slideId === nextProps.slideId &&
      prevProps.initialColor === nextProps.initialColor
    );
  },
);

TrafficLightIndicator.displayName = "TrafficLightIndicator";
