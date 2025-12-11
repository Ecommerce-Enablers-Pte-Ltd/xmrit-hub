"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { TimeBucket } from "@/lib/time-buckets";

type CountsData = Record<string, Record<string, number>>;

// Stable empty object reference for undefined cases
const EMPTY_COUNTS: Record<string, number> = {};

interface CommentCountsContextValue {
  // Stable function that reads from ref - doesn't cause re-renders
  getCounts: (
    definitionId: string,
    bucketType: TimeBucket,
  ) => Record<string, number>;
  // Subscribe to changes for a specific definition
  subscribe: (callback: () => void) => () => void;
  // Get snapshot of data for a specific definition (for useSyncExternalStore)
  getSnapshotForDefinition: (
    definitionId: string,
    bucketType: TimeBucket,
  ) => Record<string, number>;
  // Check if initial data has loaded (stable - accessed via ref)
  getIsReady: () => boolean;
}

const CommentCountsContext = createContext<CommentCountsContextValue | null>(
  null,
);

export function useCommentCounts() {
  const context = useContext(CommentCountsContext);
  if (!context) {
    throw new Error(
      "useCommentCounts must be used within CommentCountsProvider",
    );
  }
  return context;
}

interface DefinitionCommentCountsResult {
  counts: Record<string, number>;
  isReady: boolean;
}

// Stable result for not-ready state
const NOT_READY_RESULT: DefinitionCommentCountsResult = {
  counts: EMPTY_COUNTS,
  isReady: false,
};

/**
 * Hook that subscribes to comment counts for a specific definition.
 * Only re-renders when the specific definition's counts change OR when isReady changes.
 * Returns { counts, isReady } - isReady is false until initial data load completes.
 */
