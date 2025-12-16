// Metric Definitions API client and hooks

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateMetricDefinitionInput } from "@/lib/validations/metric";
import type { MetricDefinition } from "@/types/db/metric-definition";
import { BaseApiClient } from "./base";
import { slideKeys } from "./slides";

export class MetricDefinitionApiClient extends BaseApiClient {
  async updateMetricDefinition(
    definitionId: string,
    data: UpdateMetricDefinitionInput,
  ): Promise<MetricDefinition> {
    const response = await this.request<{ definition: MetricDefinition }>(
      `/metric-definitions/${definitionId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
    return response.definition;
  }

  async getMetricDefinitionById(
    definitionId: string,
  ): Promise<MetricDefinition> {
    const response = await this.request<{ definition: MetricDefinition }>(
      `/metric-definitions/${definitionId}`,
    );
    return response.definition;
  }
}

// Default metric definition client instance
export const metricDefinitionApiClient = new MetricDefinitionApiClient();

// Query keys for React Query cache management
export const metricDefinitionKeys = {
  all: ["metricDefinitions"] as const,
  details: () => [...metricDefinitionKeys.all, "detail"] as const,
  detail: (id: string) => [...metricDefinitionKeys.details(), id] as const,
};

// Mutation hook for updating metric definition
export function useUpdateMetricDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      definitionId,
      data,
    }: {
      definitionId: string;
      data: UpdateMetricDefinitionInput;
    }) => metricDefinitionApiClient.updateMetricDefinition(definitionId, data),
    onSuccess: (updatedDefinition, variables) => {
      // Update the metric definition cache directly
      queryClient.setQueryData<MetricDefinition>(
        metricDefinitionKeys.detail(variables.definitionId),
        updatedDefinition,
      );

      // Invalidate all slides to reflect the updated definition
      // This ensures all slides using this metric definition show the updated value
      queryClient.invalidateQueries({
        queryKey: slideKeys.all,
        refetchType: "active",
      });
    },
  });
}
