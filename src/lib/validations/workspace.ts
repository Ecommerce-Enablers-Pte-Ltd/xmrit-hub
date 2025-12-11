/**
 * Zod validation schemas for workspace operations
 */

import { z } from "zod";
import { normalizeSlug, SLUG_REGEX } from "@/lib/utils";

/**
 * Schema for creating a new workspace.
 * Note: slug is normalized to lowercase during validation for consistent storage.
 */
export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(100, "Workspace name must be less than 100 characters")
    .default("Untitled Workspace"),
  slug: z
    .string()
    .min(1, "Slug must be at least 1 character")
    .max(50, "Slug must be less than 50 characters")
    .transform((val) => normalizeSlug(val))
    .refine((val) => SLUG_REGEX.test(val), {
      message:
        "Slug must start with a letter and contain only lowercase letters, numbers, and hyphens",
    }),
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
 * Note: slug is intentionally excluded as it cannot be changed after creation
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

/**
 * Schema for workspace slug parameter (used in URL routing).
 * Normalizes to lowercase and validates format.
 */
export const workspaceSlugSchema = z.object({
  workspaceSlug: z
    .string()
    .min(1, "Invalid workspace slug")
    .max(50, "Invalid workspace slug")
    .transform((val) => normalizeSlug(val))
    .refine((val) => SLUG_REGEX.test(val), {
      message: "Invalid workspace slug",
    }),
});

// Type exports for use in components and API routes
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type WorkspaceIdParams = z.infer<typeof workspaceIdSchema>;
export type WorkspaceSlugParams = z.infer<typeof workspaceSlugSchema>;
