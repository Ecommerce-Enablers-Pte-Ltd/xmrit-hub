/**
 * Zod validation schemas for slide operations
 */

import { z } from "zod";

/**
 * Schema for creating a new slide
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

// Type exports for use in components and API routes
export type CreateSlideInput = z.infer<typeof createSlideSchema>;
export type UpdateSlideInput = z.infer<typeof updateSlideSchema>;
export type UpdateSlideTitleInput = z.infer<typeof updateSlideTitleSchema>;
export type SlideIdParams = z.infer<typeof slideIdSchema>;
