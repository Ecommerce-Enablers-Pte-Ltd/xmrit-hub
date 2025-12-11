/**
 * Submetric-related database entity types
 */

export interface DataPointJson {
  timestamp: string; // ISO date string
  value: number;
  confidence?: number | null;
  source?: string | null;
  dimensions?: Record<string, unknown> | null;
}

export interface SubmetricDefinition {
  id: string;
  workspaceId: string;
  metricKey: string;
  submetricKey: string;
  category: string | null; // dimension/segment (e.g., "Adidas", "North America")
  metricName: string | null; // the actual metric name (e.g., "% of MCB Count")
  xaxis: string | null; // X-axis semantic label (e.g., "period", "tracked_week", "transaction_touched_at")
  yaxis: string | null; // Y-axis semantic label / unit (e.g., "hours", "% of MCB", "complaints")
  unit: string | null; // Unit of measurement (%, $, count) - often same as yaxis
  preferredTrend: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TrafficLightColor = "green" | "yellow" | "red";

export interface Submetric {
  id: string;
  metricId: string;
  definitionId: string | null;
  timezone: string | null;
  aggregationType: string | null;
  color: string | null;
  trafficLightColor: TrafficLightColor | null; // Slide-specific traffic light status
  metadata: any; // JSON object for additional metadata
  dataPoints: DataPointJson[] | null; // Data points stored as JSON array
  createdAt: Date;
  updatedAt: Date;
  // Computed/joined fields from definition (populated via relations)
  definition?: SubmetricDefinition | null;
}
