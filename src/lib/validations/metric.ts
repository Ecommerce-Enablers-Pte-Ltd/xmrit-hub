/**
 * Zod validation schemas for metric operations
 */

import { z } from "zod";

/**
 * Schema for updating metric definition
 */
export const updateMetricDefinitionSchema = z.object({
  definition: z
    .string()
    .max(5000, "Definition must be less than 5000 characters")
    .nullable()
    .optional(),
});

/**
 * Schema for updating a metric
 */
export const updateMetricSchema = z.object({
  name: z
    .string()
    .min(1, "Metric name is required")
    .max(200, "Metric name must be less than 200 characters")
    .optional(),
  definition: z
    .string()
    .max(5000, "Definition must be less than 5000 characters")
    .nullable()
    .optional(),
  sortOrder: z.number().int().nonnegative().nullable().optional(),
  ranking: z.number().int().positive().nullable().optional(),
  chartType: z.string().nullable().optional(),
  chartConfig: z.record(z.string(), z.any()).nullable().optional(),
});

/**
 * Schema for metric ID parameter
 */
export const metricIdSchema = z.object({
  metricId: z.string().uuid("Invalid metric ID format"),
});

// Type exports for use in components and API routes
export type UpdateMetricDefinitionInput = z.infer<
  typeof updateMetricDefinitionSchema
>;
export type UpdateMetricInput = z.infer<typeof updateMetricSchema>;
export type MetricIdParams = z.infer<typeof metricIdSchema>;
