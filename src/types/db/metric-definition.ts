/**
 * Metric Definition-related database entity types
 */

export interface MetricDefinition {
  id: string;
  workspaceId: string;
  metricKey: string;
  definition: string | null;
  createdAt: Date;
  updatedAt: Date;
}
