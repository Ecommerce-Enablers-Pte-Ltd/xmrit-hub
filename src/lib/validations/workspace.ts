/**
 * Zod validation schemas for workspace operations
 */

import { z } from "zod";

/**
 * Schema for creating a new workspace
 */
export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(100, "Workspace name must be less than 100 characters")
    .default("Untitled Workspace"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .nullable()
    .optional(),
  settings: z.record(z.string(), z.any()).nullable().optional(),
  isArchived: z.boolean().default(false),
  isPublic: z.boolean().default(true),
});

/**
 * Schema for updating an existing workspace
 */
export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(100, "Workspace name must be less than 100 characters")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .nullable()
    .optional(),
  settings: z.record(z.string(), z.any()).nullable().optional(),
  isArchived: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

/**
 * Schema for workspace ID parameter
 */
export const workspaceIdSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
});

// Type exports for use in components and API routes
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type WorkspaceIdParams = z.infer<typeof workspaceIdSchema>;
