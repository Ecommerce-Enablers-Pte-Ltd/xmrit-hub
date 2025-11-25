/**
 * Metric-related database entity types
 */

import type { MetricDefinition } from "@/types/db/metric-definition";
import type { Submetric } from "@/types/db/submetric";

export interface Metric {
  id: string;
  name: string;
  slideId: string;
  definitionId: string | null;
  ranking: number | null; // Optional ranking: 1 = top, 2 = second, etc.
  chartType: string | null;
  chartConfig: any; // JSON object for chart configuration
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Extended metric type with definition relation
 */
export interface MetricWithDefinition extends Metric {
  definition?: MetricDefinition | null;
}

/**
 * Extended metric type with related submetrics (with embedded data points)
 */
export interface MetricWithSubmetrics extends Metric {
  submetrics: Submetric[];
  definition?: MetricDefinition | null;
}
