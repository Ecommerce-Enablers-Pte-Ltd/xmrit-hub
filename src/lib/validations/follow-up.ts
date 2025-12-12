/**
 * Zod validation schemas for follow-up operations
 */

import { z } from "zod";

/**
 * Helper to create an optional UUID field that treats empty strings as undefined
 */
const optionalUuidField = (message: string) =>
  z
    .string()
    .transform((val) => (val === "" ? undefined : val))
    .optional()
    .refine(
      (val) => val === undefined || z.string().uuid().safeParse(val).success,
      {
        message,
      },
    );

/**
 * Helper to create an optional comma-separated UUID field that treats empty strings as undefined
 * Validates that all values in the comma-separated list are valid UUIDs
 */
const optionalCommaSeparatedUuidField = (message: string) =>
  z
    .string()
    .transform((val) => (val === "" ? undefined : val))
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        const ids = val.split(",").filter(Boolean);
        return ids.every((id) => z.string().uuid().safeParse(id).success);
      },
      {
        message,
      },
    );

/**
 * Helper to create an optional date field that treats empty strings as undefined
 */
const optionalDateField = (pattern: RegExp, message: string) =>
  z
    .string()
    .transform((val) => (val === "" ? undefined : val))
    .optional()
    .refine((val) => val === undefined || pattern.test(val), {
      message,
    });

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
  slideId: optionalUuidField("Invalid slide ID format"),
  submetricDefinitionId: optionalUuidField(
    "Invalid submetric definition ID format",
  ),
  threadId: optionalUuidField("Invalid thread ID format"),
  status: z
    .enum(["todo", "in_progress", "done", "cancelled", "resolved"])
    .default("todo"),
  priority: z
    .enum(["no_priority", "urgent", "high", "medium", "low"])
    .default("no_priority"),
  assigneeIds: z.array(z.string().uuid("Invalid user ID format")).optional(),
  dueDate: optionalDateField(
    /^\d{4}-\d{2}-\d{2}$/,
    "Due date must be in YYYY-MM-DD format",
  ),
  workspaceId: optionalUuidField("Invalid workspace ID format"),
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
  slideId: optionalUuidField("Invalid slide ID format"),
  submetricDefinitionId: optionalUuidField(
    "Invalid submetric definition ID format",
  ),
  threadId: optionalUuidField("Invalid thread ID format"),
  resolvedAtSlideId: z
    .string()
    .transform((val) => (val === "" ? null : val))
    .nullable()
    .optional()
    .refine(
      (val) =>
        val === undefined ||
        val === null ||
        z.string().uuid().safeParse(val).success,
      {
        message: "Invalid slide ID format",
      },
    ),
  status: z
    .enum(["todo", "in_progress", "done", "cancelled", "resolved"])
    .optional(),
  priority: z
    .enum(["no_priority", "urgent", "high", "medium", "low"])
    .optional(),
  assigneeIds: z.array(z.string().uuid("Invalid user ID format")).optional(),
  dueDate: optionalDateField(
    /^\d{4}-\d{2}-\d{2}$/,
    "Due date must be in YYYY-MM-DD format",
  ),
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
    .enum(["todo", "in_progress", "done", "cancelled", "resolved"])
    .optional(),
  priority: z
    .enum(["no_priority", "urgent", "high", "medium", "low"])
    .optional(),
  assigneeId: optionalCommaSeparatedUuidField("Invalid user ID format"),
  slideId: optionalUuidField("Invalid slide ID format"),
  submetricDefinitionId: optionalUuidField(
    "Invalid submetric definition ID format",
  ),
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
