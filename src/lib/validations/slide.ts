/**
 * Zod validation schemas for slide operations
 */

import { z } from "zod";
import { normalizeSlug } from "@/lib/utils";

/**
 * Regex for valid slide slugs: {number}-{title-slug}
 * Examples: "1-my-slide", "42-q4-revenue-report", "1" (number only is also valid)
 */
export const SLIDE_SLUG_REGEX = /^\d+(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

/**
 * Schema for creating a new slide
 * Note: slideNumber is server-assigned (not client-provided)
 */
export const createSlideSchema = z.object({
  title: z
    .string()
    .min(1, "Slide title is required")
    .max(200, "Slide title must be less than 200 characters"),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .nullable()
    .optional(),
  slideDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Slide date must be in YYYY-MM-DD format")
    .nullable()
    .optional(),
});

/**
 * Schema for updating an existing slide
 * Note: slideNumber cannot be changed after creation
 */
export const updateSlideSchema = z.object({
  title: z
    .string()
    .min(1, "Slide title is required")
    .max(200, "Slide title must be less than 200 characters")
    .optional(),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .nullable()
    .optional(),
  slideDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Slide date must be in YYYY-MM-DD format")
    .nullable()
    .optional(),
});

/**
 * Schema specifically for editing slide title
 */
export const updateSlideTitleSchema = z.object({
  title: z
    .string()
    .min(1, "Slide title cannot be empty")
    .max(200, "Slide title must be less than 200 characters")
    .trim(),
});

/**
 * Schema for slide ID parameter
 */
export const slideIdSchema = z.object({
  slideId: z.string().uuid("Invalid slide ID format"),
});

/**
 * Schema for slide number parameter (used in URL routing)
 * Validates and extracts the numeric portion from a slug like "1-slide-title"
 */
export const slideNumberSchema = z.object({
  slideNumber: z.coerce
    .number()
    .int("Slide number must be an integer")
    .positive("Slide number must be positive"),
});

/**
 * Schema for slide slug parameter (used in URL routing).
 * Format: {number}-{title-slug} or just {number}
 * Examples: "1-my-slide", "42-q4-revenue-report", "1"
 * Normalizes to lowercase and validates format.
 */
export const slideSlugSchema = z.object({
  slideSlug: z
    .string()
    .min(1, "Invalid slide slug")
    .max(250, "Slide slug too long")
    .transform((val) => normalizeSlug(val))
    .refine((val) => SLIDE_SLUG_REGEX.test(val), {
      message: "Invalid slide slug format (expected: {number}-{title-slug})",
    }),
});

/**
 * Parses a slide slug (e.g., "1-my-slide-title") and extracts the slide number.
 * Returns null if the slug is invalid.
 * Note: Use slideSlugSchema.safeParse() first to validate the slug format.
 */
export function parseSlideSlug(slug: string): number | null {
  const normalized = normalizeSlug(slug);

  // Validate format first
  if (!SLIDE_SLUG_REGEX.test(normalized)) {
    return null;
  }

  const match = normalized.match(/^(\d+)(?:-|$)/);
  if (!match) return null;
  const num = Number.parseInt(match[1], 10);
  return Number.isNaN(num) || num < 1 ? null : num;
}

// Type exports for use in components and API routes
export type CreateSlideInput = z.infer<typeof createSlideSchema>;
export type UpdateSlideInput = z.infer<typeof updateSlideSchema>;
export type UpdateSlideTitleInput = z.infer<typeof updateSlideTitleSchema>;
export type SlideIdParams = z.infer<typeof slideIdSchema>;
export type SlideNumberParams = z.infer<typeof slideNumberSchema>;
export type SlideSlugParams = z.infer<typeof slideSlugSchema>;
