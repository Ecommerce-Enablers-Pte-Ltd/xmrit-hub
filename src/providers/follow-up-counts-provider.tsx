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

type CountsData = Record<string, number>;

interface FollowUpCountsContextValue {
  // Stable function that reads from ref - doesn't cause re-renders
  getCount: (definitionId: string) => number;
  // Subscribe to changes for a specific definition
  subscribe: (callback: () => void) => () => void;
  // Get snapshot of count for a specific definition (for useSyncExternalStore)
  getSnapshotForDefinition: (definitionId: string) => number;
  // Check if initial data has loaded (stable - accessed via ref)
  getIsReady: () => boolean;
  // Get data updated timestamp for tracking freshness
  getDataUpdatedAt: () => number;
}

const FollowUpCountsContext = createContext<FollowUpCountsContextValue | null>(
  null,
);

export function useFollowUpCounts() {
  const context = useContext(FollowUpCountsContext);
  if (!context) {
    throw new Error(
      "useFollowUpCounts must be used within FollowUpCountsProvider",
    );
  }
  return context;
}

interface DefinitionFollowUpCountResult {
  count: number;
  isLoading: boolean;
  dataUpdatedAt: number;
}

// Stable result for not-ready state
const NOT_READY_RESULT: DefinitionFollowUpCountResult = {
  count: 0,
  isLoading: true,
  dataUpdatedAt: 0,
};

/**
 * Hook that subscribes to follow-up count for a specific definition.
 * Only re-renders when the specific definition's count changes OR when isLoading changes.
 * Returns { count, isLoading, dataUpdatedAt }
 *
 * This replaces the individual useSubmetricFollowUps query per card,
 * consolidating 100+ API calls into a single batch request.
 */
