// Metrics API client and hooks

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateMetricInput } from "@/lib/validations/metric";
import type { Metric } from "@/types/db/metric";
import { BaseApiClient } from "./base";
import { slideKeys } from "./slides";

// Input type for creating a metric (name is required)
export interface CreateMetricInput {
  name: string;
  definition?: string | null;
  ranking?: number | null;
}

export class MetricApiClient extends BaseApiClient {
  async createMetric(
    slideId: string,
    data: CreateMetricInput,
  ): Promise<Metric> {
    return this.request(`/slides/${slideId}/metrics`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateMetric(
    metricId: string,
    data: UpdateMetricInput,
  ): Promise<Metric> {
    const response = await this.request<{ metric: Metric }>(
      `/metrics/${metricId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
    return response.metric;
  }

  async deleteMetric(metricId: string): Promise<void> {
    return this.request(`/metrics/${metricId}`, {
      method: "DELETE",
    });
  }

  async getMetricById(metricId: string): Promise<Metric> {
    const response = await this.request<{ metric: Metric }>(
      `/metrics/${metricId}`,
    );
    return response.metric;
  }
}

// Default metric client instance
export const metricApiClient = new MetricApiClient();

// Query keys for React Query cache management
export const metricKeys = {
  all: ["metrics"] as const,
  lists: () => [...metricKeys.all, "list"] as const,
  list: (slideId?: string) =>
    slideId ? ([...metricKeys.lists(), slideId] as const) : metricKeys.lists(),
  details: () => [...metricKeys.all, "detail"] as const,
  detail: (id: string) => [...metricKeys.details(), id] as const,
};

// React Query hooks for metric data fetching
export function useMetric(metricId: string) {
  const query = useQuery({
    queryKey: metricKeys.detail(metricId),
    queryFn: () => metricApiClient.getMetricById(metricId),
    enabled: !!metricId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    metric: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

// Mutation hook for updating metric
export function useUpdateMetric() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      metricId,
      data,
    }: {
      metricId: string;
      data: UpdateMetricInput;
    }) => metricApiClient.updateMetric(metricId, data),
    onSuccess: (updatedMetric, variables) => {
      // Update the metric cache directly
      queryClient.setQueryData<Metric>(
        metricKeys.detail(variables.metricId),
        updatedMetric,
      );

      // Find which slide this metric belongs to and invalidate its cache
      // This ensures the slide view reflects the updated metric
      queryClient.invalidateQueries({
        queryKey: slideKeys.all,
        refetchType: "active",
      });
    },
  });
}