export function useDefinitionCommentCounts(
  definitionId: string | undefined,
  bucketType: TimeBucket,
): DefinitionCommentCountsResult {
  const context = useContext(CommentCountsContext);
  if (!context) {
    throw new Error(
      "useDefinitionCommentCounts must be used within CommentCountsProvider",
    );
  }

  const { subscribe, getSnapshotForDefinition, getIsReady } = context;

  // Cache the result to avoid infinite loops - useSyncExternalStore requires stable references
  const cachedResultRef =
    useRef<DefinitionCommentCountsResult>(NOT_READY_RESULT);

  // Create stable getSnapshot that returns cached result (same reference if unchanged)
  const getSnapshot = useCallback((): DefinitionCommentCountsResult => {
    const isReady = getIsReady();

    // Not ready yet - return stable not-ready result
    if (!isReady || !definitionId) {
      if (!cachedResultRef.current.isReady) {
        return cachedResultRef.current; // Already not ready, return same ref
      }
      cachedResultRef.current = NOT_READY_RESULT;
      return NOT_READY_RESULT;
    }

    // Get the counts for this definition
    const counts = getSnapshotForDefinition(definitionId, bucketType);

    // Check if result changed (counts reference or isReady state)
    const cached = cachedResultRef.current;
    if (cached.isReady && cached.counts === counts) {
      return cached; // Same result, return cached reference
    }

    // Result changed - create and cache new result
    const newResult = { counts, isReady: true };
    cachedResultRef.current = newResult;
    return newResult;
  }, [definitionId, bucketType, getSnapshotForDefinition, getIsReady]);

  // Use useSyncExternalStore for optimal re-render behavior
  // This will only re-render when the specific snapshot changes
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
  // Store subscribers for external store pattern
  const subscribersRef = useRef<Set<() => void>>(new Set());

  // Store the current counts data in a ref for stable access
  const countsDataRef = useRef<CountsData>({});

  // Track if initial data has loaded (one-way flag: false -> true)
  const isReadyRef = useRef(false);

  // Cache for memoized per-definition results to avoid creating new objects
  const definitionCacheRef = useRef<Map<string, Record<string, number>>>(
    new Map(),
  );

  // Use React Query to fetch comment counts - automatically handles caching and refetching
  const { data: countsData } = useQuery({
    queryKey: commentCountsKeys.definitions(slideId, definitionIds),
    queryFn: async () => {
      if (definitionIds.length === 0) {
        return { counts: {} as CountsData };
      }

      const response = await fetch(
        `/api/slides/${slideId}/submetrics/comment-counts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ definitionIds }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch comment counts");
      }

      return response.json() as Promise<{
        counts: CountsData;
      }>;
    },
    enabled: definitionIds.length > 0,
    staleTime: 1000 * 15, // Consider data fresh for 15 seconds
    refetchOnWindowFocus: true, // Refetch when user comes back to tab
    refetchInterval: 1000 * 30, // Poll every 30 seconds for cross-tab/session updates
    refetchIntervalInBackground: false, // Don't poll when tab is not visible
    placeholderData: { counts: {} as CountsData }, // Provide empty data immediately on mount to avoid undefined
  });

  // Update ref when data changes and notify subscribers (must be in useEffect to avoid setState during render)
  useEffect(() => {
    if (countsData?.counts) {
      countsDataRef.current = countsData.counts;
      // Mark as ready after first successful data load
      isReadyRef.current = true;
      // Clear cache when data changes - will be rebuilt lazily
      definitionCacheRef.current.clear();
      // Notify all subscribers that data has changed
      subscribersRef.current.forEach((callback) => {
        callback();
      });
    }
  }, [countsData]);

  // Stable function to get isReady state
  const getIsReady = useCallback(() => isReadyRef.current, []);

  // Subscribe function for useSyncExternalStore
  const subscribe = useCallback((callback: () => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  // Get snapshot for a specific definition - uses cache for referential stability
  const getSnapshotForDefinition = useCallback(
    (definitionId: string, bucketType: TimeBucket): Record<string, number> => {
      const key = `${definitionId}:${bucketType}`;
      const data = countsDataRef.current[key];

      // Check if we already have a cached result for this key
      const cached = definitionCacheRef.current.get(key);

      if (!data) {
        // No data - return stable empty object (same reference)
        return EMPTY_COUNTS;
      }

      // Check if data is the same as cached (shallow comparison)
      if (cached) {
        const cachedKeys = Object.keys(cached);
        const dataKeys = Object.keys(data);
        if (cachedKeys.length === dataKeys.length) {
          let same = true;
          for (const k of dataKeys) {
            if (cached[k] !== data[k]) {
              same = false;
              break;
            }
          }
          if (same) {
            return cached; // Return cached reference - no change
          }
        }
      }

      // Data changed - update cache and return new reference
      definitionCacheRef.current.set(key, data);
      return data;
    },
    [],
  );

  // Stable getCounts function that reads from ref (for backwards compatibility)
  const getCounts = useCallback(
    (definitionId: string, bucketType: TimeBucket): Record<string, number> => {
      return getSnapshotForDefinition(definitionId, bucketType);
    },
    [getSnapshotForDefinition],
  );

  // Value is stable - functions don't change (no isLoading dependency to avoid re-renders)
  const value = useMemo(
    () => ({
      getCounts,
      subscribe,
      getSnapshotForDefinition,
      getIsReady,
    }),
    [getCounts, subscribe, getSnapshotForDefinition, getIsReady],
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
      // Invalidate all comment counts for this slide with immediate refetch
      queryClient.invalidateQueries({
        queryKey: commentCountsKeys.slide(slideId),
        refetchType: "active", // Only refetch if the query is currently being used
      });
    },
    [queryClient],
  );

  // Optimistic update for immediate UI feedback
  const updateCountOptimistically = useCallback(
    (
      slideId: string,
      definitionId: string,
      bucketType: TimeBucket,
      bucketValue: string,
      delta: number, // +1 for add, -1 for delete
    ) => {
      // Get all matching queries and update them optimistically
      queryClient.setQueriesData<{ counts: CountsData }>(
        { queryKey: commentCountsKeys.slide(slideId) },
        (oldData) => {
          if (!oldData?.counts) return oldData;

          const key = `${definitionId}:${bucketType}`;
          const currentBucketCounts = oldData.counts[key] || {};
          const currentCount = currentBucketCounts[bucketValue] || 0;
          const newCount = Math.max(0, currentCount + delta);

          return {
            ...oldData,
            counts: {
              ...oldData.counts,
              [key]: {
                ...currentBucketCounts,
                [bucketValue]: newCount,
              },
            },
          };
        },
      );
    },
    [queryClient],
  );

  return { invalidateCounts, updateCountOptimistically };
}