export function useDefinitionFollowUpCount(
  definitionId: string | undefined,
): DefinitionFollowUpCountResult {
  const context = useContext(FollowUpCountsContext);

  // Cache the result to avoid infinite loops - useSyncExternalStore requires stable references
  const cachedResultRef =
    useRef<DefinitionFollowUpCountResult>(NOT_READY_RESULT);

  // Extract context values (or use no-op fallbacks when outside provider)
  const subscribe = context?.subscribe ?? noopSubscribe;
  const getSnapshotForDefinition =
    context?.getSnapshotForDefinition ?? noopGetSnapshot;
  const getIsReady = context?.getIsReady ?? noopGetIsReady;
  const getDataUpdatedAt = context?.getDataUpdatedAt ?? noopGetDataUpdatedAt;

  // Create stable getSnapshot that returns cached result (same reference if unchanged)
  const getSnapshot = useCallback((): DefinitionFollowUpCountResult => {
    // If no context, return stable not-ready result
    if (!context) {
      return NOT_READY_RESULT;
    }

    const isReady = getIsReady();
    const dataUpdatedAt = getDataUpdatedAt();

    // Not ready yet - return stable not-ready result
    if (!isReady || !definitionId) {
      if (cachedResultRef.current.isLoading) {
        return cachedResultRef.current; // Already loading, return same ref
      }
      cachedResultRef.current = NOT_READY_RESULT;
      return NOT_READY_RESULT;
    }

    // Get the count for this definition
    const count = getSnapshotForDefinition(definitionId);

    // Check if result changed
    const cached = cachedResultRef.current;
    if (
      !cached.isLoading &&
      cached.count === count &&
      cached.dataUpdatedAt === dataUpdatedAt
    ) {
      return cached; // Same result, return cached reference
    }

    // Result changed - create and cache new result
    const newResult = { count, isLoading: false, dataUpdatedAt };
    cachedResultRef.current = newResult;
    return newResult;
  }, [
    context,
    definitionId,
    getSnapshotForDefinition,
    getIsReady,
    getDataUpdatedAt,
  ]);

  // Use useSyncExternalStore for optimal re-render behavior
  // This will only re-render when the specific snapshot changes
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// No-op fallbacks for when hook is used outside provider
const noopSubscribe = () => () => {};
const noopGetSnapshot = () => 0;
const noopGetIsReady = () => false;
const noopGetDataUpdatedAt = () => 0;

interface FollowUpCountsProviderProps {
  slideId: string;
  definitionIds: string[];
  children: React.ReactNode;
}

// Query key factory for follow-up counts
export const followUpCountsKeys = {
  all: ["follow-up-counts"] as const,
  slide: (slideId: string) =>
    [...followUpCountsKeys.all, "slide", slideId] as const,
  definitions: (slideId: string, definitionIds: string[]) =>
    [
      ...followUpCountsKeys.slide(slideId),
      "definitions",
      definitionIds,
    ] as const,
};

export function FollowUpCountsProvider({
  slideId,
  definitionIds,
  children,
}: FollowUpCountsProviderProps) {
  // Store subscribers for external store pattern
  const subscribersRef = useRef<Set<() => void>>(new Set());

  // Store the current counts data in a ref for stable access
  const countsDataRef = useRef<CountsData>({});

  // Track if initial data has loaded (one-way flag: false -> true)
  const isReadyRef = useRef(false);

  // Track last data update timestamp
  const dataUpdatedAtRef = useRef<number>(0);

  // Use React Query to fetch follow-up counts - automatically handles caching and refetching
  const { data: countsData, dataUpdatedAt } = useQuery({
    queryKey: followUpCountsKeys.definitions(slideId, definitionIds),
    queryFn: async () => {
      if (definitionIds.length === 0) {
        return { counts: {} as CountsData };
      }

      const response = await fetch(
        `/api/slides/${slideId}/submetrics/follow-up-counts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ definitionIds }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch follow-up counts");
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
    placeholderData: { counts: {} as CountsData }, // Provide empty data immediately on mount
  });

  // Update ref when data changes and notify subscribers (must be in useEffect to avoid setState during render)
  useEffect(() => {
    if (countsData?.counts) {
      countsDataRef.current = countsData.counts;
      dataUpdatedAtRef.current = dataUpdatedAt;
      // Mark as ready after first successful data load
      isReadyRef.current = true;
      // Notify all subscribers that data has changed
      subscribersRef.current.forEach((callback) => {
        callback();
      });
    }
  }, [countsData, dataUpdatedAt]);

  // Stable function to get isReady state
  const getIsReady = useCallback(() => isReadyRef.current, []);

  // Stable function to get dataUpdatedAt
  const getDataUpdatedAt = useCallback(() => dataUpdatedAtRef.current, []);

  // Subscribe function for useSyncExternalStore
  const subscribe = useCallback((callback: () => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  // Get snapshot for a specific definition - returns count
  const getSnapshotForDefinition = useCallback(
    (definitionId: string): number => {
      return countsDataRef.current[definitionId] ?? 0;
    },
    [],
  );

  // Stable getCount function that reads from ref (for backwards compatibility)
  const getCount = useCallback(
    (definitionId: string): number => {
      return getSnapshotForDefinition(definitionId);
    },
    [getSnapshotForDefinition],
  );

  // Value is stable - functions don't change (no isLoading dependency to avoid re-renders)
  const value = useMemo(
    () => ({
      getCount,
      subscribe,
      getSnapshotForDefinition,
      getIsReady,
      getDataUpdatedAt,
    }),
    [
      getCount,
      subscribe,
      getSnapshotForDefinition,
      getIsReady,
      getDataUpdatedAt,
    ],
  );

  return (
    <FollowUpCountsContext.Provider value={value}>
      {children}
    </FollowUpCountsContext.Provider>
  );
}

// Hook to invalidate follow-up counts after mutations
export function useInvalidateFollowUpCounts() {
  const queryClient = useQueryClient();

  const invalidateCounts = useCallback(
    (slideId: string) => {
      // Invalidate all follow-up counts for this slide with immediate refetch
      queryClient.invalidateQueries({
        queryKey: followUpCountsKeys.slide(slideId),
        refetchType: "active", // Only refetch if the query is currently being used
      });
    },
    [queryClient],
  );

  // Optimistic update for immediate UI feedback
  const updateCountOptimistically = useCallback(
    (slideId: string, definitionId: string, delta: number) => {
      // Get all matching queries and update them optimistically
      queryClient.setQueriesData<{ counts: CountsData }>(
        { queryKey: followUpCountsKeys.slide(slideId) },
        (oldData) => {
          if (!oldData?.counts) return oldData;

          const currentCount = oldData.counts[definitionId] || 0;
          const newCount = Math.max(0, currentCount + delta);

          return {
            ...oldData,
            counts: {
              ...oldData.counts,
              [definitionId]: newCount,
            },
          };
        },
      );
    },
    [queryClient],
  );

  return { invalidateCounts, updateCountOptimistically };
}
