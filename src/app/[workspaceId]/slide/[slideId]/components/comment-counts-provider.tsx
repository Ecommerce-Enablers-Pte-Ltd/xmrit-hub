"use client";

import { createContext, useContext, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TimeBucket } from "@/lib/time-buckets";

interface CommentCountsContextValue {
  getCounts: (
    definitionId: string,
    bucketType: TimeBucket
  ) => Record<string, number>;
  isLoading: boolean;
}

const CommentCountsContext = createContext<CommentCountsContextValue | null>(
  null
);

export function useCommentCounts() {
  const context = useContext(CommentCountsContext);
  if (!context) {
    throw new Error(
      "useCommentCounts must be used within CommentCountsProvider"
    );
  }
  return context;
}

interface CommentCountsProviderProps {
  slideId: string;
  definitionIds: string[];
  children: React.ReactNode;
}

// Query key factory for comment counts
export const commentCountsKeys = {
  all: ["comment-counts"] as const,
  slide: (slideId: string) =>
    [...commentCountsKeys.all, "slide", slideId] as const,
  definitions: (slideId: string, definitionIds: string[]) =>
    [
      ...commentCountsKeys.slide(slideId),
      "definitions",
      definitionIds,
    ] as const,
};

export function CommentCountsProvider({
  slideId,
  definitionIds,
  children,
}: CommentCountsProviderProps) {
  // Use React Query to fetch comment counts - automatically handles caching and refetching
  const { data: countsData, isLoading } = useQuery({
    queryKey: commentCountsKeys.definitions(slideId, definitionIds),
    queryFn: async () => {
      if (definitionIds.length === 0) {
        return { counts: {} };
      }

      const response = await fetch(
        `/api/slides/${slideId}/submetrics/comment-counts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ definitionIds }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch comment counts");
      }

      return response.json() as Promise<{
        counts: Record<string, Record<string, number>>;
      }>;
    },
    enabled: definitionIds.length > 0,
    staleTime: 1000 * 30, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true, // Refetch when user comes back to tab
    placeholderData: { counts: {} }, // Provide empty data immediately on mount to avoid undefined
  });

  // Get counts for a specific definition and bucket type
  const getCounts = useCallback(
    (definitionId: string, bucketType: TimeBucket) => {
      const key = `${definitionId}:${bucketType}`;
      return countsData?.counts?.[key] || {};
    },
    [countsData]
  );

  const value = useMemo(
    () => ({
      getCounts,
      isLoading,
    }),
    [getCounts, isLoading]
  );

  return (
    <CommentCountsContext.Provider value={value}>
      {children}
    </CommentCountsContext.Provider>
  );
}

// Hook to invalidate comment counts after mutations
export function useInvalidateCommentCounts() {
  const queryClient = useQueryClient();

  const invalidateCounts = useCallback(
    (slideId: string) => {
      // Invalidate all comment counts for this slide
      queryClient.invalidateQueries({
        queryKey: commentCountsKeys.slide(slideId),
      });
    },
    [queryClient]
  );

  return { invalidateCounts };
}
