/**
 * Zod validation schemas for follow-up operations
 */

import { z } from "zod";

/**
 * Schema for creating a new follow-up
 */
export const createFollowUpSchema = z.object({
  title: z
    .string()
    .min(1, "Follow-up title is required")
    .max(200, "Follow-up title must be less than 200 characters")
    .trim(),
  description: z
    .string()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
  slideId: z.string().uuid("Invalid slide ID format").optional(),
  submetricDefinitionId: z
    .string()
    .uuid("Invalid submetric definition ID format")
    .optional(),
  threadId: z.string().uuid("Invalid thread ID format").optional(),
  status: z
    .enum(["backlog", "todo", "in_progress", "done", "cancelled"])
    .default("backlog"),
  priority: z
    .enum(["no_priority", "urgent", "high", "medium", "low"])
    .default("no_priority"),
  assigneeIds: z.array(z.string().uuid("Invalid user ID format")).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format")
    .optional(),
  workspaceId: z.string().uuid("Invalid workspace ID format").optional(),
});

/**
 * Schema for updating an existing follow-up
 */
export const updateFollowUpSchema = z.object({
  title: z
    .string()
    .min(1, "Follow-up title is required")
    .max(200, "Follow-up title must be less than 200 characters")
    .trim()
    .optional(),
  description: z
    .string()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
  slideId: z.string().uuid("Invalid slide ID format").optional(),
  submetricDefinitionId: z
    .string()
    .uuid("Invalid submetric definition ID format")
    .optional(),
  threadId: z.string().uuid("Invalid thread ID format").optional(),
  resolvedAtSlideId: z
    .string()
    .uuid("Invalid slide ID format")
    .nullable()
    .optional(),
  status: z
    .enum(["backlog", "todo", "in_progress", "done", "cancelled"])
    .optional(),
  priority: z
    .enum(["no_priority", "urgent", "high", "medium", "low"])
    .optional(),
  assigneeIds: z.array(z.string().uuid("Invalid user ID format")).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format")
    .optional(),
});

/**
 * Schema for follow-up ID parameter
 */
export const followUpIdSchema = z.object({
  followUpId: z.string().uuid("Invalid follow-up ID format"),
});

/**
 * Schema for follow-up query parameters (pagination, filtering, sorting)
 */
export const followUpQuerySchema = z.object({
  // Pagination
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),

  // Sorting
  sortBy: z
    .enum([
      "createdAt",
      "updatedAt",
      "title",
      "status",
      "priority",
      "dueDate",
      "identifier",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),

  // Filtering
  status: z
    .enum(["backlog", "todo", "in_progress", "done", "cancelled"])
    .optional(),
  priority: z
    .enum(["no_priority", "urgent", "high", "medium", "low"])
    .optional(),
  assigneeId: z.string().uuid("Invalid user ID format").optional(),
  slideId: z.string().uuid("Invalid slide ID format").optional(),
  submetricDefinitionId: z
    .string()
    .uuid("Invalid submetric definition ID format")
    .optional(),
  search: z.string().max(200).optional(),

  // Special filters
  unassigned: z.coerce.boolean().optional(),
  overdue: z.coerce.boolean().optional(),
});

// Type exports for use in components and API routes
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;
export type FollowUpIdParams = z.infer<typeof followUpIdSchema>;
export type FollowUpQueryParams = z.infer<typeof followUpQuerySchema>;
