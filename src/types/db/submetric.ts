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
  label: string | null;
  unit: string | null;
  preferredTrend: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Submetric {
  id: string;
  label: string;
  category: string | null;
  metricId: string;
  definitionId: string | null;
  xAxis: string;
  yAxis: string | null;
  timezone: string | null;
  preferredTrend: string | null;
  unit: string | null;
  aggregationType: string | null;
  color: string | null;
  metadata: any; // JSON object for additional metadata
  dataPoints: DataPointJson[] | null; // Data points stored as JSON array
  createdAt: Date;
  updatedAt: Date;
}
